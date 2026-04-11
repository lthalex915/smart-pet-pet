import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_POLL_INTERVAL_MS,
  type PollIntervalMs,
  sanitizePollInterval,
} from '../constants/pollInterval';

const STORAGE_KEY_PREFIX = 'smartpet:poll-interval:';

function buildStorageKey(uid: string): string {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

export function useUserPollInterval(uid: string | null | undefined) {
  const [localOverride, setLocalOverride] = useState<{
    uid: string | null;
    value: PollIntervalMs;
  } | null>(null);

  const storedPollInterval = useMemo<PollIntervalMs>(() => {
    if (!uid) {
      return DEFAULT_POLL_INTERVAL_MS;
    }

    const key = buildStorageKey(uid);

    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue == null) {
        return DEFAULT_POLL_INTERVAL_MS;
      }

      return sanitizePollInterval(Number(storedValue));
    } catch {
      return DEFAULT_POLL_INTERVAL_MS;
    }
  }, [uid]);

  const pollIntervalMs =
    localOverride && localOverride.uid === (uid ?? null)
      ? localOverride.value
      : storedPollInterval;

  const setPollIntervalMs = useCallback(
    (nextValue: number) => {
      const safeValue = sanitizePollInterval(nextValue);

      if (!uid) {
        setLocalOverride({
          uid: null,
          value: safeValue,
        });
        return;
      }

      const key = buildStorageKey(uid);

      try {
        window.localStorage.setItem(key, String(safeValue));
      } catch {
        // ignore localStorage write errors
      }

      setLocalOverride({
        uid,
        value: safeValue,
      });
    },
    [uid],
  );

  return { pollIntervalMs, setPollIntervalMs };
}
