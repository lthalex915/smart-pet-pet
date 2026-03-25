import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import type { RFIDBinding } from '../types/sensor';
import { buildDefaultRFIDName, normalizeRFIDUid } from '../utils/rfid';

interface UpsertBindingPayload {
  uid: string;
  name?: string;
}

function toEpochMs(value: Timestamp | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  return Date.now();
}

interface FirestoreRFIDBinding {
  uid: string;
  name: string;
  connectedAt?: Timestamp | number | null;
  updatedAt?: Timestamp | number | null;
}

export function useRFIDBinding(uid: string | null | undefined) {
  const [binding, setBinding] = useState<RFIDBinding | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const bindingRef = useMemo(
    () => (uid ? doc(firestore, 'users', uid, 'rfid', 'binding') : null),
    [uid],
  );

  const refresh = useCallback(async () => {
    if (!bindingRef) {
      setBinding(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const snapshot = await getDoc(bindingRef);

      if (!snapshot.exists()) {
        setBinding(null);
        setError(null);
        return;
      }

      const value = snapshot.data() as FirestoreRFIDBinding;
      setBinding({
        uid: normalizeRFIDUid(value.uid),
        name: (value.name || '').trim() || buildDefaultRFIDName(value.uid),
        connectedAt: toEpochMs(value.connectedAt),
        updatedAt: toEpochMs(value.updatedAt),
      });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '讀取 RFID 綁定資料失敗');
    } finally {
      setLoading(false);
    }
  }, [bindingRef]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsertBinding = useCallback(
    async ({ uid: rawUid, name }: UpsertBindingPayload) => {
      if (!bindingRef || inFlightRef.current) {
        return;
      }

      const normalizedUid = normalizeRFIDUid(rawUid);
      if (!normalizedUid) {
        throw new Error('RFID UID 不可為空');
      }

      inFlightRef.current = true;

      try {
        const existing = binding;
        const nextName = (name?.trim() || existing?.name || buildDefaultRFIDName(normalizedUid)).slice(0, 32);

        await setDoc(
          bindingRef,
          {
            uid: normalizedUid,
            name: nextName,
            connectedAt:
              existing && normalizeRFIDUid(existing.uid) === normalizedUid
                ? existing.connectedAt
                : serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await refresh();
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '更新 RFID 綁定資料失敗');
        throw err;
      } finally {
        inFlightRef.current = false;
      }
    },
    [binding, bindingRef, refresh],
  );

  const renameBinding = useCallback(
    async (name: string) => {
      if (!bindingRef || !binding || inFlightRef.current) {
        return;
      }

      const nextName = name.trim();
      if (!nextName) {
        throw new Error('名稱不可為空');
      }

      inFlightRef.current = true;

      try {
        await updateDoc(bindingRef, {
          name: nextName.slice(0, 32),
          updatedAt: serverTimestamp(),
        });

        await refresh();
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'RFID 重新命名失敗');
        throw err;
      } finally {
        inFlightRef.current = false;
      }
    },
    [binding, bindingRef, refresh],
  );

  const disconnectBinding = useCallback(async () => {
    if (!bindingRef || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    try {
      await deleteDoc(bindingRef);
      setBinding(null);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'RFID 中斷連線失敗');
      throw err;
    } finally {
      inFlightRef.current = false;
    }
  }, [bindingRef]);

  return {
    binding,
    loading,
    error,
    refresh,
    upsertBinding,
    renameBinding,
    disconnectBinding,
  };
}
