/**
 * =============================================================================
 * EXECUTOR SHARED — Security, RBAC & Utility Functions for Tool Handlers
 * =============================================================================
 *
 * Types/constants extracted to executor-shared-types.ts (ADR-065 Phase 6).
 *
 * @module services/ai-pipeline/tools/executor-shared
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveAccessConfig, UNLINKED_ACCESS, deriveBlockedFieldSet } from '@/config/ai-role-access-matrix';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

// Re-export all types and constants for backward compatibility
export type {
  AgenticContext,
  ToolResult,
  QueryFilter,
  ToolHandler,
} from './executor-shared-types';

export {
  AI_ERRORS,
  ALLOWED_READ_COLLECTIONS,
  ALLOWED_WRITE_COLLECTIONS,
  SENSITIVE_FIELDS,
  COLLECTION_TO_SYNC_ENTITY,
  MAX_QUERY_RESULTS,
  DEFAULT_QUERY_LIMIT,
  MAX_RESULT_JSON_LENGTH,
} from './executor-shared-types';

import type { AgenticContext, ToolResult, QueryFilter } from './executor-shared-types';
import {
  SENSITIVE_FIELDS,
  ALLOWED_READ_COLLECTIONS,
  ALLOWED_WRITE_COLLECTIONS,
  COLLECTION_TO_SYNC_ENTITY,
  MAX_RESULT_JSON_LENGTH,
  AI_ERRORS,
} from './executor-shared-types';
import { nowISO } from '@/lib/date-local';

export const logger = createModuleLogger('AGENTIC_TOOL_EXECUTOR');

// ============================================================================
// ATTRIBUTION
// ============================================================================

/**
 * Builds a human-readable attribution string for document audit fields.
 */
export function buildAttribution(ctx: AgenticContext): string {
  const name = ctx.contactMeta?.displayName ?? ctx.channelSenderId;
  const role = ctx.isAdmin ? '' : 'buyer: ';
  return `AI Agent (${role}${name} via ${ctx.channel})`;
}

// ============================================================================
// RBAC: Role-Based Access Enforcement
// ============================================================================

/**
 * Resolve access config ONCE per context and cache it.
 */
export function getAccessConfig(ctx: AgenticContext): import('@/config/ai-role-access-matrix').RoleAccessConfig {
  if (ctx._resolvedAccess) return ctx._resolvedAccess;

  const roles = ctx.contactMeta?.projectRoles ?? [];
  const linkedProjectIds = [...new Set(roles.map(r => r.projectId).filter(Boolean))];
  const config = linkedProjectIds.length > 0
    ? resolveAccessConfig(roles)
    : UNLINKED_ACCESS;

  ctx._resolvedAccess = config;
  return config;
}

/**
 * Enforce role-based access at query level.
 */
export function enforceRoleAccess(
  collection: string,
  filters: QueryFilter[],
  ctx: AgenticContext
): { allowed: true; filters: QueryFilter[] } | { allowed: false; result: ToolResult } {
  if (ctx.isAdmin) return { allowed: true, filters };

  const accessConfig = getAccessConfig(ctx);
  const linkedProjectIds = [...new Set(
    (ctx.contactMeta?.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
  )];

  const allowedSet = new Set(accessConfig.allowedCollections);
  if (!allowedSet.has(collection)) {
    return { allowed: false, result: { success: false, error: 'Δεν έχετε πρόσβαση σε αυτά τα δεδομένα.' } };
  }

  // SPEC-257B: Unit-level scoping for buyer/owner/tenant
  const linkedPropertyIds = ctx.contactMeta?.linkedPropertyIds ?? [];
  if (accessConfig.scopeLevel === 'property' && linkedPropertyIds.length === 0) {
    const unitSensitive = new Set([COLLECTIONS.PROPERTIES, COLLECTIONS.FILES, COLLECTIONS.PAYMENTS]);
    if (unitSensitive.has(collection)) {
      return { allowed: false, result: { success: false, error: AI_ERRORS.NO_LINKED_UNITS } };
    }
    return { allowed: true, filters };
  }
  if (accessConfig.scopeLevel === 'property' && linkedPropertyIds.length > 0) {
    if (collection === COLLECTIONS.PROPERTIES) {
      const hasIdFilter = filters.some(f => f.field === 'id');
      if (!hasIdFilter) {
        filters = [...filters, {
          field: 'id',
          operator: 'in',
          value: linkedPropertyIds.slice(0, 30),
        }];
      }
    }
    const propertyIdScopedCollections = new Set([COLLECTIONS.FILES, COLLECTIONS.PAYMENTS, COLLECTIONS.TASKS]);
    if (propertyIdScopedCollections.has(collection)) {
      const hasPropertyFilter = filters.some(f => f.field === 'propertyId');
      if (!hasPropertyFilter) {
        filters = [...filters, {
          field: 'propertyId',
          operator: 'in',
          value: linkedPropertyIds.slice(0, 30),
        }];
      }
    }
    return { allowed: true, filters };
  }

  // Project-level scoping
  const projectScopedByProjectId = new Set([COLLECTIONS.BUILDINGS, COLLECTIONS.PROPERTIES]);
  if (projectScopedByProjectId.has(collection) && linkedProjectIds.length > 0) {
    const hasProjectFilter = filters.some(f => f.field === 'projectId');
    if (!hasProjectFilter) {
      filters = [...filters, {
        field: 'projectId',
        operator: 'in',
        value: linkedProjectIds.slice(0, 30),
      }];
    }
  }

  return { allowed: true, filters };
}

// ============================================================================
// FIRESTORE UTILITIES
// ============================================================================

/**
 * Ensure companyId filter is present in all queries (tenant isolation)
 */
export function enforceCompanyScope(
  filters: QueryFilter[],
  companyId: string,
  collection: string
): QueryFilter[] {
  const collectionsWithOptionalCompanyId = new Set([
    COLLECTIONS.BUILDINGS,
    COLLECTIONS.FLOORS,
    COLLECTIONS.CONSTRUCTION_PHASES,
    COLLECTIONS.CONSTRUCTION_TASKS,
  ]);
  const isSubcollection = collection.includes('/');
  if (collectionsWithOptionalCompanyId.has(collection) || isSubcollection) {
    return filters.filter(f => f.field !== 'companyId');
  }

  const hasCompanyFilter = filters.some(f => f.field === 'companyId');
  if (hasCompanyFilter) {
    return filters.map(f =>
      f.field === 'companyId' ? { ...f, value: companyId } : f
    );
  }

  return [
    { field: 'companyId', operator: '==', value: companyId },
    ...filters,
  ];
}

/**
 * Coerce string values to their appropriate Firestore types.
 */
export function coerceFilterValue(value: string | number | boolean | null | string[]): string | number | boolean | null | string[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  }

  return value;
}

/**
 * Map string operator to Firestore operator
 */
export function mapOperator(
  op: string
): FirebaseFirestore.WhereFilterOp | null {
  const operatorMap: Record<string, FirebaseFirestore.WhereFilterOp> = {
    '==': '==',
    '!=': '!=',
    '<': '<',
    '<=': '<=',
    '>': '>',
    '>=': '>=',
    'in': 'in',
    'array-contains': 'array-contains',
    'array-contains-any': 'array-contains-any',
    'not-in': 'not-in',
  };
  return operatorMap[op] ?? null;
}

/**
 * Flatten nested objects into top-level keys for AI readability.
 */
export function flattenNestedFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  const commercial = data.commercial as Record<string, unknown> | undefined;
  if (commercial && typeof commercial === 'object') {
    if (commercial.askingPrice != null) result._askingPrice = commercial.askingPrice;
    if (commercial.finalPrice != null) result._finalPrice = commercial.finalPrice;
    if (commercial.owners != null) result._owners = commercial.owners;
    if (commercial.ownerContactIds != null) result._ownerContactIds = commercial.ownerContactIds;
    if (commercial.reservationDate != null) result._reservationDate = commercial.reservationDate;
    if (commercial.saleDate != null) result._saleDate = commercial.saleDate;

    const ps = commercial.paymentSummary as Record<string, unknown> | undefined;
    if (ps && typeof ps === 'object') {
      if (ps.totalAmount != null) result._paymentTotal = ps.totalAmount;
      if (ps.paidAmount != null) result._paymentPaid = ps.paidAmount;
      if (ps.remainingAmount != null) result._paymentRemaining = ps.remainingAmount;
      if (ps.paidPercentage != null) result._paymentPaidPct = ps.paidPercentage;
      if (ps.totalInstallments != null) result._installmentsTotal = ps.totalInstallments;
      if (ps.paidInstallments != null) result._installmentsPaid = ps.paidInstallments;
      if (ps.overdueInstallments != null) result._installmentsOverdue = ps.overdueInstallments;
      if (ps.nextInstallmentAmount != null) result._nextInstallmentAmount = ps.nextInstallmentAmount;
      if (ps.nextInstallmentDate != null) result._nextInstallmentDate = ps.nextInstallmentDate;
    }

    delete result.commercial;
  }

  const areas = data.areas as Record<string, unknown> | undefined;
  if (areas && typeof areas === 'object') {
    if (areas.gross != null) result._areaGross = areas.gross;
    if (areas.net != null) result._areaNet = areas.net;
    if (areas.balcony != null) result._areaBalcony = areas.balcony;
    if (areas.terrace != null) result._areaTerrace = areas.terrace;
    if (areas.garden != null) result._areaGarden = areas.garden;
    delete result.areas;
  }

  return result;
}

/**
 * Remove sensitive fields from document data
 */
export function redactSensitiveFields(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * RBAC: Redact fields blocked by the role access matrix.
 */
export function redactRoleBlockedFields(
  data: Record<string, unknown>,
  ctx: AgenticContext
): Record<string, unknown> {
  if (ctx.isAdmin) return data;

  const accessConfig = getAccessConfig(ctx);

  if (accessConfig.blockedFields.length === 0) return data;

  const allBlocked = deriveBlockedFieldSet(accessConfig.blockedFields);

  const blockedNested = new Map<string, Set<string>>();
  for (const field of accessConfig.blockedFields) {
    const dotIdx = field.indexOf('.');
    if (dotIdx !== -1) {
      const parent = field.substring(0, dotIdx);
      const child = field.substring(dotIdx + 1);
      if (!blockedNested.has(parent)) blockedNested.set(parent, new Set());
      blockedNested.get(parent)!.add(child);
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allBlocked.has(key)) continue;

    if (blockedNested.has(key) && typeof value === 'object' && value !== null) {
      const blockedChildren = blockedNested.get(key)!;
      const nested = value as Record<string, unknown>;
      const cleaned: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(nested)) {
        if (!blockedChildren.has(nk)) {
          cleaned[nk] = nv;
        }
      }
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
      continue;
    }

    result[key] = value;
  }
  return result;
}

/**
 * Truncate result data to prevent excessive token usage
 */
export function truncateResult(data: unknown): unknown {
  const json = JSON.stringify(data);
  if (json.length <= MAX_RESULT_JSON_LENGTH) {
    return data;
  }

  if (Array.isArray(data)) {
    let truncated = [...data];
    while (JSON.stringify(truncated).length > MAX_RESULT_JSON_LENGTH && truncated.length > 1) {
      truncated = truncated.slice(0, truncated.length - 1);
    }
    return [...truncated, { _truncated: true, _originalCount: data.length }];
  }

  return data;
}

/**
 * Audit log for write operations
 */
export async function auditWrite(
  ctx: AgenticContext,
  collection: string,
  documentId: string,
  mode: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = getAdminFirestore();
    const { generatePipelineAuditId } = await import('@/services/enterprise-id.service');
    await db.collection(COLLECTIONS.AI_PIPELINE_AUDIT).doc(generatePipelineAuditId()).set({
      type: 'agentic_write',
      requestId: ctx.requestId,
      companyId: ctx.companyId,
      channelSenderId: ctx.channelSenderId,
      collection,
      documentId,
      mode,
      fieldsWritten: Object.keys(data),
      timestamp: nowISO(),
    });
  } catch (error) {
    logger.warn('Failed to audit write operation', {
      requestId: ctx.requestId,
      error: getErrorMessage(error),
    });
  }
}

/**
 * Emit a sync signal if the collection has a corresponding SyncEntityType.
 */
export function emitSyncSignalIfMapped(
  collection: string,
  action: import('@/services/realtime/types').EntitySyncAction,
  entityId: string,
  companyId: string
): void {
  const entityType = COLLECTION_TO_SYNC_ENTITY[collection];
  if (!entityType) return;
  import('@/services/ai-pipeline/shared/contact-lookup').then(
    ({ emitEntitySyncSignal }) => emitEntitySyncSignal(entityType, action, entityId, companyId)
  ).catch(() => { /* non-blocking */ });
}

/**
 * Extract file attachments from IntakeAttachment[] to AgenticContext format.
 */
export function extractAttachments(
  intakeAttachments?: ReadonlyArray<{ fileRecordId?: string; filename: string; contentType: string; storageUrl?: string }>
): AgenticContext['attachments'] {
  if (!intakeAttachments || intakeAttachments.length === 0) return undefined;
  const mapped = intakeAttachments
    .filter((a): a is typeof a & { fileRecordId: string } => !!a.fileRecordId)
    .map(a => ({ fileRecordId: a.fileRecordId, filename: a.filename, contentType: a.contentType, storageUrl: a.storageUrl ?? '' }));
  return mapped.length > 0 ? mapped : undefined;
}

/**
 * Check if collection is allowed for read (including subcollections)
 */
export function isReadAllowed(collection: string): boolean {
  return ALLOWED_READ_COLLECTIONS.has(collection)
    || ALLOWED_READ_COLLECTIONS.has(collection.split('/')[0]);
}

/**
 * Check if collection is allowed for write (including subcollections)
 */
export function isWriteAllowed(collection: string): boolean {
  return ALLOWED_WRITE_COLLECTIONS.has(collection)
    || ALLOWED_WRITE_COLLECTIONS.has(collection.split('/')[0]);
}
