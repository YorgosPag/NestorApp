/**
 * @fileoverview Audit Logging — Convenience Functions
 *
 * Thin wrappers around logAuditEvent for common audit scenarios:
 * role changes, permissions, grants, communications, financial transitions, etc.
 *
 * Extracted from audit.ts for SRP compliance (ADR-065 Phase 4).
 */

import 'server-only';

import type {
  AuthContext,
  AuditTargetType,
} from './types';
import { logAuditEvent } from './audit-core';

// =============================================================================
// ROLE & PERMISSION CHANGES
// =============================================================================

/** Log a role change event. */
export async function logRoleChange(
  ctx: AuthContext,
  targetUserId: string,
  previousRole: string,
  newRole: string,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'role_changed', targetUserId, 'user', {
    previousValue: { type: 'role', value: previousRole },
    newValue: { type: 'role', value: newRole },
    metadata: { reason },
  });
}

/** Log a permission grant event. */
export async function logPermissionGranted(
  ctx: AuthContext,
  targetUserId: string,
  permissions: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'permission_granted', targetUserId, 'user', {
    previousValue: null,
    newValue: { type: 'permission', value: permissions },
    metadata: { reason },
  });
}

/** Log a permission revoke event. */
export async function logPermissionRevoked(
  ctx: AuthContext,
  targetUserId: string,
  permissions: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'permission_revoked', targetUserId, 'user', {
    previousValue: { type: 'permission', value: permissions },
    newValue: null,
    metadata: { reason },
  });
}

// =============================================================================
// GRANT MANAGEMENT
// =============================================================================

/** Log a grant creation event. */
export async function logGrantCreated(
  ctx: AuthContext,
  grantId: string,
  scopes: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'grant_created', grantId, 'grant', {
    previousValue: null,
    newValue: { type: 'grant', value: scopes },
    metadata: { reason },
  });
}

/** Log a grant revocation event. */
export async function logGrantRevoked(
  ctx: AuthContext,
  grantId: string,
  scopes: string[],
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'grant_revoked', grantId, 'grant', {
    previousValue: { type: 'grant', value: scopes },
    newValue: null,
    metadata: { reason },
  });
}

// =============================================================================
// ACCESS & CLAIMS
// =============================================================================

/** Log an access denied event. */
export async function logAccessDenied(
  ctx: AuthContext,
  resource: string,
  permission: string,
  path?: string
): Promise<void> {
  await logAuditEvent(ctx, 'access_denied', resource, 'api', {
    previousValue: null,
    newValue: { type: 'permission', value: permission },
    metadata: { path },
  });
}

/** Log a claims update event. */
export async function logClaimsUpdated(
  ctx: AuthContext,
  targetUserId: string,
  previousClaims: Record<string, unknown>,
  newClaims: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'claims_updated', targetUserId, 'user', {
    previousValue: { type: 'status', value: previousClaims },
    newValue: { type: 'status', value: newClaims },
    metadata: { reason },
  });
}

// =============================================================================
// OWNERSHIP & SYSTEM
// =============================================================================

/** Log an ownership change event. */
export async function logOwnershipChanged(
  ctx: AuthContext,
  propertyId: string,
  previousOwnerId: string | null,
  newOwnerId: string,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'ownership_changed', propertyId, 'property', {
    previousValue: previousOwnerId ? { type: 'membership', value: previousOwnerId } : null,
    newValue: { type: 'membership', value: newOwnerId },
    metadata: { reason },
  });
}

/** Log a system bootstrap event. */
export async function logSystemBootstrap(
  ctx: AuthContext,
  operation: string,
  details: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(ctx, 'system_bootstrap', operation, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: 'System initialization' },
  });
}

/** Log a migration execution event. */
export async function logMigrationExecuted(
  ctx: AuthContext,
  migrationId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'migration_executed', migrationId, 'migration', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'Database migration executed' },
  });
}

/** Log a data fix operation. */
export async function logDataFix(
  ctx: AuthContext,
  fixId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'data_fix_executed', fixId, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'Data fix operation executed' },
  });
}

/** Log a direct database operation. */
export async function logDirectOperation(
  ctx: AuthContext,
  operationId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'direct_operation_executed', operationId, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'Direct database operation executed' },
  });
}

/** Log a system configuration operation. */
export async function logSystemOperation(
  ctx: AuthContext,
  configId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'system_configured', configId, 'api', {
    previousValue: null,
    newValue: { type: 'status', value: details },
    metadata: { reason: reason || 'System configuration operation executed' },
  });
}

// =============================================================================
// COMMUNICATIONS AUDIT LOGGING
// =============================================================================

/** Log a communication creation event. */
export async function logCommunicationCreated(
  ctx: AuthContext,
  communicationId: string,
  communicationType: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'communication_created', communicationId, 'communication', {
    previousValue: null,
    newValue: { type: 'communication_status', value: { type: communicationType, ...details } },
    metadata: { reason: reason || `Communication created (${communicationType})` },
  });
}

/** Log a communication approval event. */
export async function logCommunicationApproved(
  ctx: AuthContext,
  communicationId: string,
  previousStatus: string,
  linkedTaskId: string,
  details: Record<string, unknown>,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'communication_approved', communicationId, 'communication', {
    previousValue: { type: 'communication_status', value: previousStatus },
    newValue: { type: 'task_linked', value: { status: 'approved', taskId: linkedTaskId, ...details } },
    metadata: { reason: reason || 'Communication approved and task created' },
  });
}

/** Log a communication rejection event. */
export async function logCommunicationRejected(
  ctx: AuthContext,
  communicationId: string,
  previousStatus: string,
  reason?: string
): Promise<void> {
  await logAuditEvent(ctx, 'communication_rejected', communicationId, 'communication', {
    previousValue: { type: 'communication_status', value: previousStatus },
    newValue: { type: 'communication_status', value: 'rejected' },
    metadata: { reason: reason || 'Communication rejected' },
  });
}

// =============================================================================
// FINANCIAL AUDIT LOGGING (ADR-255 SPEC-255E)
// =============================================================================

/**
 * Log a financial status transition (cheque/loan/invoice/commission FSM).
 */
export async function logFinancialTransition(
  ctx: AuthContext,
  entityType: 'cheque' | 'loan' | 'invoice' | 'payment' | 'commission',
  entityId: string,
  fromStatus: string,
  toStatus: string,
  metadata?: Record<string, string | number | boolean | null>
): Promise<void> {
  await logAuditEvent(ctx, 'financial_transition', entityId, entityType, {
    previousValue: { type: 'financial_status', value: fromStatus },
    newValue: { type: 'financial_status', value: toStatus },
    metadata: {
      reason: `${entityType} transitioned: ${fromStatus} → ${toStatus}`,
      ...(metadata ? { path: JSON.stringify(metadata) } : {}),
    },
  });
}

/** Log an entity deletion with context. */
export async function logEntityDeletion(
  ctx: AuthContext,
  entityType: AuditTargetType,
  entityId: string,
  metadata?: Record<string, string | number | boolean | null>
): Promise<void> {
  await logAuditEvent(ctx, 'data_deleted', entityId, entityType, {
    previousValue: null,
    newValue: { type: 'status', value: { deleted: true, ...metadata } },
    metadata: { reason: `${entityType} deleted` },
  });
}
