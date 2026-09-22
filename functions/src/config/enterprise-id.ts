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
