import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import type { BoardConnection } from '../types/sensor';

interface FirestoreBoardConnection {
  boardId: string;
  connectedAt?: Timestamp | number | null;
  updatedAt?: Timestamp | number | null;
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

export function useBoardConnection(uid: string | null | undefined) {
  const [connection, setConnection] = useState<BoardConnection | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const connectionRef = useMemo(
    () => (uid ? doc(firestore, 'users', uid, 'board', 'connection') : null),
    [uid],
  );

  const refresh = useCallback(async () => {
    if (!connectionRef) {
      setConnection(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const snapshot = await getDoc(connectionRef);

      if (!snapshot.exists()) {
        setConnection(null);
        setError(null);
        return;
      }

      const value = snapshot.data() as FirestoreBoardConnection;
      const boardId = (value.boardId || '').trim();

      if (!boardId) {
        setConnection(null);
        setError('Board ID 資料不完整');
        return;
      }

      setConnection({
        boardId,
        connectedAt: toEpochMs(value.connectedAt),
        updatedAt: toEpochMs(value.updatedAt),
      });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '讀取 Board 連線資料失敗');
    } finally {
      setLoading(false);
    }
  }, [connectionRef]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectBoard = useCallback(
    async (boardIdRaw: string) => {
      if (!connectionRef || inFlightRef.current) {
        return;
      }

      const boardId = boardIdRaw.trim();
      if (!boardId) {
        throw new Error('Board ID 不可為空');
      }

      inFlightRef.current = true;

      try {
        const existing = connection;

        await setDoc(
          connectionRef,
          {
            boardId,
            connectedAt:
              existing && existing.boardId === boardId
                ? existing.connectedAt
                : serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        await refresh();
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Board 連線失敗');
        throw err;
      } finally {
        inFlightRef.current = false;
      }
    },
    [connection, connectionRef, refresh],
  );

  const disconnectBoard = useCallback(async () => {
    if (!connectionRef || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    try {
      await deleteDoc(connectionRef);
      setConnection(null);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Board 中斷連線失敗');
      throw err;
    } finally {
      inFlightRef.current = false;
    }
  }, [connectionRef]);

  return {
    connection,
    loading,
    error,
    refresh,
    connectBoard,
    disconnectBoard,
  };
}
