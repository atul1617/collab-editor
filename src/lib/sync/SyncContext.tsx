'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { SyncEngine, SyncStatus, UserRole } from './SyncEngine';
import * as Y from 'yjs';

interface SyncContextValue {
  engine: SyncEngine | null;
  ydoc: Y.Doc | null;
  status: SyncStatus;
  pendingOps: number;
  role: UserRole | null;
}

const SyncContext = createContext<SyncContextValue>({
  engine: null,
  ydoc: null,
  status: 'loading',
  pendingOps: 0,
  role: null,
});

interface SyncProviderProps {
  documentId: string;
  userId: string;
  role: UserRole;
  authToken: string;
  children: ReactNode;
}

export function SyncProvider({
  documentId,
  userId,
  role,
  authToken,
  children,
}: SyncProviderProps) {
  const engineRef = useRef<SyncEngine | null>(null);
  const [status, setStatus] = useState<SyncStatus>('loading');
  const [pendingOps, setPendingOps] = useState(0);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  useEffect(() => {
    const engine = new SyncEngine(documentId, userId, role, authToken);
    engineRef.current = engine;
    setYdoc(engine.getYDoc());

    const unsub = engine.onStatus((s, pending) => {
      setStatus(s);
      setPendingOps(pending);
    });

    return () => {
      unsub();
      engine.destroy();
    };
  }, [documentId, userId, role, authToken]);

  return (
    <SyncContext.Provider
      value={{
        engine: engineRef.current,
        ydoc,
        status,
        pendingOps,
        role,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncEngine() {
  return useContext(SyncContext);
}