/**
 * MESSAGING HANDLER — Unit Tests (Google-level)
 *
 * Covers:
 * - send_email_to_contact: contact search, email extraction, admin-only
 * - send_telegram_message: chatId resolution, admin-only
 * - send_messenger_message / send_instagram_message: admin-only
 *
 * @see ADR-171
 */

import '../setup';

import { MessagingHandler } from '../../handlers/messaging-handler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore, type MockFirestoreKit } from '../test-utils/mock-firestore';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

const mockSendChannelReply = jest.requireMock(
  '@/services/ai-pipeline/shared/channel-reply-dispatcher'
).sendChannelReply as jest.Mock;

describe('MessagingHandler', () => {
  let handler: MessagingHandler;
  let mockDb: MockFirestoreKit;

  beforeEach(() => {
    handler = new MessagingHandler();
    mockDb = createMockFirestore();
    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb.instance);
    jest.clearAllMocks();
    mockSendChannelReply.mockReturnValue({ success: true, messageId: 'msg_001' });
  });

  // ==========================================================================
  // send_email_to_contact
  // ==========================================================================

  describe('send_email_to_contact', () => {
    test('should send email when contact found with email', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'c1': {
          companyId: 'test-company-001',
          displayName: 'Δημήτριος Οικονόμου',
          firstName: 'Δημήτριος',
          lastName: 'Οικονόμου',
          emails: [{ email: 'dim@example.com', type: 'personal', isPrimary: true }],
        },
      });

      const result = await handler.execute('send_email_to_contact', {
        contactName: 'Δημήτριος',
        subject: 'Test',
        body: 'Hello',
      }, ctx);

      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.recipientEmail).toBe('dim@example.com');
    });

    test('should reject email when contact has no email', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'c1': {
          companyId: 'test-company-001',
          displayName: 'Δημήτριος',
          firstName: 'Δημήτριος',
          emails: [],
        },
      });

      const result = await handler.execute('send_email_to_contact', {
        contactName: 'Δημήτριος',
        subject: 'Test',
        body: 'Hello',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('no email');
    });

    test('should reject email when contact not found', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {});

      const result = await handler.execute('send_email_to_contact', {
        contactName: 'Nonexistent Person',
        subject: 'Test',
        body: 'Hello',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should reject email when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('send_email_to_contact', {
        contactName: 'Test',
        subject: 'Test',
        body: 'Hello',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });
  });

  // ==========================================================================
  // send_telegram_message
  // ==========================================================================

  describe('send_telegram_message', () => {
    test('should send telegram message with explicit chatId', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('send_telegram_message', {
        chatId: '12345',
        text: 'Hello Telegram',
      }, ctx);

      expect(result.success).toBe(true);
      expect(mockSendChannelReply).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'telegram',
          telegramChatId: '12345',
          textBody: 'Hello Telegram',
        }),
      );
    });

    test('should use context telegramChatId when no explicit chatId', async () => {
      const ctx = createAdminContext({ telegramChatId: '5618410820' });

      const result = await handler.execute('send_telegram_message', {
        text: 'Auto chatId',
      }, ctx);

      expect(result.success).toBe(true);
      expect(mockSendChannelReply).toHaveBeenCalledWith(
        expect.objectContaining({ telegramChatId: '5618410820' }),
      );
    });

    test('should reject telegram when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('send_telegram_message', {
        chatId: '12345',
        text: 'test',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    test('should reject telegram when text is empty', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('send_telegram_message', {
        chatId: '12345',
        text: '',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  // ==========================================================================
  // send_messenger_message / send_instagram_message
  // ==========================================================================

  describe('send_social_messages', () => {
    test('should reject messenger when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('send_messenger_message', {
        contactName: 'Test',
        text: 'Hello',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    test('should reject instagram when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('send_instagram_message', {
        contactName: 'Test',
        text: 'Hello',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });
  });
});
