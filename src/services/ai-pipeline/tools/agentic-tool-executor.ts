/**
 * =============================================================================
 * AGENTIC TOOL EXECUTOR — Secure Firestore Tool Execution Engine
 * =============================================================================
 *
 * Executes tool calls from the AI agent with security guardrails:
 * - Collection whitelist (no access to system/config/settings)
 * - Automatic companyId injection (tenant isolation)
 * - Write operations restricted to admin only
 * - Result truncation (max 50 results, max 3000 tokens)
 * - Sensitive field redaction
 * - Audit logging for write operations
 *
 * @module services/ai-pipeline/tools/agentic-tool-executor
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getCollectionSchemaInfo } from '@/config/firestore-schema-map';
// ADR-173: Tool analytics
import { getToolAnalyticsService } from '../tool-analytics-service';
// 🧠 Query Strategy Memory — learns from FAILED_PRECONDITION errors
import { recordQueryStrategy } from '../query-strategy-service';
// 🏢 SSoT: Greek↔Latin transliteration from greek-nlp
import { greekToLatin } from '../shared/greek-nlp';
// RBAC: SSoT access matrix
import { resolveAccessConfig, UNLINKED_ACCESS, deriveBlockedFieldSet } from '@/config/ai-role-access-matrix';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { captureMessage as sentryCaptureMessage } from '@/lib/telemetry/sentry';
import { getErrorMessage } from '@/lib/error-utils';
// SPEC-257D/E/F: SSoT enums for tool validation (same source as tool definition schemas)
import { COMPLAINT_SEVERITIES, CONTACT_FIELD_TYPES, FILE_SOURCE_TYPES } from './agentic-tool-definitions';
import type { ComplaintSeverity, ContactFieldType, FileSourceType } from './agentic-tool-definitions';
// SSoT types: CrmTask priority, contact array entry types
import type { CrmTask } from '@/types/crm';
import type { PhoneInfo, EmailInfo, SocialMediaInfo } from '@/types/contacts/contracts';

const logger = createModuleLogger('AGENTIC_TOOL_EXECUTOR');

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

interface QueryFilter {
  field: string;
  operator: string;
  value: string | number | boolean | null | string[];
}

// ============================================================================
// AI-FACING ERROR MESSAGES (SSoT — returned to AI inside ToolResult.error)
// ============================================================================
const AI_ERRORS = {
  NO_LINKED_UNITS: 'Δεν βρέθηκαν συνδεδεμένα ακίνητα. Επικοινωνήστε με τον διαχειριστή.',
  UNRECOGNIZED_USER: 'Πρέπει να είστε αναγνωρισμένος χρήστης.',
} as const;

// ============================================================================
// SECURITY: COLLECTION WHITELIST
// ============================================================================

/**
 * Collections the AI agent is ALLOWED to query.
 * System/config/settings collections are EXCLUDED for security.
 */
const ALLOWED_READ_COLLECTIONS = new Set([
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

/**
 * Collections allowed for write operations (admin only, very restricted)
 */
const ALLOWED_WRITE_COLLECTIONS = new Set([
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
  COLLECTIONS.CONTACT_LINKS,
]);

/**
 * Fields that should be redacted from results (security)
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'apiKey',
  'secret',
  'refreshToken',
  'accessToken',
  'privateKey',
]);

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_QUERY_RESULTS = 50;
const DEFAULT_QUERY_LIMIT = 20;
const MAX_RESULT_JSON_LENGTH = 8000; // ~3000 tokens

// ============================================================================
// EXECUTOR CLASS
// ============================================================================

export class AgenticToolExecutor {

  // ── RBAC: Role-Based Access Enforcement (SSoT: ai-role-access-matrix.ts) ──

  /**
   * Enforce role-based access at query level.
   * Reads allowed/blocked collections from SSoT config.
   * Admin bypasses all checks.
   */
  /**
   * Resolve access config ONCE per context and cache it.
   * All downstream methods (enforceRoleAccess, redactRoleBlockedFields) read from cache.
   */
  private getAccessConfig(ctx: AgenticContext): import('@/config/ai-role-access-matrix').RoleAccessConfig {
    if (ctx._resolvedAccess) return ctx._resolvedAccess;

    const roles = ctx.contactMeta?.projectRoles ?? [];
    const linkedProjectIds = [...new Set(roles.map(r => r.projectId).filter(Boolean))];
    const config = linkedProjectIds.length > 0
      ? resolveAccessConfig(roles)
      : UNLINKED_ACCESS;

    ctx._resolvedAccess = config;
    return config;
  }

  private enforceRoleAccess(
    collection: string,
    filters: QueryFilter[],
    ctx: AgenticContext
  ): { allowed: true; filters: QueryFilter[] } | { allowed: false; result: ToolResult } {
    // Admin bypasses
    if (ctx.isAdmin) return { allowed: true, filters };

    const accessConfig = this.getAccessConfig(ctx);
    const linkedProjectIds = [...new Set(
      (ctx.contactMeta?.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
    )];

    // allowedCollections is the ONLY gate — if not in the list, denied
    const allowedSet = new Set(accessConfig.allowedCollections);
    if (!allowedSet.has(collection)) {
      return { allowed: false, result: { success: false, error: 'Δεν έχετε πρόσβαση σε αυτά τα δεδομένα.' } };
    }

    // SPEC-257B: Unit-level scoping for buyer/owner/tenant
    const linkedUnitIds = ctx.contactMeta?.linkedUnitIds ?? [];
    if (accessConfig.scopeLevel === 'unit' && linkedUnitIds.length === 0) {
      // Safety guard: unit-scoped role without linked units → deny unit-sensitive collections
      const unitSensitive = new Set([COLLECTIONS.UNITS, COLLECTIONS.FILES, COLLECTIONS.PAYMENTS]);
      if (unitSensitive.has(collection)) {
        return { allowed: false, result: { success: false, error: AI_ERRORS.NO_LINKED_UNITS } };
      }
      // Non-unit collections (buildings, appointments) — allow without scoping
      return { allowed: true, filters };
    }
    if (accessConfig.scopeLevel === 'unit' && linkedUnitIds.length > 0) {
      // Units collection: filter by document's stored `id` field
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
      // Documents, payments: filter by unitId
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
      // Buildings: allow without extra filter (parent building access OK)
      return { allowed: true, filters };
    }

    // Project-level scoping for supervisor/architect/engineer/contractor (existing behavior)
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

  /**
   * Execute a tool call and return the result
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    logger.info('Executing tool', {
      tool: toolName,
      requestId: ctx.requestId,
      companyId: ctx.companyId,
      isAdmin: ctx.isAdmin,
    });

    try {
      let result: ToolResult;

      switch (toolName) {
        case 'firestore_query':
          result = await this.executeFirestoreQuery(args, ctx);
          break;
        case 'firestore_get_document':
          result = await this.executeFirestoreGetDocument(args, ctx);
          break;
        case 'firestore_count':
          result = await this.executeFirestoreCount(args, ctx);
          break;
        case 'firestore_write':
          result = await this.executeFirestoreWrite(args, ctx);
          break;
        case 'send_email_to_contact':
          result = await this.executeSendEmail(args, ctx);
          break;
        case 'send_telegram_message':
          result = await this.executeSendTelegram(args, ctx);
          break;
        case 'send_messenger_message':
          result = await this.executeSendSocialMessage(args, ctx, 'messenger');
          break;
        case 'send_instagram_message':
          result = await this.executeSendSocialMessage(args, ctx, 'instagram');
          break;
        case 'get_collection_schema':
          result = await this.executeGetCollectionSchema(args);
          break;
        case 'search_text':
          result = await this.executeSearchText(args, ctx);
          break;
        case 'create_complaint_task':
          result = await this.executeCreateComplaintTask(args, ctx);
          break;
        case 'append_contact_info':
          result = await this.executeAppendContactInfo(args, ctx);
          break;
        case 'deliver_file_to_chat':
          result = await this.executeDeliverFileToChat(args, ctx);
          break;
        case 'search_knowledge_base':
          result = await this.executeSearchKnowledgeBase(args, ctx);
          break;
        default:
          result = { success: false, error: `Unknown tool: ${toolName}` };
      }

      const elapsed = Date.now() - startTime;
      logger.info('Tool execution completed', {
        tool: toolName,
        requestId: ctx.requestId,
        success: result.success,
        elapsedMs: elapsed,
        resultCount: result.count,
      });

      // ADR-173: Record tool analytics (fire-and-forget)
      getToolAnalyticsService()
        .recordToolExecution(toolName, result.success, result.error)
        .catch(() => { /* non-fatal */ });

      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // 🏢 ENTERPRISE: FAILED_PRECONDITION = missing index → broad query fallback
      // Instead of returning empty results, fetch ALL docs and let AI filter.
      // ADR-259C: Log full error (contains index creation link) + flag results as unfiltered.
      if (errorMessage.includes('FAILED_PRECONDITION') && toolName === 'firestore_query') {
        const fallbackArgs = args as Record<string, unknown>;
        const collection = String(fallbackArgs.collection ?? '');

        logger.warn('Missing Firestore index — fallback to broad query', {
          tool: toolName,
          collection,
          requestId: ctx.requestId,
          indexError: errorMessage,
        });
        // ADR-259D: Capture missing index as Sentry warning (includes auto-create link)
        sentryCaptureMessage(`Missing Firestore index: ${collection}`, 'warning', {
          tags: { component: 'tool-executor', collection },
          extra: { requestId: ctx.requestId, indexError: errorMessage },
        });

        try {
          const db = getAdminFirestore();
          const companyId = ctx.companyId;
          const limit = Math.min(typeof fallbackArgs.limit === 'number' ? fallbackArgs.limit : 20, 50);

          let broadQuery: FirebaseFirestore.Query = db.collection(collection);
          broadQuery = broadQuery.where('companyId', '==', companyId);
          broadQuery = broadQuery.limit(limit);

          const snapshot = await broadQuery.get();
          const results = snapshot.docs.map(doc => {
            const raw = this.redactRoleBlockedFields(this.redactSensitiveFields(doc.data()), ctx);
            return { id: doc.id, ...this.flattenNestedFields(raw) };
          });

          return {
            success: true,
            data: this.truncateResult(results),
            count: results.length,
            warning: `[FALLBACK] Results may be incomplete — missing Firestore index for "${collection}". Filters were not fully applied.`,
          };
        } catch {
          // If even broad query fails, return empty with warning
          return {
            success: true,
            data: [],
            count: 0,
            warning: `[FALLBACK] Broad query also failed for "${collection}". No results available.`,
          };
        }
      }
      if (errorMessage.includes('FAILED_PRECONDITION')) {
        return {
          success: true,
          data: [],
          count: 0,
          warning: `[FALLBACK] Missing index for non-query tool "${toolName}". No results available.`,
        };
      }

      logger.error('Tool execution error', {
        tool: toolName,
        requestId: ctx.requestId,
        error: errorMessage,
      });
      return { success: false, error: `Tool error: ${errorMessage}` };
    }
  }

  // ==========================================================================
  // TOOL IMPLEMENTATIONS
  // ==========================================================================

  /**
   * firestore_query: Query collection with filters
   */
  private async executeFirestoreQuery(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');

    // Allow both top-level collections AND subcollections (e.g. units/{id}/payment_plans)
    const isAllowed = ALLOWED_READ_COLLECTIONS.has(collection)
      || ALLOWED_READ_COLLECTIONS.has(collection.split('/')[0]);
    if (!isAllowed) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];

    // RBAC: Enforce role-based access (safety net)
    const accessCheck = this.enforceRoleAccess(collection, rawFilters, ctx);
    if (!accessCheck.allowed) return accessCheck.result;

    const filters = this.enforceCompanyScope(accessCheck.filters, ctx.companyId, collection);
    const orderBy = typeof args.orderBy === 'string' ? args.orderBy : null;
    const orderDirection = args.orderDirection === 'desc' ? 'desc' : 'asc';
    const limit = Math.min(
      typeof args.limit === 'number' ? args.limit : DEFAULT_QUERY_LIMIT,
      MAX_QUERY_RESULTS
    );

    // 🏢 ENTERPRISE: Pre-strip non-queryable filters — they cause FAILED_PRECONDITION.
    // 1. Nested fields (dots): commercial.askingPrice → don't exist as top-level Firestore fields
    // 2. Flattened fields (_prefix): _installmentsOverdue → created AFTER query by flattenNestedFields
    const isNonQueryable = (field: string) => field.includes('.') || field.startsWith('_');
    const nestedDropped = filters.filter(f => isNonQueryable(f.field));
    const safeFilters = filters.filter(f => !isNonQueryable(f.field));

    if (nestedDropped.length > 0) {
      logger.info('Stripped nested filters (would cause FAILED_PRECONDITION)', {
        requestId: ctx.requestId,
        collection,
        dropped: nestedDropped.map(f => `${f.field} ${f.operator} ${f.value}`),
        kept: safeFilters.map(f => f.field),
      });
      // 🧠 Record strategy (fire-and-forget)
      recordQueryStrategy({
        collection,
        failedFilters: nestedDropped.map(f => f.field),
        failedReason: 'STRIPPED_NESTED_FILTER',
        successfulFilters: safeFilters.map(f => f.field),
      }).catch(() => { /* non-fatal */ });
    }

    const db = getAdminFirestore();
    const snapshot = await this.executeWithFallback(db, collection, safeFilters, orderBy, orderDirection, limit, ctx);

    const results = snapshot.docs.map(doc => {
      const raw = this.redactRoleBlockedFields(this.redactSensitiveFields(doc.data()), ctx);
      return { id: doc.id, ...this.flattenNestedFields(raw) };
    });

    return {
      success: true,
      data: this.truncateResult(results),
      count: results.length,
    };
  }

  /**
   * firestore_get_document: Fetch single document by ID
   */
  private async executeFirestoreGetDocument(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');
    const documentId = String(args.documentId ?? '');

    // Allow both top-level collections AND subcollections (e.g. units/{id}/payment_plans)
    const isAllowed = ALLOWED_READ_COLLECTIONS.has(collection)
      || ALLOWED_READ_COLLECTIONS.has(collection.split('/')[0]);
    if (!isAllowed) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    if (!documentId) {
      return { success: false, error: 'documentId is required' };
    }

    const db = getAdminFirestore();
    const doc = await db.collection(collection).doc(documentId).get();

    if (!doc.exists) {
      return { success: true, data: null, count: 0 };
    }

    const data = doc.data() ?? {};

    // Verify companyId scope (tenant isolation)
    if ('companyId' in data && data.companyId !== ctx.companyId) {
      return { success: false, error: 'Document not found' };
    }

    return {
      success: true,
      data: { id: doc.id, ...this.redactRoleBlockedFields(this.redactSensitiveFields(data), ctx) },
      count: 1,
    };
  }

  /**
   * firestore_count: Count documents matching criteria
   */
  private async executeFirestoreCount(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');

    // Allow both top-level collections AND subcollections (e.g. units/{id}/payment_plans)
    const isAllowed = ALLOWED_READ_COLLECTIONS.has(collection)
      || ALLOWED_READ_COLLECTIONS.has(collection.split('/')[0]);
    if (!isAllowed) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];

    // RBAC: Enforce role-based access (safety net)
    const countAccessCheck = this.enforceRoleAccess(collection, rawFilters, ctx);
    if (!countAccessCheck.allowed) return countAccessCheck.result;

    const filters = this.enforceCompanyScope(countAccessCheck.filters, ctx.companyId, collection);

    // 🏢 Pre-strip nested filters (same as firestore_query)
    const safeFilters = filters.filter(f => !f.field.includes('.'));

    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(collection);

    for (const filter of safeFilters) {
      const op = this.mapOperator(filter.operator);
      if (op) {
        query = query.where(filter.field, op, this.coerceFilterValue(filter.value));
      }
    }

    try {
      const countResult = await query.count().get();
      return { success: true, data: { count: countResult.data().count }, count: countResult.data().count };
    } catch (err) {
      const msg = getErrorMessage(err);
      if (!msg.includes('FAILED_PRECONDITION')) throw err;
      // Fallback: count with companyId only
      const companyFilter = safeFilters.find(f => f.field === 'companyId');
      let fallback: FirebaseFirestore.Query = db.collection(collection);
      if (companyFilter) {
        fallback = fallback.where('companyId', '==', this.coerceFilterValue(companyFilter.value));
      }
      const fallbackResult = await fallback.count().get();
      return { success: true, data: { count: fallbackResult.data().count }, count: fallbackResult.data().count };
    }
  }

  /**
   * firestore_write: Create/update document (admin only)
   */
  private async executeFirestoreWrite(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Write operations are restricted to admin only' };
    }

    const collection = String(args.collection ?? '');
    const documentId = typeof args.documentId === 'string' ? args.documentId : null;
    const mode = String(args.mode ?? 'create');

    // Tool definition sends data as JSON string (strict mode); parse it
    let data: Record<string, unknown> = {};
    if (typeof args.data === 'string') {
      const parsed = safeJsonParse<Record<string, unknown>>(args.data, null as unknown as Record<string, unknown>);
      if (parsed === null) {
        return { success: false, error: 'Invalid JSON in data field' };
      }
      if (typeof parsed === 'object' && parsed !== null) {
        data = parsed;
      }
    } else if (typeof args.data === 'object' && args.data !== null) {
      data = args.data as Record<string, unknown>;
    }

    const isWriteAllowed = ALLOWED_WRITE_COLLECTIONS.has(collection)
      || ALLOWED_WRITE_COLLECTIONS.has(collection.split('/')[0]);
    if (!isWriteAllowed) {
      return { success: false, error: `Write to "${collection}" is not allowed` };
    }

    // Inject companyId and timestamps
    const writeData: Record<string, unknown> = {
      ...data,
      companyId: ctx.companyId,
      updatedAt: new Date().toISOString(),
    };

    if (mode === 'create') {
      writeData.createdAt = new Date().toISOString();
    }

    const db = getAdminFirestore();

    if (mode === 'create' && !documentId) {
      // 🏢 ENTERPRISE: setDoc + enterprise ID (SOS N.6)
      const { generateEntityId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateEntityId();
      await db.collection(collection).doc(enterpriseId).set(writeData);

      // Audit log
      await this.auditWrite(ctx, collection, enterpriseId, mode, writeData);

      return { success: true, data: { id: enterpriseId }, count: 1 };
    }

    if (documentId) {
      if (mode === 'create') {
        await db.collection(collection).doc(documentId).set(writeData, { merge: true });
      } else {
        await db.collection(collection).doc(documentId).update(writeData);
      }

      await this.auditWrite(ctx, collection, documentId, mode, writeData);

      return { success: true, data: { id: documentId }, count: 1 };
    }

    return { success: false, error: 'documentId required for update mode' };
  }

  // ==========================================================================
  // SPEC-257D: COMPLAINT TRIAGE — CUSTOMER COMPLAINT TASK CREATION
  // ==========================================================================

  /**
   * create_complaint_task: Customer (buyer/owner/tenant) reports a problem.
   * Creates a CRM task with enterprise ID + optional admin notification.
   *
   * Security:
   * - Only linked customers with units can use this (no admin required)
   * - unitId validated against ctx.contactMeta.linkedUnitIds
   * - Server derives contactId/projectId/companyId — AI provides only
   *   title, description, severity, unitId
   *
   * @see SPEC-257D (Complaint Triage System)
   */
  private async executeCreateComplaintTask(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    // ── 1. Security: Must be a recognized contact with linked units ──
    const contact = ctx.contactMeta;
    if (!contact) {
      return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
    }

    const linkedUnitIds = contact.linkedUnitIds ?? [];
    if (linkedUnitIds.length === 0) {
      return { success: false, error: AI_ERRORS.NO_LINKED_UNITS };
    }

    // ── 2. Validate inputs ──
    const title = String(args.title ?? '').trim();
    const description = String(args.description ?? '').trim();
    const severity = String(args.severity ?? 'normal');
    const unitId = String(args.unitId ?? '').trim();

    if (!title || !description) {
      return { success: false, error: 'Απαιτούνται τίτλος και περιγραφή παραπόνου.' };
    }

    if (!COMPLAINT_SEVERITIES.includes(severity as ComplaintSeverity)) {
      return { success: false, error: `severity must be one of: ${COMPLAINT_SEVERITIES.join(', ')}` };
    }

    // ── 3. Security: unitId must belong to caller's linked units ──
    if (!linkedUnitIds.includes(unitId)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το ακίνητο.' };
    }

    // ── 4. Map severity → CrmTask priority ──
    const SEVERITY_TO_PRIORITY: Record<ComplaintSeverity, CrmTask['priority']> = {
      urgent: 'urgent',
      normal: 'high',
      low: 'low',
    };
    const priority = SEVERITY_TO_PRIORITY[severity as ComplaintSeverity] ?? 'high';

    // ── 5. Resolve projectId from unit document ──
    const db = getAdminFirestore();
    let projectId: string | null = null;
    try {
      const unitDoc = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();
      if (unitDoc.exists) {
        projectId = String(unitDoc.data()?.projectId ?? '') || null;
      }
    } catch {
      // Non-fatal: task still created without projectId
      logger.warn('Failed to resolve projectId for complaint task', { unitId });
    }

    // ── 6. Create task with enterprise ID ──
    const { generateTaskId } = await import('@/services/enterprise-id.service');
    const taskId = generateTaskId();
    const now = new Date().toISOString();

    const taskData: Record<string, unknown> = {
      companyId: ctx.companyId,
      title: `Παράπονο: ${title}`,
      description,
      type: 'complaint',
      priority,
      status: 'pending',
      contactId: contact.contactId,
      unitId,
      projectId: projectId ?? null,
      assignedTo: '',
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'ai_complaint_triage',
        channel: ctx.channel,
        severity,
        reportedBy: contact.displayName,
      },
    };

    await db.collection(COLLECTIONS.TASKS).doc(taskId).set(taskData);

    // ── 7. Audit trail ──
    await this.auditWrite(ctx, COLLECTIONS.TASKS, taskId, 'create', taskData);

    logger.info('Complaint task created', {
      taskId,
      severity,
      priority,
      unitId,
      contactId: contact.contactId,
      requestId: ctx.requestId,
    });

    // ── 8. URGENT: Server-side admin notification via Telegram ──
    let notifiedAdmin = false;
    if (severity === 'urgent') {
      try {
        const { getAdminTelegramChatId } = await import(
          '@/services/ai-pipeline/shared/super-admin-resolver'
        );
        const adminChatId = await getAdminTelegramChatId();
        if (adminChatId) {
          const { sendChannelReply } = await import(
            '@/services/ai-pipeline/shared/channel-reply-dispatcher'
          );
          const truncatedDesc = description.length > 200
            ? `${description.substring(0, 200)}…`
            : description;
          await sendChannelReply({
            channel: 'telegram',
            telegramChatId: adminChatId,
            textBody: `🚨 ΕΠΕΙΓΟΝ ΠΑΡΑΠΟΝΟ\n\n📋 ${title}\n👤 ${contact.displayName}\n🏠 Unit: ${unitId}\n\n${truncatedDesc}`,
            requestId: ctx.requestId,
          });
          notifiedAdmin = true;
        }
      } catch (notifyError) {
        // Non-fatal: task was created, notification is best-effort
        logger.warn('Failed to send admin notification for urgent complaint', {
          taskId,
          requestId: ctx.requestId,
          error: getErrorMessage(notifyError),
        });
      }
    }

    return {
      success: true,
      data: { taskId, priority, severity, notifiedAdmin },
      count: 1,
    };
  }

  // ==========================================================================
  // SPEC-257E: APPEND-ONLY CONTACT UPDATES
  // ==========================================================================

  /** Label → PhoneInfo.type mapping (Greek + English, defined ONCE) — type derived from SSoT */
  private static readonly PHONE_LABEL_MAP: Record<string, PhoneInfo['type']> = {
    'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
    'σπίτι': 'home', 'home': 'home',
    'κινητό': 'mobile', 'mobile': 'mobile',
    'fax': 'fax', 'φαξ': 'fax',
  };

  /** Label → EmailInfo.type mapping — type derived from SSoT */
  private static readonly EMAIL_LABEL_MAP: Record<string, EmailInfo['type']> = {
    'προσωπικό': 'personal', 'personal': 'personal', 'προσωπικά': 'personal',
    'εργασία': 'work', 'δουλειά': 'work', 'work': 'work', 'γραφείο': 'work',
  };

  /** Label → SocialMediaInfo.platform mapping — type derived from SSoT */
  private static readonly SOCIAL_PLATFORM_MAP: Record<string, SocialMediaInfo['platform']> = {
    'facebook': 'facebook', 'fb': 'facebook',
    'twitter': 'twitter', 'x': 'twitter',
    'linkedin': 'linkedin',
    'instagram': 'instagram', 'insta': 'instagram',
    'youtube': 'youtube',
    'github': 'github',
  };

  /**
   * append_contact_info: Customer adds phone/email/social to OWN contact.
   * APPEND-ONLY — cannot delete or modify existing entries.
   *
   * Security:
   * - Only recognized contacts can use this (no admin required)
   * - Server uses ctx.contactMeta.contactId — AI cannot specify contactId
   * - Validates phone/email format via SSoT validators
   * - Duplicate detection by value before append
   *
   * @see SPEC-257E (Append-Only Contact Updates)
   */
  private async executeAppendContactInfo(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    // ── 1. Security: Must be a recognized contact ──
    const contact = ctx.contactMeta;
    if (!contact?.contactId) {
      return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
    }

    // ── 2. Validate fieldType ──
    const fieldType = String(args.fieldType ?? '');
    const value = String(args.value ?? '').trim();
    const label = String(args.label ?? '').trim().toLowerCase();

    if (!CONTACT_FIELD_TYPES.includes(fieldType as ContactFieldType)) {
      return { success: false, error: `fieldType must be one of: ${CONTACT_FIELD_TYPES.join(', ')}` };
    }
    if (!value) {
      return { success: false, error: 'value is required' };
    }

    // ── 3. Validate value format (SSoT validators) ──
    if (fieldType === 'phone') {
      const { isValidPhone } = await import('@/lib/validation/phone-validation');
      if (!isValidPhone(value)) {
        return { success: false, error: `Μη έγκυρο τηλέφωνο: "${value}". Αποδεκτά: ελληνικό (69XXXXXXXX, 2XXXXXXXXX) ή διεθνές (+XXXXXXXXXXX).` };
      }
    } else if (fieldType === 'email') {
      const { isValidEmail } = await import('@/lib/validation/email-validation');
      if (!isValidEmail(value)) {
        return { success: false, error: `Μη έγκυρο email: "${value}".` };
      }
    }
    // social: any non-empty string is valid (username or URL)

    // ── 4. Fetch current contact document ──
    const db = getAdminFirestore();
    const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(contact.contactId).get();
    if (!contactDoc.exists) {
      return { success: false, error: 'Η επαφή δεν βρέθηκε.' };
    }
    const contactData = contactDoc.data() as Record<string, unknown>;

    // ── 5. Duplicate check + Append ──
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (fieldType === 'phone') {
      const { cleanPhoneNumber } = await import('@/lib/validation/phone-validation');
      const cleanedPhone = cleanPhoneNumber(value);
      const currentPhones = (contactData.phones ?? []) as Array<{ number: string }>;
      if (currentPhones.some(p => cleanPhoneNumber(p.number) === cleanedPhone)) {
        return { success: false, error: `Το τηλέφωνο ${value} υπάρχει ήδη.` };
      }
      const phoneType = AgenticToolExecutor.PHONE_LABEL_MAP[label] ?? 'mobile';
      const newEntry = {
        number: cleanedPhone,
        type: phoneType,
        isPrimary: false,
        ...(label && !AgenticToolExecutor.PHONE_LABEL_MAP[label] ? { label } : {}),
      };
      updatePayload.phones = [...currentPhones, newEntry];
    } else if (fieldType === 'email') {
      const normalizedEmail = value.toLowerCase().trim();
      const currentEmails = (contactData.emails ?? []) as Array<{ email: string }>;
      if (currentEmails.some(e => e.email.toLowerCase() === normalizedEmail)) {
        return { success: false, error: `Το email ${value} υπάρχει ήδη.` };
      }
      const emailType = AgenticToolExecutor.EMAIL_LABEL_MAP[label] ?? 'personal';
      const newEntry = {
        email: normalizedEmail,
        type: emailType,
        isPrimary: false,
        ...(label && !AgenticToolExecutor.EMAIL_LABEL_MAP[label] ? { label } : {}),
      };
      updatePayload.emails = [...currentEmails, newEntry];
    } else {
      // social
      const currentSocial = (contactData.socialMedia ?? []) as Array<{ username: string; url?: string }>;
      if (currentSocial.some(s => s.username === value || s.url === value)) {
        return { success: false, error: `Το social media ${value} υπάρχει ήδη.` };
      }
      const platform = AgenticToolExecutor.SOCIAL_PLATFORM_MAP[label] ?? 'other';
      const { isValidUrl } = await import('@/lib/validation/email-validation');
      const newEntry = {
        platform,
        username: value,
        ...(isValidUrl(value) ? { url: value } : {}),
        ...(label && !AgenticToolExecutor.SOCIAL_PLATFORM_MAP[label] ? { label } : {}),
      };
      updatePayload.socialMedia = [...currentSocial, newEntry];
    }

    // ── 6. Update contact document ──
    await db.collection(COLLECTIONS.CONTACTS).doc(contact.contactId).update(updatePayload);

    // ── 7. Audit trail ──
    await this.auditWrite(ctx, COLLECTIONS.CONTACTS, contact.contactId, 'append', updatePayload);

    logger.info('Contact info appended', {
      contactId: contact.contactId,
      fieldType,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { contactId: contact.contactId, fieldType, value, added: true },
      count: 1,
    };
  }

  // ==========================================================================
  // SPEC-257F: DELIVER FILE TO CHAT (Photo / Floorplan / Document)
  // ==========================================================================

  /**
   * SPEC-257F: Image content types recognized as photos (sent via sendPhoto).
   * Everything else (PDF, DXF, etc.) is sent as a document.
   */
  private static readonly PHOTO_CONTENT_TYPES: ReadonlySet<string> = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  ]);

  /** File extensions recognized as photos */
  private static readonly PHOTO_EXTENSIONS: ReadonlySet<string> = new Set([
    'jpg', 'jpeg', 'png', 'webp', 'gif',
  ]);

  /**
   * deliver_file_to_chat: Send photo/floorplan/document to the current chat.
   * Entity-reference pattern: AI provides sourceType + entityId, server resolves URL.
   *
   * Security:
   * - Only recognized contacts with linkedUnitIds can use this
   * - unit_photo: unitId must be in linkedUnitIds
   * - file: file's entity must belong to accessible unit/project
   * - floorplan: floorplan's projectId must be in linked projects
   *
   * @see SPEC-257F (Photo & Floorplan Delivery)
   */
  private async executeDeliverFileToChat(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    // ── 1. Security: Must be a recognized contact with linked units ──
    const contact = ctx.contactMeta;
    if (!contact) {
      return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
    }

    const linkedUnitIds = contact.linkedUnitIds ?? [];
    if (linkedUnitIds.length === 0) {
      return { success: false, error: AI_ERRORS.NO_LINKED_UNITS };
    }

    // ── 2. Validate inputs ──
    const sourceType = String(args.sourceType ?? '');
    const sourceId = String(args.sourceId ?? '').trim();
    const caption = args.caption != null ? String(args.caption).trim() : undefined;

    if (!FILE_SOURCE_TYPES.includes(sourceType as FileSourceType)) {
      return { success: false, error: `sourceType must be one of: ${FILE_SOURCE_TYPES.join(', ')}` };
    }
    if (!sourceId) {
      return { success: false, error: 'sourceId is required' };
    }

    const db = getAdminFirestore();

    // ── 3. Resolve URL based on sourceType ──
    let mediaUrls: Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }> = [];

    if (sourceType === 'unit_photo') {
      // ── 3a. Unit photos: validate unit access, fetch photoURL / multiplePhotoURLs ──
      if (!linkedUnitIds.includes(sourceId)) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το ακίνητο.' };
      }

      const unitDoc = await db.collection(COLLECTIONS.UNITS).doc(sourceId).get();
      if (!unitDoc.exists) {
        return { success: false, error: 'Το ακίνητο δεν βρέθηκε.' };
      }

      const unitData = unitDoc.data() as Record<string, unknown>;
      const allPhotoUrls: string[] = [];

      if (typeof unitData.photoURL === 'string' && unitData.photoURL) {
        allPhotoUrls.push(unitData.photoURL);
      }
      if (Array.isArray(unitData.multiplePhotoURLs)) {
        for (const url of unitData.multiplePhotoURLs) {
          if (typeof url === 'string' && url && !allPhotoUrls.includes(url)) {
            allPhotoUrls.push(url);
          }
        }
      }

      if (allPhotoUrls.length === 0) {
        return { success: false, error: 'Δεν υπάρχουν φωτογραφίες για αυτό το ακίνητο.' };
      }

      mediaUrls = allPhotoUrls.map((url, i) => ({
        url,
        mediaType: 'photo' as const,
        filename: `photo_${i + 1}.jpg`,
        contentType: 'image/jpeg',
      }));

    } else if (sourceType === 'file') {
      // ── 3b. File record: validate entity access chain ──
      const fileDoc = await db.collection(COLLECTIONS.FILES).doc(sourceId).get();
      if (!fileDoc.exists) {
        return { success: false, error: 'Το αρχείο δεν βρέθηκε.' };
      }

      const fileData = fileDoc.data() as Record<string, unknown>;
      if (fileData.isDeleted) {
        return { success: false, error: 'Το αρχείο έχει διαγραφεί.' };
      }

      // Access validation: entity must belong to buyer's accessible scope
      const entityType = String(fileData.entityType ?? '');
      const entityId = String(fileData.entityId ?? '');
      const fileProjectId = String(fileData.projectId ?? '');

      const linkedProjectIds = [...new Set(
        (contact.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
      )];

      let hasAccess = false;
      if (entityType === 'unit') {
        hasAccess = linkedUnitIds.includes(entityId);
      } else if (entityType === 'building' || entityType === 'project') {
        hasAccess = linkedProjectIds.includes(fileProjectId);
      } else {
        // For other entity types, check project ownership
        hasAccess = fileProjectId ? linkedProjectIds.includes(fileProjectId) : false;
      }

      if (!hasAccess) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το αρχείο.' };
      }

      const downloadUrl = String(fileData.downloadUrl ?? '');
      if (!downloadUrl) {
        return { success: false, error: 'Το αρχείο δεν είναι διαθέσιμο αυτή τη στιγμή.' };
      }

      const ext = String(fileData.ext ?? '').toLowerCase();
      const ct = String(fileData.contentType ?? 'application/octet-stream');
      const isPhoto = AgenticToolExecutor.PHOTO_CONTENT_TYPES.has(ct)
        || AgenticToolExecutor.PHOTO_EXTENSIONS.has(ext);

      mediaUrls = [{
        url: downloadUrl,
        mediaType: isPhoto ? 'photo' : 'document',
        filename: String(fileData.originalFilename ?? fileData.displayName ?? `file.${ext}`),
        contentType: ct,
      }];

    } else if (sourceType === 'floorplan') {
      // ── 3c. Floorplan: validate project access ──
      const fpDoc = await db.collection(COLLECTIONS.FLOORPLANS).doc(sourceId).get();
      if (!fpDoc.exists) {
        return { success: false, error: 'Η κάτοψη δεν βρέθηκε.' };
      }

      const fpData = fpDoc.data() as Record<string, unknown>;
      const fpProjectId = String(fpData.projectId ?? '');

      const linkedProjectIds = [...new Set(
        (contact.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
      )];

      if (!linkedProjectIds.includes(fpProjectId)) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτή την κάτοψη.' };
      }

      // Check for sendable format (PDF or image URL)
      const pdfImageUrl = String(fpData.pdfImageUrl ?? '');
      const fpDownloadUrl = String(fpData.downloadUrl ?? '');
      const fileType = String(fpData.fileType ?? '');

      let resolvedUrl = '';
      let resolvedMediaType: 'photo' | 'document' = 'document';

      if (pdfImageUrl) {
        // PDF floorplan rendered as image
        resolvedUrl = pdfImageUrl;
        resolvedMediaType = 'photo';
      } else if (fpDownloadUrl) {
        // File-record-based floorplan (PDF or image)
        resolvedUrl = fpDownloadUrl;
        resolvedMediaType = fileType === 'pdf' ? 'document' : 'photo';
      } else if (fpData.scene) {
        // DXF scene data — compressed JSON, cannot be sent as file
        return { success: false, error: 'Η κάτοψη αυτή είναι μόνο σε μορφή CAD (DXF). Δεν είναι δυνατή η αποστολή μέσω μηνύματος.' };
      } else {
        return { success: false, error: 'Η κάτοψη δεν είναι διαθέσιμη σε μορφή αρχείου.' };
      }

      const fpName = String(fpData.fileName ?? fpData.type ?? 'floorplan');
      mediaUrls = [{
        url: resolvedUrl,
        mediaType: resolvedMediaType,
        filename: fpName.includes('.') ? fpName : `${fpName}.pdf`,
        contentType: resolvedMediaType === 'photo' ? 'image/png' : 'application/pdf',
      }];
    }

    // ── 4. Send via channel (supports multiple photos) ──
    const { sendChannelMediaReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    let sentCount = 0;
    let lastError = '';
    const totalFiles = mediaUrls.length;

    // Build channel-specific IDs from context
    // telegramChatId is explicit; for other channels, channelSenderId carries the recipient address
    const channelIds: Record<string, string | undefined> = {
      telegramChatId: ctx.telegramChatId,
      recipientEmail: ctx.channel === 'email' ? ctx.channelSenderId : undefined,
      whatsappPhone: ctx.channel === 'whatsapp' ? ctx.channelSenderId : undefined,
      messengerPsid: ctx.channel === 'messenger' ? ctx.channelSenderId : undefined,
      instagramIgsid: ctx.channel === 'instagram' ? ctx.channelSenderId : undefined,
    };

    for (let i = 0; i < mediaUrls.length; i++) {
      const media = mediaUrls[i];
      const fileCaption = caption
        ?? (totalFiles > 1 ? `${media.filename} (${i + 1}/${totalFiles})` : media.filename);

      const sendResult = await sendChannelMediaReply({
        channel: ctx.channel as import('@/types/ai-pipeline').PipelineChannelValue,
        ...channelIds,
        mediaUrl: media.url,
        mediaType: media.mediaType,
        caption: fileCaption,
        filename: media.filename,
        contentType: media.contentType,
        requestId: ctx.requestId,
      });

      if (sendResult.success) {
        sentCount++;
      } else {
        lastError = sendResult.error ?? 'Αποτυχία αποστολής';
      }
    }

    // ── 5. Audit trail (fire-and-forget) ──
    this.auditWrite(ctx, 'file_delivery', sourceId, 'deliver', {
      sourceType,
      sourceId,
      sentCount,
      totalFiles,
      channel: ctx.channel,
    }).catch(() => { /* non-fatal */ });

    logger.info('File delivery completed', {
      sourceType,
      sourceId,
      sentCount,
      totalFiles,
      channel: ctx.channel,
      requestId: ctx.requestId,
    });

    if (sentCount === 0) {
      return { success: false, error: lastError || 'Αποτυχία αποστολής αρχείων.' };
    }

    return {
      success: true,
      data: { sourceType, sourceId, sentCount, totalFiles },
      count: sentCount,
    };
  }

  // ==========================================================================
  // SPEC-257G: KNOWLEDGE BASE — Legal Procedures & Required Documents
  // ==========================================================================

  /**
   * search_knowledge_base: Search legal procedures and check document availability.
   *
   * Flow:
   * 1. Keyword match against LEGAL_PROCEDURES config (SSoT)
   * 2. For matching procedures, check which source:"system" docs exist in files collection
   * 3. Return enriched result with availability markers
   *
   * Security: Available to all customer roles (buyer/owner/tenant).
   * No admin restriction — this is informational, read-only.
   *
   * @see SPEC-257G (Knowledge Base — Procedures & Documents)
   */
  private async executeSearchKnowledgeBase(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, error: 'query is required' };
    }

    // ── 1. Search procedures by keyword ──
    const { searchProcedures, DOCUMENT_SOURCE_LABELS } = await import(
      '@/config/legal-procedures-kb'
    );

    const matches = searchProcedures(query);

    if (matches.length === 0) {
      return {
        success: true,
        data: {
          message: 'Δεν βρέθηκε σχετική διαδικασία.',
          suggestion: 'Δοκιμάστε: "συμβόλαιο", "δάνειο", "μεταβίβαση", "προσύμφωνο"',
          procedures: [],
        },
        count: 0,
      };
    }

    // ── 2. For top match(es), check document availability ──
    const db = getAdminFirestore();
    const linkedUnitIds = ctx.contactMeta?.linkedUnitIds ?? [];
    const linkedProjectIds = [...new Set(
      (ctx.contactMeta?.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
    )];

    // Collect all searchTerms from system documents that need availability check
    // Map: searchTerm → Set of document names that use this term
    const termToDocNames = new Map<string, Set<string>>();
    for (const { procedure } of matches.slice(0, 2)) {
      for (const doc of procedure.requiredDocuments) {
        if (doc.source === 'system' && doc.searchTerms.length > 0) {
          for (const term of doc.searchTerms) {
            const existing = termToDocNames.get(term) ?? new Set();
            existing.add(doc.name);
            termToDocNames.set(term, existing);
          }
        }
      }
    }

    // Query files collection and match against searchTerms
    const availableDocNames = new Set<string>();

    if (termToDocNames.size > 0 && (linkedUnitIds.length > 0 || linkedProjectIds.length > 0)) {
      try {
        const filesQuery = db.collection(COLLECTIONS.FILES)
          .where('companyId', '==', ctx.companyId)
          .where('status', '==', 'ready')
          .limit(100);

        const filesSnap = await filesQuery.get();

        for (const fileDoc of filesSnap.docs) {
          const data = fileDoc.data();
          const purpose = String(data.purpose ?? '').toLowerCase();
          const category = String(data.category ?? '').toLowerCase();
          const displayName = String(data.displayName ?? '').toLowerCase();
          const entityId = String(data.entityId ?? '');
          const projectId = String(data.projectId ?? '');

          // Check if file is accessible to this user
          const isAccessible =
            linkedUnitIds.includes(entityId) ||
            linkedProjectIds.includes(projectId) ||
            linkedProjectIds.includes(entityId);

          if (!isAccessible) continue;

          // Combine all searchable text from file record
          const searchableText = `${purpose} ${category} ${displayName}`;

          // Match search terms against file record fields
          for (const [term, docNames] of termToDocNames) {
            if (searchableText.includes(term.toLowerCase())) {
              for (const name of docNames) {
                availableDocNames.add(name);
              }
            }
          }
        }
      } catch (err) {
        // Non-fatal: proceed without availability info
        logger.warn('Failed to check document availability for KB', {
          requestId: ctx.requestId,
          error: getErrorMessage(err),
        });
      }
    }

    // ── 3. Build enriched response ──
    const enrichedProcedures = matches.slice(0, 2).map(({ procedure, matchScore }) => ({
      id: procedure.id,
      title: procedure.title,
      category: procedure.category,
      description: procedure.description,
      matchScore,
      requiredDocuments: procedure.requiredDocuments.map(doc => ({
        name: doc.name,
        source: doc.source,
        sourceLabel: DOCUMENT_SOURCE_LABELS[doc.source],
        availableInSystem: availableDocNames.has(doc.name),
        canBeSent: availableDocNames.has(doc.name),
      })),
    }));

    logger.info('Knowledge base search completed', {
      query,
      matchCount: matches.length,
      topMatch: enrichedProcedures[0]?.id,
      availableDocsCount: availableKeys.size,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { procedures: enrichedProcedures },
      count: enrichedProcedures.length,
    };
  }

  /**
   * send_email_to_contact: Find contact by name and send email
   */
  private async executeSendEmail(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Email sending is restricted to admin only' };
    }

    const contactName = String(args.contactName ?? '');
    const subject = String(args.subject ?? 'Μήνυμα');
    const body = String(args.body ?? '');

    if (!contactName) {
      return { success: false, error: 'contactName is required' };
    }

    // Search for contact — supports Greek↔Latin + fuzzy substring matching
    const db = getAdminFirestore();
    const searchWords = contactName.toLowerCase().split(/\s+/).filter(Boolean);
    // Generate Latin transliterations of Greek search words
    const latinWords = searchWords.map(w => greekToLatin(w)).filter(Boolean);
    // Generate short stems (first 3-4 chars) for fuzzy matching
    // "Γιώργου" → stem "γιωργ" which matches "γεωργ" less well, but
    // Latin "giorg" matches "georgi" via substring
    const stems = [...searchWords, ...latinWords]
      .filter(w => w.length >= 3)
      .map(w => w.substring(0, Math.min(w.length, 4)));
    const allSearchTerms = [...new Set([...searchWords, ...latinWords, ...stems])];

    const contactsSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
      .limit(50)
      .get();

    const matchingContacts = contactsSnap.docs.filter(doc => {
      const data = doc.data();
      // Build searchable text from ALL name fields + Latin transliteration
      const nameFields = [
        data.displayName, data.firstName, data.lastName, data.name, data.tradeName,
      ].filter(Boolean).map(v => String(v).toLowerCase());
      const searchableText = nameFields.join(' ');
      // Also add Latin version of stored names for reverse matching
      const latinText = nameFields.map(n => greekToLatin(n)).filter(Boolean).join(' ');
      const fullText = `${searchableText} ${latinText}`;

      // Any search term (Greek, Latin, or stem) must match in full text
      return allSearchTerms.some(term => fullText.includes(term));
    });

    if (matchingContacts.length === 0) {
      return { success: false, error: `Contact "${contactName}" not found` };
    }

    const contact = matchingContacts[0];
    const contactData = contact.data();
    // Email can be top-level string OR in emails[] array (Nestor contact format)
    const emailsArray = Array.isArray(contactData.emails) ? contactData.emails as Array<{ email?: string; isPrimary?: boolean }> : [];
    const primaryEmail = emailsArray.find(e => e.isPrimary)?.email ?? emailsArray[0]?.email;
    const email = String(primaryEmail ?? contactData.email ?? '');

    if (!email) {
      return {
        success: false,
        error: `Contact "${contactData.displayName ?? contactName}" has no email address`,
      };
    }

    // 🏢 ENTERPRISE: Wrap in branded HTML template (logo, colors, footer)
    const { wrapInBrandedTemplate, escapeHtml } = await import(
      '@/services/email-templates'
    );

    const recipientName = String(contactData.displayName ?? contactData.firstName ?? contactName);
    const contentHtml = `
      <p style="margin: 0 0 16px;">Αγαπητέ/ή ${escapeHtml(recipientName)},</p>
      <p style="margin: 0 0 16px;">${escapeHtml(body)}</p>
      <p style="margin: 24px 0 0; color: #6B7280;">Με εκτίμηση,<br/>Pagonis Energo</p>
    `;

    const htmlBody = wrapInBrandedTemplate({ contentHtml });

    // Download attachments from Firebase Storage (if provided)
    const attachmentPaths = Array.isArray(args.attachmentPaths) ? args.attachmentPaths as string[] : [];
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (attachmentPaths.length > 0) {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage().bucket();

      for (const storagePath of attachmentPaths.slice(0, 5)) { // Max 5 attachments
        try {
          const file = bucket.file(storagePath);
          const [buffer] = await file.download();
          const [metadata] = await file.getMetadata();
          const filename = storagePath.split('/').pop() ?? 'attachment';
          attachments.push({
            filename,
            content: buffer,
            contentType: String(metadata.contentType ?? 'application/octet-stream'),
          });
        } catch {
          logger.warn('Failed to download attachment', { path: storagePath });
        }
      }
    }

    // Send email via channel reply dispatcher
    const { sendChannelReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    const result = await sendChannelReply({
      channel: 'email',
      recipientEmail: email,
      subject,
      textBody: body,
      htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      requestId: ctx.requestId,
    });

    return {
      success: result.success,
      data: {
        recipientName: contactData.displayName ?? contactName,
        recipientEmail: email,
        messageId: result.messageId ?? null,
      },
      error: result.error,
    };
  }

  /**
   * send_telegram_message: Send a Telegram message
   */
  private async executeSendTelegram(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Telegram sending is restricted to admin only' };
    }

    const chatId = String(args.chatId ?? ctx.telegramChatId ?? '');
    const text = String(args.text ?? '');

    if (!chatId || !text) {
      return { success: false, error: 'chatId and text are required' };
    }

    const { sendChannelReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    const result = await sendChannelReply({
      channel: 'telegram',
      telegramChatId: chatId,
      textBody: text,
      requestId: ctx.requestId,
    });

    return {
      success: result.success,
      data: { chatId, sent: result.success },
      error: result.error,
    };
  }

  /**
   * get_collection_schema: Return schema info about a collection
   */
  /**
   * send_messenger_message / send_instagram_message: Send social message to contact
   * SSoT: Single method for both Messenger + Instagram — only the channel differs.
   */
  private async executeSendSocialMessage(
    args: Record<string, unknown>,
    ctx: AgenticContext,
    channel: 'messenger' | 'instagram',
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Social messaging is restricted to admin only' };
    }

    const contactName = String(args.contactName ?? '');
    const text = String(args.text ?? '');

    if (!contactName || !text) {
      return { success: false, error: 'contactName and text are required' };
    }

    // 1. Find contact (reuse fuzzy Greek↔Latin matching)
    const db = getAdminFirestore();
    const searchWords = contactName.toLowerCase().split(/\s+/).filter(Boolean);
    const latinWords = searchWords.map(w => greekToLatin(w)).filter(Boolean);
    const stems = [...searchWords, ...latinWords]
      .filter(w => w.length >= 3)
      .map(w => w.substring(0, Math.min(w.length, 4)));
    const allSearchTerms = [...new Set([...searchWords, ...latinWords, ...stems])];

    const contactsSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
      .limit(50)
      .get();

    const matchingContacts = contactsSnap.docs.filter(doc => {
      const data = doc.data();
      const nameFields = [data.displayName, data.firstName, data.lastName, data.name]
        .filter(Boolean).map(v => String(v).toLowerCase());
      const fullText = nameFields.join(' ');
      const latinText = nameFields.map(n => greekToLatin(n)).filter(Boolean).join(' ');
      return allSearchTerms.some(term => `${fullText} ${latinText}`.includes(term));
    });

    if (matchingContacts.length === 0) {
      return { success: false, error: `Contact "${contactName}" not found` };
    }

    const contactId = matchingContacts[0].id;
    const contactData = matchingContacts[0].data();
    const contactDisplayName = String(contactData.displayName ?? contactData.firstName ?? contactName);

    // 2. Find social identity (PSID for Messenger, IGSID for Instagram)
    const platform = channel === 'messenger' ? 'messenger' : 'instagram';
    const identitiesSnap = await db
      .collection(COLLECTIONS.EXTERNAL_IDENTITIES)
      .where('contactId', '==', contactId)
      .where('platform', '==', platform)
      .limit(1)
      .get();

    if (identitiesSnap.empty) {
      return {
        success: false,
        error: `Ο ${contactDisplayName} δεν έχει ${channel === 'messenger' ? 'Messenger' : 'Instagram'} identity. Πρέπει να έχει στείλει πρώτα μήνυμα στη σελίδα σου.`,
      };
    }

    const identity = identitiesSnap.docs[0].data();
    const recipientId = String(identity.platformUserId ?? identity.psid ?? identity.igsid ?? '');

    if (!recipientId) {
      return { success: false, error: `No ${platform} user ID found for ${contactDisplayName}` };
    }

    // 3. Send message via channel dispatcher
    const { sendChannelReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    const result = await sendChannelReply({
      channel,
      ...(channel === 'messenger' ? { messengerPsid: recipientId } : { instagramIgsid: recipientId }),
      textBody: text,
      requestId: ctx.requestId,
    });

    return {
      success: result.success,
      data: {
        recipientName: contactDisplayName,
        platform: channel,
        recipientId,
        messageId: result.messageId ?? null,
      },
      error: result.error,
    };
  }

  private async executeGetCollectionSchema(
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');
    const schema = getCollectionSchemaInfo(collection);

    if (!schema) {
      return {
        success: false,
        error: `No schema info for collection "${collection}". Available: ${[...ALLOWED_READ_COLLECTIONS].join(', ')}`,
      };
    }

    return { success: true, data: schema };
  }

  /**
   * search_text: Full-text search across multiple collections
   */
  private async executeSearchText(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const searchTerm = String(args.searchTerm ?? '').toLowerCase();
    // Split into words and generate Latin transliterations + stems per word
    const words = searchTerm.split(/\s+/).filter(w => w.length >= 2);
    const latinWords = words.map(w => greekToLatin(w)).filter(Boolean);
    const stems = [...words, ...latinWords]
      .filter(w => w.length >= 3)
      .map(w => w.substring(0, Math.min(w.length, 4)));
    const allSearchTerms = [...new Set([...words, ...latinWords, ...stems])];

    const collections = Array.isArray(args.collections)
      ? (args.collections as string[]).filter(c => ALLOWED_READ_COLLECTIONS.has(c))
      : [];
    const limit = Math.min(
      typeof args.limit === 'number' ? args.limit : 10,
      20
    );

    if (!searchTerm || collections.length === 0) {
      return { success: false, error: 'searchTerm and collections are required' };
    }

    const db = getAdminFirestore();
    const allResults: Record<string, Array<Record<string, unknown>>> = {};
    let totalCount = 0;

    // Search text fields in each collection
    const searchFields = ['name', 'displayName', 'title', 'description', 'firstName', 'lastName', 'tradeName'];

    for (const collection of collections) {
      const snap = await db
        .collection(collection)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .limit(100) // Fetch more to filter client-side
        .get();

      const matches = snap.docs
        .filter(doc => {
          const data = doc.data();
          return searchFields.some(field => {
            const val = data[field];
            if (typeof val !== 'string') return false;
            const valLower = val.toLowerCase();
            const valLatin = greekToLatin(valLower);
            const fullVal = valLatin ? `${valLower} ${valLatin}` : valLower;
            // Match any search term against original + transliterated value
            return allSearchTerms.some(term => fullVal.includes(term));
          });
        })
        .slice(0, limit)
        .map(doc => ({
          id: doc.id,
          ...this.redactRoleBlockedFields(this.redactSensitiveFields(doc.data()), ctx),
        }));

      if (matches.length > 0) {
        allResults[collection] = matches;
        totalCount += matches.length;
      }
    }

    return {
      success: true,
      data: allResults,
      count: totalCount,
    };
  }

  // ==========================================================================
  // SECURITY HELPERS
  // ==========================================================================

  /**
   * Execute Firestore query with progressive fallback — NEVER throws FAILED_PRECONDITION.
   * Fallback chain: full query → drop orderBy → drop nested filters → companyId only → no filters.
   */
  private async executeWithFallback(
    db: FirebaseFirestore.Firestore,
    collection: string,
    filters: QueryFilter[],
    orderBy: string | null,
    orderDirection: 'asc' | 'desc',
    limit: number,
    ctx: AgenticContext,
  ): Promise<FirebaseFirestore.QuerySnapshot> {
    const nestedFilters = filters.filter(f => f.field.includes('.'));
    const flatFilters = filters.filter(f => !f.field.includes('.'));
    const companyFilter = filters.find(f => f.field === 'companyId');

    // Chain of fallback attempts — each progressively simpler
    const attempts: Array<{ label: string; build: () => FirebaseFirestore.Query }> = [
      {
        label: 'full query',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          for (const f of filters) {
            const op = this.mapOperator(f.operator);
            if (op) q = q.where(f.field, op, this.coerceFilterValue(f.value));
          }
          if (orderBy) q = q.orderBy(orderBy, orderDirection);
          return q.limit(limit);
        },
      },
      {
        label: 'without orderBy',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          for (const f of filters) {
            const op = this.mapOperator(f.operator);
            if (op) q = q.where(f.field, op, this.coerceFilterValue(f.value));
          }
          return q.limit(limit);
        },
      },
      {
        label: 'flat filters only (no nested)',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          for (const f of flatFilters) {
            const op = this.mapOperator(f.operator);
            if (op) q = q.where(f.field, op, this.coerceFilterValue(f.value));
          }
          return q.limit(limit);
        },
      },
      {
        label: 'companyId only',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          if (companyFilter) {
            q = q.where('companyId', '==', this.coerceFilterValue(companyFilter.value));
          }
          return q.limit(limit);
        },
      },
    ];

    for (const attempt of attempts) {
      try {
        const snapshot = await attempt.build().get();
        if (attempt.label !== 'full query') {
          logger.warn('Query fallback succeeded', {
            requestId: ctx.requestId,
            collection,
            fallbackLevel: attempt.label,
            droppedNested: nestedFilters.map(f => f.field),
          });
          // 🧠 Record strategy (fire-and-forget)
          const droppedFields = [...nestedFilters.map(f => f.field), ...(orderBy ? [orderBy] : [])];
          if (droppedFields.length > 0) {
            recordQueryStrategy({
              collection,
              failedFilters: droppedFields,
              failedReason: 'FAILED_PRECONDITION',
              successfulFilters: flatFilters.map(f => f.field),
            }).catch(() => { /* non-fatal */ });
          }
        }
        return snapshot;
      } catch (err) {
        const msg = getErrorMessage(err);
        if (!msg.includes('FAILED_PRECONDITION')) throw err; // Only catch index errors
        logger.warn(`Query attempt "${attempt.label}" failed, trying next`, {
          requestId: ctx.requestId, collection,
        });
      }
    }

    // Should never reach here, but just in case
    return db.collection(collection).limit(limit).get();
  }

  /**
   * Ensure companyId filter is present in all queries (tenant isolation)
   */
  private enforceCompanyScope(
    filters: QueryFilter[],
    companyId: string,
    collection: string
  ): QueryFilter[] {
    // Collections where companyId is optional or missing — strip any companyId filter
    // These are child collections linked via parentId (buildingId, phaseId)
    // Data isolation for these is enforced via their parent (buildings.companyId)
    const collectionsWithOptionalCompanyId = new Set([
      COLLECTIONS.BUILDINGS,
      COLLECTIONS.FLOORS,
      COLLECTIONS.CONSTRUCTION_PHASES,
      COLLECTIONS.CONSTRUCTION_TASKS,
    ]);
    // Subcollections (e.g. units/{id}/payment_plans) don't have companyId — skip
    const isSubcollection = collection.includes('/');
    if (collectionsWithOptionalCompanyId.has(collection) || isSubcollection) {
      return filters.filter(f => f.field !== 'companyId');
    }

    const hasCompanyFilter = filters.some(f => f.field === 'companyId');
    if (hasCompanyFilter) {
      // Override any user-provided companyId (prevent cross-tenant access)
      return filters.map(f =>
        f.field === 'companyId' ? { ...f, value: companyId } : f
      );
    }

    // Inject companyId filter
    return [
      { field: 'companyId', operator: '==', value: companyId },
      ...filters,
    ];
  }

  /**
   * Coerce string values to their appropriate Firestore types.
   * OpenAI strict mode requires all values as strings, but Firestore
   * does strict type matching. This converts:
   *   "true"/"false" → boolean
   *   numeric strings → number
   *   "null" → null
   *   everything else → string
   */
  private coerceFilterValue(value: string | number | boolean | null | string[]): string | number | boolean | null | string[] {
    // Arrays pass through (for 'in' operator)
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;

    // Boolean coercion
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null coercion
    if (value === 'null') return null;

    // Number coercion (only if the entire string is a valid number)
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num)) return num;
    }

    return value;
  }

  /**
   * Map string operator to Firestore operator
   */
  private mapOperator(
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
   * gpt-4o-mini struggles with deeply nested JSON — this makes key fields
   * immediately visible (e.g., "paymentRemaining: 100000" instead of
   * commercial.paymentSummary.remainingAmount).
   */
  private flattenNestedFields(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    // Flatten commercial object (units)
    const commercial = data.commercial as Record<string, unknown> | undefined;
    if (commercial && typeof commercial === 'object') {
      if (commercial.askingPrice != null) result._askingPrice = commercial.askingPrice;
      if (commercial.finalPrice != null) result._finalPrice = commercial.finalPrice;
      if (commercial.buyerName != null) result._buyerName = commercial.buyerName;
      if (commercial.buyerContactId != null) result._buyerContactId = commercial.buyerContactId;
      if (commercial.reservationDate != null) result._reservationDate = commercial.reservationDate;
      if (commercial.saleDate != null) result._saleDate = commercial.saleDate;

      // Flatten paymentSummary (most important for financial queries)
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

      // Remove original nested object to save tokens
      delete result.commercial;
    }

    // Flatten areas object (units)
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
  private redactSensitiveFields(
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
   *
   * SSoT: blockedFields in ai-role-access-matrix.ts defines NESTED form only.
   * deriveBlockedFieldSet() auto-generates flat forms (_askingPrice from commercial.askingPrice).
   * Zero manual duplication, zero heuristics.
   */
  private redactRoleBlockedFields(
    data: Record<string, unknown>,
    ctx: AgenticContext
  ): Record<string, unknown> {
    if (ctx.isAdmin) return data;

    const accessConfig = this.getAccessConfig(ctx);

    if (accessConfig.blockedFields.length === 0) return data;

    // Auto-derive flat + nested field set from SSoT nested definitions
    const allBlocked = deriveBlockedFieldSet(accessConfig.blockedFields);

    // Build nested parent→children map for object-level redaction
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
      // Flat field match (auto-derived: '_askingPrice', '_buyerName', etc.)
      if (allBlocked.has(key)) continue;

      // Nested object redaction (e.g. 'commercial' → remove blocked children)
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
  private truncateResult(data: unknown): unknown {
    const json = JSON.stringify(data);
    if (json.length <= MAX_RESULT_JSON_LENGTH) {
      return data;
    }

    // Truncate array results
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
  private async auditWrite(
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
      // Non-fatal — don't let audit failure break the operation
      logger.warn('Failed to audit write operation', {
        requestId: ctx.requestId,
        error: getErrorMessage(error),
      });
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let executorInstance: AgenticToolExecutor | null = null;

export function getAgenticToolExecutor(): AgenticToolExecutor {
  if (!executorInstance) {
    executorInstance = new AgenticToolExecutor();
  }
  return executorInstance;
}
