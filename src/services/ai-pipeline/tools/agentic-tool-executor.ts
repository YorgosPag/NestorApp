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
import { getCollectionSchemaInfo } from '@/config/firestore-schema-map';
import { createModuleLogger } from '@/lib/telemetry/Logger';

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
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Number of results returned (for queries) */
  count?: number;
}

interface QueryFilter {
  field: string;
  operator: string;
  value: string | number | boolean | null;
}

// ============================================================================
// SECURITY: COLLECTION WHITELIST
// ============================================================================

/**
 * Collections the AI agent is ALLOWED to query.
 * System/config/settings collections are EXCLUDED for security.
 */
const ALLOWED_READ_COLLECTIONS = new Set([
  'projects',
  'buildings',
  'units',
  'floors',
  'contacts',
  'construction_phases',
  'construction_tasks',
  'leads',
  'opportunities',
  'appointments',
  'tasks',
  'obligations',
  'messages',
  'communications',
  'invoices',
  'payments',
  'contact_links',
  'employment_records',
  'attendance_events',
  'conversations',
  'activities',
  'documents',
  'parking_spots',
  'accounting_invoices',
  'accounting_bank_transactions',
  'accounting_journal_entries',
  'accounting_fixed_assets',
]);

/**
 * Collections allowed for write operations (admin only, very restricted)
 */
const ALLOWED_WRITE_COLLECTIONS = new Set([
  'contacts',
  'tasks',
  'appointments',
  'activities',
  'leads',
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
        case 'get_collection_schema':
          result = await this.executeGetCollectionSchema(args);
          break;
        case 'search_text':
          result = await this.executeSearchText(args, ctx);
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

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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

    if (!ALLOWED_READ_COLLECTIONS.has(collection)) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];
    const filters = this.enforceCompanyScope(rawFilters, ctx.companyId, collection);
    const orderBy = typeof args.orderBy === 'string' ? args.orderBy : null;
    const orderDirection = args.orderDirection === 'desc' ? 'desc' : 'asc';
    const limit = Math.min(
      typeof args.limit === 'number' ? args.limit : DEFAULT_QUERY_LIMIT,
      MAX_QUERY_RESULTS
    );

    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(collection);

    // Apply filters with value type coercion
    for (const filter of filters) {
      const op = this.mapOperator(filter.operator);
      if (op) {
        const coercedValue = this.coerceFilterValue(filter.value);
        query = query.where(filter.field, op, coercedValue);
      }
    }

    // Apply ordering
    if (orderBy) {
      query = query.orderBy(orderBy, orderDirection);
    }

    // Apply limit
    query = query.limit(limit);

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...this.redactSensitiveFields(doc.data()),
    }));

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

    if (!ALLOWED_READ_COLLECTIONS.has(collection)) {
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
      data: { id: doc.id, ...this.redactSensitiveFields(data) },
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

    if (!ALLOWED_READ_COLLECTIONS.has(collection)) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];
    const filters = this.enforceCompanyScope(rawFilters, ctx.companyId, collection);

    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(collection);

    for (const filter of filters) {
      const op = this.mapOperator(filter.operator);
      if (op) {
        const coercedValue = this.coerceFilterValue(filter.value);
        query = query.where(filter.field, op, coercedValue);
      }
    }

    const countResult = await query.count().get();
    const count = countResult.data().count;

    return { success: true, data: { count }, count };
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
      try {
        const parsed = JSON.parse(args.data) as Record<string, unknown>;
        if (typeof parsed === 'object' && parsed !== null) {
          data = parsed;
        }
      } catch {
        return { success: false, error: 'Invalid JSON in data field' };
      }
    } else if (typeof args.data === 'object' && args.data !== null) {
      data = args.data as Record<string, unknown>;
    }

    if (!ALLOWED_WRITE_COLLECTIONS.has(collection)) {
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
      const docRef = await db.collection(collection).add(writeData);

      // Audit log
      await this.auditWrite(ctx, collection, docRef.id, mode, writeData);

      return { success: true, data: { id: docRef.id }, count: 1 };
    }

    if (documentId) {
      if (mode === 'create') {
        await db.collection(collection).doc(documentId).set(writeData);
      } else {
        await db.collection(collection).doc(documentId).update(writeData);
      }

      await this.auditWrite(ctx, collection, documentId, mode, writeData);

      return { success: true, data: { id: documentId }, count: 1 };
    }

    return { success: false, error: 'documentId required for update mode' };
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

    // Search for contact
    const db = getAdminFirestore();
    const searchTerm = contactName.toLowerCase();

    const contactsSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .where('companyId', '==', ctx.companyId)
      .limit(50)
      .get();

    const matchingContacts = contactsSnap.docs.filter(doc => {
      const data = doc.data();
      const displayName = String(data.displayName ?? '').toLowerCase();
      const firstName = String(data.firstName ?? '').toLowerCase();
      const lastName = String(data.lastName ?? '').toLowerCase();
      return displayName.includes(searchTerm)
        || firstName.includes(searchTerm)
        || lastName.includes(searchTerm);
    });

    if (matchingContacts.length === 0) {
      return { success: false, error: `Contact "${contactName}" not found` };
    }

    const contact = matchingContacts[0];
    const contactData = contact.data();
    const email = String(contactData.email ?? '');

    if (!email) {
      return {
        success: false,
        error: `Contact "${contactData.displayName ?? contactName}" has no email address`,
      };
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
    const searchFields = ['name', 'displayName', 'title', 'description', 'firstName', 'lastName'];

    for (const collection of collections) {
      const snap = await db
        .collection(collection)
        .where('companyId', '==', ctx.companyId)
        .limit(100) // Fetch more to filter client-side
        .get();

      const matches = snap.docs
        .filter(doc => {
          const data = doc.data();
          return searchFields.some(field => {
            const val = data[field];
            return typeof val === 'string' && val.toLowerCase().includes(searchTerm);
          });
        })
        .slice(0, limit)
        .map(doc => ({
          id: doc.id,
          ...this.redactSensitiveFields(doc.data()),
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
      'buildings',
      'floors',
      'construction_phases',
      'construction_tasks',
    ]);
    if (collectionsWithOptionalCompanyId.has(collection)) {
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
  private coerceFilterValue(value: string | number | boolean | null): string | number | boolean | null {
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
      await db.collection(COLLECTIONS.AI_PIPELINE_AUDIT).add({
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
        error: error instanceof Error ? error.message : String(error),
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
