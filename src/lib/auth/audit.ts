/**
 * @fileoverview Audit Logging — Barrel Re-exports
 *
 * Split into 3 files for SRP compliance (ADR-065 Phase 4):
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
