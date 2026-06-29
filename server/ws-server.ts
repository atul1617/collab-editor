import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';

const PORT = parseInt(process.env.PORT ?? '1234');

// In-memory store: documentId → Yjs doc + connected clients
const docs = new Map<string, Y.Doc>();
const rooms = new Map<string, Set<WebSocket>>();

function getDoc(roomName: string): Y.Doc {
  if (!docs.has(roomName)) {
    docs.set(roomName, new Y.Doc());
  }
  return docs.get(roomName)!;
}

function getRoom(roomName: string): Set<WebSocket> {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  return rooms.get(roomName)!;
}

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  
  // Room name = document ID (e.g. /some-doc-uuid)
  const roomName = url.pathname.slice(1);
  const role = url.searchParams.get('role') ?? 'viewer';

  if (!roomName) {
    ws.close();
    return;
  }

  const doc = getDoc(roomName);
  const room = getRoom(roomName);
  room.add(ws);

  console.log(`[ws] client joined room: ${roomName} as ${role} (${room.size} total)`);

  // Send current doc state to the new client
  const currentState = Y.encodeStateAsUpdate(doc);
  if (currentState.length > 2) {
    ws.send(currentState);
  }

  ws.on('message', (message: Buffer) => {
    // Block write messages from viewers
    if (role === 'viewer') return;

    try {
      const update = new Uint8Array(message as Buffer);

      // Apply update to server-side doc
      Y.applyUpdate(doc, update);

      // Broadcast to all other clients in the room
      room.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(update);
        }
      });
    } catch (err) {
      console.error('[ws] failed to apply update:', err);
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    console.log(`[ws] client left room: ${roomName} (${room.size} remaining)`);
    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomName);
      docs.delete(roomName);
    }
  });

  ws.on('error', (err) => {
    console.error('[ws] error:', err);
    room.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`✓ WebSocket server running on ws://localhost:${PORT}`);
});