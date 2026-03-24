/**
 * =============================================================================
 * DUPLICATE CONTACT KEYBOARD — Telegram Inline Keyboard for Duplicate Resolution
 * =============================================================================
 *
 * Creates inline keyboard buttons when a duplicate contact is detected during
 * AI-assisted contact creation. Follows the same pattern as feedback-keyboard.ts.
 *
 * Callback data formats:
 *   Update existing: `dc:u:{pendingActionId}`
 *   Create new:      `dc:n:{pendingActionId}`
 *   Cancel:          `dc:x:{pendingActionId}`
 *
 * All callback_data values are well within Telegram's 64-byte limit (~50 bytes max).
 *
 * Pending actions are stored in Firestore (ai_pending_actions) with 24h TTL.
 *
 * @module services/ai-pipeline/duplicate-contact-keyboard
 * @see ADR-171 (Autonomous AI Agent — duplicate contact detection)
 */

import 'server-only';

import type { TelegramReplyMarkup } from '@/app/api/communications/webhooks/telegram/telegram/types';
import type { DuplicateMatch } from './shared/contact-lookup';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generatePendingId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('DUPLICATE_CONTACT_KEYBOARD');

// ============================================================================
// CONSTANTS
// ============================================================================

const DC_PREFIX = 'dc';
const ACTION_UPDATE = 'u';
const ACTION_CREATE_NEW = 'n';
const ACTION_CANCEL = 'x';

/** Maps compact callback codes to semantic action names */
const ACTION_MAP: Record<string, DuplicateContactAction> = {
  [ACTION_UPDATE]: 'update',
  [ACTION_CREATE_NEW]: 'create_new',
  [ACTION_CANCEL]: 'cancel',
};

// ============================================================================
// TYPES
// ============================================================================

export type DuplicateContactAction = 'update' | 'create_new' | 'cancel';

export interface ParsedDuplicateCallback {
  pendingId: string;
  action: DuplicateContactAction;
}

/** What gets stored in Firestore for pending duplicate resolution */
export interface PendingContactAction {
  type: 'duplicate_contact';
  requestedContact: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    contactType: string;
    companyName: string | null;
  };
  companyId: string;
  matches: DuplicateMatch[];
  chatId: string;
  createdAt: string;
  expiresAt: string;
}

// ============================================================================
// KEYBOARD FACTORY
// ============================================================================

/**
 * Create an inline keyboard with 3 buttons for duplicate contact resolution.
 *
 * @param pendingActionId - Enterprise ID of the pending action doc in Firestore
 * @returns TelegramReplyMarkup with inline keyboard
 */
export function createDuplicateContactKeyboard(pendingActionId: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🔄 Ενημέρωσε υπάρχουσα', callback_data: `${DC_PREFIX}:${ACTION_UPDATE}:${pendingActionId}` },
      ],
      [
        { text: '➕ Δημιούργησε νέα', callback_data: `${DC_PREFIX}:${ACTION_CREATE_NEW}:${pendingActionId}` },
      ],
      [
        { text: '❌ Ακύρωση', callback_data: `${DC_PREFIX}:${ACTION_CANCEL}:${pendingActionId}` },
      ],
    ],
  };
}

// ============================================================================
// CALLBACK PARSERS
// ============================================================================

/**
 * Check if a callback_data string is a duplicate contact callback.
 */
export function isDuplicateContactCallback(data: string): boolean {
  return data.startsWith(`${DC_PREFIX}:`);
}

/**
 * Parse a duplicate contact callback_data string.
 * Format: `dc:{action}:{pendingId}`
 *
 * @returns Parsed result or null if invalid
 */
export function parseDuplicateContactCallback(data: string): ParsedDuplicateCallback | null {
  const parts = data.split(':');
  if (parts.length < 3 || parts[0] !== DC_PREFIX) return null;

  const actionCode = parts[1];
  const action = ACTION_MAP[actionCode];
  if (!action) return null;

  // pendingId may contain colons (unlikely with UUID, but be safe)
  const pendingId = parts.slice(2).join(':');
  if (!pendingId) return null;

  return { pendingId, action };
}

// ============================================================================
// FIRESTORE CRUD — PENDING CONTACT ACTIONS
// ============================================================================

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Store a pending contact action in Firestore for later resolution via button press.
 *
 * @returns Enterprise ID of the stored pending action
 */
export async function storePendingContactAction(
  params: Omit<PendingContactAction, 'createdAt' | 'expiresAt'>
): Promise<string> {
  const adminDb = getAdminFirestore();
  const pendingId = generatePendingId();
  const now = new Date();

  const doc: PendingContactAction = {
    ...params,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
  };

  await adminDb
    .collection(COLLECTIONS.AI_PENDING_ACTIONS)
    .doc(pendingId)
    .set(doc);

  logger.info('Pending contact action stored', { pendingId, chatId: params.chatId });
  return pendingId;
}

/**
 * Retrieve a pending contact action from Firestore.
 * Returns null if not found or expired.
 */
export async function getPendingContactAction(
  pendingId: string
): Promise<PendingContactAction | null> {
  const adminDb = getAdminFirestore();
  const snap = await adminDb
    .collection(COLLECTIONS.AI_PENDING_ACTIONS)
    .doc(pendingId)
    .get();

  if (!snap.exists) return null;

  const data = snap.data() as PendingContactAction;

  // Check TTL expiry
  if (new Date(data.expiresAt) < new Date()) {
    logger.info('Pending action expired', { pendingId });
    // Fire-and-forget cleanup
    snap.ref.delete().catch(() => { /* non-fatal */ });
    return null;
  }

  return data;
}

/**
 * Delete a pending contact action (cleanup after resolution).
 */
export async function deletePendingContactAction(pendingId: string): Promise<void> {
  const adminDb = getAdminFirestore();
  await adminDb
    .collection(COLLECTIONS.AI_PENDING_ACTIONS)
    .doc(pendingId)
    .delete();

  logger.info('Pending contact action deleted', { pendingId });
}
