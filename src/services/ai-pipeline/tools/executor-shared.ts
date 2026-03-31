/**
 * =============================================================================
 * EXECUTOR SHARED — Types, Constants, Security & Utilities for Tool Handlers
 * =============================================================================
 *
 * Single source of truth for all shared infrastructure used by tool handlers.
 * Extracted from the monolithic agentic-tool-executor.ts (Strategy Pattern refactor).
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

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticContext {
  companyId: string;
  isAdmin: boolean;
  /** Communication channel: telegram, email, in_app */
  channel: string;
  channelSenderId: string;
  requestId: string;
  /** Telegram chatId for send_telegram_message */
  telegramChatId?: string;
  /** RBAC: Resolved contact with project roles */
  contactMeta?: import('@/types/ai-pipeline').ContactMeta | null;
  /** RBAC cache: resolved once per request by resolveRoleAccess(), reused by redactRoleBlockedFields() */
  _resolvedAccess?: import('@/config/ai-role-access-matrix').RoleAccessConfig;
  /** File attachments from the current message (Telegram photos/documents) */
  attachments?: Array<{
    fileRecordId: string;
    filename: string;
    contentType: string;
    storageUrl: string;
  }>;
  /**
   * FIND-U guardrail: Tracks which fields were updated per contact within
   * the current agentic loop execution. Key = contactId, Value = Set of field names.
   * Prevents AI from auto-setting taxOffice when vatNumber was just written.
   */
  _updatedContactFields?: Map<string, Set<string>>;
  /** Invoice entity data extracted from document preview (Phase 2).
   *  Used by create_contact handler to auto-enrich contacts with ΑΦΜ/ΔΟΥ/τηλ/κλπ. */
  invoiceEntities?: import('@/services/ai-pipeline/invoice-entity-extractor').InvoiceEntityResult | null;
  /** ADR-265: Base64-encoded document images for vision-in-the-loop.
   *  Passed as multipart content to Chat Completions so the AI sees the actual document. */
  documentImages?: Array<{
    base64DataUri: string;
    filename: string;
    contentType: string;
    fileRecordId: string;
  }>;
  /** True when the user sent ONLY a file without text command.
   *  Guardrail A (write-claim without tools) is skipped — describing a document IS the correct response. */
  isDocumentPreviewOnly?: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Number of results returned (for queries) */
  count?: number;
  /** Flags degraded results (e.g., FAILED_PRECONDITION fallback — AI should caveat its answer) */
  warning?: string;
}

export interface QueryFilter {
  field: string;
  operator: string;
  value: string | number | boolean | null | string[];
}

/**
 * Strategy Pattern: Each domain handler implements this interface.
 * The executor auto-registers handlers by iterating toolNames.
 */
export interface ToolHandler {
  readonly toolNames: readonly string[];
  execute(toolName: string, args: Record<string, unknown>, ctx: AgenticContext): Promise<ToolResult>;
}

// ============================================================================
// ATTRIBUTION — Human-readable "who did this" for document createdBy/lastModifiedBy
// ============================================================================

/**
 * Builds a human-readable attribution string for document audit fields.
 *
 * Examples:
 *   "AI Agent (Γιώργος via telegram)"
 *   "AI Agent (buyer: Δημήτρης via whatsapp)"
 *   "AI Agent (unknown via email)"
 */
export function buildAttribution(ctx: AgenticContext): string {
  const name = ctx.contactMeta?.displayName ?? ctx.channelSenderId;
  const role = ctx.isAdmin ? '' : 'buyer: ';
  return `AI Agent (${role}${name} via ${ctx.channel})`;
}

// ============================================================================
// AI-FACING ERROR MESSAGES (SSoT — returned to AI inside ToolResult.error)
// ============================================================================

export const AI_ERRORS = {
  NO_LINKED_UNITS: 'Δεν βρέθηκαν συνδεδεμένα ακίνητα. Επικοινωνήστε με τον διαχειριστή.',
  UNRECOGNIZED_USER: 'Πρέπει να είστε αναγνωρισμένος χρήστης.',
} as const;

// ============================================================================
// SECURITY: COLLECTION WHITELISTS
// ============================================================================

export const ALLOWED_READ_COLLECTIONS = new Set([
  COLLECTIONS.PROJECTS,
  COLLECTIONS.BUILDINGS,
  COLLECTIONS.UNITS,
  COLLECTIONS.FLOORS,
  COLLECTIONS.CONTACTS,
  COLLECTIONS.CONSTRUCTION_PHASES,
  COLLECTIONS.CONSTRUCTION_TASKS,
  COLLECTIONS.LEADS,
  COLLECTIONS.OPPORTUNITIES,
  COLLECTIONS.APPOINTMENTS,
  COLLECTIONS.TASKS,
  COLLECTIONS.OBLIGATIONS,
  COLLECTIONS.MESSAGES,
  COLLECTIONS.COMMUNICATIONS,
  COLLECTIONS.INVOICES,
  COLLECTIONS.PAYMENTS,
  COLLECTIONS.CONTACT_LINKS,
  COLLECTIONS.EMPLOYMENT_RECORDS,
  COLLECTIONS.ATTENDANCE_EVENTS,
  COLLECTIONS.CONVERSATIONS,
  COLLECTIONS.ACTIVITIES,
  COLLECTIONS.FILES,
  COLLECTIONS.PARKING_SPACES,
  COLLECTIONS.ACCOUNTING_INVOICES,
  COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
  COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES,
  COLLECTIONS.ACCOUNTING_FIXED_ASSETS,
  COLLECTIONS.FILES,        // SPEC-257F: file delivery
  COLLECTIONS.FLOORPLANS,   // SPEC-257F: floorplan delivery
]);

export const ALLOWED_WRITE_COLLECTIONS = new Set([
  COLLECTIONS.CONTACTS,
  COLLECTIONS.TASKS,
  COLLECTIONS.APPOINTMENTS,
  COLLECTIONS.ACTIVITIES,
  COLLECTIONS.LEADS,
  COLLECTIONS.UNITS,
  COLLECTIONS.PROJECTS,
  COLLECTIONS.BUILDINGS,
  COLLECTIONS.CONSTRUCTION_PHASES,
  COLLECTIONS.CONSTRUCTION_TASKS,
  COLLECTIONS.FILES,
  // FINDING-006: contact_links REMOVED — requires dedicated tool with validation
  // COLLECTIONS.CONTACT_LINKS,
]);

export const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'apiKey',
  'secret',
  'refreshToken',
  'accessToken',
  'privateKey',
]);

/**
 * Map Firestore collections → SyncEntityType for AI sync bridge.
 * When a write happens to a mapped collection, emitEntitySyncSignal is called
 * so the client UI refreshes in real-time.
 */
export const COLLECTION_TO_SYNC_ENTITY: Record<string, import('@/services/realtime/types').SyncEntityType> = {
  [COLLECTIONS.CONTACTS]: 'contacts',
  [COLLECTIONS.TASKS]: 'tasks',
  [COLLECTIONS.BUILDINGS]: 'buildings',
  [COLLECTIONS.PROJECTS]: 'projects',
  [COLLECTIONS.OPPORTUNITIES]: 'opportunities',
  [COLLECTIONS.COMMUNICATIONS]: 'communications',
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_QUERY_RESULTS = 50;
export const DEFAULT_QUERY_LIMIT = 20;
export const MAX_RESULT_JSON_LENGTH = 8000; // ~3000 tokens

export const logger = createModuleLogger('AGENTIC_TOOL_EXECUTOR');

// ============================================================================
// RBAC: Role-Based Access Enforcement (SSoT: ai-role-access-matrix.ts)
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
  const linkedUnitIds = ctx.contactMeta?.linkedUnitIds ?? [];
  if (accessConfig.scopeLevel === 'unit' && linkedUnitIds.length === 0) {
    const unitSensitive = new Set([COLLECTIONS.UNITS, COLLECTIONS.FILES, COLLECTIONS.PAYMENTS]);
    if (unitSensitive.has(collection)) {
      return { allowed: false, result: { success: false, error: AI_ERRORS.NO_LINKED_UNITS } };
    }
    return { allowed: true, filters };
  }
  if (accessConfig.scopeLevel === 'unit' && linkedUnitIds.length > 0) {
    if (collection === COLLECTIONS.UNITS) {
      const hasIdFilter = filters.some(f => f.field === 'id');
      if (!hasIdFilter) {
        filters = [...filters, {
          field: 'id',
          operator: 'in',
          value: linkedUnitIds.slice(0, 30),
        }];
      }
    }
    const unitIdScopedCollections = new Set([COLLECTIONS.FILES, COLLECTIONS.PAYMENTS, COLLECTIONS.TASKS]);
    if (unitIdScopedCollections.has(collection)) {
      const hasUnitFilter = filters.some(f => f.field === 'unitId');
      if (!hasUnitFilter) {
        filters = [...filters, {
          field: 'unitId',
          operator: 'in',
          value: linkedUnitIds.slice(0, 30),
        }];
      }
    }
    return { allowed: true, filters };
  }

  // Project-level scoping
  const projectScopedByProjectId = new Set([COLLECTIONS.BUILDINGS, COLLECTIONS.UNITS]);
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
      timestamp: new Date().toISOString(),
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
 * Fire-and-forget — non-blocking.
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
