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
  // Opt-in only — logging EVERY id generation floods the dev console (dozens per
  // session). Set NEXT_PUBLIC_DEBUG_ENTERPRISE_ID=true to re-enable when debugging ids.
  enableLogging: process.env.NEXT_PUBLIC_DEBUG_ENTERPRISE_ID === 'true',
  enableCache: true,
  maxRetries: 5,
});
