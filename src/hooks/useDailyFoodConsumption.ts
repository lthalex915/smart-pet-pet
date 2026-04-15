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
  dayStartTotalG: number;
}

interface RawConsumptionState {
  dateKey?: unknown;
  dayStartTotalG?: unknown;
}

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
  const dayStartTotalG = toFiniteNumber(raw.dayStartTotalG);

  if (!dateKey || dayStartTotalG == null) {
    return null;
  }

  return {
    dateKey,
    dayStartTotalG: toNonNegativeRounded(dayStartTotalG),
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
  totalConsumedG: number | null | undefined,
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
    const total = toFiniteNumber(totalConsumedG);

    if (total == null) {
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
      const totalRounded = toNonNegativeRounded(total);

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

      let dayStartTotal = stored?.dayStartTotalG ?? totalRounded;
      let shouldWrite = stored == null || stored.dateKey !== dateKey;

      if (totalRounded < dayStartTotal) {
        dayStartTotal = totalRounded;
        shouldWrite = true;
      }

      if (shouldWrite) {
        const payload = {
          dateKey,
          dayStartTotalG: dayStartTotal,
          timezone: timezone || 'Asia/Hong_Kong',
          updatedAt: Date.now(),
        };

        if (userConsumptionRef) {
          await set(userConsumptionRef, payload);
        } else {
          await set(legacyConsumptionRef, payload);
        }
      }

      const consumedToday = toNonNegativeRounded(totalRounded - dayStartTotal);
      setTodayConsumedG(consumedToday);
      setError(null);
    } catch (err: unknown) {
      const fallbackTotal = toFiniteNumber(totalConsumedG);
      setTodayConsumedG(fallbackTotal == null ? null : toNonNegativeRounded(fallbackTotal));
      setError(err instanceof Error ? err.message : '讀取本日食用量失敗');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [legacyConsumptionRef, timezone, totalConsumedG, userConsumptionRef]);

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
