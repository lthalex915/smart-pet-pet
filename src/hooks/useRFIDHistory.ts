import { useEffect, useState } from 'react';
import { get, limitToLast, orderByChild, query, ref } from 'firebase/database';
import type { DataSnapshot, Query } from 'firebase/database';
import { db } from '../firebase';
import type { RFIDScan } from '../types/sensor';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';
import { legacyRFIDScansPath, userRFIDScansPath } from '../constants/dbPaths';

async function getSafe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export function useRFIDHistory(
  uid: string | null | undefined,
  limit = 30,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
) {
  const [scans, setScans] = useState<RFIDScan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!uid) {
      setScans([]);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const userQuery: Query = query(
      ref(db, userRFIDScansPath(uid)),
      orderByChild('timestamp'),
      limitToLast(limit),
    );

    const legacyQuery: Query = query(
      ref(db, legacyRFIDScansPath()),
      orderByChild('timestamp'),
      limitToLast(limit),
    );

    const parseScans = (snapshot: DataSnapshot): RFIDScan[] => {
      const items: RFIDScan[] = [];

      snapshot.forEach((child: DataSnapshot) => {
        const value = child.val() as Omit<RFIDScan, 'id'>;

        items.unshift({
          id: child.key as string,
          ...value,
        });
      });

      return items;
    };

    const fetchRFIDHistory = async () => {
      try {
        const [userSnapshot, legacySnapshot] = await Promise.all([
          getSafe(get(userQuery)),
          getSafe(get(legacyQuery)),
        ]);

        const snapshot =
          userSnapshot?.exists()
            ? userSnapshot
            : legacySnapshot?.exists()
              ? legacySnapshot
              : userSnapshot ?? legacySnapshot ?? null;
        if (!active) {
          return;
        }

        setScans(snapshot ? parseScans(snapshot) : []);
        setError(null);
      } catch (err: unknown) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : '讀取 RFID 紀錄失敗');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    void fetchRFIDHistory();

    const timerId = window.setInterval(() => {
      void fetchRFIDHistory();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [uid, limit, pollIntervalMs]);

  return { scans, loading, error };
}
