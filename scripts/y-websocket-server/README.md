# Yjs Sync Server — ADR-344 Phase 4

Self-hosted Yjs WebSocket server for collaborative DXF text editing.
Tenant-isolated per ADR-326 (companyId in every room name).

## Stack

| Layer | Library | License | Purpose |
|---|---|---|---|
| WebSocket | `ws` | MIT | Native WebSocket server |
| CRDT | `yjs` | MIT | Conflict-free replicated doc |
| Protocol | `y-protocols` | MIT | Sync + awareness message codecs |
| Encoding | `lib0` | MIT | Binary encoder/decoder |
| Auth | `firebase-admin` | Apache-2.0 | Firebase ID token verification |

All MIT/Apache — compliant with CLAUDE.md N.5.

## Architecture

```
browser (TipTap + y-prosemirror + y-websocket client)
   │  wss://ws.example.com/<companyId>:<drawingId>:<entityId>?token=<firebase-id-token>
   ▼
auth.js — Firebase Admin verifies token, checks companyId claim == room prefix
   │
   ▼
server.js — per-room Y.Doc + Awareness, broadcasts updates to peers
```

### Room naming

```
<companyId>:<drawingId>:<entityId>
```

Examples:
- `acme:dwg_floor_plan_42:mtxt_a8x9q` — MTEXT entity in floor plan
- `nestor:dwg_001:mtxt_title` — title block annotation

Tenant boundary is the **first segment**. Verified against the Firebase
custom claim `companyId` on every connection — mismatches return WS close
code 4003.

### Close codes

| Code | Meaning |
|---|---|
| 4001 | Missing / invalid token |
| 4003 | Tenant mismatch |
| 4004 | Bad room id format |

## Run locally

```bash
cd scripts/y-websocket-server
npm install
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export YJS_PORT=1234
npm start
```

## Deploy to Cloud Run

```bash
gcloud run deploy nestor-yjs-server \
  --source . \
  --region=europe-west3 \
  --allow-unauthenticated \
  --port=1234 \
  --min-instances=1 \
  --cpu-throttling=false \
  --session-affinity
```

**`--session-affinity` is mandatory** — without it, peer WebSocket
messages may land on a different instance with an empty in-memory Y.Doc.

**`--cpu-throttling=false`** keeps awareness heartbeats and broadcast
fan-out latency low even when no requests are arriving.

## NOT for Vercel

Vercel serverless functions do not support long-lived WebSocket
connections. Use Cloud Run, Fly.io, Railway, or a self-managed VM.

## Persistence (production hardening — future work)

The skeleton keeps every Y.Doc in memory only. For production, add one
of:

- **LevelDB** (`y-leveldb`) — on-disk per-room snapshots, simplest
- **Firestore periodic snapshots** — pair with `text_drafts` collection
- **Redis** (`y-redis`) — for horizontal scaling

When persistence is added, wire it in `getRoom()` (load on first
access) and on the `doc.update` event (save throttled, e.g. once per
30 s).

## Phase 4 scope notes

This skeleton handles:

- WebSocket lifecycle (open / message / close)
- Firebase Auth verification + tenant isolation
- y-protocols sync messages (state vector → diff exchange)
- y-protocols awareness (cursor / selection / user info)
- Per-room doc + awareness broadcast fan-out
- Room eviction when last client disconnects

It does **not** yet handle:

- Persistence (drafts evict on server restart)
- Token-refresh disconnect (clients reconnect with fresh token —
  handled on the client side)
- Rate limiting per room (add at the load balancer or in `handleMessage`)
- Metrics / OpenTelemetry export

These are operational hardening, not architecture changes — to be
added when the server moves from skeleton → production deployment.
