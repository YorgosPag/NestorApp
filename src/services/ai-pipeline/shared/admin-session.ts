/**
 * =============================================================================
 * 🏢 ENTERPRISE: ADMIN SESSION — Lightweight Conversational Context
 * =============================================================================
 *
 * Tracks the last admin action (create/update contact) so that follow-up
 * commands without an explicit contact name can be resolved automatically.
 *
 * Firestore path: settings/admin_sessions/{adminIdentifier}
 * TTL: 10 minutes (checked on read, expired sessions return null)
 *
 * @module services/ai-pipeline/shared/admin-session
 * @see ADR-145 (Super Admin AI Assistant — Secretary Mode)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('ADMIN_SESSION');

/** TTL for admin sessions — 10 minutes */
const SESSION_TTL_MS = 10 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

/** The last action performed by the admin (create or update contact) */
export interface AdminSessionLastAction {
  type: 'create_contact' | 'update_contact';
  contactId: string;
  contactName: string;
  timestamp: string; // ISO 8601
}

/** Admin session document stored in Firestore */
export interface AdminSession {
  lastAction: AdminSessionLastAction | null;
  expiresAt: string; // ISO 8601
}

// ============================================================================
// FIRESTORE PATH
// ============================================================================

/**
 * Build the Firestore document path for an admin session.
 * Uses a subcollection under `settings/admin_sessions`.
 */
function getSessionDocPath(adminIdentifier: string): string {
  return `settings/admin_sessions/sessions/${adminIdentifier}`;
}

// ============================================================================
// READ SESSION
// ============================================================================

/**
 * Get the current admin session. Returns null if no session or if expired.
 *
 * @param adminIdentifier - Unique admin identifier (e.g., `telegram_5618410820`)
 * @returns AdminSession or null
 */
export async function getAdminSession(
  adminIdentifier: string
): Promise<AdminSession | null> {
  try {
    const adminDb = getAdminFirestore();
    const docPath = getSessionDocPath(adminIdentifier);
    const docRef = adminDb.doc(docPath);
    const snap = await docRef.get();

    if (!snap.exists) return null;

    const data = snap.data() as AdminSession;

    // Check TTL
    const expiresAt = new Date(data.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      logger.debug('Admin session expired', { adminIdentifier });
      return null;
    }

    return data;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to read admin session', { adminIdentifier, error: msg });
    return null;
  }
}

// ============================================================================
// WRITE SESSION
// ============================================================================

/**
 * Write/update the admin session with a new last action.
 *
 * @param adminIdentifier - Unique admin identifier (e.g., `telegram_5618410820`)
 * @param lastAction - The action to store
 */
export async function setAdminSession(
  adminIdentifier: string,
  lastAction: AdminSessionLastAction
): Promise<void> {
  try {
    const adminDb = getAdminFirestore();
    const docPath = getSessionDocPath(adminIdentifier);
    const docRef = adminDb.doc(docPath);

    const session: AdminSession = {
      lastAction,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };

    await docRef.set(session);

    logger.debug('Admin session updated', {
      adminIdentifier,
      actionType: lastAction.type,
      contactId: lastAction.contactId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to write admin session', { adminIdentifier, error: msg });
    // Non-fatal — session is a convenience feature, not critical
  }
}

// ============================================================================
// HELPER: Build admin identifier from pipeline context
// ============================================================================

/**
 * Build a unique admin identifier from the pipeline context.
 * Used as the Firestore document key for the session.
 *
 * Format: `{channel}_{channelSpecificId}`
 * Examples: `telegram_5618410820`, `email_admin@example.com`
 */
export function buildAdminIdentifier(
  channel: string,
  sender: { telegramId?: string; email?: string; phone?: string }
): string {
  if (channel === 'telegram' && sender.telegramId) {
    return `telegram_${sender.telegramId}`;
  }
  if (channel === 'email' && sender.email) {
    return `email_${sender.email}`;
  }
  if (sender.phone) {
    return `phone_${sender.phone}`;
  }
  return `unknown_${Date.now()}`;
}
