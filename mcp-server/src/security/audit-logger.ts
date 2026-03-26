/**
 * Audit Logger — JSON Lines
 *
 * Appends each MCP operation to a local `audit.jsonl` file.
 * Lightweight, non-blocking (fire-and-forget writes).
 */

import { appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditEntry } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = join(__dirname, '..', '..', 'audit.jsonl');

// ============================================================================
// RATE LIMITER (in-memory sliding window)
// ============================================================================

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  // Firestore rate limits
  read: { maxRequests: 60, windowMs: 60_000 },
  write: { maxRequests: 20, windowMs: 60_000 },
  delete: { maxRequests: 50, windowMs: 60_000 },
  // Storage rate limits (separate buckets)
  storage_read: { maxRequests: 30, windowMs: 60_000 },
  storage_write: { maxRequests: 10, windowMs: 60_000 },
  storage_delete: { maxRequests: 3, windowMs: 60_000 },
};

export function checkRateLimit(operation: string): { allowed: boolean; reason: string } {
  // Storage operations use their own rate limit buckets
  const category = operation.startsWith('storage_')
    ? operation
    : operation === 'delete'
      ? 'delete'
      : operation === 'create' || operation === 'update'
        ? 'write'
        : 'read';
  const limit = RATE_LIMITS[category];
  if (!limit) return { allowed: true, reason: 'No rate limit configured' };

  const now = Date.now();
  let bucket = rateBuckets.get(category);
  if (!bucket) {
    bucket = { timestamps: [] };
    rateBuckets.set(category, bucket);
  }

  // Prune expired timestamps
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < limit.windowMs);

  if (bucket.timestamps.length >= limit.maxRequests) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${limit.maxRequests} ${category} ops per ${limit.windowMs / 1000}s`,
    };
  }

  bucket.timestamps.push(now);
  return { allowed: true, reason: 'Within rate limit' };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const line = JSON.stringify(entry) + '\n';
    await appendFile(AUDIT_FILE, line, 'utf-8');
  } catch {
    // Non-blocking — don't crash server on audit write failure
    console.error('[MCP-Audit] Failed to write audit entry');
  }
}
