/**
 * @fileoverview Audit Logging — Barrel Re-exports
 *
 * Split into 4 files for SRP compliance (ADR-065 Phase 4):
 * - audit-policy.ts        — three-tier retention / delivery / dedup policy (SSoT)
 * - audit-core.ts          — logAuditEvent, logWebhookEvent, extractRequestMetadata
 * - audit-convenience.ts   — 19 convenience wrappers (logRoleChange, logFinancialTransition, etc.)
 * - audit.ts               — Barrel re-exports (this file)
 *
 * @see docs/rfc/authorization-rbac.md
 */

// Core functions
export {
  logAuditEvent,
  extractRequestMetadata,
  logWebhookEvent,
} from './audit-core';

// Policy (ADR-438 three-tier) — retention / delivery / dedup SSoT.
// ⚠️ Το audit-policy.ts είναι καθαρό (χωρίς `server-only`)· ο ΒΑRREL όμως τραβάει
// το audit-core ⇒ tests/isomorphic κώδικας να εισάγουν απευθείας από './audit-policy'.
export type { AuditTier, AuditTierConfig } from './audit-policy';

export {
  AUDIT_TIER_CONFIG,
  AUDIT_ACTION_TIER,
  resolveAuditTier,
  resolveAuditPolicy,
  resolveDedupWindowMs,
  computeAuditExpiry,
  buildAuditDedupKey,
  shouldSuppressDuplicate,
} from './audit-policy';

// Convenience functions
export {
  logRoleChange,
  logPermissionGranted,
  logPermissionRevoked,
  logGrantCreated,
  logGrantRevoked,
  logAccessDenied,
  logClaimsUpdated,
  logOwnershipChanged,
  logSystemBootstrap,
  logMigrationExecuted,
  logDataFix,
  logDirectOperation,
  logSystemOperation,
  logCommunicationCreated,
  logCommunicationApproved,
  logCommunicationRejected,
  logFinancialTransition,
  logEntityDeletion,
} from './audit-convenience';
