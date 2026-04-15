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

type RawSensorData = Partial<SensorData> & {
  id?: unknown;
  d?: unknown;
  n?: unknown;
  t?: unknown;
  h?: unknown;
  w?: unknown;
  fcl?: unknown;
  fct?: unknown;
  wpi?: unknown;
  wpm?: unknown;
  hf?: unknown;
  f?: unknown;
  fmo?: unknown;
  fmp?: unknown;
  fae?: unknown;
  fat?: unknown;
  ftr?: unknown;
  ts?: unknown;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeWaterPumpMode(value: unknown): SensorData['waterPumpMode'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto' || normalized === 'always_on' || normalized === 'always_off') {
    return normalized;
  }

  return undefined;
}

function asNonNegativeNumber(value: unknown): number | null {
  const parsed = asFiniteNumber(value);
  if (parsed == null) {
    return null;
  }

  return Math.max(0, parsed);
}

function toTrendPoint(snapshot: DataSnapshot): SensorTrendPoint {
  const value = snapshot.val() as RawSensorData | null;
  const temperature = asFiniteNumber(value?.temperature) ?? asFiniteNumber(value?.t);
  const humidity = asFiniteNumber(value?.humidity) ?? asFiniteNumber(value?.h);
  const timestamp = asFiniteNumber(value?.timestamp) ?? asFiniteNumber(value?.ts) ?? 0;

  return {
    timestamp,
    temperature,
    humidity,
  };
}

function normalizeSensorData(value: SensorData | null): SensorData | null {
  if (!value) {
    return null;
  }

  const raw = value as RawSensorData;

  const distance = asFiniteNumber(raw.distance) ?? asFiniteNumber(raw.d);
  const noEcho = asBooleanOrNull(raw.noEcho) ?? asBooleanOrNull(raw.n) ?? false;
  const temperature = asFiniteNumber(raw.temperature) ?? asFiniteNumber(raw.t);
  const humidity = asFiniteNumber(raw.humidity) ?? asFiniteNumber(raw.h);
  const weight = asNonNegativeNumber(raw.weight) ?? asNonNegativeNumber(raw.w);
  const foodConsumedLastG = asNonNegativeNumber(raw.foodConsumedLastG) ?? asNonNegativeNumber(raw.fcl);
  const foodConsumedTotalG = asNonNegativeNumber(raw.foodConsumedTotalG) ?? asNonNegativeNumber(raw.fct);
  const waterPumpIntervalMinRaw = asFiniteNumber(raw.waterPumpIntervalMin) ?? asFiniteNumber(raw.wpi);
  const waterPumpIntervalMin = waterPumpIntervalMinRaw == null
    ? undefined
    : Math.max(15, Math.min(30, Math.round(waterPumpIntervalMinRaw / 5) * 5));
  const waterPumpMode = normalizeWaterPumpMode(raw.waterPumpMode) ?? normalizeWaterPumpMode(raw.wpm);
  const hasFood = asBooleanOrNull(raw.hasFood) ?? asBooleanOrNull(raw.hf) ?? false;
  const fanSpeed = asFiniteNumber(raw.fanSpeed) ?? asFiniteNumber(raw.f);
  const fanManualOn = asBooleanOrNull(raw.fanManualOn) ?? asBooleanOrNull(raw.fmo);
  const fanManualPercent = asFiniteNumber(raw.fanManualPercent) ?? asFiniteNumber(raw.fmp);
  const fanAutoEnabled = asBooleanOrNull(raw.fanAutoEnabled) ?? asBooleanOrNull(raw.fae);
  const fanAutoThresholdC = asFiniteNumber(raw.fanAutoThresholdC) ?? asFiniteNumber(raw.fat);
  const fanAutoTriggered = asBooleanOrNull(raw.fanAutoTriggered) ?? asBooleanOrNull(raw.ftr);
  const timestamp = asFiniteNumber(raw.timestamp) ?? asFiniteNumber(raw.ts) ?? 0;

  return {
    deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : typeof raw.id === 'string' ? raw.id : 'unknown',
    distance,
    noEcho,
    temperature,
    humidity,
    weight,
    foodConsumedLastG: foodConsumedLastG ?? undefined,
    foodConsumedTotalG: foodConsumedTotalG ?? undefined,
    waterPumpIntervalMin,
    waterPumpMode,
    hasFood,
    fanSpeed: fanSpeed ?? undefined,
    fanManualOn: fanManualOn ?? undefined,
    fanManualPercent: fanManualPercent ?? undefined,
    fanAutoEnabled: fanAutoEnabled ?? undefined,
    fanAutoThresholdC: fanAutoThresholdC ?? undefined,
    fanAutoTriggered: fanAutoTriggered ?? undefined,
    timestamp,
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
