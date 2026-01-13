/**
 * =============================================================================
 * ENTERPRISE ID GENERATION - SHA-256 DETERMINISTIC IDs
 * =============================================================================
 *
 * Generates safe, deterministic document IDs for Firestore using SHA-256.
 *
 * Security Features:
 * - NO PII in document IDs (SHA-256 hashed identifiers)
 * - Safe characters only (alphanumeric + underscore)
 * - Deterministic (same input = same output)
 * - Chat-scoped for Telegram (message_id is only unique per chat)
 * - Collision-resistant (SHA-256 provides 256-bit security)
 *
 * @module server/lib/id-generation
 * @enterprise ADR-031 - Safe Document ID Generation
 * @server-only Uses Node.js crypto - do NOT import in client bundles
 */

import { createHash } from 'crypto';
import type { CommunicationChannel } from '@/types/communications';
import type { IdentityProvider } from '@/types/conversations';

// ============================================================================
// HASH FUNCTION (SHA-256 - deterministic, sync, collision-resistant)
// ============================================================================

/**
 * SHA-256 hash with base64url encoding for safe document IDs
 * @enterprise Collision-resistant, cryptographically secure
 * @server-only Uses Node.js crypto module
 */
function sha256Hash(input: string): string {
  return createHash('sha256')
    .update(input, 'utf8')
    .digest('base64url');
}

/**
 * Generate safe alphanumeric hash from input
 * @enterprise Produces URL-safe, Firestore-safe identifier
 * @returns First 16 chars of SHA-256 base64url (96 bits of entropy)
 */
function generateSafeHash(input: string): string {
  // SHA-256 produces 256 bits of entropy
  // Base64url encoding, take first 16 chars for compact but safe IDs
  // 16 base64 chars = 96 bits = collision probability ~1 in 79 billion billion
  const fullHash = sha256Hash(input);
  // Replace any remaining non-alphanumeric chars (base64url may have - and _)
  // We keep underscore but replace hyphen
  return fullHash.substring(0, 16).replace(/-/g, 'x');
}

// ============================================================================
// CONVERSATION ID GENERATION
// ============================================================================

/**
 * Generate deterministic conversation ID from channel + external user
 *
 * @enterprise
 * - Same user on same channel = same conversation ID
 * - External user ID is hashed (no PII in doc ID)
 * - Format: conv_{channel}_{hashedUserId}
 *
 * @example
 * generateConversationId('telegram', '123456789') => 'conv_telegram_abc123xyz'
 */
export function generateConversationId(
  channel: CommunicationChannel,
  externalUserId: string
): string {
  const hashedUserId = generateSafeHash(`${channel}_user_${externalUserId}`);
  return `conv_${channel}_${hashedUserId}`;
}

// ============================================================================
// MESSAGE DOCUMENT ID GENERATION
// ============================================================================

/**
 * Generate deterministic message doc ID from channel + chat + message
 *
 * @enterprise
 * - CRITICAL: Telegram message_id is only unique per chat, NOT globally
 * - Must include chatId for proper deduplication
 * - Format: msg_{channel}_{hashedChatAndMessage}
 *
 * @example
 * generateMessageDocId('telegram', '123456', '999') => 'msg_telegram_xyz789abc'
 */
export function generateMessageDocId(
  channel: CommunicationChannel,
  chatId: string,
  providerMessageId: string
): string {
  // Include chatId in hash to prevent collision across chats
  const combinedKey = `${channel}_chat_${chatId}_msg_${providerMessageId}`;
  const hashedKey = generateSafeHash(combinedKey);
  return `msg_${channel}_${hashedKey}`;
}

/**
 * Generate message doc ID for channels where message ID is globally unique
 * (e.g., Email Message-ID header)
 *
 * @enterprise Use this ONLY for channels with guaranteed global uniqueness
 */
export function generateGlobalMessageDocId(
  channel: CommunicationChannel,
  providerMessageId: string
): string {
  const hashedKey = generateSafeHash(`${channel}_msg_${providerMessageId}`);
  return `msg_${channel}_${hashedKey}`;
}

// ============================================================================
// EXTERNAL IDENTITY ID GENERATION
// ============================================================================

/**
 * Generate deterministic external identity ID
 *
 * @enterprise
 * - Same provider + user = same identity ID
 * - External user ID is hashed (no PII in doc ID)
 * - Format: eid_{provider}_{hashedUserId}
 *
 * @example
 * generateExternalIdentityId('telegram', '123456789') => 'eid_telegram_abc123xyz'
 */
export function generateExternalIdentityId(
  provider: IdentityProvider,
  externalUserId: string
): string {
  const hashedUserId = generateSafeHash(`${provider}_identity_${externalUserId}`);
  return `eid_${provider}_${hashedUserId}`;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a string is a valid Firestore document ID
 * @enterprise Must match: [a-zA-Z0-9_]+ and length 1-1500
 */
export function isValidDocumentId(id: string): boolean {
  if (!id || id.length === 0 || id.length > 1500) {
    return false;
  }
  // Only alphanumeric and underscore
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Validate that all generated IDs are safe
 * @enterprise Self-test function for development
 */
export function validateIdGeneration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Test conversation ID
  const convId = generateConversationId('telegram', 'test@example.com');
  if (!isValidDocumentId(convId)) {
    errors.push(`Invalid conversation ID: ${convId}`);
  }

  // Test message ID
  const msgId = generateMessageDocId('telegram', '12345', '99999');
  if (!isValidDocumentId(msgId)) {
    errors.push(`Invalid message ID: ${msgId}`);
  }

  // Test external identity ID
  const eidId = generateExternalIdentityId('telegram', '12345');
  if (!isValidDocumentId(eidId)) {
    errors.push(`Invalid external identity ID: ${eidId}`);
  }

  // Test that same input produces same output (determinism)
  const convId2 = generateConversationId('telegram', 'test@example.com');
  if (convId !== convId2) {
    errors.push('Conversation ID not deterministic');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
