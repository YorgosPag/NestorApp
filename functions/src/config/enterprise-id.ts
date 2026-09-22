/**
 * =============================================================================
 * CLOUD FUNCTIONS: Enterprise ID Generator (SSoT Mirror)
 * =============================================================================
 *
 * Lightweight ID generator for Cloud Functions.
 * Mirrors the pattern from src/services/enterprise-id.service.ts; the prefixes
 * themselves are projected from the app registry (ADR-874).
 *
 * Format: {prefix}_{uuid-v4}
 *
 * @module functions/config/enterprise-id
 * @enterprise ADR-017 — Enterprise ID Generation
 */

import * as crypto from 'crypto';

import { ENTERPRISE_ID_PREFIXES } from '../generated/services/enterprise-id-prefixes';
import { deterministicV4Uuid } from '../generated/services/enterprise-id-deterministic';

// ADR-874 — the prefixes come from THE registry (`src/services/enterprise-id-prefixes.ts`)
// by projection (CHECK 3.93); the projection carries exactly the keys read below.
// A prefix declared only here — as `cfaud` was until 2026-09-22 — is invisible to
// the app's collision checks.

/**
 * Generate an enterprise-format ID for Cloud Function audit log entries.
 * Format: cfaud_{uuid}
 */
export function generateCloudAuditId(): string {
  return `${ENTERPRISE_ID_PREFIXES.CLOUD_FUNCTION_AUDIT}_${crypto.randomUUID()}`;
}

/**
 * Generate an enterprise-format ID for entity audit trail entries (ADR-195).
 * Format: eaud_{uuid}
 *
 * Mirrors `generateEntityAuditId()` in the main app's enterprise-id.service.ts
 * so entries produced by Cloud Function triggers are indistinguishable by
 * shape from those produced by the service layer.
 */
export function generateEntityAuditId(): string {
  return `${ENTERPRISE_ID_PREFIXES.ENTITY_AUDIT}_${crypto.randomUUID()}`;
}

/**
 * Deterministic ID for the "this CHANGE was already handled" marker (ADR-873 Φ1 §9.1).
 * Format: fevt_{uuid-v4-shaped}
 *
 * 🔑 **Deterministic on purpose** — this is the whole mechanism: every observer of the same
 * event derives the SAME id from the same seed, so `create()` fails for the second one.
 * A random id here would make the marker useless.
 *
 * ⚠️ **One engine, not two.** The hash lives in the app SSoT
 * (`src/services/enterprise-id-deterministic.ts`) and arrives here by projection
 * (ADR-874 · CHECK 3.93). ⛔ Never re-implement it — a second hash would make the two
 * packages disagree about which document a given change owns, and the marker would
 * silently stop working. Build the seed with `generated/lib/idempotency/event-claim`.
 */
export function generateFunctionEventId(seed: string): string {
  return `${ENTERPRISE_ID_PREFIXES.FUNCTION_EVENT}_${deterministicV4Uuid(seed)}`;
}

/**
 * Deterministic ID for an entity audit row derived from a specific change (ADR-873 Φ1).
 * Format: eaud_{uuid-v4-shaped}
 *
 * Same shape as {@link generateEntityAuditId}, but **stable**: a redelivered trigger writes
 * the SAME document instead of a second audit row that nobody can tell from a real one.
 */
export function generateDeterministicEntityAuditId(seed: string): string {
  return `${ENTERPRISE_ID_PREFIXES.ENTITY_AUDIT}_${deterministicV4Uuid(seed)}`;
}

/**
 * Deterministic ID for a Cloud Function audit row derived from a specific action (ADR-873 Φ1).
 * Format: cfaud_{uuid-v4-shaped}
 */
export function generateDeterministicCloudAuditId(seed: string): string {
  return `${ENTERPRISE_ID_PREFIXES.CLOUD_FUNCTION_AUDIT}_${deterministicV4Uuid(seed)}`;
}

/**
 * Opaque, unprefixed UUID v4 for non-entity tokens (download tokens, nonces).
 *
 * Mirrors `generateOpaqueToken()` in `src/services/enterprise-id.service.ts`.
 * Every randomness source in Cloud Function code routes through this helper
 * (or a prefixed generator above) to satisfy CLAUDE.md N.6 — inline
 * `crypto.randomUUID()` at call sites is blocked by the pre-commit hook.
 */
export function generateOpaqueToken(): string {
  return crypto.randomUUID();
}
