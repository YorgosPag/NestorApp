/**
 * ADR-920 §14.12 Β0 — ο Worker του πρωτοτύπου σύντηξης. Το `ImageBitmap` της απάντησης **μετακομίζει** (zero-copy).
 */

import { serveWorkerRpc } from '@/lib/workers/worker-rpc-host';

import { createFusionHost, type FusionReply, type FusionRequest } from './fusion-host';

serveWorkerRpc<FusionRequest, FusionReply>(self, createFusionHost(), (reply) =>
  reply.kind === 'tile' ? [reply.bitmap] : [],
);

// Empty export: the file stays a module under `isolatedModules`.
export {};
