/**
 * ADR-344 Phase 4 — Yjs sync server skeleton (self-hosted, MIT stack).
 *
 * Standalone Node.js service: accepts WebSocket connections from
 * browser clients (y-websocket-client.ts), authenticates each via
 * Firebase ID token (auth.js), and bridges WebSocket frames ↔ Y.Doc
 * using the y-protocols sync messages.
 *
 * Architecture:
 *   - One Y.Doc per room (`companyId:drawingId:entityId`)
 *   - Doc lifecycle: created on first client, persisted via on-disk
 *     snapshot every N seconds, evicted from memory when empty
 *   - In-memory only at this skeleton stage; production deployments
 *     should add LevelDB persistence (y-leveldb) or Firestore
 *     periodic snapshots
 *
 * Run:
 *   node scripts/y-websocket-server/server.js
 *
 * Required env vars:
 *   GOOGLE_APPLICATION_CREDENTIALS  — path to service-account JSON
 *   YJS_PORT                        — WebSocket port (default 1234)
 *
 * Deployment target: Cloud Run (see Dockerfile). NOT to be hosted on
 * Vercel — long-lived WebSockets are not supported on serverless.
 *
 * @module scripts/y-websocket-server/server
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const { verifyConnection } = require('./auth');

const PORT = parseInt(process.env.YJS_PORT || '1234', 10);

// ── Per-room shared state ─────────────────────────────────────────────────────

/** @type {Map<string, { doc: Y.Doc, awareness: awarenessProtocol.Awareness, conns: Set<WebSocket> }>} */
const rooms = new Map();

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    const doc = new Y.Doc({ guid: roomId });
    const awareness = new awarenessProtocol.Awareness(doc);
    room = { doc, awareness, conns: new Set() };
    rooms.set(roomId, room);
  }
  return room;
}

function evictRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (room && room.conns.size === 0) {
    room.doc.destroy();
    rooms.delete(roomId);
  }
}

// ── y-protocols message handlers ──────────────────────────────────────────────

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

function broadcast(room, sender, payload) {
  for (const conn of room.conns) {
    if (conn !== sender && conn.readyState === conn.OPEN) {
      conn.send(payload);
    }
  }
}

function handleMessage(room, conn, data) {
  const decoder = decoding.createDecoder(new Uint8Array(data));
  const encoder = encoding.createEncoder();
  const msgType = decoding.readVarUint(decoder);

  if (msgType === MSG_SYNC) {
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);
    if (encoding.length(encoder) > 1) {
      conn.send(encoding.toUint8Array(encoder));
    }
  } else if (msgType === MSG_AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), conn);
  }
}

function sendInitialSync(room, conn) {
  // 1) sync step 1 — broadcast our state vector
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  conn.send(encoding.toUint8Array(encoder));

  // 2) initial awareness snapshot
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const aEncoder = encoding.createEncoder();
    encoding.writeVarUint(aEncoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(aEncoder, awarenessProtocol.encodeAwarenessUpdate(
      room.awareness, Array.from(awarenessStates.keys()),
    ));
    conn.send(encoding.toUint8Array(aEncoder));
  }
}

// ── Doc-update fan-out ────────────────────────────────────────────────────────

function wireRoomBroadcast(room) {
  room.doc.on('update', (update, origin) => {
    if (origin === 'remote') return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcast(room, origin, encoding.toUint8Array(encoder));
  });

  room.awareness.on('update', ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(
      room.awareness, changedClients,
    ));
    broadcast(room, origin, encoding.toUint8Array(encoder));
  });
}

// ── Connection lifecycle ──────────────────────────────────────────────────────

async function handleConnection(conn, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.pathname.slice(1);
  const token = url.searchParams.get('token');

  let identity;
  try {
    identity = await verifyConnection(token, roomId);
  } catch (err) {
    conn.close(err.code || 4001, err.message);
    return;
  }

  const room = getRoom(roomId);
  if (room.conns.size === 0) wireRoomBroadcast(room);
  room.conns.add(conn);

  conn.on('message', (data) => {
    try { handleMessage(room, conn, data); } catch (e) { console.error('msg error', e); }
  });
  conn.on('close', () => {
    room.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(room.awareness, [identity.uid], null);
    evictRoomIfEmpty(roomId);
  });

  sendInitialSync(room, conn);
}

// ── HTTP / WS bootstrap ───────────────────────────────────────────────────────

const httpServer = http.createServer((req, res) => {
  // Health probe for Cloud Run / k8s
  if (req.url === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', handleConnection);

httpServer.listen(PORT, () => {
  console.log(`[yjs-server] listening on :${PORT}`);
});
