// src/hooks/useRFIDHistory.ts
import { useEffect, useState } from 'react';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import type { DataSnapshot, Query } from 'firebase/database';
import { db } from '../firebase';
import type { RFIDScan } from '../types/sensor';
import { DEFAULT_POLL_INTERVAL_MS } from '../constants/pollInterval';

export function useRFIDHistory(limit = 30, pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS) {
  const [scans, setScans] = useState<RFIDScan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const q: Query = query(
      ref(db, 'rfidScans'),
      orderByChild('timestamp'),
      limitToLast(limit),
    );

    const fetchRFIDHistory = async () => {
      try {
        const snapshot = await get(q);
        if (!active) {
          return;
        }

        const items: RFIDScan[] = [];
        snapshot.forEach((child: DataSnapshot) => {
          items.unshift({
            id: child.key as string,
            ...(child.val() as Omit<RFIDScan, 'id'>),
          });
        });

        setScans(items);
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
  }, [limit, pollIntervalMs]);

  return { scans, loading };
}
