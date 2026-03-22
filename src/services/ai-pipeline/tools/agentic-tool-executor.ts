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
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

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
  COLLECTIONS.DOCUMENTS,
  COLLECTIONS.PARKING_SPACES,
  COLLECTIONS.ACCOUNTING_INVOICES,
  COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
  COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES,
  COLLECTIONS.ACCOUNTING_FIXED_ASSETS,
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
      // Instead of returning empty results, fetch ALL docs and let AI filter
      if (errorMessage.includes('FAILED_PRECONDITION') && toolName === 'firestore_query') {
        logger.warn('Tool hit missing index, executing broad fallback query', {
          tool: toolName,
          requestId: ctx.requestId,
        });
        try {
          const fallbackArgs = args as Record<string, unknown>;
          const collection = String(fallbackArgs.collection ?? '');
          const db = getAdminFirestore();
          const companyId = ctx.companyId;
          const limit = Math.min(typeof fallbackArgs.limit === 'number' ? fallbackArgs.limit : 20, 50);

          let broadQuery: FirebaseFirestore.Query = db.collection(collection);
          broadQuery = broadQuery.where('companyId', '==', companyId);
          broadQuery = broadQuery.limit(limit);

          const snapshot = await broadQuery.get();
          const results = snapshot.docs.map(doc => {
            const raw = this.redactSensitiveFields(doc.data());
            return { id: doc.id, ...this.flattenNestedFields(raw) };
          });

          return { success: true, data: this.truncateResult(results), count: results.length };
        } catch {
          // If even broad query fails, return empty
          return { success: true, data: [], count: 0 };
        }
      }
      if (errorMessage.includes('FAILED_PRECONDITION')) {
        return { success: true, data: [], count: 0 };
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
    const filters = this.enforceCompanyScope(rawFilters, ctx.companyId, collection);
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
      const raw = this.redactSensitiveFields(doc.data());
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

    // Allow both top-level collections AND subcollections (e.g. units/{id}/payment_plans)
    const isAllowed = ALLOWED_READ_COLLECTIONS.has(collection)
      || ALLOWED_READ_COLLECTIONS.has(collection.split('/')[0]);
    if (!isAllowed) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];
    const filters = this.enforceCompanyScope(rawFilters, ctx.companyId, collection);

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
    const latinWords = searchWords.map(w => this.greekToLatin(w)).filter(Boolean);
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
      const latinText = nameFields.map(n => this.greekToLatin(n)).filter(Boolean).join(' ');
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
    const latinWords = searchWords.map(w => this.greekToLatin(w)).filter(Boolean);
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
      const latinText = nameFields.map(n => this.greekToLatin(n)).filter(Boolean).join(' ');
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
    const latinWords = words.map(w => this.greekToLatin(w)).filter(Boolean);
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
            const valLatin = this.greekToLatin(valLower);
            const fullVal = valLatin ? `${valLower} ${valLatin}` : valLower;
            // Match any search term against original + transliterated value
            return allSearchTerms.some(term => fullVal.includes(term));
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
   * Transliterate Greek text to Latin characters for name matching.
   * Handles common Greek→Latin mappings (Γεώργιος → georgios, Παγώνης → pagonis).
   */
  private greekToLatin(text: string): string {
    const map: Record<string, string> = {
      'α': 'a', 'ά': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'έ': 'e',
      'ζ': 'z', 'η': 'i', 'ή': 'i', 'θ': 'th', 'ι': 'i', 'ί': 'i', 'ϊ': 'i',
      'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'ό': 'o',
      'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'ύ': 'y',
      'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o', 'ώ': 'o',
    };
    // Only transliterate if text contains Greek characters
    if (!/[α-ωά-ώ]/i.test(text)) return '';
    return text.split('').map(c => map[c] ?? c).join('');
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
