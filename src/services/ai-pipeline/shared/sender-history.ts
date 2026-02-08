/**
 * =============================================================================
 * 🏢 ENTERPRISE: SENDER HISTORY SERVICE
 * =============================================================================
 *
 * Queries the messages collection for previous emails from the same sender.
 * Provides context to the AI reply generator so it can write more relevant,
 * personalized replies (e.g. acknowledging repeat contacts).
 *
 * Privacy-safe: Only returns subject + date + intent — never email bodies.
 * Non-fatal: Returns empty history on any failure.
 *
 * @module services/ai-pipeline/shared/sender-history
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('sender-history');

// ============================================================================
// TYPES
// ============================================================================

/** A single previous email entry — privacy-safe (no body content) */
export interface SenderHistoryEntry {
  /** Email subject line */
  subject: string;
  /** ISO date string */
  date: string;
  /** AI-classified intent, if available */
  intent: string | null;
}

/** Result of sender history lookup */
export interface SenderHistoryResult {
  /** Total number of previous emails from this sender (excluding current) */
  totalPreviousEmails: number;
  /** Most recent emails, newest first (max 5) */
  recentEmails: SenderHistoryEntry[];
  /** Whether this sender has contacted before */
  isReturningContact: boolean;
}

// ============================================================================
// INTERNAL: Firestore document shape (partial — only fields we read)
// ============================================================================

interface MessageDocPartial {
  subject?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
  intentAnalysis?: {
    intentType?: string;
  };
}

/**
 * Extract a usable ISO date string from Firestore timestamp fields.
 * Handles: Firestore Timestamp, Date object, ISO string.
 */
function extractDateString(createdAt: MessageDocPartial['createdAt']): string {
  if (!createdAt) return new Date().toISOString();

  // Firestore Timestamp (has toDate method)
  if (typeof createdAt === 'object' && 'toDate' in createdAt && typeof createdAt.toDate === 'function') {
    return createdAt.toDate().toISOString();
  }

  // Native Date
  if (createdAt instanceof Date) {
    return createdAt.toISOString();
  }

  // ISO string
  if (typeof createdAt === 'string') {
    return createdAt;
  }

  return new Date().toISOString();
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

const DEFAULT_LIMIT = 5;

/**
 * Query previous emails from the same sender.
 *
 * Uses Firestore composite index: (companyId, from, createdAt DESC).
 * Returns only subject + date + intent — never body content (privacy + token cost).
 *
 * @param senderEmail — The sender's email address
 * @param companyId — Tenant/company ID for data isolation
 * @param currentMessageId — Current message doc ID to exclude from results
 * @param limit — Max number of previous emails to return (default 5)
 */
export async function getSenderHistory(
  senderEmail: string,
  companyId: string,
  currentMessageId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SenderHistoryResult> {
  const emptyResult: SenderHistoryResult = {
    totalPreviousEmails: 0,
    recentEmails: [],
    isReturningContact: false,
  };

  if (!senderEmail || !companyId) {
    return emptyResult;
  }

  try {
    const adminDb = getAdminFirestore();

    // Query: last N+1 emails from this sender (sorted newest first)
    // We fetch limit+1 to account for excluding the current message
    const snapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where('companyId', '==', companyId)
      .where('from', '==', senderEmail)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1)
      .get();

    if (snapshot.empty) {
      return emptyResult;
    }

    // Filter out the current message and map to entries
    const entries: SenderHistoryEntry[] = [];

    for (const doc of snapshot.docs) {
      // Skip the current message
      if (doc.id === currentMessageId) {
        continue;
      }

      const data = doc.data() as MessageDocPartial;

      entries.push({
        subject: data.subject ?? '(χωρίς θέμα)',
        date: extractDateString(data.createdAt),
        intent: data.intentAnalysis?.intentType ?? null,
      });
    }

    // Trim to requested limit (in case current message wasn't in results)
    const recentEmails = entries.slice(0, limit);

    logger.info('Sender history retrieved', {
      senderEmail,
      companyId,
      totalFound: recentEmails.length,
      isReturning: recentEmails.length > 0,
    });

    return {
      totalPreviousEmails: recentEmails.length,
      recentEmails,
      isReturningContact: recentEmails.length > 0,
    };
  } catch (error) {
    // Non-fatal — AI reply works fine without history
    logger.warn('Sender history query failed (non-fatal)', {
      senderEmail,
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });

    return emptyResult;
  }
}
