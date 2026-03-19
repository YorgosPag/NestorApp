/**
 * Read Tools — 4 Firestore read-only operations
 *
 * - firestore_list_collections
 * - firestore_get_document
 * - firestore_query
 * - firestore_count
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../firestore-client.js';
import { redactSensitiveFields } from '../security/field-redaction.js';
import { checkRateLimit, logAudit } from '../security/audit-logger.js';

// ============================================================================
// HELPERS
// ============================================================================

const MAX_RESULTS = 100;

function serializeDoc(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const data = doc.data();
  if (!data) return { _id: doc.id, _exists: false };
  return { _id: doc.id, ...redactSensitiveFields(data) };
}

function serializeValue(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object' && 'toDate' in val && typeof (val as Record<string, unknown>).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return String(val);
}

// ============================================================================
// FILTER SCHEMA
// ============================================================================

const filterSchema = z.object({
  field: z.string(),
  operator: z.enum(['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});

const orderBySchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================================
// REGISTER
// ============================================================================

export function registerReadTools(server: McpServer): void {
  // ---- LIST COLLECTIONS ----
  server.tool(
    'firestore_list_collections',
    'List all top-level Firestore collections with estimated document counts',
    {},
    async () => {
      const start = Date.now();
      const rateCheck = checkRateLimit('read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        const collections = await db.listCollections();
        const results: Array<{ name: string; estimatedCount: number }> = [];

        for (const col of collections) {
          // Use count aggregation (efficient — no full scan)
          const countSnap = await col.count().get();
          results.push({ name: col.id, estimatedCount: countSnap.data().count });
        }

        await logAudit({
          ts: new Date().toISOString(),
          op: 'list_collections',
          collection: '*',
          resultCount: results.length,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ collections: results, total: results.length }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- GET DOCUMENT ----
  server.tool(
    'firestore_get_document',
    'Get a single Firestore document by collection and document ID',
    {
      collection: z.string().describe('Collection name (e.g., "contacts", "projects")'),
      documentId: z.string().describe('Document ID'),
    },
    async ({ collection, documentId }) => {
      const start = Date.now();
      const rateCheck = checkRateLimit('read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        const doc = await db.collection(collection).doc(documentId).get();

        await logAudit({
          ts: new Date().toISOString(),
          op: 'get_document',
          collection,
          documentId,
          resultCount: doc.exists ? 1 : 0,
          ms: Date.now() - start,
        });

        if (!doc.exists) {
          return {
            content: [{ type: 'text' as const, text: `Document "${documentId}" not found in "${collection}"` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(serializeDoc(doc), null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- QUERY ----
  server.tool(
    'firestore_query',
    'Query Firestore documents with filters, ordering, and pagination (max 100 results)',
    {
      collection: z.string().describe('Collection name'),
      filters: z.array(filterSchema).optional().describe('Array of {field, operator, value} filters'),
      orderBy: z.array(orderBySchema).optional().describe('Array of {field, direction} orderings'),
      limit: z.number().min(1).max(MAX_RESULTS).default(20).describe('Max documents to return (1-100, default 20)'),
      startAfter: z.string().optional().describe('Document ID to start after (pagination cursor)'),
    },
    async ({ collection, filters, orderBy, limit, startAfter }) => {
      const start = Date.now();
      const rateCheck = checkRateLimit('read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db.collection(collection);

        // Apply filters
        if (filters) {
          for (const f of filters) {
            query = query.where(f.field, f.operator, f.value);
          }
        }

        // Apply ordering
        if (orderBy) {
          for (const o of orderBy) {
            query = query.orderBy(o.field, o.direction);
          }
        }

        // Pagination
        if (startAfter) {
          const cursorDoc = await db.collection(collection).doc(startAfter).get();
          if (cursorDoc.exists) {
            query = query.startAfter(cursorDoc);
          }
        }

        // Limit
        const effectiveLimit = Math.min(limit, MAX_RESULTS);
        query = query.limit(effectiveLimit);

        const snapshot = await query.get();
        const results = snapshot.docs.map(serializeDoc);

        await logAudit({
          ts: new Date().toISOString(),
          op: 'query',
          collection,
          filters: filters ?? [],
          resultCount: results.length,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              collection,
              count: results.length,
              hasMore: results.length === effectiveLimit,
              documents: results,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- COUNT ----
  server.tool(
    'firestore_count',
    'Count documents in a collection, optionally with filters',
    {
      collection: z.string().describe('Collection name'),
      filters: z.array(filterSchema).optional().describe('Array of {field, operator, value} filters'),
    },
    async ({ collection, filters }) => {
      const start = Date.now();
      const rateCheck = checkRateLimit('read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db.collection(collection);

        if (filters) {
          for (const f of filters) {
            query = query.where(f.field, f.operator, f.value);
          }
        }

        const countSnap = await query.count().get();
        const count = countSnap.data().count;

        await logAudit({
          ts: new Date().toISOString(),
          op: 'count',
          collection,
          filters: filters ?? [],
          resultCount: count,
          ms: Date.now() - start,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ collection, count }, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
