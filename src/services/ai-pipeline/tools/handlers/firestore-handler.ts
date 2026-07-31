/**
 * FIRESTORE HANDLER — Query, Get, Count, Write & Text Search
 * @module services/ai-pipeline/tools/handlers/firestore-handler
 * @see ADR-171 (Autonomous AI Agent)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { safeJsonParse } from '@/lib/json-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { recordQueryStrategy } from '../../query-strategy-service';
import { executeSearchText } from './search-text-handler';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  type QueryFilter,
  isReadAllowed,
  isWriteAllowed,
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
} from '../executor-shared';
import { filterContactByTab, resolveContactType } from '../contact-tab-filter';
import { resolveOwnedToolDoc } from '../tool-tenant-guard';
import {
  buildFallbackAttempts,
  buildFilteredQuery,
  tenantEqualityFilter,
  withScopedRead,
} from './firestore-query-plan';
import { nowISO } from '@/lib/date-local';

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

  private async executeFirestoreQuery(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    return withScopedRead(args, ctx, async ({ collection, filters }, db) => {
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
        logger.info('Stripped nested filters', { requestId: ctx.requestId, collection, dropped: nestedDropped.map(f => f.field) });
        recordQueryStrategy({ collection, failedFilters: nestedDropped.map(f => f.field), failedReason: 'STRIPPED_NESTED_FILTER', successfulFilters: safeFilters.map(f => f.field) }).catch(() => {});
      }

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
    });
  }

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

    // Tenant ownership (ADR-742 Φάση Δ).
    //
    // 🔴 Εδώ η μεταμφίεση ήταν σπασμένη **στο σχήμα, όχι στο κείμενο**: το
    // γνήσιο κενό απαντούσε `{success:true, data:null, count:0}` ενώ το ξένο
    // `{success:false, error:'Document not found'}`. Ο καλών ξεχώριζε τα δύο
    // **χωρίς καν να διαβάσει το μήνυμα** — αρκούσε το `success` flag. Πλέον
    // παράγονται από το ΙΔΙΟ callback, άρα δεν μπορούν να αποκλίνουν (§7.1).
    const owned = resolveOwnedToolDoc({
      snap: doc,
      ctx,
      subject: {
        resource: collection,
        resourceId: documentId,
        path: 'firestore_get_document',
      },
      notFound: () => ({ success: true, data: null, count: 0 }),
    });
    if (!owned.ok) return owned.result;

    const data = owned.data;

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

  private async executeFirestoreCount(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    return withScopedRead(args, ctx, async ({ collection, filters }, db) => {
      const safeFilters = filters.filter(f => !f.field.includes('.'));

      // Χωρίς `limit`: το `count()` μετρά ΟΛΑ όσα ταιριάζουν, δεν φέρνει έγγραφα.
      const query = buildFilteredQuery(db, collection, safeFilters, { limit: null });

      try {
        const countResult = await query.count().get();
        return { success: true, data: { count: countResult.data().count }, count: countResult.data().count };
      } catch (err) {
        const msg = getErrorMessage(err);
        if (!msg.includes('FAILED_PRECONDITION')) throw err;
        // Το ίδιο «τελευταίο καταφύγιο» με το query path: **ισότητα tenant, πάντα**
        // (βλ. `tenantEqualityFilter` — ο operator του μοντέλου απορρίπτεται εδώ).
        const companyFilter = safeFilters.find(f => f.field === 'companyId');
        const fallback = buildFilteredQuery(
          db,
          collection,
          companyFilter === undefined ? [] : [tenantEqualityFilter(companyFilter)],
          { limit: null },
        );
        const fallbackResult = await fallback.count().get();
        return { success: true, data: { count: fallbackResult.data().count }, count: fallbackResult.data().count };
      }
    });
  }

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

    // FINDING-007: Block ALL updates to contacts via firestore_write.
    // Contacts have dedicated tools: update_contact_field (scalar), append_contact_info (arrays), set_contact_esco (ESCO).
    // Only mode=create is allowed (for edge cases not covered by create_contact).
    if (collection === COLLECTIONS.CONTACTS && mode === 'update') {
      return {
        success: false,
        error: 'Η ενημέρωση contacts μέσω firestore_write δεν επιτρέπεται. Χρησιμοποίησε update_contact_field, append_contact_info ή set_contact_esco.',
      };
    }

    // ESCO-protected fields — block direct writes to contacts ESCO fields (even in create mode)
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
      updatedAt: nowISO(),
      lastModifiedBy: buildAttribution(ctx),
    };

    if (mode === 'create') {
      writeData.createdAt = nowISO();
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

  /** Delegated to search-text-handler.ts (SRP extraction) */
  private executeSearchText(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    return executeSearchText(args, ctx);
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

    const attempts = buildFallbackAttempts({ filters, orderBy, orderDirection });

    for (const attempt of attempts) {
      try {
        const snapshot = await buildFilteredQuery(db, collection, attempt.filters, {
          orderBy: attempt.orderBy,
          limit,
        }).get();
        if (attempt.label !== 'full query') {
          logger.warn('Query fallback succeeded', { requestId: ctx.requestId, collection, fallbackLevel: attempt.label });
          const dropped = [...nestedFilters.map(f => f.field), ...(orderBy ? [orderBy] : [])];
          if (dropped.length > 0) {
            recordQueryStrategy({ collection, failedFilters: dropped, failedReason: 'FAILED_PRECONDITION', successfulFilters: flatFilters.map(f => f.field) }).catch(() => {});
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
