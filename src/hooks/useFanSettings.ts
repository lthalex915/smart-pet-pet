import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, ref, set } from 'firebase/database';
import { db } from '../firebase';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';
import {
  legacyFanSettingsDeprecatedPath,
  legacyFanSettingsPath,
  userFanSettingsPath,
} from '../constants/dbPaths';
import type { FanSettings } from '../types/sensor';

export const DEFAULT_FAN_SETTINGS: FanSettings = {
  manualOn: false,
  manualPercent: 100,
  autoEnabled: true,
  autoThresholdC: 27,
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeFanSettings(value: Partial<FanSettings> | null | undefined): FanSettings {
  const manualOn = typeof value?.manualOn === 'boolean' ? value.manualOn : DEFAULT_FAN_SETTINGS.manualOn;

  const manualPercentRaw = typeof value?.manualPercent === 'number'
    ? value.manualPercent
    : DEFAULT_FAN_SETTINGS.manualPercent;

  const autoEnabled = typeof value?.autoEnabled === 'boolean'
    ? value.autoEnabled
    : DEFAULT_FAN_SETTINGS.autoEnabled;

  const autoThresholdRaw = typeof value?.autoThresholdC === 'number'
    ? value.autoThresholdC
    : DEFAULT_FAN_SETTINGS.autoThresholdC;

  return {
    manualOn,
    manualPercent: clampInt(manualPercentRaw, 0, 100),
    autoEnabled,
    autoThresholdC: Number(clampFloat(autoThresholdRaw, 15, 45).toFixed(1)),
  };
}

async function getSafe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export function useFanSettings(
  uid: string | null | undefined,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
) {
  const [settings, setSettings] = useState<FanSettings>(DEFAULT_FAN_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  const userSettingsRef = useMemo(
    () => (uid ? ref(db, userFanSettingsPath(uid)) : null),
    [uid],
  );

  const legacySettingsRef = useMemo(
    () => ref(db, legacyFanSettingsPath()),
    [],
  );

  const legacyDeprecatedSettingsRef = useMemo(
    () => ref(db, legacyFanSettingsDeprecatedPath()),
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (isMountedRef.current) {
      setLoading(true);
    }

    try {
      const [userSnapshot, legacySnapshot, legacyDeprecatedSnapshot] = await Promise.all([
        userSettingsRef ? getSafe(get(userSettingsRef)) : Promise.resolve(null),
        getSafe(get(legacySettingsRef)),
        getSafe(get(legacyDeprecatedSettingsRef)),
      ]);

      const selectedValue =
        userSnapshot?.exists()
          ? (userSnapshot.val() as Partial<FanSettings>)
          : legacySnapshot?.exists()
            ? (legacySnapshot.val() as Partial<FanSettings>)
            : legacyDeprecatedSnapshot?.exists()
              ? (legacyDeprecatedSnapshot.val() as Partial<FanSettings>)
              : null;

      if (!isMountedRef.current) {
        return;
      }

      setSettings(normalizeFanSettings(selectedValue));
      setError(null);
    } catch (err: unknown) {
      if (!isMountedRef.current) {
        return;
      }

      setError(err instanceof Error ? err.message : '讀取風扇設定失敗');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [legacyDeprecatedSettingsRef, legacySettingsRef, userSettingsRef]);

  useEffect(() => {
    void refresh();

    const timerId = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [pollIntervalMs, refresh]);

  const saveSettings = useCallback(
    async (patch: Partial<FanSettings>) => {
      const nextSettings = normalizeFanSettings({
        ...settings,
        ...patch,
      });

      setSaving(true);

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

        // Best-effort backward compatibility path. Ignore failures.
        try {
          await set(legacyDeprecatedSettingsRef, payload);
        } catch {
          // no-op
        }

        if (!wroteAny) {
          throw (firstError instanceof Error ? firstError : new Error('儲存風扇設定失敗'));
        }

        if (!isMountedRef.current) {
          return;
        }

        setSettings(nextSettings);
        setError(null);
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : '儲存風扇設定失敗');
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setSaving(false);
        }
      }
    },
    [legacyDeprecatedSettingsRef, legacySettingsRef, settings, userSettingsRef],
  );

  return {
    settings,
    loading,
    saving,
    error,
    refresh,
    saveSettings,
  };
}
