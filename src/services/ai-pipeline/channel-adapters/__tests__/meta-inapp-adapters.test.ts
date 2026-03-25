/**
 * META CHANNELS + IN-APP ADAPTER TESTS
 *
 * Tests WhatsApp, Messenger, Instagram (Meta omnichannel) and InApp adapters.
 * These share a similar pattern: simple text messages, admin detection,
 * signatureVerified based on META_APP_SECRET env var.
 *
 * @see ADR-174 (Meta Omnichannel), ADR-164 (In-App Voice)
 * @module __tests__/meta-inapp-adapters
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
  enqueuePipelineItem: (...args: unknown[]) => mockEnqueue(...args),
}));

const mockIsSuperAdminWhatsApp = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();
const mockIsSuperAdminMessenger = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();
const mockIsSuperAdminInstagram = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();
const mockIsSuperAdminFirebaseUid = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();
const mockIsSuperAdminEmail = jest.fn<
  Promise<{ identity: { displayName: string; firebaseUid: string }; resolvedVia: string } | null>,
  [string]
>();

jest.mock('../../shared/super-admin-resolver', () => ({
  isSuperAdminWhatsApp: (...args: [string]) => mockIsSuperAdminWhatsApp(...args),
  isSuperAdminMessenger: (...args: [string]) => mockIsSuperAdminMessenger(...args),
  isSuperAdminInstagram: (...args: [string]) => mockIsSuperAdminInstagram(...args),
  isSuperAdminFirebaseUid: (...args: [string]) => mockIsSuperAdminFirebaseUid(...args),
  isSuperAdminEmail: (...args: [string]) => mockIsSuperAdminEmail(...args),
}));

// ── Imports ──
import { WhatsAppChannelAdapter } from '../whatsapp-channel-adapter';
import { MessengerChannelAdapter } from '../messenger-channel-adapter';
import { InstagramChannelAdapter } from '../instagram-channel-adapter';
import { InAppChannelAdapter } from '../inapp-channel-adapter';
import type { WhatsAppFeedParams } from '../whatsapp-channel-adapter';
import type { MessengerFeedParams } from '../messenger-channel-adapter';
import type { InstagramFeedParams } from '../instagram-channel-adapter';
import type { InAppFeedParams } from '../inapp-channel-adapter';
import { PipelineChannel } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

const ADMIN_RESOLUTION = {
  identity: { displayName: 'Admin Giorgos', firebaseUid: 'uid_admin_001' },
  resolvedVia: 'whatsapp' as const,
};

function createWhatsAppParams(overrides?: Partial<WhatsAppFeedParams>): WhatsAppFeedParams {
  return {
    phoneNumber: '+306912345678',
    senderName: 'Maria K.',
    messageText: 'Πότε θα είναι έτοιμο;',
    messageId: 'wamid_abc123',
    companyId: 'comp_pagonis',
    ...overrides,
  };
}

function createMessengerParams(overrides?: Partial<MessengerFeedParams>): MessengerFeedParams {
  return {
    psid: 'psid_550001',
    senderName: 'Messenger User',
    messageText: 'Hi, information please',
    messageId: 'mid_msn_001',
    companyId: 'comp_pagonis',
    ...overrides,
  };
}

function createInstagramParams(overrides?: Partial<InstagramFeedParams>): InstagramFeedParams {
  return {
    igsid: 'igsid_770001',
    senderName: 'Instagram User',
    messageText: 'Interested in your services',
    messageId: 'mid_ig_001',
    companyId: 'comp_pagonis',
    ...overrides,
  };
}

function createInAppParams(overrides?: Partial<InAppFeedParams>): InAppFeedParams {
  return {
    commandId: 'vc_cmd_001',
    userId: 'firebase_uid_123',
    userName: 'Giorgos P.',
    transcript: 'Δείξε μου τα ανοιχτά projects',
    companyId: 'comp_pagonis',
    ...overrides,
  };
}

// ============================================================================
// WHATSAPP CHANNEL ADAPTER
// ============================================================================

describe('WhatsAppChannelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue({ queueId: 'pq_wa_001', requestId: 'req_wa_001' });
    mockIsSuperAdminWhatsApp.mockResolvedValue(null);
  });

  describe('feedToPipeline', () => {
    it('enqueues message with WHATSAPP channel', async () => {
      const result = await WhatsAppChannelAdapter.feedToPipeline(createWhatsAppParams());

      expect(result.enqueued).toBe(true);
      expect(result.pipelineQueueId).toBe('pq_wa_001');
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ channel: PipelineChannel.WHATSAPP })
      );
    });

    it('detects admin via phone number', async () => {
      mockIsSuperAdminWhatsApp.mockResolvedValue(ADMIN_RESOLUTION);

      const result = await WhatsAppChannelAdapter.feedToPipeline(
        createWhatsAppParams({ phoneNumber: '+306999999999' })
      );

      expect(mockIsSuperAdminWhatsApp).toHaveBeenCalledWith('+306999999999');
      expect(result.isAdmin).toBe(true);
    });

    it('returns error on enqueue failure', async () => {
      mockEnqueue.mockRejectedValue(new Error('network error'));

      const result = await WhatsAppChannelAdapter.feedToPipeline(createWhatsAppParams());

      expect(result.enqueued).toBe(false);
      expect(result.error).toContain('WhatsAppChannelAdapter');
    });
  });

  describe('toIntakeMessage', () => {
    it('generates correct id format: wa_{phone}_{messageId}', () => {
      const msg = WhatsAppChannelAdapter.toIntakeMessage(
        createWhatsAppParams({ phoneNumber: '+30123', messageId: 'wam_456' })
      );
      expect(msg.id).toBe('wa_+30123_wam_456');
    });

    it('stores phone in rawPayload and sender', () => {
      const msg = WhatsAppChannelAdapter.toIntakeMessage(createWhatsAppParams());
      expect(msg.rawPayload).toEqual(
        expect.objectContaining({ phoneNumber: '+306912345678' })
      );
      expect(msg.normalized.sender.whatsappPhone).toBe('+306912345678');
    });

    it('signatureVerified reflects META_APP_SECRET env', () => {
      const original = process.env.META_APP_SECRET;
      process.env.META_APP_SECRET = 'test_secret';

      const msg = WhatsAppChannelAdapter.toIntakeMessage(createWhatsAppParams());
      expect(msg.metadata.signatureVerified).toBe(true);

      process.env.META_APP_SECRET = original;
    });
  });
});

// ============================================================================
// MESSENGER CHANNEL ADAPTER
// ============================================================================

describe('MessengerChannelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue({ queueId: 'pq_msn_001', requestId: 'req_msn_001' });
    mockIsSuperAdminMessenger.mockResolvedValue(null);
  });

  describe('feedToPipeline', () => {
    it('enqueues message with MESSENGER channel', async () => {
      const result = await MessengerChannelAdapter.feedToPipeline(createMessengerParams());

      expect(result.enqueued).toBe(true);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ channel: PipelineChannel.MESSENGER })
      );
    });

    it('detects admin via PSID', async () => {
      mockIsSuperAdminMessenger.mockResolvedValue({
        ...ADMIN_RESOLUTION,
        resolvedVia: 'messenger',
      });

      const result = await MessengerChannelAdapter.feedToPipeline(createMessengerParams());

      expect(mockIsSuperAdminMessenger).toHaveBeenCalledWith('psid_550001');
      expect(result.isAdmin).toBe(true);
    });

    it('treats admin check failure as non-fatal', async () => {
      mockIsSuperAdminMessenger.mockRejectedValue(new Error('timeout'));

      const result = await MessengerChannelAdapter.feedToPipeline(createMessengerParams());
      expect(result.enqueued).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it('returns error on enqueue failure', async () => {
      mockEnqueue.mockRejectedValue(new Error('permission denied'));

      const result = await MessengerChannelAdapter.feedToPipeline(createMessengerParams());
      expect(result.enqueued).toBe(false);
      expect(result.error).toContain('MessengerChannelAdapter');
    });
  });

  describe('toIntakeMessage', () => {
    it('generates correct id format: msngr_{psid}_{messageId}', () => {
      const msg = MessengerChannelAdapter.toIntakeMessage(
        createMessengerParams({ psid: 'p1', messageId: 'm1' })
      );
      expect(msg.id).toBe('msngr_p1_m1');
    });

    it('stores PSID in rawPayload and sender', () => {
      const msg = MessengerChannelAdapter.toIntakeMessage(createMessengerParams());
      expect(msg.rawPayload).toEqual(
        expect.objectContaining({ psid: 'psid_550001' })
      );
      expect(msg.normalized.sender.messengerUserId).toBe('psid_550001');
    });

    it('sets schemaVersion from config', () => {
      const msg = MessengerChannelAdapter.toIntakeMessage(createMessengerParams());
      expect(msg.schemaVersion).toBe(1);
    });
  });
});

// ============================================================================
// INSTAGRAM CHANNEL ADAPTER
// ============================================================================

describe('InstagramChannelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue({ queueId: 'pq_ig_001', requestId: 'req_ig_001' });
    mockIsSuperAdminInstagram.mockResolvedValue(null);
  });

  describe('feedToPipeline', () => {
    it('enqueues message with INSTAGRAM channel', async () => {
      const result = await InstagramChannelAdapter.feedToPipeline(createInstagramParams());

      expect(result.enqueued).toBe(true);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ channel: PipelineChannel.INSTAGRAM })
      );
    });

    it('detects admin via IGSID', async () => {
      mockIsSuperAdminInstagram.mockResolvedValue({
        ...ADMIN_RESOLUTION,
        resolvedVia: 'instagram',
      });

      const result = await InstagramChannelAdapter.feedToPipeline(createInstagramParams());

      expect(mockIsSuperAdminInstagram).toHaveBeenCalledWith('igsid_770001');
      expect(result.isAdmin).toBe(true);
    });

    it('returns error on enqueue failure', async () => {
      mockEnqueue.mockRejectedValue(new Error('deadline exceeded'));

      const result = await InstagramChannelAdapter.feedToPipeline(createInstagramParams());
      expect(result.enqueued).toBe(false);
      expect(result.error).toContain('InstagramChannelAdapter');
    });
  });

  describe('toIntakeMessage', () => {
    it('generates correct id format: ig_{igsid}_{messageId}', () => {
      const msg = InstagramChannelAdapter.toIntakeMessage(
        createInstagramParams({ igsid: 'ig1', messageId: 'mid1' })
      );
      expect(msg.id).toBe('ig_ig1_mid1');
    });

    it('stores IGSID in rawPayload and sender', () => {
      const msg = InstagramChannelAdapter.toIntakeMessage(createInstagramParams());
      expect(msg.rawPayload).toEqual(
        expect.objectContaining({ igsid: 'igsid_770001' })
      );
      expect(msg.normalized.sender.instagramUserId).toBe('igsid_770001');
    });

    it('signatureVerified reflects META_APP_SECRET env', () => {
      const original = process.env.META_APP_SECRET;
      delete process.env.META_APP_SECRET;

      const msg = InstagramChannelAdapter.toIntakeMessage(createInstagramParams());
      expect(msg.metadata.signatureVerified).toBe(false);

      process.env.META_APP_SECRET = original;
    });
  });
});

// ============================================================================
// IN-APP CHANNEL ADAPTER
// ============================================================================

describe('InAppChannelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue({ queueId: 'pq_inapp_001', requestId: 'req_inapp_001' });
    mockIsSuperAdminFirebaseUid.mockResolvedValue(null);
    mockIsSuperAdminEmail.mockResolvedValue(null);
  });

  describe('feedToPipeline', () => {
    it('enqueues voice command with IN_APP channel', async () => {
      const result = await InAppChannelAdapter.feedToPipeline(createInAppParams());

      expect(result.enqueued).toBe(true);
      expect(result.pipelineQueueId).toBe('pq_inapp_001');
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({ channel: PipelineChannel.IN_APP })
      );
    });

    it('detects admin via Firebase UID (primary)', async () => {
      mockIsSuperAdminFirebaseUid.mockResolvedValue({
        ...ADMIN_RESOLUTION,
        resolvedVia: 'firebaseUid',
      });

      const result = await InAppChannelAdapter.feedToPipeline(
        createInAppParams({ userId: 'uid_admin_001' })
      );

      expect(mockIsSuperAdminFirebaseUid).toHaveBeenCalledWith('uid_admin_001');
      expect(mockIsSuperAdminEmail).not.toHaveBeenCalled();
      expect(result.isAdmin).toBe(true);
    });

    it('falls back to email admin check when UID not matched', async () => {
      mockIsSuperAdminFirebaseUid.mockResolvedValue(null);
      mockIsSuperAdminEmail.mockResolvedValue({
        ...ADMIN_RESOLUTION,
        resolvedVia: 'email',
      });

      const result = await InAppChannelAdapter.feedToPipeline(
        createInAppParams({ userEmail: 'admin@pagonis.gr' })
      );

      expect(mockIsSuperAdminFirebaseUid).toHaveBeenCalled();
      expect(mockIsSuperAdminEmail).toHaveBeenCalledWith('admin@pagonis.gr');
      expect(result.isAdmin).toBe(true);
    });

    it('skips email fallback when userEmail not provided', async () => {
      mockIsSuperAdminFirebaseUid.mockResolvedValue(null);

      const result = await InAppChannelAdapter.feedToPipeline(
        createInAppParams({ userEmail: undefined })
      );

      expect(mockIsSuperAdminEmail).not.toHaveBeenCalled();
      expect(result.isAdmin).toBe(false);
    });

    it('treats admin check failure as non-fatal', async () => {
      mockIsSuperAdminFirebaseUid.mockRejectedValue(new Error('resolver crash'));

      const result = await InAppChannelAdapter.feedToPipeline(createInAppParams());
      expect(result.enqueued).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it('returns error on enqueue failure', async () => {
      mockEnqueue.mockRejectedValue(new Error('timeout'));

      const result = await InAppChannelAdapter.feedToPipeline(createInAppParams());
      expect(result.enqueued).toBe(false);
      expect(result.error).toContain('InAppChannelAdapter');
    });
  });

  describe('toIntakeMessage', () => {
    it('generates correct id format: inapp_{commandId}', () => {
      const msg = InAppChannelAdapter.toIntakeMessage(
        createInAppParams({ commandId: 'vc_cmd_555' })
      );
      expect(msg.id).toBe('inapp_vc_cmd_555');
    });

    it('sets channel to IN_APP', () => {
      const msg = InAppChannelAdapter.toIntakeMessage(createInAppParams());
      expect(msg.channel).toBe(PipelineChannel.IN_APP);
    });

    it('stores commandId and userId in rawPayload', () => {
      const msg = InAppChannelAdapter.toIntakeMessage(createInAppParams());
      expect(msg.rawPayload).toEqual({
        commandId: 'vc_cmd_001',
        userId: 'firebase_uid_123',
      });
    });

    it('includes email in sender when provided', () => {
      const msg = InAppChannelAdapter.toIntakeMessage(
        createInAppParams({ userEmail: 'user@test.com' })
      );
      expect(msg.normalized.sender.email).toBe('user@test.com');
    });

    it('maps transcript to contentText', () => {
      const msg = InAppChannelAdapter.toIntakeMessage(
        createInAppParams({ transcript: 'Test voice command' })
      );
      expect(msg.normalized.contentText).toBe('Test voice command');
    });

    it('signatureVerified is true (Firebase JWT auth)', () => {
      const msg = InAppChannelAdapter.toIntakeMessage(createInAppParams());
      expect(msg.metadata.signatureVerified).toBe(true);
    });
  });
});
