import { useEffect, useMemo, useState } from 'react';
import { get, limitToLast, orderByChild, query, ref } from 'firebase/database';
import type { DataSnapshot, Query } from 'firebase/database';
import { db } from '../firebase';
import type { SensorData, SensorTrendPoint } from '../types/sensor';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';
import {
  legacySensorsHistoryPath,
  legacySensorsLatestPath,
  userSensorsHistoryPath,
  userSensorsLatestPath,
} from '../constants/dbPaths';

function toTrendPoint(snapshot: DataSnapshot): SensorTrendPoint {
  const value = snapshot.val() as Partial<SensorData> | null;

  return {
    timestamp: Number(value?.timestamp ?? 0),
    temperature:
      typeof value?.temperature === 'number' && Number.isFinite(value.temperature)
        ? value.temperature
        : null,
    humidity:
      typeof value?.humidity === 'number' && Number.isFinite(value.humidity)
        ? value.humidity
        : null,
  };
}

function normalizeSensorData(value: SensorData | null): SensorData | null {
  if (!value) {
    return null;
  }

  return {
    deviceId: value.deviceId ?? 'unknown',
    distance: value.distance ?? null,
    noEcho: Boolean(value.noEcho),
    temperature: typeof value.temperature === 'number' ? value.temperature : null,
    humidity: typeof value.humidity === 'number' ? value.humidity : null,
    timestamp: Number(value.timestamp ?? 0),
  };
}

async function getSafe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export function useSensorData(
  uid: string | null | undefined,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
  trendLimit = 24,
) {
  const [data, setData] = useState<SensorData | null>(null);
  const [trend, setTrend] = useState<SensorTrendPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const sanitizedTrendLimit = useMemo(() => Math.max(4, Math.min(240, Math.floor(trendLimit))), [trendLimit]);

  useEffect(() => {
    let active = true;

    if (!uid) {
      setData(null);
      setTrend([]);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const userLatestRef = ref(db, userSensorsLatestPath(uid));
    const userHistoryQuery: Query = query(
      ref(db, userSensorsHistoryPath(uid)),
      orderByChild('timestamp'),
      limitToLast(sanitizedTrendLimit),
    );

    const legacyLatestRef = ref(db, legacySensorsLatestPath());
    const legacyHistoryQuery: Query = query(
      ref(db, legacySensorsHistoryPath()),
      orderByChild('timestamp'),
      limitToLast(sanitizedTrendLimit),
    );

    const fetchSensorData = async () => {
      try {
        const [userLatestSnapshot, userHistorySnapshot, legacyLatestSnapshot, legacyHistorySnapshot] =
          await Promise.all([
            getSafe(get(userLatestRef)),
            getSafe(get(userHistoryQuery)),
            getSafe(get(legacyLatestRef)),
            getSafe(get(legacyHistoryQuery)),
          ]);

        const latestSnapshot =
          userLatestSnapshot?.exists()
            ? userLatestSnapshot
            : legacyLatestSnapshot?.exists()
              ? legacyLatestSnapshot
              : userLatestSnapshot ?? legacyLatestSnapshot ?? null;

        const historySnapshot =
          userHistorySnapshot?.exists()
            ? userHistorySnapshot
            : legacyHistorySnapshot?.exists()
              ? legacyHistorySnapshot
              : userHistorySnapshot ?? legacyHistorySnapshot ?? null;

        if (!active) {
          return;
        }

        const latestValue = normalizeSensorData((latestSnapshot?.val() as SensorData | null) ?? null);

        setData(latestValue);

        const historyPoints: SensorTrendPoint[] = [];

        if (historySnapshot) {
          historySnapshot.forEach((child) => {
            const point = toTrendPoint(child);
            historyPoints.push(point);
          });
        }

        if (historyPoints.length === 0 && latestValue) {
          historyPoints.push({
            timestamp: latestValue.timestamp,
            temperature: latestValue.temperature,
            humidity: latestValue.humidity,
          });
        }

        setTrend(historyPoints.filter((point) => point.timestamp > 0));
        setError(null);
      } catch (err: unknown) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : '讀取感測器資料失敗');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    void fetchSensorData();

    const timerId = window.setInterval(() => {
      void fetchSensorData();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [uid, pollIntervalMs, sanitizedTrendLimit]);

  return { data, trend, loading, error };
}
