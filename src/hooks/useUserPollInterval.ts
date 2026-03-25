import { useCallback, useEffect, useState } from 'react';
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
  const [pollIntervalMs, setPollIntervalMsState] = useState<PollIntervalMs>(DEFAULT_POLL_INTERVAL_MS);

  useEffect(() => {
    if (!uid) {
      setPollIntervalMsState(DEFAULT_POLL_INTERVAL_MS);
      return;
    }

    const key = buildStorageKey(uid);

    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue == null) {
        setPollIntervalMsState(DEFAULT_POLL_INTERVAL_MS);
        return;
      }

      setPollIntervalMsState(sanitizePollInterval(Number(storedValue)));
    } catch {
      // ignore localStorage read errors
      setPollIntervalMsState(DEFAULT_POLL_INTERVAL_MS);
    }
  }, [uid]);

  const setPollIntervalMs = useCallback(
    (nextValue: number) => {
      const safeValue = sanitizePollInterval(nextValue);
      setPollIntervalMsState(safeValue);

      if (!uid) {
        return;
      }

      const key = buildStorageKey(uid);

      try {
        window.localStorage.setItem(key, String(safeValue));
      } catch {
        // ignore localStorage write errors
      }
    },
    [uid],
  );

  return { pollIntervalMs, setPollIntervalMs };
}
