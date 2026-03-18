// src/hooks/useSensorData.ts
import { useEffect, useState }          from 'react';
import { ref, onValue }                 from 'firebase/database';
import type { DatabaseReference,
              DataSnapshot }            from 'firebase/database';
import { db }                           from '../firebase';
import type { SensorData }              from '../types/sensor';

export function useSensorData() {
  const [data,    setData]    = useState<SensorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const sensorRef: DatabaseReference = ref(db, 'sensors/latest');

    const unsubscribe = onValue(
      sensorRef,
      (snapshot: DataSnapshot) => {
        setData(snapshot.val() as SensorData | null);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {          // ← must be Error, not FirebaseError
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return { data, loading, error };
}