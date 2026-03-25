/**
 * CHANNEL REPLY DISPATCHER TESTS
 *
 * Tests the centralized outbound message dispatcher across all channels:
 * Email, Telegram, WhatsApp, Messenger, Instagram, In-App.
 *
 * @see ADR-132 (UC Modules Expansion), ADR-174 (Meta Omnichannel)
 * @module __tests__/channel-reply-dispatcher
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone setup ──
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

jest.mock('../mailgun-sender', () => ({
  sendReplyViaMailgun: jest.fn(async () => ({
    success: true,
    messageId: 'mailgun_msg_001',
  })),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { VOICE_COMMANDS: 'voice_commands' },
}));

// ── Mock dynamic imports for messaging clients ──
jest.mock(
  '@/app/api/communications/webhooks/telegram/telegram/client',
  () => ({
    sendTelegramMessage: jest.fn(async () => ({ success: true })),
  }),
);

jest.mock(
  '@/app/api/communications/webhooks/whatsapp/whatsapp-client',
  () => ({
    sendWhatsAppMessage: jest.fn(async () => ({ success: true, messageId: 'wa_001' })),
  }),
);

jest.mock(
  '@/app/api/communications/webhooks/messenger/messenger-client',
  () => ({
    sendMessengerMessage: jest.fn(async () => ({ success: true, messageId: 'msn_001' })),
  }),
);

jest.mock(
  '@/app/api/communications/webhooks/instagram/instagram-client',
  () => ({
    sendInstagramMessage: jest.fn(async () => ({ success: true, messageId: 'ig_001' })),
  }),
);

import { sendChannelReply, sendChannelMediaReply, extractChannelIds } from '../channel-reply-dispatcher';
import type { ChannelReplyParams, ChannelMediaReplyParams } from '../channel-reply-dispatcher';
import { PipelineChannel } from '@/types/ai-pipeline';
import type { PipelineContext } from '@/types/ai-pipeline';
import { sendReplyViaMailgun } from '../mailgun-sender';
import { sendTelegramMessage } from '@/app/api/communications/webhooks/telegram/telegram/client';
import { sendWhatsAppMessage } from '@/app/api/communications/webhooks/whatsapp/whatsapp-client';
import { sendMessengerMessage } from '@/app/api/communications/webhooks/messenger/messenger-client';
import { sendInstagramMessage } from '@/app/api/communications/webhooks/instagram/instagram-client';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore } from '../../tools/__tests__/test-utils/mock-firestore';

// ============================================================================
// HELPERS
// ============================================================================

function baseParams(
  channel: ChannelReplyParams['channel'],
  overrides?: Partial<ChannelReplyParams>,
): ChannelReplyParams {
  return {
    channel,
    textBody: 'Test reply message',
    requestId: 'req_test_001',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('channel-reply-dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // EMAIL DISPATCH
  // ==========================================================================

  describe('Email dispatch', () => {
    it('should send email via Mailgun', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.EMAIL, {
          recipientEmail: 'user@example.com',
          subject: 'Test Subject',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.messageId).toBe('mailgun_msg_001');
      expect(sendReplyViaMailgun).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
        }),
      );
    });

    it('should fail when no recipientEmail', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.EMAIL),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No recipient email');
    });

    it('should use default subject when not provided', async () => {
      await sendChannelReply(
        baseParams(PipelineChannel.EMAIL, {
          recipientEmail: 'user@example.com',
        }),
      );

      expect(sendReplyViaMailgun).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Απάντηση' }),
      );
    });
  });

  // ==========================================================================
  // TELEGRAM DISPATCH
  // ==========================================================================

  describe('Telegram dispatch', () => {
    it('should send via Telegram Bot API', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.TELEGRAM, {
          telegramChatId: '12345678',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('telegram');
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 12345678,
          text: 'Test reply message',
        }),
      );
    });

    it('should fail when no telegramChatId', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.TELEGRAM),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Telegram chat ID');
    });

    it('should handle Telegram API failure', async () => {
      (sendTelegramMessage as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Bot blocked by user',
      });

      const result = await sendChannelReply(
        baseParams(PipelineChannel.TELEGRAM, { telegramChatId: '123' }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bot blocked');
    });

    it('should handle Telegram exception', async () => {
      (sendTelegramMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Network timeout'),
      );

      const result = await sendChannelReply(
        baseParams(PipelineChannel.TELEGRAM, { telegramChatId: '123' }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  // ==========================================================================
  // WHATSAPP DISPATCH
  // ==========================================================================

  describe('WhatsApp dispatch', () => {
    it('should send via WhatsApp Cloud API', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.WHATSAPP, {
          whatsappPhone: '+306971234567',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('whatsapp');
      expect(sendWhatsAppMessage).toHaveBeenCalledWith(
        '+306971234567',
        'Test reply message',
      );
    });

    it('should fail when no whatsappPhone', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.WHATSAPP),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No WhatsApp phone');
    });
  });

  // ==========================================================================
  // MESSENGER DISPATCH
  // ==========================================================================

  describe('Messenger dispatch', () => {
    it('should send via Messenger Send API', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.MESSENGER, {
          messengerPsid: 'psid_12345',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('messenger');
      expect(sendMessengerMessage).toHaveBeenCalledWith(
        'psid_12345',
        'Test reply message',
      );
    });

    it('should fail when no messengerPsid', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.MESSENGER),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Messenger PSID');
    });
  });

  // ==========================================================================
  // INSTAGRAM DISPATCH
  // ==========================================================================

  describe('Instagram dispatch', () => {
    it('should send via Instagram Messaging API', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.INSTAGRAM, {
          instagramIgsid: 'igsid_12345',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('instagram');
      expect(sendInstagramMessage).toHaveBeenCalledWith(
        'igsid_12345',
        'Test reply message',
      );
    });

    it('should fail when no instagramIgsid', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.INSTAGRAM),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Instagram IGSID');
    });
  });

  // ==========================================================================
  // IN-APP DISPATCH (ADR-164)
  // ==========================================================================

  describe('In-App dispatch', () => {
    it('should update Firestore voice command document', async () => {
      const kit = createMockFirestore();
      kit.seedCollection('voice_commands', {
        cmd_001: { status: 'processing' },
      });
      (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);

      const result = await sendChannelReply(
        baseParams(PipelineChannel.IN_APP, {
          inAppCommandId: 'cmd_001',
        }),
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('cmd_001');
      const updated = kit.getData('voice_commands', 'cmd_001');
      expect(updated!.status).toBe('completed');
      expect(updated!.aiResponse).toBe('Test reply message');
    });

    it('should fail when no inAppCommandId', async () => {
      const result = await sendChannelReply(
        baseParams(PipelineChannel.IN_APP),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No in-app command ID');
    });
  });

  // ==========================================================================
  // UNSUPPORTED CHANNEL
  // ==========================================================================

  describe('Unsupported channel', () => {
    it('should return error for unknown channel', async () => {
      const result = await sendChannelReply(
        baseParams('sms' as ChannelReplyParams['channel']),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  // ==========================================================================
  // extractChannelIds
  // ==========================================================================

  describe('extractChannelIds', () => {
    it('should extract all channel IDs from PipelineContext', () => {
      const ctx = {
        intake: {
          normalized: {
            sender: {
              email: 'test@example.com',
              telegramId: '111',
              whatsappPhone: '+30222',
              messengerUserId: 'psid_333',
              instagramUserId: 'ig_444',
            },
          },
          rawPayload: {},
        },
      } as unknown as PipelineContext;

      const ids = extractChannelIds(ctx);

      expect(ids.recipientEmail).toBe('test@example.com');
      expect(ids.telegramChatId).toBe('111');
      expect(ids.whatsappPhone).toBe('+30222');
      expect(ids.messengerPsid).toBe('psid_333');
      expect(ids.instagramIgsid).toBe('ig_444');
    });

    it('should fallback to rawPayload for channel IDs', () => {
      const ctx = {
        intake: {
          normalized: { sender: {} },
          rawPayload: {
            chatId: 'raw_chat',
            phoneNumber: 'raw_phone',
            psid: 'raw_psid',
            igsid: 'raw_igsid',
            commandId: 'raw_cmd',
          },
        },
      } as unknown as PipelineContext;

      const ids = extractChannelIds(ctx);

      expect(ids.telegramChatId).toBe('raw_chat');
      expect(ids.whatsappPhone).toBe('raw_phone');
      expect(ids.messengerPsid).toBe('raw_psid');
      expect(ids.instagramIgsid).toBe('raw_igsid');
      expect(ids.inAppCommandId).toBe('raw_cmd');
    });
  });

  // ==========================================================================
  // MEDIA REPLY — sendChannelMediaReply
  // ==========================================================================

  describe('sendChannelMediaReply', () => {
    it('should send Telegram photo via sendPhoto method', async () => {
      const result = await sendChannelMediaReply({
        channel: PipelineChannel.TELEGRAM,
        telegramChatId: '12345',
        mediaUrl: 'https://example.com/photo.jpg',
        mediaType: 'photo',
        caption: 'Test photo',
        requestId: 'req_media_001',
      });

      expect(result.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'sendPhoto',
          photo: 'https://example.com/photo.jpg',
          caption: 'Test photo',
        }),
      );
    });

    it('should send Telegram document via sendDocument method', async () => {
      await sendChannelMediaReply({
        channel: PipelineChannel.TELEGRAM,
        telegramChatId: '12345',
        mediaUrl: 'https://example.com/file.pdf',
        mediaType: 'document',
        requestId: 'req_media_002',
      });

      expect(sendTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'sendDocument',
          document: 'https://example.com/file.pdf',
        }),
      );
    });

    it('should block Instagram PDF documents', async () => {
      const result = await sendChannelMediaReply({
        channel: PipelineChannel.INSTAGRAM,
        instagramIgsid: 'ig_123',
        mediaUrl: 'https://example.com/file.pdf',
        mediaType: 'document',
        requestId: 'req_media_003',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('δεν υποστηρίζονται');
    });

    it('should return error for unsupported media channel', async () => {
      const result = await sendChannelMediaReply({
        channel: 'sms' as ChannelMediaReplyParams['channel'],
        mediaUrl: 'https://example.com/photo.jpg',
        mediaType: 'photo',
        requestId: 'req_media_004',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('should fallback to text+link for WhatsApp media', async () => {
      await sendChannelMediaReply({
        channel: PipelineChannel.WHATSAPP,
        whatsappPhone: '+306971234567',
        mediaUrl: 'https://example.com/photo.jpg',
        mediaType: 'photo',
        caption: 'Η φωτογραφία',
        requestId: 'req_media_005',
      });

      expect(sendWhatsAppMessage).toHaveBeenCalledWith(
        '+306971234567',
        expect.stringContaining('https://example.com/photo.jpg'),
      );
    });
  });
});
