// src/hooks/useRFIDHistory.ts
import { useEffect, useState }               from 'react';
import { ref, onValue, query,
         orderByChild, limitToLast }         from 'firebase/database';
import type { DataSnapshot }                 from 'firebase/database';
import { db }                                from '../firebase';
import type { RFIDScan }                     from '../types/sensor';

export function useRFIDHistory(limit = 30) {
  const [scans,   setScans]   = useState<RFIDScan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const q = query(
      ref(db, 'rfidScans'),
      orderByChild('timestamp'),
      limitToLast(limit),
    );

    const unsubscribe = onValue(q, (snapshot: DataSnapshot) => {
      const items: RFIDScan[] = [];
      snapshot.forEach((child: DataSnapshot) => {
        items.unshift({
          id: child.key as string,
          ...(child.val() as Omit<RFIDScan, 'id'>),
        });
      });
      setScans(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [limit]);

  return { scans, loading };
}