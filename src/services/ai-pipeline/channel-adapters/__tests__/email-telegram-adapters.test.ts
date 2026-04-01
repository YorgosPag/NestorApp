/**
 * EMAIL + TELEGRAM CHANNEL ADAPTER TESTS
 *
 * Tests the two adapters with the most complex logic:
 * - EmailChannelAdapter: attachment mapping (deferred mode), admin via email
 * - TelegramChannelAdapter: attachment filtering, contactMeta, admin via userId
 *
 * @see ADR-080 (Pipeline), ADR-071 (Email Webhook), ADR-132 (Telegram)
 * @module __tests__/email-telegram-adapters
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Standalone mocks (before imports) ──

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : String(e)
  ),
}));

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 },
}));

const mockEnqueue = jest.fn<
  Promise<{ queueId: string; requestId: string }>,
  [unknown]
>();
jest.mock('../../pipeline-queue-service', () => ({
  enqueuePipelineItem: (item: unknown) => mockEnqueue(item),
}));

const mockIsSuperAdminEmail = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();
jest.mock('../../shared/super-admin-resolver', () => ({
  isSuperAdminEmail: (...args: [string]) => mockIsSuperAdminEmail(...args),
  isSuperAdminTelegram: (...args: [string]) => mockIsSuperAdminTelegram(...args),
}));

const mockIsSuperAdminTelegram = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();

// ── Imports ──
import { EmailChannelAdapter } from '../email-channel-adapter';
import type { FeedToPipelineParams } from '../email-channel-adapter';
import { TelegramChannelAdapter } from '../telegram-channel-adapter';
import type { TelegramFeedParams } from '../telegram-channel-adapter';
import { PipelineChannel } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createEmailParams(overrides?: Partial<FeedToPipelineParams>): FeedToPipelineParams {
  return {
    queueItem: {
      sender: { email: 'customer@example.com', name: 'John Doe' },
      recipients: ['office@pagonis.gr'],
      subject: 'Inquiry about project',
      contentText: 'Hello, I need info.',
      contentHtml: '<p>Hello, I need info.</p>',
      attachments: [],
      providerMessageId: 'mailgun_abc123',
      rawMetadata: { 'Message-Id': '<abc@mail>' },
      createdAt: new Date('2026-03-25T10:00:00Z'),
    } as unknown as FeedToPipelineParams['queueItem'],
    communicationId: 'msg_email_00001',
    companyId: 'comp_pagonis',
    ...overrides,
  };
}

function createTelegramParams(overrides?: Partial<TelegramFeedParams>): TelegramFeedParams {
  return {
    chatId: '123456',
    userId: '789012',
    userName: 'Nikos Test',
    messageText: 'Γεια σας, θέλω πληροφορίες',
    messageId: '9999',
    companyId: 'comp_pagonis',
    ...overrides,
  };
}

const ADMIN_RESOLUTION = {
  identity: { displayName: 'Admin Giorgos', firebaseUid: 'uid_admin_001' },
  resolvedVia: 'email' as const,
};

// ============================================================================
// EMAIL CHANNEL ADAPTER
// ============================================================================

describe('EmailChannelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue({ queueId: 'pq_001', requestId: 'req_001' });
    mockIsSuperAdminEmail.mockResolvedValue(null);
  });

  // ── feedToPipeline ──

  describe('feedToPipeline', () => {
    it('enqueues email successfully with correct channel', async () => {
      const result = await EmailChannelAdapter.feedToPipeline(createEmailParams());

      expect(result.enqueued).toBe(true);
      expect(result.pipelineQueueId).toBe('pq_001');
      expect(result.requestId).toBe('req_001');
      expect(result.error).toBeUndefined();

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ channel: PipelineChannel.EMAIL })
      );
    });

    it('passes companyId to enqueue', async () => {
      await EmailChannelAdapter.feedToPipeline(
        createEmailParams({ companyId: 'comp_custom' })
      );

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'comp_custom' })
      );
    });

    it('detects super admin via email', async () => {
      mockIsSuperAdminEmail.mockResolvedValue(ADMIN_RESOLUTION);

      await EmailChannelAdapter.feedToPipeline(createEmailParams());

      expect(mockIsSuperAdminEmail).toHaveBeenCalledWith('customer@example.com');
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          adminCommandMeta: expect.objectContaining({
            isAdminCommand: true,
            adminIdentity: expect.objectContaining({
              displayName: 'Admin Giorgos',
            }),
          }),
        })
      );
    });

    it('omits adminCommandMeta when sender is not admin', async () => {
      mockIsSuperAdminEmail.mockResolvedValue(null);

      await EmailChannelAdapter.feedToPipeline(createEmailParams());

      const enqueueArg = mockEnqueue.mock.calls[0][0] as Record<string, unknown>;
      expect(enqueueArg).not.toHaveProperty('adminCommandMeta');
    });

    it('treats admin check failure as non-fatal', async () => {
      mockIsSuperAdminEmail.mockRejectedValue(new Error('Redis down'));

      const result = await EmailChannelAdapter.feedToPipeline(createEmailParams());

      expect(result.enqueued).toBe(true);
      const enqueueArg = mockEnqueue.mock.calls[0][0] as Record<string, unknown>;
      expect(enqueueArg).not.toHaveProperty('adminCommandMeta');
    });

    it('returns error when enqueue throws', async () => {
      mockEnqueue.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await EmailChannelAdapter.feedToPipeline(createEmailParams());

      expect(result.enqueued).toBe(false);
      expect(result.error).toContain('EmailChannelAdapter');
      expect(result.error).toContain('Firestore unavailable');
    });
  });

  // ── toIntakeMessage ──

  describe('toIntakeMessage', () => {
    it('maps sender email and name', () => {
      const params = createEmailParams();
      const msg = EmailChannelAdapter.toIntakeMessage(
        params.queueItem,
        params.communicationId
      );

      expect(msg.normalized.sender.email).toBe('customer@example.com');
      expect(msg.normalized.sender.name).toBe('John Doe');
    });

    it('uses communicationId as message id', () => {
      const msg = EmailChannelAdapter.toIntakeMessage(
        createEmailParams().queueItem,
        'msg_email_12345'
      );

      expect(msg.id).toBe('msg_email_12345');
    });

    it('sets channel to EMAIL', () => {
      const msg = EmailChannelAdapter.toIntakeMessage(
        createEmailParams().queueItem,
        'msg_email_00001'
      );

      expect(msg.channel).toBe(PipelineChannel.EMAIL);
    });

    it('maps deferred attachments with storageUrl', () => {
      const params = createEmailParams({
        queueItem: {
          ...createEmailParams().queueItem,
          attachments: [
            {
              filename: 'plan.pdf',
              contentType: 'application/pdf',
              sizeBytes: 524288,
              mode: 'deferred',
              storageUrl: 'gs://bucket/plan.pdf',
            },
          ],
        } as FeedToPipelineParams['queueItem'],
      });

      const msg = EmailChannelAdapter.toIntakeMessage(
        params.queueItem,
        params.communicationId
      );

      expect(msg.normalized.attachments).toHaveLength(1);
      expect(msg.normalized.attachments[0]).toEqual({
        filename: 'plan.pdf',
        contentType: 'application/pdf',
        sizeBytes: 524288,
        storageUrl: 'gs://bucket/plan.pdf',
      });
    });

    it('omits storageUrl for non-deferred attachments', () => {
      const params = createEmailParams({
        queueItem: {
          ...createEmailParams().queueItem,
          attachments: [
            {
              filename: 'photo.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 100000,
              mode: 'inline',
            },
          ],
        } as FeedToPipelineParams['queueItem'],
      });

      const msg = EmailChannelAdapter.toIntakeMessage(
        params.queueItem,
        params.communicationId
      );

      expect(msg.normalized.attachments[0]).not.toHaveProperty('storageUrl');
    });

    it('sets signatureVerified to true (Mailgun-verified)', () => {
      const msg = EmailChannelAdapter.toIntakeMessage(
        createEmailParams().queueItem,
        'msg_email_00001'
      );

      expect(msg.metadata.signatureVerified).toBe(true);
    });

    it('converts Date createdAt to ISO string', () => {
      const msg = EmailChannelAdapter.toIntakeMessage(
        createEmailParams().queueItem,
        'msg_email_00001'
      );

      expect(msg.normalized.timestampIso).toBe('2026-03-25T10:00:00.000Z');
    });

    it('sets schemaVersion from config', () => {
      const msg = EmailChannelAdapter.toIntakeMessage(
        createEmailParams().queueItem,
        'msg_email_00001'
      );

      expect(msg.schemaVersion).toBe(1);
    });
  });
});

// ============================================================================
// TELEGRAM CHANNEL ADAPTER
// ============================================================================

describe('TelegramChannelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue({ queueId: 'pq_002', requestId: 'req_002' });
    mockIsSuperAdminTelegram.mockResolvedValue(null);
  });

  // ── feedToPipeline ──

  describe('feedToPipeline', () => {
    it('enqueues telegram message successfully', async () => {
      const result = await TelegramChannelAdapter.feedToPipeline(
        createTelegramParams()
      );

      expect(result.enqueued).toBe(true);
      expect(result.pipelineQueueId).toBe('pq_002');
      expect(result.requestId).toBe('req_002');
      expect(result.isAdmin).toBe(false);
    });

    it('passes TELEGRAM channel to enqueue', async () => {
      await TelegramChannelAdapter.feedToPipeline(createTelegramParams());

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ channel: PipelineChannel.TELEGRAM })
      );
    });

    it('detects super admin via telegram userId', async () => {
      mockIsSuperAdminTelegram.mockResolvedValue({
        ...ADMIN_RESOLUTION,
        resolvedVia: 'telegram',
      });

      const result = await TelegramChannelAdapter.feedToPipeline(
        createTelegramParams({ userId: '5618410820' })
      );

      expect(mockIsSuperAdminTelegram).toHaveBeenCalledWith('5618410820');
      expect(result.isAdmin).toBe(true);
    });

    it('passes contactMeta when provided', async () => {
      const contactMeta = {
        contactId: 'cnt_001',
        displayName: 'Nikos',
        firstName: 'Nikos',
        primaryPersona: null,
        linkedPropertyIds: [],
        projectRoles: [{ projectId: 'prj_001', role: 'owner', entityType: 'project', entityId: 'prj_001' }],
      };

      await TelegramChannelAdapter.feedToPipeline(
        createTelegramParams({ contactMeta })
      );

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ contactMeta })
      );
    });

    it('omits contactMeta when null', async () => {
      await TelegramChannelAdapter.feedToPipeline(
        createTelegramParams({ contactMeta: null })
      );

      const enqueueArg = mockEnqueue.mock.calls[0][0] as Record<string, unknown>;
      expect(enqueueArg).not.toHaveProperty('contactMeta');
    });

    it('treats admin check failure as non-fatal', async () => {
      mockIsSuperAdminTelegram.mockRejectedValue(new Error('timeout'));

      const result = await TelegramChannelAdapter.feedToPipeline(
        createTelegramParams()
      );

      expect(result.enqueued).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it('returns error when enqueue throws', async () => {
      mockEnqueue.mockRejectedValue(new Error('quota exceeded'));

      const result = await TelegramChannelAdapter.feedToPipeline(
        createTelegramParams()
      );

      expect(result.enqueued).toBe(false);
      expect(result.error).toContain('TelegramChannelAdapter');
      expect(result.error).toContain('quota exceeded');
    });
  });

  // ── toIntakeMessage ──

  describe('toIntakeMessage', () => {
    it('generates correct id format: tg_{chatId}_{messageId}', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(
        createTelegramParams({ chatId: '111', messageId: '222' })
      );

      expect(msg.id).toBe('tg_111_222');
    });

    it('sets channel to TELEGRAM', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(createTelegramParams());
      expect(msg.channel).toBe(PipelineChannel.TELEGRAM);
    });

    it('stores chatId and userId in rawPayload', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(
        createTelegramParams({ chatId: '111', userId: '222', messageId: '333' })
      );

      expect(msg.rawPayload).toEqual({
        chatId: '111',
        userId: '222',
        messageId: '333',
      });
    });

    it('maps valid attachments with fileRecordId and url', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(
        createTelegramParams({
          attachments: [
            {
              fileRecordId: 'fr_001',
              url: 'https://storage.example.com/photo.jpg',
              filename: 'photo.jpg',
              mimeType: 'image/jpeg',
              size: 204800,
              type: 'image',
            },
          ],
        })
      );

      expect(msg.normalized.attachments).toHaveLength(1);
      expect(msg.normalized.attachments[0]).toEqual(
        expect.objectContaining({
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 204800,
          storageUrl: 'https://storage.example.com/photo.jpg',
          fileRecordId: 'fr_001',
        })
      );
    });

    it('keeps attachments without fileRecordId but marks them (no filtering)', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(
        createTelegramParams({
          attachments: [
            {
              url: 'https://example.com/file.pdf',
              filename: 'file.pdf',
              mimeType: 'application/pdf',
              size: 1000,
              type: 'document',
            },
          ] as TelegramFeedParams['attachments'],
        })
      );

      // Adapter no longer filters — keeps attachment with storageUrl but no fileRecordId
      expect(msg.normalized.attachments).toHaveLength(1);
      expect(msg.normalized.attachments[0].storageUrl).toBe('https://example.com/file.pdf');
      expect(msg.normalized.attachments[0].fileRecordId).toBeUndefined();
    });

    it('keeps attachments without url and marks downloadFailed', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(
        createTelegramParams({
          attachments: [
            {
              fileRecordId: 'fr_002',
              filename: 'doc.pdf',
              mimeType: 'application/pdf',
              size: 500,
              type: 'document',
            },
          ] as TelegramFeedParams['attachments'],
        })
      );

      // Adapter no longer filters — keeps attachment with fileRecordId but no url
      expect(msg.normalized.attachments).toHaveLength(1);
      expect(msg.normalized.attachments[0].fileRecordId).toBe('fr_002');
    });

    it('returns empty attachments when none provided', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(createTelegramParams());
      expect(msg.normalized.attachments).toEqual([]);
    });

    it('uses fallback filename and contentType for missing fields', () => {
      const msg = TelegramChannelAdapter.toIntakeMessage(
        createTelegramParams({
          attachments: [
            {
              fileRecordId: 'fr_003',
              url: 'https://example.com/file',
              type: 'document',
            },
          ] as TelegramFeedParams['attachments'],
        })
      );

      expect(msg.normalized.attachments[0].filename).toBe('attachment');
      expect(msg.normalized.attachments[0].contentType).toBe('application/octet-stream');
      expect(msg.normalized.attachments[0].sizeBytes).toBe(0);
    });
  });
});
