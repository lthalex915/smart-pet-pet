import { useCallback, useMemo, useRef, useState } from 'react';
import { set, ref } from 'firebase/database';
import { db } from '../firebase';
import { legacyWeightCommandPath, userWeightCommandPath } from '../constants/dbPaths';

function makeRequestId(): string {
  return `tare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useWeightControl(uid: string | null | undefined) {
  const [triggeringTare, setTriggeringTare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const userCommandRef = useMemo(
    () => (uid ? ref(db, userWeightCommandPath(uid)) : null),
    [uid],
  );

  const legacyCommandRef = useMemo(
    () => ref(db, legacyWeightCommandPath()),
    [],
  );

  const tare = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) {
      return false;
    }

    inFlightRef.current = true;
    setTriggeringTare(true);
    setError(null);

    const requestId = makeRequestId();
    const payload = {
      action: 'tareWeight',
      requestId,
      status: 'pending',
      issuedAt: Date.now(),
    };

    try {
      let wroteLegacy = false;
      let firstError: unknown = null;

      if (userCommandRef) {
        try {
          await set(userCommandRef, payload);
        } catch (err: unknown) {
          firstError = firstError ?? err;
        }
      }

      try {
        await set(legacyCommandRef, payload);
        wroteLegacy = true;
      } catch (err: unknown) {
        firstError = firstError ?? err;
      }

      if (!wroteLegacy) {
        throw (firstError instanceof Error ? firstError : new Error('送出重量歸零命令失敗'));
      }

      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '送出重量歸零命令失敗');
      return false;
    } finally {
      inFlightRef.current = false;
      setTriggeringTare(false);
    }
  }, [legacyCommandRef, userCommandRef]);

  return {
    triggeringTare,
    error,
    tare,
  };
}
