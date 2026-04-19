/**
 * =============================================================================
 * TELEGRAM CHAT ID VALIDATOR — SSoT
 * =============================================================================
 *
 * Telegram Bot API rejects send operations with "Bad Request: chat not found"
 * when the target is addressed by @username or any non-numeric handle. Only
 * numeric `chat_id` values (positive for private chats, negative for
 * groups/supergroups) are deliverable once the user has sent `/start` to the
 * bot at least once.
 *
 * This module is the single source of truth that gates every
 * `telegram` channel surface before a send attempt is attempted — used by:
 *   - `/api/contacts/[contactId]/channels` → hide non-deliverable channels
 *   - future linking forms that want to block bad input at entry
 *
 * @see ADR-312 Phase 9.12 (Telegram chat_id hardening)
 */
export const TELEGRAM_CHAT_ID_REGEX = /^-?\d+$/;

export function isValidTelegramChatId(value: string): boolean {
  return TELEGRAM_CHAT_ID_REGEX.test(value.trim());
}
