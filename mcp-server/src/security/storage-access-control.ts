/**
 * Storage Path-Based Access Control
 *
 * Controls which Firebase Storage paths can be read, written, or deleted.
 *
 * - BLOCKED: Paths containing secrets, credentials, internal config
 * - READ: All non-blocked paths
 * - WRITE: Only allowlisted path patterns
 * - DELETE: Write-allowed + MCP_ALLOW_DELETE=true
 */

import type { StorageOperation, StorageAccessDecision } from '../types.js';

// ============================================================================
// BLOCKED PATH PATTERNS (never access — regex)
// ============================================================================

const BLOCKED_PATH_PATTERNS: RegExp[] = [
  /^\.well-known\//i,
  /^__internal\//i,
  /secret/i,
  /credential/i,
  /private[_-]key/i,
  /service[_-]account/i,
  /\.env/i,
];

// ============================================================================
// WRITE ALLOWLIST PATTERNS (regex — must match start of path)
// ============================================================================

const WRITE_ALLOWED_PATTERNS: RegExp[] = [
  /^companies\/[^/]+\/entities\//,     // ADR-031 canonical path
  /^contacts\/photos\//,               // Legacy contact photos
  /^floors\/[^/]+\/floorplans\//,      // Legacy floorplans
  /^temp\//,                           // Temporary uploads
  /^config\//,                         // Configuration files
];

// ============================================================================
// ACCESS CHECK
// ============================================================================

export function checkStorageAccess(
  path: string,
  operation: StorageOperation
): StorageAccessDecision {
  // Normalize path — remove leading slash
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  // Check blocked paths (applies to ALL operations including read)
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return {
        allowed: false,
        reason: `Path "${normalizedPath}" is blocked (matches security pattern: ${pattern.source})`,
      };
    }
  }

  // READ: all non-blocked paths allowed
  if (operation === 'read') {
    return { allowed: true, reason: 'Read access granted' };
  }

  // WRITE: must match allowlist
  const isWriteAllowed = WRITE_ALLOWED_PATTERNS.some((pattern) =>
    pattern.test(normalizedPath)
  );

  if (!isWriteAllowed) {
    return {
      allowed: false,
      reason: `Path "${normalizedPath}" is not in the write allowlist. Allowed patterns: companies/{id}/entities/**, contacts/photos/**, floors/*/floorplans/**, temp/**, config/**`,
    };
  }

  // DELETE: requires env var opt-in + write-allowed
  if (operation === 'delete') {
    if (process.env.MCP_ALLOW_DELETE !== 'true') {
      return {
        allowed: false,
        reason: 'Delete operations are disabled. Set MCP_ALLOW_DELETE=true to enable.',
      };
    }
    return { allowed: true, reason: 'Delete access granted (opt-in enabled, path in allowlist)' };
  }

  return { allowed: true, reason: 'Write access granted (path in allowlist)' };
}
