/**
 * Storage Tools — 6 Firebase Storage operations
 *
 * - storage_list_files
 * - storage_get_metadata
 * - storage_read_file
 * - storage_get_signed_url
 * - storage_upload_file
 * - storage_delete_file
 *
 * All operations enforce path-based access control and audit logging.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getStorageBucket } from '../storage-client.js';
import { checkStorageAccess } from '../security/storage-access-control.js';
import { checkRateLimit, logAudit } from '../security/audit-logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const TEXT_EXTENSIONS = new Set([
  '.json', '.txt', '.csv', '.md', '.xml', '.svg', '.html', '.css', '.js', '.ts',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.log', '.env.example',
]);

const MAX_TEXT_READ_BYTES = 512 * 1024; // 512KB
const MAX_UPLOAD_BYTES = 1024 * 1024;   // 1MB
const DEFAULT_SIGNED_URL_MINUTES = 60;
const MAX_SIGNED_URL_MINUTES = 24 * 60; // 24 hours

// ============================================================================
// HELPERS
// ============================================================================

function isTextFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const unitIndex = Math.min(i, units.length - 1);
  const unit = units[unitIndex];
  if (!unit) return `${bytes} B`;
  return `${(bytes / Math.pow(1024, unitIndex)).toFixed(1)} ${unit}`;
}

// ============================================================================
// REGISTER
// ============================================================================

export function registerStorageTools(server: McpServer): void {

  // ---- LIST FILES ----
  server.tool(
    'storage_list_files',
    'List files and folders in a Firebase Storage path. Returns name, size, type for each item.',
    {
      path: z.string().default('').describe('Storage path prefix (e.g., "contacts/photos/"). Empty = root.'),
      maxResults: z.number().min(1).max(500).default(100).describe('Max results (1-500, default 100)'),
    },
    async ({ path, maxResults }) => {
      const start = Date.now();
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      // Access control
      const access = checkStorageAccess(normalizedPath || '/', 'read');
      if (!access.allowed) {
        await logAudit({ ts: new Date().toISOString(), op: 'storage_list', collection: 'storage', path: normalizedPath, blocked: true, reason: access.reason, ms: Date.now() - start });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      // Rate limit
      const rateCheck = checkRateLimit('storage_read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const bucket = getStorageBucket();
        const [files] = await bucket.getFiles({
          prefix: normalizedPath || undefined,
          maxResults,
          delimiter: '/',
        });

        const items = files.map((file) => {
          const metadata = file.metadata;
          return {
            name: file.name,
            size: metadata.size ? formatBytes(Number(metadata.size)) : 'unknown',
            contentType: metadata.contentType ?? 'unknown',
            updated: metadata.updated ?? null,
          };
        });

        // Get prefixes (folders) from the API response
        const [, , apiResponse] = await bucket.getFiles({
          prefix: normalizedPath || undefined,
          maxResults,
          delimiter: '/',
          autoPaginate: false,
        });

        const prefixes = (apiResponse as { prefixes?: string[] }).prefixes ?? [];

        await logAudit({
          ts: new Date().toISOString(),
          op: 'storage_list',
          collection: 'storage',
          path: normalizedPath,
          resultCount: items.length + prefixes.length,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              path: normalizedPath || '/',
              folders: prefixes,
              files: items,
              totalFiles: items.length,
              totalFolders: prefixes.length,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- GET METADATA ----
  server.tool(
    'storage_get_metadata',
    'Get metadata for a specific file in Firebase Storage (size, type, updated, md5Hash)',
    {
      path: z.string().describe('Full file path in Storage (e.g., "contacts/photos/abc123.jpg")'),
    },
    async ({ path }) => {
      const start = Date.now();
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      const access = checkStorageAccess(normalizedPath, 'read');
      if (!access.allowed) {
        await logAudit({ ts: new Date().toISOString(), op: 'storage_metadata', collection: 'storage', path: normalizedPath, blocked: true, reason: access.reason, ms: Date.now() - start });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      const rateCheck = checkRateLimit('storage_read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const bucket = getStorageBucket();
        const file = bucket.file(normalizedPath);
        const [metadata] = await file.getMetadata();

        await logAudit({
          ts: new Date().toISOString(),
          op: 'storage_metadata',
          collection: 'storage',
          path: normalizedPath,
          resultCount: 1,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              name: metadata.name,
              size: metadata.size ? formatBytes(Number(metadata.size)) : 'unknown',
              sizeBytes: Number(metadata.size ?? 0),
              contentType: metadata.contentType ?? 'unknown',
              created: metadata.timeCreated ?? null,
              updated: metadata.updated ?? null,
              md5Hash: metadata.md5Hash ?? null,
              crc32c: metadata.crc32c ?? null,
              generation: metadata.generation ?? null,
              metageneration: metadata.metageneration ?? null,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('No such object') || message.includes('404')) {
          return { content: [{ type: 'text' as const, text: `File not found: "${normalizedPath}"` }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- READ FILE ----
  server.tool(
    'storage_read_file',
    'Read file content from Firebase Storage. Returns text content for text files (max 512KB), or metadata + signed URL for binary files.',
    {
      path: z.string().describe('Full file path in Storage'),
    },
    async ({ path }) => {
      const start = Date.now();
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      const access = checkStorageAccess(normalizedPath, 'read');
      if (!access.allowed) {
        await logAudit({ ts: new Date().toISOString(), op: 'storage_read', collection: 'storage', path: normalizedPath, blocked: true, reason: access.reason, ms: Date.now() - start });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      const rateCheck = checkRateLimit('storage_read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const bucket = getStorageBucket();
        const file = bucket.file(normalizedPath);
        const [metadata] = await file.getMetadata();
        const sizeBytes = Number(metadata.size ?? 0);

        // Text file — return content
        if (isTextFile(normalizedPath)) {
          if (sizeBytes > MAX_TEXT_READ_BYTES) {
            // Too large — return metadata + signed URL instead
            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: Date.now() + DEFAULT_SIGNED_URL_MINUTES * 60 * 1000,
            });

            await logAudit({ ts: new Date().toISOString(), op: 'storage_read', collection: 'storage', path: normalizedPath, resultCount: 1, ms: Date.now() - start });

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  path: normalizedPath,
                  type: 'text_too_large',
                  size: formatBytes(sizeBytes),
                  maxReadable: formatBytes(MAX_TEXT_READ_BYTES),
                  contentType: metadata.contentType ?? 'unknown',
                  signedUrl,
                  expiresIn: `${DEFAULT_SIGNED_URL_MINUTES} minutes`,
                }, null, 2),
              }],
            };
          }

          const [contents] = await file.download();
          const textContent = contents.toString('utf-8');

          await logAudit({ ts: new Date().toISOString(), op: 'storage_read', collection: 'storage', path: normalizedPath, resultCount: 1, ms: Date.now() - start });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                path: normalizedPath,
                type: 'text',
                size: formatBytes(sizeBytes),
                contentType: metadata.contentType ?? 'unknown',
                content: textContent,
              }, null, 2),
            }],
          };
        }

        // Binary file — return metadata + signed URL
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + DEFAULT_SIGNED_URL_MINUTES * 60 * 1000,
        });

        await logAudit({ ts: new Date().toISOString(), op: 'storage_read', collection: 'storage', path: normalizedPath, resultCount: 1, ms: Date.now() - start });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              path: normalizedPath,
              type: 'binary',
              size: formatBytes(sizeBytes),
              contentType: metadata.contentType ?? 'unknown',
              md5Hash: metadata.md5Hash ?? null,
              signedUrl,
              expiresIn: `${DEFAULT_SIGNED_URL_MINUTES} minutes`,
              note: 'Binary file — use the signed URL to download or share with the user.',
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('No such object') || message.includes('404')) {
          return { content: [{ type: 'text' as const, text: `File not found: "${normalizedPath}"` }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- GET SIGNED URL ----
  server.tool(
    'storage_get_signed_url',
    'Generate a temporary signed download URL for a file in Firebase Storage',
    {
      path: z.string().describe('Full file path in Storage'),
      expiresInMinutes: z.number().min(1).max(MAX_SIGNED_URL_MINUTES).default(DEFAULT_SIGNED_URL_MINUTES)
        .describe(`URL expiration in minutes (1-${MAX_SIGNED_URL_MINUTES}, default ${DEFAULT_SIGNED_URL_MINUTES})`),
    },
    async ({ path, expiresInMinutes }) => {
      const start = Date.now();
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      const access = checkStorageAccess(normalizedPath, 'read');
      if (!access.allowed) {
        await logAudit({ ts: new Date().toISOString(), op: 'storage_signed_url', collection: 'storage', path: normalizedPath, blocked: true, reason: access.reason, ms: Date.now() - start });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      const rateCheck = checkRateLimit('storage_read');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const bucket = getStorageBucket();
        const file = bucket.file(normalizedPath);

        // Verify file exists
        const [exists] = await file.exists();
        if (!exists) {
          return { content: [{ type: 'text' as const, text: `File not found: "${normalizedPath}"` }], isError: true };
        }

        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + expiresInMinutes * 60 * 1000,
        });

        await logAudit({
          ts: new Date().toISOString(),
          op: 'storage_signed_url',
          collection: 'storage',
          path: normalizedPath,
          resultCount: 1,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              path: normalizedPath,
              signedUrl,
              expiresIn: `${expiresInMinutes} minutes`,
              expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- UPLOAD FILE ----
  server.tool(
    'storage_upload_file',
    'Upload text content to Firebase Storage (max 1MB). Only allowed in specific paths.',
    {
      path: z.string().describe('Destination path in Storage (e.g., "temp/report.json")'),
      content: z.string().describe('Text content to upload'),
      contentType: z.string().default('application/octet-stream').describe('MIME type (e.g., "application/json", "text/plain")'),
    },
    async ({ path, content, contentType }) => {
      const start = Date.now();
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      // Access control — write
      const access = checkStorageAccess(normalizedPath, 'write');
      if (!access.allowed) {
        await logAudit({ ts: new Date().toISOString(), op: 'storage_upload', collection: 'storage', path: normalizedPath, blocked: true, reason: access.reason, ms: Date.now() - start });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      // Rate limit
      const rateCheck = checkRateLimit('storage_write');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      // Size check
      const contentBytes = Buffer.byteLength(content, 'utf-8');
      if (contentBytes > MAX_UPLOAD_BYTES) {
        return {
          content: [{
            type: 'text' as const,
            text: `Upload rejected: content size (${formatBytes(contentBytes)}) exceeds maximum (${formatBytes(MAX_UPLOAD_BYTES)})`,
          }],
          isError: true,
        };
      }

      try {
        const bucket = getStorageBucket();
        const file = bucket.file(normalizedPath);

        await file.save(Buffer.from(content, 'utf-8'), {
          metadata: { contentType },
        });

        await logAudit({
          ts: new Date().toISOString(),
          op: 'storage_upload',
          collection: 'storage',
          path: normalizedPath,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              path: normalizedPath,
              size: formatBytes(contentBytes),
              contentType,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- DELETE FILE ----
  server.tool(
    'storage_delete_file',
    'Delete a file from Firebase Storage. Requires MCP_ALLOW_DELETE=true and path in write allowlist.',
    {
      path: z.string().describe('Full file path to delete'),
    },
    async ({ path }) => {
      const start = Date.now();
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

      // Access control — delete
      const access = checkStorageAccess(normalizedPath, 'delete');
      if (!access.allowed) {
        await logAudit({ ts: new Date().toISOString(), op: 'storage_delete', collection: 'storage', path: normalizedPath, blocked: true, reason: access.reason, ms: Date.now() - start });
        return { content: [{ type: 'text' as const, text: `Access denied: ${access.reason}` }], isError: true };
      }

      // Rate limit
      const rateCheck = checkRateLimit('storage_delete');
      if (!rateCheck.allowed) {
        return { content: [{ type: 'text' as const, text: `Rate limit: ${rateCheck.reason}` }], isError: true };
      }

      try {
        const bucket = getStorageBucket();
        const file = bucket.file(normalizedPath);

        // Verify file exists
        const [exists] = await file.exists();
        if (!exists) {
          return { content: [{ type: 'text' as const, text: `File not found: "${normalizedPath}"` }], isError: true };
        }

        await file.delete();

        await logAudit({
          ts: new Date().toISOString(),
          op: 'storage_delete',
          collection: 'storage',
          path: normalizedPath,
          ms: Date.now() - start,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              deleted: normalizedPath,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
