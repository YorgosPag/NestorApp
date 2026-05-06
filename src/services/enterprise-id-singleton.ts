/**
 * ENTERPRISE ID — SINGLETON INSTANCE
 *
 * Owns the canonical `enterpriseIdService` instance. Lives in its own module
 * so that `enterprise-id-convenience.ts` can import the singleton without
 * pulling in the full `enterprise-id.service.ts` facade — that import edge
 * was the root cause of a webpack TDZ on `const P` (2026-05-06 incident on
 * `/contacts`).
 *
 * Import graph after the split (no cycles):
 *
 *   prefixes.ts ← class.ts ← singleton.ts ← convenience.ts
 *                                        ↖
 *                                          service.ts (facade re-exports)
 *
 * Public consumers continue to import from `./enterprise-id.service`; this
 * file is internal infrastructure.
 *
 * @module services/enterprise-id-singleton
 * @since 2026-05-06 (cycle-break)
 */

import { EnterpriseIdService } from './enterprise-id-class';

export const enterpriseIdService = new EnterpriseIdService({
  enableLogging: process.env.NODE_ENV === 'development',
  enableCache: true,
  maxRetries: 5,
});
