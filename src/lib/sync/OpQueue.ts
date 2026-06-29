
export interface QueuedOp {
  id: string;
  update: Uint8Array;
  clock: number;
  timestamp: number;
}

const DB_NAME = 'collab-editor-ops';
const STORE_NAME = 'op-queue';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('documentId', 'documentId', { unique: false });
        store.createIndex('clock', 'clock', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class OpQueue {
  private documentId: string;
  private clock: number = 0;

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  async enqueue(update: Uint8Array): Promise<void> {
    const db = await openDB();
    const op: QueuedOp & { documentId: string } = {
      id: `${this.documentId}-${Date.now()}-${Math.random()}`,
      documentId: this.documentId,
      update,
      clock: ++this.clock,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async enqueueAll(ops: QueuedOp[]): Promise<void> {
    for (const op of ops) {
      await this.enqueue(op.update);
    }
  }

  async drain(): Promise<QueuedOp[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('documentId');
      const request = index.getAll(this.documentId);

      request.onsuccess = () => {
        const ops = request.result as (QueuedOp & { documentId: string })[];
        ops.sort((a, b) => a.clock - b.clock);

        // Delete all drained ops
        ops.forEach((op) => store.delete(op.id));

        tx.oncomplete = () => resolve(ops);
        tx.onerror = () => reject(tx.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async count(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('documentId');
      const request = index.count(this.documentId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('documentId');
      const request = index.getAll(this.documentId);

      request.onsuccess = () => {
        const ops = request.result;
        ops.forEach((op) => store.delete(op.id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }
}