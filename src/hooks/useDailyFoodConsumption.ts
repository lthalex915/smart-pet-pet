import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, ref, set } from 'firebase/database';
import { db } from '../firebase';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';
import {
  legacyFeedingConsumptionPath,
  userFeedingConsumptionPath,
} from '../constants/dbPaths';

interface ConsumptionState {
  dateKey: string;
  todayConsumedG: number;
  lastWeightG: number | null;
}

interface RawConsumptionState {
  dateKey?: unknown;
  dayStartTotalG?: unknown;
  todayConsumedG?: unknown;
  lastWeightG?: unknown;
}

const FOOD_CONSUMED_DISTANCE_GATE_CM = 25;

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

function toNonNegativeRounded(value: number): number {
  return Number(Math.max(0, value).toFixed(1));
}

function normalizeState(value: unknown): ConsumptionState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as RawConsumptionState;
  const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey.trim() : '';
  const todayConsumedRaw = toFiniteNumber(raw.todayConsumedG);
  const lastWeightRaw = toFiniteNumber(raw.lastWeightG);

  if (!dateKey) {
    return null;
  }

  return {
    dateKey,
    todayConsumedG: toNonNegativeRounded(todayConsumedRaw ?? 0),
    lastWeightG: lastWeightRaw == null ? null : toNonNegativeRounded(lastWeightRaw),
  };
}

function getDateKeyInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

async function getSafe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export function useDailyFoodConsumption(
  uid: string | null | undefined,
  weightG: number | null | undefined,
  distanceCm: number | null | undefined,
  noEcho: boolean,
  timezone: string,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
) {
  const [todayConsumedG, setTodayConsumedG] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const userConsumptionRef = useMemo(
    () => (uid ? ref(db, userFeedingConsumptionPath(uid)) : null),
    [uid],
  );

  const legacyConsumptionRef = useMemo(
    () => ref(db, legacyFeedingConsumptionPath()),
    [],
  );

  const refresh = useCallback(async () => {
    const currentWeight = toFiniteNumber(weightG);
    const currentDistance = toFiniteNumber(distanceCm);
    const canCountConsumption = !noEcho
      && currentDistance != null
      && currentDistance >= 0
      && currentDistance <= FOOD_CONSUMED_DISTANCE_GATE_CM;

    if (currentWeight == null) {
      setTodayConsumedG(null);
      setLoading(false);
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    try {
      const dateKey = getDateKeyInTimezone(timezone || 'Asia/Hong_Kong');
      const currentWeightRounded = toNonNegativeRounded(currentWeight);

      const [userSnapshot, legacySnapshot] = await Promise.all([
        userConsumptionRef ? getSafe(get(userConsumptionRef)) : Promise.resolve(null),
        getSafe(get(legacyConsumptionRef)),
      ]);

      const source = userSnapshot?.exists()
        ? userSnapshot
        : legacySnapshot?.exists()
          ? legacySnapshot
          : userSnapshot ?? legacySnapshot ?? null;

      const stored = normalizeState(source?.val());

      const isSameDay = stored?.dateKey === dateKey;
      const previousWeight = isSameDay ? stored?.lastWeightG ?? null : null;
      let nextTodayConsumed = isSameDay ? stored?.todayConsumedG ?? 0 : 0;

      if (canCountConsumption && previousWeight != null && currentWeightRounded < previousWeight) {
        nextTodayConsumed += previousWeight - currentWeightRounded;
      }

      nextTodayConsumed = toNonNegativeRounded(nextTodayConsumed);

      const payload = {
        dateKey,
        todayConsumedG: nextTodayConsumed,
        lastWeightG: currentWeightRounded,
        timezone: timezone || 'Asia/Hong_Kong',
        updatedAt: Date.now(),
      };

      const shouldWrite = !isSameDay
        || previousWeight !== currentWeightRounded
        || Math.abs((stored?.todayConsumedG ?? 0) - nextTodayConsumed) > 0.0001;

      if (shouldWrite) {
        if (userConsumptionRef) {
          await set(userConsumptionRef, payload);
        } else {
          await set(legacyConsumptionRef, payload);
        }
      }

      setTodayConsumedG(nextTodayConsumed);
      setError(null);
    } catch (err: unknown) {
      setTodayConsumedG(null);
      setError(err instanceof Error ? err.message : '讀取本日食用量失敗');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [distanceCm, legacyConsumptionRef, noEcho, timezone, userConsumptionRef, weightG]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const safeInterval = Math.max(15_000, Math.min(60_000, pollIntervalMs));
    const timerId = window.setInterval(() => {
      void refresh();
    }, safeInterval);

    return () => {
      window.clearInterval(timerId);
    };
  }, [pollIntervalMs, refresh]);

  return {
    todayConsumedG,
    loading,
    error,
    refresh,
  };
}
