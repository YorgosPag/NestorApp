/**
 * =============================================================================
 * CLOUD FUNCTIONS: Enterprise ID Generator (SSoT Mirror)
 * =============================================================================
 *
 * Lightweight ID generator for Cloud Functions.
 * Mirrors the pattern from src/services/enterprise-id.service.ts.
 *
 * Format: {prefix}_{uuid-v4}
 *
 * @module functions/config/enterprise-id
 * @enterprise ADR-017 — Enterprise ID Generation
 */

import * as crypto from 'crypto';

const PREFIXES = {
  /** Cloud Function audit log entries */
  CLOUD_AUDIT: 'cfaud',
  /** Entity audit trail entries (ADR-195) — mirrors `eaud` in src/services/enterprise-id-prefixes.ts */
  ENTITY_AUDIT: 'eaud',
} as const;

/**
 * Generate an enterprise-format ID for Cloud Function audit log entries.
 * Format: cfaud_{uuid}
 */
export function generateCloudAuditId(): string {
  return `${PREFIXES.CLOUD_AUDIT}_${crypto.randomUUID()}`;
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
  return `${PREFIXES.ENTITY_AUDIT}_${crypto.randomUUID()}`;
}
