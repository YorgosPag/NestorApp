/**
 * Write Tools — 3 Firestore write operations
 *
 * - firestore_create_document
 * - firestore_update_document
 * - firestore_delete_document
 *
 * All operations enforce access control and audit logging.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDb } from '../firestore-client.js';
import { checkAccess } from '../security/access-control.js';
import { checkRateLimit, logAudit } from '../security/audit-logger.js';

// ============================================================================
// REGISTER
// ============================================================================

export function registerWriteTools(server: McpServer): void {
  // ---- CREATE DOCUMENT ----
  server.tool(
    'firestore_create_document',
    'Create a new Firestore document in a collection. Requires collection to be in write allowlist.',
    {
      collection: z.string().describe('Collection name (e.g., "contacts")'),
      data: z.record(z.unknown()).describe('Document data as key-value object'),
      documentId: z.string().optional().describe('Optional custom document ID. If omitted, auto-generated.'),
    },
    async ({ collection, data, documentId }) => {
      const start = Date.now();

      // Access control
      const access = checkAccess(collection, 'write');
      if (!access.allowed) {
        await logAudit({
          ts: new Date().toISOString(),
          op: 'create',
          collection,
          blocked: true,
          reason: access.reason,
          ms: Date.now() - start,
        });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      // Rate limit
      const rateCheck = checkRateLimit('write');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        let docId: string;

        if (documentId) {
          await db.collection(collection).doc(documentId).set(data);
          docId = documentId;
        } else {
          const docRef = await db.collection(collection).add(data);
          docId = docRef.id;
        }

        await logAudit({
          ts: new Date().toISOString(),
          op: 'create',
          collection,
          documentId: docId,
          fieldsChanged: Object.keys(data),
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, documentId: docId, collection }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- UPDATE DOCUMENT ----
  server.tool(
    'firestore_update_document',
    'Update an existing Firestore document. Only updates specified fields (merge). Requires write allowlist.',
    {
      collection: z.string().describe('Collection name'),
      documentId: z.string().describe('Document ID to update'),
      data: z.record(z.unknown()).describe('Fields to update (merge — existing fields not specified are preserved)'),
    },
    async ({ collection, documentId, data }) => {
      const start = Date.now();

      // Access control
      const access = checkAccess(collection, 'write');
      if (!access.allowed) {
        await logAudit({
          ts: new Date().toISOString(),
          op: 'update',
          collection,
          documentId,
          blocked: true,
          reason: access.reason,
          ms: Date.now() - start,
        });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      // Rate limit
      const rateCheck = checkRateLimit('write');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        const docRef = db.collection(collection).doc(documentId);

        // Verify document exists
        const existing = await docRef.get();
        if (!existing.exists) {
          return {
            content: [{
              type: 'text' as const,
              text: `Document "${documentId}" not found in "${collection}"`,
            }],
            isError: true,
          };
        }

        await docRef.update(data);

        await logAudit({
          ts: new Date().toISOString(),
          op: 'update',
          collection,
          documentId,
          fieldsChanged: Object.keys(data),
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              documentId,
              collection,
              fieldsUpdated: Object.keys(data),
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- DELETE DOCUMENT ----
  server.tool(
    'firestore_delete_document',
    'Delete a Firestore document. Requires MCP_ALLOW_DELETE=true and collection in write allowlist.',
    {
      collection: z.string().describe('Collection name'),
      documentId: z.string().describe('Document ID to delete'),
    },
    async ({ collection, documentId }) => {
      const start = Date.now();

      // Access control (includes MCP_ALLOW_DELETE check)
      const access = checkAccess(collection, 'delete');
      if (!access.allowed) {
        await logAudit({
          ts: new Date().toISOString(),
          op: 'delete',
          collection,
          documentId,
          blocked: true,
          reason: access.reason,
          ms: Date.now() - start,
        });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      // Rate limit
      const rateCheck = checkRateLimit('delete');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const db = getDb();
        const docRef = db.collection(collection).doc(documentId);

        // Verify document exists
        const existing = await docRef.get();
        if (!existing.exists) {
          return {
            content: [{
              type: 'text' as const,
              text: `Document "${documentId}" not found in "${collection}"`,
            }],
            isError: true,
          };
        }

        await docRef.delete();

        await logAudit({
          ts: new Date().toISOString(),
          op: 'delete',
          collection,
          documentId,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, deleted: documentId, collection }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
