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
} as const;

/**
 * Generate an enterprise-format ID for Cloud Function audit log entries.
 * Format: cfaud_{uuid}
 */
export function generateCloudAuditId(): string {
  return `${PREFIXES.CLOUD_AUDIT}_${crypto.randomUUID()}`;
}
