/**
 * FIRESTORE HANDLER — Query, Get, Count, Write & Text Search
 * @module services/ai-pipeline/tools/handlers/firestore-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { safeJsonParse } from '@/lib/json-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { recordQueryStrategy } from '../../query-strategy-service';
import { greekToLatin } from '../../shared/greek-nlp';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  type QueryFilter,
  isReadAllowed,
  isWriteAllowed,
  enforceRoleAccess,
  enforceCompanyScope,
  coerceFilterValue,
  mapOperator,
  flattenNestedFields,
  redactSensitiveFields,
  redactRoleBlockedFields,
  truncateResult,
  auditWrite,
  buildAttribution,
  emitSyncSignalIfMapped,
  logger,
  MAX_QUERY_RESULTS,
  DEFAULT_QUERY_LIMIT,
  ALLOWED_READ_COLLECTIONS,
} from '../executor-shared';
import { filterContactByTab, resolveContactType } from '../contact-tab-filter';

// ============================================================================
// HANDLER
// ============================================================================

export class FirestoreHandler implements ToolHandler {
  readonly toolNames = [
    'firestore_query',
    'firestore_get_document',
    'firestore_count',
    'firestore_write',
    'search_text',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'firestore_query':
        return this.executeFirestoreQuery(args, ctx);
      case 'firestore_get_document':
        return this.executeFirestoreGetDocument(args, ctx);
      case 'firestore_count':
        return this.executeFirestoreCount(args, ctx);
      case 'firestore_write':
        return this.executeFirestoreWrite(args, ctx);
      case 'search_text':
        return this.executeSearchText(args, ctx);
      default:
        return { success: false, error: `Unknown firestore tool: ${toolName}` };
    }
  }

  // firestore_query

  private async executeFirestoreQuery(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');

    if (!isReadAllowed(collection)) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];

    const accessCheck = enforceRoleAccess(collection, rawFilters, ctx);
    if (!accessCheck.allowed) return accessCheck.result;

    const filters = enforceCompanyScope(accessCheck.filters, ctx.companyId, collection);
    const orderBy = typeof args.orderBy === 'string' ? args.orderBy : null;
    const orderDirection = args.orderDirection === 'desc' ? 'desc' : 'asc';
    const limit = Math.min(
      typeof args.limit === 'number' ? args.limit : DEFAULT_QUERY_LIMIT,
      MAX_QUERY_RESULTS
    );

    // Pre-strip non-queryable filters (nested/flattened fields)
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
      recordQueryStrategy({
        collection,
        failedFilters: nestedDropped.map(f => f.field),
        failedReason: 'STRIPPED_NESTED_FILTER',
        successfulFilters: safeFilters.map(f => f.field),
      }).catch(() => { /* non-fatal */ });
    }

    const db = getAdminFirestore();
    const snapshot = await this.executeWithFallback(db, collection, safeFilters, orderBy, orderDirection, limit, ctx);

    const tabFilter = typeof args.tabFilter === 'string' ? args.tabFilter : null;

    const results = snapshot.docs.map(doc => {
      const raw = redactRoleBlockedFields(redactSensitiveFields(doc.data()), ctx);
      let result: Record<string, unknown> = { id: doc.id, ...flattenNestedFields(raw) };

      // Server-side tab filtering: strip fields not belonging to requested tab
      if (tabFilter && collection === COLLECTIONS.CONTACTS) {
        const contactType = resolveContactType(result);
        result = filterContactByTab(result, contactType, tabFilter);
      }

      return result;
    });

    return {
      success: true,
      data: truncateResult(results),
      count: results.length,
    };
  }

  // firestore_get_document

  private async executeFirestoreGetDocument(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');
    const documentId = String(args.documentId ?? '');

    if (!isReadAllowed(collection)) {
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

    if ('companyId' in data && data.companyId !== ctx.companyId) {
      return { success: false, error: 'Document not found' };
    }

    let result: Record<string, unknown> = {
      id: doc.id,
      ...redactRoleBlockedFields(redactSensitiveFields(data), ctx),
    };

    // Server-side tab filtering: strip fields not belonging to requested tab
    const tabFilter = typeof args.tabFilter === 'string' ? args.tabFilter : null;
    if (tabFilter && collection === COLLECTIONS.CONTACTS) {
      const contactType = resolveContactType(result);
      result = filterContactByTab(result, contactType, tabFilter);
    }

    return {
      success: true,
      data: result,
      count: 1,
    };
  }

  // firestore_count

  private async executeFirestoreCount(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');

    if (!isReadAllowed(collection)) {
      return { success: false, error: `Collection "${collection}" is not accessible` };
    }

    const rawFilters = Array.isArray(args.filters) ? args.filters as QueryFilter[] : [];

    const countAccessCheck = enforceRoleAccess(collection, rawFilters, ctx);
    if (!countAccessCheck.allowed) return countAccessCheck.result;

    const filters = enforceCompanyScope(countAccessCheck.filters, ctx.companyId, collection);
    const safeFilters = filters.filter(f => !f.field.includes('.'));

    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(collection);

    for (const filter of safeFilters) {
      const op = mapOperator(filter.operator);
      if (op) {
        query = query.where(filter.field, op, coerceFilterValue(filter.value));
      }
    }

    try {
      const countResult = await query.count().get();
      return { success: true, data: { count: countResult.data().count }, count: countResult.data().count };
    } catch (err) {
      const msg = getErrorMessage(err);
      if (!msg.includes('FAILED_PRECONDITION')) throw err;
      const companyFilter = safeFilters.find(f => f.field === 'companyId');
      let fallback: FirebaseFirestore.Query = db.collection(collection);
      if (companyFilter) {
        fallback = fallback.where('companyId', '==', coerceFilterValue(companyFilter.value));
      }
      const fallbackResult = await fallback.count().get();
      return { success: true, data: { count: fallbackResult.data().count }, count: fallbackResult.data().count };
    }
  }

  // firestore_write

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

    if (!isWriteAllowed(collection)) {
      return { success: false, error: `Write to "${collection}" is not allowed` };
    }

    // ESCO-protected fields — block direct writes to contacts ESCO fields
    if (collection === COLLECTIONS.CONTACTS) {
      const ESCO_PROTECTED = ['profession', 'escoUri', 'escoLabel', 'iscoCode', 'escoSkills'];
      const blockedFields = Object.keys(data).filter(k => ESCO_PROTECTED.includes(k));
      if (blockedFields.length > 0) {
        return {
          success: false,
          error: `Τα πεδία [${blockedFields.join(', ')}] προστατεύονται — χρησιμοποίησε set_contact_esco αντί firestore_write.`,
        };
      }
    }

    const writeData: Record<string, unknown> = {
      ...data,
      companyId: ctx.companyId,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: buildAttribution(ctx),
    };

    if (mode === 'create') {
      writeData.createdAt = new Date().toISOString();
      writeData.createdBy = buildAttribution(ctx);
    }

    const db = getAdminFirestore();

    if (mode === 'create' && !documentId) {
      const { generateEntityId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateEntityId();
      await db.collection(collection).doc(enterpriseId).set(writeData);

      await auditWrite(ctx, collection, enterpriseId, mode, writeData);
      emitSyncSignalIfMapped(collection, 'CREATED', enterpriseId, ctx.companyId);

      return { success: true, data: { id: enterpriseId }, count: 1 };
    }

    if (documentId) {
      if (mode === 'create') {
        await db.collection(collection).doc(documentId).set(writeData, { merge: true });
      } else {
        await db.collection(collection).doc(documentId).update(writeData);
      }

      await auditWrite(ctx, collection, documentId, mode, writeData);
      const action = mode === 'create' ? 'CREATED' as const : 'UPDATED' as const;
      emitSyncSignalIfMapped(collection, action, documentId, ctx.companyId);

      return { success: true, data: { id: documentId }, count: 1 };
    }

    return { success: false, error: 'documentId required for update mode' };
  }

  // search_text

  private async executeSearchText(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const searchTerm = String(args.searchTerm ?? '').toLowerCase();
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

    const searchFields = ['name', 'displayName', 'title', 'description', 'firstName', 'lastName', 'tradeName'];

    for (const collection of collections) {
      const snap = await db
        .collection(collection)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .limit(100)
        .get();

      const tabFilter = typeof args.tabFilter === 'string' ? args.tabFilter : null;

      const matches = snap.docs
        .filter(doc => {
          const data = doc.data();
          return searchFields.some(field => {
            const val = data[field];
            if (typeof val !== 'string') return false;
            const valLower = val.toLowerCase();
            const valLatin = greekToLatin(valLower);
            const fullVal = valLatin ? `${valLower} ${valLatin}` : valLower;
            return allSearchTerms.some(term => fullVal.includes(term));
          });
        })
        .slice(0, limit)
        .map(doc => {
          let result: Record<string, unknown> = {
            id: doc.id,
            ...redactRoleBlockedFields(redactSensitiveFields(doc.data()), ctx),
          };
          // Server-side tab filtering for contact search results
          if (tabFilter && collection === COLLECTIONS.CONTACTS) {
            const contactType = resolveContactType(result);
            result = filterContactByTab(result, contactType, tabFilter);
          }
          return result;
        });

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

    const attempts: Array<{ label: string; build: () => FirebaseFirestore.Query }> = [
      {
        label: 'full query',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          for (const f of filters) {
            const op = mapOperator(f.operator);
            if (op) q = q.where(f.field, op, coerceFilterValue(f.value));
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
            const op = mapOperator(f.operator);
            if (op) q = q.where(f.field, op, coerceFilterValue(f.value));
          }
          return q.limit(limit);
        },
      },
      {
        label: 'flat filters only (no nested)',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          for (const f of flatFilters) {
            const op = mapOperator(f.operator);
            if (op) q = q.where(f.field, op, coerceFilterValue(f.value));
          }
          return q.limit(limit);
        },
      },
      {
        label: 'companyId only',
        build: () => {
          let q: FirebaseFirestore.Query = db.collection(collection);
          if (companyFilter) {
            q = q.where('companyId', '==', coerceFilterValue(companyFilter.value));
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
        if (!msg.includes('FAILED_PRECONDITION')) throw err;
        logger.warn(`Query attempt "${attempt.label}" failed, trying next`, {
          requestId: ctx.requestId, collection,
        });
      }
    }

    return db.collection(collection).limit(limit).get();
  }
}
