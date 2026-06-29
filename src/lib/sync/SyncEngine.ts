'use client';

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { OpQueue } from './OpQueue';

export type SyncStatus = 'loading' | 'connected' | 'connecting' | 'offline';
export type UserRole = 'owner' | 'editor' | 'viewer';
export type StatusListener = (status: SyncStatus, pendingCount: number) => void;

export class SyncEngine {
  private ydoc: Y.Doc;
  private persistence: IndexeddbPersistence;
  private ws: WebSocket | null = null;
  private opQueue: OpQueue;
  private documentId: string;
  private userId: string;
  private role: UserRole;
  private authToken: string;
  private statusListeners: StatusListener[] = [];
  private currentStatus: SyncStatus = 'loading';
  private isDestroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(documentId: string, userId: string, role: UserRole, authToken: string) {
    this.documentId = documentId;
    this.userId = userId;
    this.role = role;
    this.authToken = authToken;
    this.ydoc = new Y.Doc();
    this.opQueue = new OpQueue(documentId);

    this.persistence = new IndexeddbPersistence(`collab-doc-${documentId}`, this.ydoc);

    if (this.role !== 'viewer') {
      this.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'remote') {
          this.opQueue.enqueue(update);
          // Send directly over WebSocket if connected
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(update);
          }
        }
      });
    }

    this.persistence.once('synced', async () => {
      this.connectWebSocket();
      await this.flushQueue();
    });

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = async () => {
    this.setStatus('connecting');
    this.connectWebSocket();
    await this.flushQueue();
  };

  private handleOffline = () => {
    this.setStatus('offline');
    this.ws?.close();
  };

  private connectWebSocket() {
    if (this.isDestroyed || !navigator.onLine) return;

    this.ws?.close();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:1234';
    const url = `${wsUrl}/${this.documentId}?token=${this.authToken}&role=${this.role}`;

    try {
      this.ws = new WebSocket(url);
      this.setStatus('connecting');

      this.ws.onopen = async () => {
        const pending = await this.opQueue.count();
        this.setStatus('connected', pending);
        await this.flushQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const update = new Uint8Array(event.data as ArrayBuffer);
          Y.applyUpdate(this.ydoc, update, 'remote');
        } catch (err) {
          console.error('[sync] failed to apply remote update:', err);
        }
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          this.setStatus('connecting');
          // Reconnect after 3 seconds
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 3000);
        }
      };

      this.ws.onerror = () => {
        this.setStatus('offline');
      };
    } catch (err) {
      console.error('[sync] WebSocket connection failed:', err);
      this.setStatus('offline');
    }
  }

  private async flushQueue(): Promise<void> {
    if (!navigator.onLine || this.role === 'viewer') return;

    const ops = await this.opQueue.drain();
    if (ops.length === 0) return;

    try {
      const mergedUpdate = Y.mergeUpdates(ops.map((op) => op.update));

      const res = await fetch(`/api/documents/${this.documentId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update: Buffer.from(mergedUpdate).toString('base64'),
          clientClock: ops[ops.length - 1].clock,
          userId: this.userId,
        }),
      });

      if (!res.ok) {
        await this.opQueue.enqueueAll(ops);
      }
    } catch {
      await this.opQueue.enqueueAll(ops);
    }
  }

  public async captureVersion(label: string): Promise<boolean> {
    try {
      const state = Y.encodeStateAsUpdate(this.ydoc);
      const res = await fetch(`/api/documents/${this.documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          yjsState: Buffer.from(state).toString('base64'),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    listener(this.currentStatus, 0);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: SyncStatus, pendingCount = 0) {
    this.currentStatus = status;
    this.statusListeners.forEach((l) => l(status, pendingCount));
  }

  public getYDoc(): Y.Doc { return this.ydoc; }
  public getRole(): UserRole { return this.role; }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.ws?.close();
    this.persistence.destroy();
  }
}