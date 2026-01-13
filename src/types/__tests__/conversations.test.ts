/**
 * =============================================================================
 * CONVERSATIONS MODULE TESTS
 * =============================================================================
 *
 * Unit tests for canonical conversation model:
 * - ID generation (deterministic/idempotent with hashing)
 * - Type guards
 * - Constants validation
 * - PII-safe document IDs
 *
 * @enterprise No network required - pure function tests
 */

import {
  // Constants
  CONVERSATION_STATUS,
  MESSAGE_DIRECTION,
  DELIVERY_STATUS,
  IDENTITY_PROVIDER,

  // Type Guards
  isValidDirection,
  isValidConversationStatus,
  isValidDeliveryStatus,
} from '@/types/conversations';

// ID Generation (server-only module)
import {
  generateConversationId,
  generateMessageDocId,
  generateExternalIdentityId,
  isValidDocumentId,
} from '@/server/lib/id-generation';

import { COMMUNICATION_CHANNELS } from '@/types/communications';

describe('conversations canonical model', () => {
  // =========================================================================
  // CONSTANTS TESTS
  // =========================================================================

  describe('constants', () => {
    it('CONVERSATION_STATUS contains all required statuses', () => {
      expect(CONVERSATION_STATUS.ACTIVE).toBe('active');
      expect(CONVERSATION_STATUS.CLOSED).toBe('closed');
      expect(CONVERSATION_STATUS.ARCHIVED).toBe('archived');
      expect(CONVERSATION_STATUS.SPAM).toBe('spam');
    });

    it('MESSAGE_DIRECTION contains inbound and outbound', () => {
      expect(MESSAGE_DIRECTION.INBOUND).toBe('inbound');
      expect(MESSAGE_DIRECTION.OUTBOUND).toBe('outbound');
    });

    it('DELIVERY_STATUS contains all delivery states', () => {
      expect(DELIVERY_STATUS.PENDING).toBe('pending');
      expect(DELIVERY_STATUS.SENT).toBe('sent');
      expect(DELIVERY_STATUS.DELIVERED).toBe('delivered');
      expect(DELIVERY_STATUS.READ).toBe('read');
      expect(DELIVERY_STATUS.FAILED).toBe('failed');
    });

    it('IDENTITY_PROVIDER matches implemented channels', () => {
      expect(IDENTITY_PROVIDER.TELEGRAM).toBe('telegram');
      expect(IDENTITY_PROVIDER.EMAIL).toBe('email');
      expect(IDENTITY_PROVIDER.WHATSAPP).toBe('whatsapp');
      expect(IDENTITY_PROVIDER.MESSENGER).toBe('messenger');
      expect(IDENTITY_PROVIDER.SMS).toBe('sms');
      expect(IDENTITY_PROVIDER.PHONE).toBe('phone');
    });
  });

  // =========================================================================
  // IDEMPOTENCY TESTS - Deterministic ID Generation with Hashing
  // =========================================================================

  describe('idempotency - deterministic ID generation (hashed)', () => {
    describe('generateConversationId', () => {
      it('generates deterministic ID for same channel + user (same hash)', () => {
        const id1 = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, '123456');
        const id2 = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, '123456');

        // Same input must produce same output
        expect(id1).toBe(id2);
        // Must start with prefix
        expect(id1).toMatch(/^conv_telegram_/);
        // Must be valid document ID (alphanumeric + underscore)
        expect(isValidDocumentId(id1)).toBe(true);
      });

      it('generates different IDs for different users', () => {
        const id1 = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, '123456');
        const id2 = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, '789012');

        expect(id1).not.toBe(id2);
      });

      it('generates different IDs for different channels', () => {
        const id1 = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, '123456');
        const id2 = generateConversationId(COMMUNICATION_CHANNELS.EMAIL, '123456');

        expect(id1).not.toBe(id2);
        expect(id1).toContain('telegram');
        expect(id2).toContain('email');
      });

      it('produces PII-safe IDs (no raw email in ID)', () => {
        const id = generateConversationId(COMMUNICATION_CHANNELS.EMAIL, 'user@example.com');
        // Should NOT contain the raw email
        expect(id).not.toContain('@');
        expect(id).not.toContain('user@example.com');
        // Should still be deterministic
        const id2 = generateConversationId(COMMUNICATION_CHANNELS.EMAIL, 'user@example.com');
        expect(id).toBe(id2);
      });
    });

    describe('generateMessageDocId', () => {
      it('generates deterministic ID for same channel + chat + message', () => {
        // B1 FIX: Now requires chatId for proper scoping
        const id1 = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, '12345', '999');
        const id2 = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, '12345', '999');

        expect(id1).toBe(id2);
        expect(id1).toMatch(/^msg_telegram_/);
        expect(isValidDocumentId(id1)).toBe(true);
      });

      it('generates different IDs for different messages in same chat', () => {
        const id1 = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, '12345', '999');
        const id2 = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, '12345', '1000');

        expect(id1).not.toBe(id2);
      });

      it('generates different IDs for same message_id in different chats (B1 fix)', () => {
        // CRITICAL: This is the B1 fix - Telegram message_id is only unique per chat
        const id1 = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, '12345', '999');
        const id2 = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, '67890', '999');

        // Same message_id in different chats must produce different doc IDs
        expect(id1).not.toBe(id2);
      });

      it('prevents duplicate message storage on retries', () => {
        // Same provider message ID in same chat should always generate same doc ID
        const chatId = '12345';
        const providerMessageId = '99999999';
        const attempts = [
          generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, chatId, providerMessageId),
          generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, chatId, providerMessageId),
          generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, chatId, providerMessageId),
        ];

        expect(new Set(attempts).size).toBe(1); // All attempts produce same ID
      });
    });

    describe('generateExternalIdentityId', () => {
      it('generates deterministic ID for same provider + user', () => {
        const id1 = generateExternalIdentityId(IDENTITY_PROVIDER.TELEGRAM, '123456');
        const id2 = generateExternalIdentityId(IDENTITY_PROVIDER.TELEGRAM, '123456');

        expect(id1).toBe(id2);
        expect(id1).toMatch(/^eid_telegram_/);
        expect(isValidDocumentId(id1)).toBe(true);
      });

      it('generates different IDs for different providers', () => {
        const id1 = generateExternalIdentityId(IDENTITY_PROVIDER.TELEGRAM, '123456');
        const id2 = generateExternalIdentityId(IDENTITY_PROVIDER.EMAIL, '123456');

        expect(id1).not.toBe(id2);
      });

      it('produces PII-safe IDs for email identities', () => {
        const id = generateExternalIdentityId(IDENTITY_PROVIDER.EMAIL, 'sensitive@company.com');
        // Should NOT contain the raw email
        expect(id).not.toContain('@');
        expect(id).not.toContain('sensitive@company.com');
        // Should be valid
        expect(isValidDocumentId(id)).toBe(true);
      });
    });
  });

  // =========================================================================
  // DOCUMENT ID VALIDATION TESTS
  // =========================================================================

  describe('isValidDocumentId', () => {
    it('returns true for valid alphanumeric IDs', () => {
      expect(isValidDocumentId('abc123')).toBe(true);
      expect(isValidDocumentId('conv_telegram_abc123')).toBe(true);
      expect(isValidDocumentId('msg_email_xyz789')).toBe(true);
    });

    it('returns true for IDs with underscores', () => {
      expect(isValidDocumentId('conv_telegram_123_456')).toBe(true);
      expect(isValidDocumentId('__prefix__')).toBe(true);
    });

    it('returns false for IDs with special characters', () => {
      expect(isValidDocumentId('user@example.com')).toBe(false);
      expect(isValidDocumentId('path/to/doc')).toBe(false);
      expect(isValidDocumentId('id with spaces')).toBe(false);
    });

    it('returns false for empty IDs', () => {
      expect(isValidDocumentId('')).toBe(false);
    });
  });

  // =========================================================================
  // TYPE GUARD TESTS
  // =========================================================================

  describe('type guards', () => {
    describe('isValidDirection', () => {
      it('returns true for valid directions', () => {
        expect(isValidDirection('inbound')).toBe(true);
        expect(isValidDirection('outbound')).toBe(true);
      });

      it('returns false for invalid directions', () => {
        expect(isValidDirection('invalid')).toBe(false);
        expect(isValidDirection('')).toBe(false);
        expect(isValidDirection('INBOUND')).toBe(false); // Case sensitive
      });
    });

    describe('isValidConversationStatus', () => {
      it('returns true for valid statuses', () => {
        expect(isValidConversationStatus('active')).toBe(true);
        expect(isValidConversationStatus('closed')).toBe(true);
        expect(isValidConversationStatus('archived')).toBe(true);
        expect(isValidConversationStatus('spam')).toBe(true);
      });

      it('returns false for invalid statuses', () => {
        expect(isValidConversationStatus('invalid')).toBe(false);
        expect(isValidConversationStatus('pending')).toBe(false);
        expect(isValidConversationStatus('')).toBe(false);
      });
    });

    describe('isValidDeliveryStatus', () => {
      it('returns true for valid delivery statuses', () => {
        expect(isValidDeliveryStatus('pending')).toBe(true);
        expect(isValidDeliveryStatus('sent')).toBe(true);
        expect(isValidDeliveryStatus('delivered')).toBe(true);
        expect(isValidDeliveryStatus('read')).toBe(true);
        expect(isValidDeliveryStatus('failed')).toBe(true);
      });

      it('returns false for invalid delivery statuses', () => {
        expect(isValidDeliveryStatus('invalid')).toBe(false);
        expect(isValidDeliveryStatus('queued')).toBe(false);
        expect(isValidDeliveryStatus('')).toBe(false);
      });
    });
  });

  // =========================================================================
  // INTEGRATION WITH COMMUNICATIONS MODULE
  // =========================================================================

  describe('integration with communications module', () => {
    it('conversation IDs use same channel values as COMMUNICATION_CHANNELS', () => {
      // Ensure conversation IDs align with communication channels
      const telegramConvId = generateConversationId(COMMUNICATION_CHANNELS.TELEGRAM, 'user1');
      const emailConvId = generateConversationId(COMMUNICATION_CHANNELS.EMAIL, 'user1');

      expect(telegramConvId).toContain('telegram');
      expect(emailConvId).toContain('email');
    });

    it('message doc IDs use same channel values as COMMUNICATION_CHANNELS', () => {
      const telegramMsgId = generateMessageDocId(COMMUNICATION_CHANNELS.TELEGRAM, 'chat1', 'msg1');
      const emailMsgId = generateMessageDocId(COMMUNICATION_CHANNELS.EMAIL, 'chat1', 'msg1');

      expect(telegramMsgId).toContain('telegram');
      expect(emailMsgId).toContain('email');
    });
  });

  // =========================================================================
  // COLLISION RESISTANCE TESTS
  // =========================================================================

  describe('collision resistance', () => {
    it('different inputs produce different conversation IDs', () => {
      const ids = new Set<string>();
      const testInputs = [
        ['telegram', '1'],
        ['telegram', '2'],
        ['email', '1'],
        ['email', '2'],
        ['whatsapp', '1'],
      ] as const;

      for (const [channel, userId] of testInputs) {
        const id = generateConversationId(channel, userId);
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(testInputs.length);
    });

    it('different inputs produce different message IDs', () => {
      const ids = new Set<string>();
      const testInputs = [
        ['telegram', 'chat1', 'msg1'],
        ['telegram', 'chat1', 'msg2'],
        ['telegram', 'chat2', 'msg1'], // Same msg ID, different chat
        ['email', 'chat1', 'msg1'],
      ] as const;

      for (const [channel, chatId, msgId] of testInputs) {
        const id = generateMessageDocId(channel, chatId, msgId);
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(testInputs.length);
    });
  });
});
