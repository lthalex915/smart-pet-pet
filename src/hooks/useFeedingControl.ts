import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  get,
  limitToLast,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import type { DataSnapshot, Query } from 'firebase/database';
import { db } from '../firebase';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';
import {
  legacyFeedingCommandPath,
  legacyFeedingSettingsPath,
  legacySensorsLatestPath,
  userFeedingCommandPath,
  userFeedingEventsPath,
  userFeedingRuntimePath,
  userFeedingScheduleTriggerPath,
  userFeedingSettingsPath,
  userSensorsLatestPath,
} from '../constants/dbPaths';
import type {
  FeedingEvent,
  FeedingRuntime,
  FeedingSettings,
  FeedingTriggerSource,
} from '../types/sensor';

const SCHEDULE_CHECK_INTERVAL_MS = 15_000;
const FEEDING_EVENT_LIMIT = 20;

export const DEFAULT_FEEDING_SETTINGS: FeedingSettings = {
  timezone: 'Asia/Hong_Kong',
  scheduleEnabled: true,
  scheduleTimes: ['08:00', '20:00'],
  motorRunMs: 1_000,
  weightDeltaThresholdG: 2,
  confirmationTimeoutMs: 4_500,
  retryDelayMs: 1_200,
  maxAttempts: 3,
};

const DEFAULT_FEEDING_RUNTIME: FeedingRuntime = {
  inProgress: false,
  requestGroupId: null,
  source: null,
  attempt: 0,
  maxAttempts: DEFAULT_FEEDING_SETTINGS.maxAttempts,
  lastStatus: 'idle',
  lastMessage: '尚未開始投餵流程',
  lastUpdatedAt: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastDeltaG: null,
  alert: false,
};

interface FeedingEventPayload {
  requestGroupId: string;
  requestId: string;
  source: FeedingTriggerSource;
  attempt: number;
  type: FeedingEvent['type'];
  message: string;
  scheduleTime?: string;
  scheduleKey?: string;
  weightBefore?: number | null;
  weightAfter?: number | null;
  delta?: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeScheduleTime(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeScheduleTimes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_FEEDING_SETTINGS.scheduleTimes;
  }

  const normalized = value
    .map((item) => (typeof item === 'string' ? normalizeScheduleTime(item) : null))
    .filter((item): item is string => item != null);

  if (normalized.length === 0) {
    return DEFAULT_FEEDING_SETTINGS.scheduleTimes;
  }

  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
}

function normalizeTimezone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_FEEDING_SETTINGS.timezone;
  }

  const candidate = value.trim();

  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_FEEDING_SETTINGS.timezone;
  }
}

function normalizeFeedingSettings(value: Partial<FeedingSettings> | null | undefined): FeedingSettings {
  const motorRunMs = typeof value?.motorRunMs === 'number'
    ? value.motorRunMs
    : DEFAULT_FEEDING_SETTINGS.motorRunMs;

  const weightDeltaThresholdG = typeof value?.weightDeltaThresholdG === 'number'
    ? value.weightDeltaThresholdG
    : DEFAULT_FEEDING_SETTINGS.weightDeltaThresholdG;

  const confirmationTimeoutMs = typeof value?.confirmationTimeoutMs === 'number'
    ? value.confirmationTimeoutMs
    : DEFAULT_FEEDING_SETTINGS.confirmationTimeoutMs;

  const retryDelayMs = typeof value?.retryDelayMs === 'number'
    ? value.retryDelayMs
    : DEFAULT_FEEDING_SETTINGS.retryDelayMs;

  const maxAttempts = typeof value?.maxAttempts === 'number'
    ? value.maxAttempts
    : DEFAULT_FEEDING_SETTINGS.maxAttempts;

  return {
    timezone: normalizeTimezone(value?.timezone),
    scheduleEnabled:
      typeof value?.scheduleEnabled === 'boolean'
        ? value.scheduleEnabled
        : DEFAULT_FEEDING_SETTINGS.scheduleEnabled,
    scheduleTimes: normalizeScheduleTimes(value?.scheduleTimes),
    motorRunMs: clampInt(motorRunMs, 300, 5_000),
    weightDeltaThresholdG: Number(clampFloat(weightDeltaThresholdG, 0.5, 50).toFixed(1)),
    confirmationTimeoutMs: clampInt(confirmationTimeoutMs, 1_000, 20_000),
    retryDelayMs: clampInt(retryDelayMs, 400, 10_000),
    maxAttempts: clampInt(maxAttempts, 1, 5),
  };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeFeedingRuntime(value: Partial<FeedingRuntime> | null | undefined): FeedingRuntime {
  if (!value) {
    return DEFAULT_FEEDING_RUNTIME;
  }

  const source = value.source;

  return {
    inProgress: Boolean(value.inProgress),
    requestGroupId:
      typeof value.requestGroupId === 'string' && value.requestGroupId.trim()
        ? value.requestGroupId
        : null,
    source:
      source === 'manual' || source === 'schedule' || source === 'retry'
        ? source
        : null,
    attempt: typeof value.attempt === 'number' && Number.isFinite(value.attempt) ? Math.max(0, Math.floor(value.attempt)) : 0,
    maxAttempts:
      typeof value.maxAttempts === 'number' && Number.isFinite(value.maxAttempts)
        ? clampInt(value.maxAttempts, 1, 5)
        : DEFAULT_FEEDING_SETTINGS.maxAttempts,
    lastStatus:
      value.lastStatus === 'in_progress' || value.lastStatus === 'success' || value.lastStatus === 'failed' || value.lastStatus === 'idle'
        ? value.lastStatus
        : 'idle',
    lastMessage:
      typeof value.lastMessage === 'string' && value.lastMessage.trim()
        ? value.lastMessage
        : DEFAULT_FEEDING_RUNTIME.lastMessage,
    lastUpdatedAt: typeof value.lastUpdatedAt === 'number' ? value.lastUpdatedAt : 0,
    lastSuccessAt: toFiniteNumber(value.lastSuccessAt),
    lastFailureAt: toFiniteNumber(value.lastFailureAt),
    lastDeltaG: toFiniteNumber(value.lastDeltaG),
    alert: Boolean(value.alert),
  };
}

function pruneUndefined(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function makeRequestGroupId(): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${randomPart}`;
}

function sanitizeFirebaseKey(value: string): string {
  return value.replace(/[.#$[\]/]/g, '_');
}

function getZonedDateParts(timezone: string): { dateKey: string; timeKey: string } | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(new Date());
    const getValue = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

    const year = getValue('year');
    const month = getValue('month');
    const day = getValue('day');
    const hour = getValue('hour');
    const minute = getValue('minute');

    if (!year || !month || !day || !hour || !minute) {
      return null;
    }

    return {
      dateKey: `${year}-${month}-${day}`,
      timeKey: `${hour}:${minute}`,
    };
  } catch {
    return null;
  }
}

async function getSafe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

async function fetchLatestWeight(uid: string): Promise<number | null> {
  const [userSnapshot, legacySnapshot] = await Promise.all([
    getSafe(get(ref(db, userSensorsLatestPath(uid)))),
    getSafe(get(ref(db, legacySensorsLatestPath()))),
  ]);

  const source = userSnapshot?.exists()
    ? userSnapshot
    : legacySnapshot?.exists()
      ? legacySnapshot
      : userSnapshot ?? legacySnapshot ?? null;

  if (!source) {
    return null;
  }

  const value = source.val() as { weight?: unknown; w?: unknown } | null;
  const weight = typeof value?.weight === 'number' ? value.weight : value?.w;

  return typeof weight === 'number' && Number.isFinite(weight)
    ? Number(weight.toFixed(1))
    : null;
}

function parseFeedingEvents(snapshot: DataSnapshot): FeedingEvent[] {
  const items: FeedingEvent[] = [];

  snapshot.forEach((child) => {
    const value = child.val() as Partial<FeedingEvent> | null;
    const id = child.key;

    if (!id || !value) {
      return;
    }

    const source = value.source;
    if (source !== 'manual' && source !== 'schedule' && source !== 'retry') {
      return;
    }

    const type = value.type;
    if (type !== 'requested' && type !== 'retrying' && type !== 'success' && type !== 'failed') {
      return;
    }

    items.unshift({
      id,
      requestGroupId: typeof value.requestGroupId === 'string' ? value.requestGroupId : id,
      requestId: typeof value.requestId === 'string' ? value.requestId : id,
      source,
      attempt: typeof value.attempt === 'number' ? Math.max(1, Math.floor(value.attempt)) : 1,
      type,
      message: typeof value.message === 'string' ? value.message : '',
      scheduleTime: typeof value.scheduleTime === 'string' ? value.scheduleTime : null,
      scheduleKey: typeof value.scheduleKey === 'string' ? value.scheduleKey : null,
      weightBefore: toFiniteNumber(value.weightBefore),
      weightAfter: toFiniteNumber(value.weightAfter),
      delta: toFiniteNumber(value.delta),
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    });
  });

  return items;
}

export function useFeedingControl(
  uid: string | null | undefined,
  latestWeightInput: number | null | undefined,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
) {
  const [settings, setSettings] = useState<FeedingSettings>(DEFAULT_FEEDING_SETTINGS);
  const [runtime, setRuntime] = useState<FeedingRuntime>(DEFAULT_FEEDING_RUNTIME);
  const [events, setEvents] = useState<FeedingEvent[]>([]);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [runtimeLoading, setRuntimeLoading] = useState<boolean>(true);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const latestWeightRef = useRef<number | null>(toFiniteNumber(latestWeightInput));
  const inFlightRef = useRef(false);

  useEffect(() => {
    latestWeightRef.current = toFiniteNumber(latestWeightInput);
  }, [latestWeightInput]);

  const userSettingsRef = useMemo(
    () => (uid ? ref(db, userFeedingSettingsPath(uid)) : null),
    [uid],
  );

  const legacySettingsRef = useMemo(
    () => ref(db, legacyFeedingSettingsPath()),
    [],
  );

  const userCommandRef = useMemo(
    () => (uid ? ref(db, userFeedingCommandPath(uid)) : null),
    [uid],
  );

  const legacyCommandRef = useMemo(
    () => ref(db, legacyFeedingCommandPath()),
    [],
  );

  const userRuntimeRef = useMemo(
    () => (uid ? ref(db, userFeedingRuntimePath(uid)) : null),
    [uid],
  );

  const userEventsQuery = useMemo<Query | null>(
    () => (uid
      ? query(
        ref(db, userFeedingEventsPath(uid)),
        orderByChild('createdAt'),
        limitToLast(FEEDING_EVENT_LIMIT),
      )
      : null),
    [uid],
  );

  const refreshSettings = useCallback(async () => {
    if (!uid || !userSettingsRef) {
      setSettings(DEFAULT_FEEDING_SETTINGS);
      setSettingsLoading(false);
      return;
    }

    setSettingsLoading(true);

    try {
      const [userSnapshot, legacySnapshot] = await Promise.all([
        getSafe(get(userSettingsRef)),
        getSafe(get(legacySettingsRef)),
      ]);

      const source = userSnapshot?.exists()
        ? userSnapshot
        : legacySnapshot?.exists()
          ? legacySnapshot
          : userSnapshot ?? legacySnapshot ?? null;

      const value = source?.val() as Partial<FeedingSettings> | null;
      setSettings(normalizeFeedingSettings(value));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '讀取投餵設定失敗');
    } finally {
      setSettingsLoading(false);
    }
  }, [legacySettingsRef, uid, userSettingsRef]);

  const refreshRuntime = useCallback(async () => {
    if (!uid || !userRuntimeRef) {
      setRuntime(DEFAULT_FEEDING_RUNTIME);
      setRuntimeLoading(false);
      return;
    }

    setRuntimeLoading(true);

    try {
      const snapshot = await get(userRuntimeRef);
      const value = snapshot.exists()
        ? (snapshot.val() as Partial<FeedingRuntime>)
        : null;
      setRuntime(normalizeFeedingRuntime(value));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '讀取投餵狀態失敗');
    } finally {
      setRuntimeLoading(false);
    }
  }, [uid, userRuntimeRef]);

  const refreshEvents = useCallback(async () => {
    if (!uid || !userEventsQuery) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);

    try {
      const snapshot = await get(userEventsQuery);
      setEvents(snapshot.exists() ? parseFeedingEvents(snapshot) : []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '讀取投餵紀錄失敗');
    } finally {
      setEventsLoading(false);
    }
  }, [uid, userEventsQuery]);

  useEffect(() => {
    void refreshSettings();

    const timerId = window.setInterval(() => {
      void refreshSettings();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [pollIntervalMs, refreshSettings]);

  useEffect(() => {
    void refreshRuntime();

    const timerId = window.setInterval(() => {
      void refreshRuntime();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [pollIntervalMs, refreshRuntime]);

  useEffect(() => {
    void refreshEvents();

    const timerId = window.setInterval(() => {
      void refreshEvents();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [pollIntervalMs, refreshEvents]);

  const saveSettings = useCallback(
    async (patch: Partial<FeedingSettings>) => {
      const nextSettings = normalizeFeedingSettings({
        ...settings,
        ...patch,
      });

      setSettingsSaving(true);

      try {
        const payload = {
          ...nextSettings,
          updatedAt: Date.now(),
        };

        let wroteAny = false;
        let firstError: unknown = null;

        if (userSettingsRef) {
          try {
            await set(userSettingsRef, payload);
            wroteAny = true;
          } catch (err: unknown) {
            firstError = firstError ?? err;
          }
        }

        try {
          await set(legacySettingsRef, payload);
          wroteAny = true;
        } catch (err: unknown) {
          firstError = firstError ?? err;
        }

        if (!wroteAny) {
          throw (firstError instanceof Error ? firstError : new Error('儲存投餵設定失敗'));
        }

        setSettings(nextSettings);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '儲存投餵設定失敗');
        throw err;
      } finally {
        setSettingsSaving(false);
      }
    },
    [legacySettingsRef, settings, userSettingsRef],
  );

  const appendEvent = useCallback(
    async (payload: FeedingEventPayload) => {
      if (!uid) {
        return;
      }

      const eventsRef = ref(db, userFeedingEventsPath(uid));
      const eventRef = push(eventsRef);
      const cleanPayload = pruneUndefined({
        ...payload,
        createdAt: Date.now(),
      });

      await set(eventRef, cleanPayload);
    },
    [uid],
  );

  const updateRuntimeState = useCallback(
    async (patch: Partial<FeedingRuntime>) => {
      const patchWithTimestamp = {
        ...patch,
        lastUpdatedAt: Date.now(),
      };

      setRuntime((prev) => normalizeFeedingRuntime({
        ...prev,
        ...patchWithTimestamp,
      }));

      if (!userRuntimeRef) {
        return;
      }

      await update(userRuntimeRef, pruneUndefined(patchWithTimestamp as Record<string, unknown>));
    },
    [userRuntimeRef],
  );

  const writeFeedingCommand = useCallback(
    async (payload: Record<string, unknown>) => {
      let wroteLegacy = false;
      let firstError: unknown = null;

      if (userCommandRef) {
        try {
          await set(userCommandRef, payload);
        } catch (err: unknown) {
          firstError = firstError ?? err;
        }
      }

      try {
        await set(legacyCommandRef, payload);
        wroteLegacy = true;
      } catch (err: unknown) {
        firstError = firstError ?? err;
      }

      if (!wroteLegacy) {
        throw (firstError instanceof Error ? firstError : new Error('寫入投餵命令失敗（legacy command path）'));
      }
    },
    [legacyCommandRef, userCommandRef],
  );

  const triggerFeed = useCallback(
    async (
      source: FeedingTriggerSource,
      context?: {
        scheduleTime?: string;
        scheduleKey?: string;
      },
    ): Promise<boolean> => {
      if (!uid) {
        throw new Error('使用者未登入，無法投餵');
      }

      if (inFlightRef.current) {
        return false;
      }

      inFlightRef.current = true;
      setTriggering(true);

      const requestGroupId = makeRequestGroupId();
      const maxAttempts = settings.maxAttempts;
      const threshold = settings.weightDeltaThresholdG;
      let baselineWeight = latestWeightRef.current;

      if (baselineWeight == null) {
        baselineWeight = await fetchLatestWeight(uid);
      }

      try {
        await updateRuntimeState({
          inProgress: true,
          requestGroupId,
          source,
          attempt: 0,
          maxAttempts,
          lastStatus: 'in_progress',
          lastMessage: '已送出投餵流程',
          lastFailureAt: null,
          alert: false,
        });

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const requestId = `${requestGroupId}-${attempt}`;

          const commandPayload = {
            action: 'dispenseOnce',
            requestGroupId,
            requestId,
            source: attempt === 1 ? source : 'retry',
            attempt,
            maxAttempts,
            motorRunMs: settings.motorRunMs,
            scheduleTime: context?.scheduleTime ?? null,
            scheduleKey: context?.scheduleKey ?? null,
            status: 'pending',
            issuedAt: Date.now(),
          };

          await writeFeedingCommand(commandPayload);

          const requestType = attempt === 1 ? 'requested' : 'retrying';
          await appendEvent({
            requestGroupId,
            requestId,
            source: commandPayload.source,
            attempt,
            type: requestType,
            message: attempt === 1
              ? '已發送一次馬達轉動指令'
              : `第 ${attempt} 次重試：再次發送馬達轉動指令`,
            scheduleTime: context?.scheduleTime,
            scheduleKey: context?.scheduleKey,
            weightBefore: baselineWeight,
          });

          await updateRuntimeState({
            inProgress: true,
            source: commandPayload.source,
            attempt,
            maxAttempts,
            lastStatus: 'in_progress',
            lastMessage: `投餵中（第 ${attempt}/${maxAttempts} 次）`,
            alert: false,
          });

          await sleep(settings.confirmationTimeoutMs);

          const weightAfter = await fetchLatestWeight(uid);
          const delta =
            baselineWeight != null && weightAfter != null
              ? Number((weightAfter - baselineWeight).toFixed(1))
              : null;

          const dropped = delta != null && delta >= threshold;

          if (dropped) {
            const successMessage = `已偵測重量增加 ${delta.toFixed(1)}g，投餵成功`;

            await appendEvent({
              requestGroupId,
              requestId,
              source: commandPayload.source,
              attempt,
              type: 'success',
              message: successMessage,
              scheduleTime: context?.scheduleTime,
              scheduleKey: context?.scheduleKey,
              weightBefore: baselineWeight,
              weightAfter,
              delta,
            });

            await updateRuntimeState({
              inProgress: false,
              requestGroupId,
              source: commandPayload.source,
              attempt,
              maxAttempts,
              lastStatus: 'success',
              lastMessage: successMessage,
              lastSuccessAt: Date.now(),
              lastDeltaG: delta,
              alert: false,
            });

            return true;
          }

          if (attempt < maxAttempts) {
            const retryReason = delta == null
              ? '未取得有效重量變化，準備重試'
              : `重量僅變化 ${delta.toFixed(1)}g，低於門檻 ${threshold.toFixed(1)}g，準備重試`;

            await updateRuntimeState({
              inProgress: true,
              requestGroupId,
              source: 'retry',
              attempt,
              maxAttempts,
              lastStatus: 'in_progress',
              lastMessage: retryReason,
              lastDeltaG: delta,
              alert: false,
            });

            baselineWeight = weightAfter ?? baselineWeight;
            await sleep(settings.retryDelayMs);
            continue;
          }

          const failedMessage = `已連續嘗試 ${maxAttempts} 次仍無重量變化，請檢查飼料容器`;

          await appendEvent({
            requestGroupId,
            requestId,
            source: commandPayload.source,
            attempt,
            type: 'failed',
            message: failedMessage,
            scheduleTime: context?.scheduleTime,
            scheduleKey: context?.scheduleKey,
            weightBefore: baselineWeight,
            weightAfter,
            delta,
          });

          await updateRuntimeState({
            inProgress: false,
            requestGroupId,
            source: commandPayload.source,
            attempt,
            maxAttempts,
            lastStatus: 'failed',
            lastMessage: failedMessage,
            lastFailureAt: Date.now(),
            lastDeltaG: delta,
            alert: true,
          });

          return false;
        }

        return false;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '投餵流程執行失敗';

        await updateRuntimeState({
          inProgress: false,
          requestGroupId,
          source,
          attempt: 0,
          maxAttempts,
          lastStatus: 'failed',
          lastMessage: message,
          lastFailureAt: Date.now(),
          alert: true,
        });

        setError(message);
        return false;
      } finally {
        inFlightRef.current = false;
        setTriggering(false);
      }
    },
    [appendEvent, settings, uid, updateRuntimeState, writeFeedingCommand],
  );

  const triggerManualFeed = useCallback(async () => {
    return triggerFeed('manual');
  }, [triggerFeed]);

  const clearAlert = useCallback(async () => {
    await updateRuntimeState({
      alert: false,
    });
  }, [updateRuntimeState]);

  const checkAndRunSchedule = useCallback(async () => {
    if (!uid || !settings.scheduleEnabled || settings.scheduleTimes.length === 0 || inFlightRef.current || runtime.inProgress) {
      return;
    }

    const now = getZonedDateParts(settings.timezone);
    if (!now) {
      return;
    }

    if (!settings.scheduleTimes.includes(now.timeKey)) {
      return;
    }

    const scheduleKeyRaw = `${now.dateKey}_${now.timeKey.replace(':', '-')}`;
    const scheduleKey = sanitizeFirebaseKey(scheduleKeyRaw);
    const triggerRef = ref(db, `${userFeedingScheduleTriggerPath(uid)}/${scheduleKey}`);

    const result = await runTransaction(
      triggerRef,
      (current) => {
        if (current != null) {
          return;
        }

        return Date.now();
      },
      { applyLocally: false },
    );

    if (!result.committed) {
      return;
    }

    await triggerFeed('schedule', {
      scheduleTime: now.timeKey,
      scheduleKey,
    });
  }, [runtime.inProgress, settings.scheduleEnabled, settings.scheduleTimes, settings.timezone, triggerFeed, uid]);

  useEffect(() => {
    if (!uid) {
      return;
    }

    void checkAndRunSchedule();

    const timerId = window.setInterval(() => {
      void checkAndRunSchedule();
    }, SCHEDULE_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [checkAndRunSchedule, uid]);

  return {
    settings,
    runtime,
    events,
    settingsLoading,
    runtimeLoading,
    eventsLoading,
    settingsSaving,
    triggering,
    error,
    refreshSettings,
    refreshRuntime,
    refreshEvents,
    saveSettings,
    triggerManualFeed,
    clearAlert,
  };
}
