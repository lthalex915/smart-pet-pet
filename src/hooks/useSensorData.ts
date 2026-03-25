// src/hooks/useSensorData.ts
import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import type { DatabaseReference } from 'firebase/database';
import { db } from '../firebase';
import type { SensorData } from '../types/sensor';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';

export function useSensorData(pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS) {
  const [data, setData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const sensorRef: DatabaseReference = ref(db, 'sensors/latest');

    const fetchSensorData = async () => {
      try {
        const snapshot = await get(sensorRef);
        if (!active) {
          return;
        }

        setData(snapshot.val() as SensorData | null);
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
  }, [pollIntervalMs]);

  return { data, loading, error };
}
