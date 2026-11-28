/**
 * ADR-920 §14.12 Β4 — **the Web Worker of the `terrain-fusion://` protocol**: a thin wrapper. The mosaic and its
 * `ImageBitmap` are made here, off the main thread (Β0 measured `createImageBitmap` at 0,8 ms here against 33 ms there).
 * @related `fusion-tile-host.ts` (all the logic — pure, tested without a Worker) · `fusion-tile-runtime.ts` (the browser
 *   wiring) · `fusion-tile-worker-spawn.ts` (the ONLY place that starts it) · `lib/workers/worker-rpc-host.ts` (the RPC)
 * @module lib/terrain/elevation-fusion/fusion-tile.worker
 *
 * 🔑 **Concurrent**: a tile waiting for the archive does not hold back the tiles whose data is already here.
 * 🔑 The image of a reply MOVES to the main thread (zero-copy).
 *
 * ⚠️ No React / DOM / stores: pure `lib` only (the doctrine of every Worker of the app, ADR-639 · ADR-884 §4.14).
 */

import { serveWorkerRpc } from '@/lib/workers/worker-rpc-host';

import type { FusionTileRequest } from './fusion-tile-host';
import { createBrowserFusionTileHost, fusionReplyTransfer, type BrowserFusionTileReply } from './fusion-tile-runtime';

serveWorkerRpc<FusionTileRequest, BrowserFusionTileReply>(self, createBrowserFusionTileHost('worker'), fusionReplyTransfer, {
  ordering: 'concurrent',
});

// Empty export: the file stays a module under `isolatedModules`.
export {};
