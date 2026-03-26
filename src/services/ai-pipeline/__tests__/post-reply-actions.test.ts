/**
 * POST-REPLY ACTIONS TESTS
 *
 * Tests the post-reply orchestration module:
 * - CRM outbound message storage (Telegram only)
 * - Duplicate contact keyboard dispatch
 * - Feedback snapshot saving + per-channel keyboards
 *
 * All actions are NON-FATAL — failure must never propagate.
 *
 * @see ADR-171 (Agentic Loop)
 * @see ADR-173 (AI Self-Improvement)
 * @see ADR-174 (Multi-Channel)
 * @module __tests__/post-reply-actions
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ── Mocks (BEFORE imports) ──

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

// ── Channel reply dispatcher mock ──
const mockExtractChannelIds = jest.fn();
jest.mock('../shared/channel-reply-dispatcher', () => ({
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

// ── Feedback service mock ──
const mockSaveFeedbackSnapshot = jest.fn().mockResolvedValue('fb_test_001');
jest.mock('../feedback-service', () => ({
  getFeedbackService: () => ({
    saveFeedbackSnapshot: mockSaveFeedbackSnapshot,
  }),
}));

// ── Feedback keyboard mock ──
jest.mock('../feedback-keyboard', () => ({
  createFeedbackKeyboard: jest.fn(() => ({ inline_keyboard: [] })),
  createSuggestedActionsKeyboard: jest.fn(() => ({ inline_keyboard: [] })),
}));

// ── CRM store mock ──
const mockStoreMessageInCRM = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/api/communications/webhooks/telegram/crm/store', () => ({
  storeMessageInCRM: mockStoreMessageInCRM,
}));

// ── Domain constants mock ──
jest.mock('@/config/domain-constants', () => ({
  BOT_IDENTITY: { ID: 'bot_001', DISPLAY_NAME: 'Nestor AI' },
}));

// ── Telegram client mock ──
const mockSendTelegramMessage = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/api/communications/webhooks/telegram/telegram/client', () => ({
  sendTelegramMessage: mockSendTelegramMessage,
}));

// ── Duplicate contact keyboard mock ──
const mockStorePendingContactAction = jest.fn().mockResolvedValue('pending_001');
const mockCreateDuplicateContactKeyboard = jest.fn(() => ({ inline_keyboard: [] }));
jest.mock('../duplicate-contact-keyboard', () => ({
  storePendingContactAction: (...args: unknown[]) => Reflect.apply(mockStorePendingContactAction, null, args),
  createDuplicateContactKeyboard: (...args: unknown[]) => Reflect.apply(mockCreateDuplicateContactKeyboard, null, args),
}));

// ── WhatsApp client mock ──
const mockSendWhatsAppButtons = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/api/communications/webhooks/whatsapp/whatsapp-client', () => ({
  sendWhatsAppButtons: mockSendWhatsAppButtons,
}));

// ── Messenger client mock ──
const mockSendMessengerQuickReplies = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/api/communications/webhooks/messenger/messenger-client', () => ({
  sendMessengerQuickReplies: mockSendMessengerQuickReplies,
}));

// ── Instagram client mock ──
const mockSendInstagramMessage = jest.fn().mockResolvedValue(undefined);
jest.mock('@/app/api/communications/webhooks/instagram/instagram-client', () => ({
  sendInstagramMessage: mockSendInstagramMessage,
}));

// ── Imports ──
import type { PostReplyParams } from '../post-reply-actions';

// ── Helpers ──

interface MockToolCall {
  name: string;
  args: string;
  result: string;
}

interface MockAgenticResult {
  answer: string;
  suggestions: string[];
  toolCalls: MockToolCall[];
  iterations: number;
  totalDurationMs: number;
  totalUsage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function makeAgenticResult(overrides?: Partial<MockAgenticResult>): MockAgenticResult {
  return {
    answer: 'Γεια σου! Ось η απάντησή μου.',
    suggestions: ['Ρώτα για ακίνητα', 'Κλείσε ραντεβού'],
    toolCalls: [],
    iterations: 1,
    totalDurationMs: 500,
    totalUsage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    ...overrides,
  };
}

type ChannelType = 'telegram' | 'whatsapp' | 'messenger' | 'instagram' | 'email';

function makeParams(
  channel: ChannelType = 'telegram',
  overrides?: Partial<PostReplyParams>,
): PostReplyParams {
  return {
    ctx: {
      requestId: 'req_test_001',
      companyId: 'comp_001',
      state: 'RECEIVED',
      intake: {
        id: 'intake_001',
        channel,
        rawPayload: { chatId: '12345' },
        normalized: {
          sender: {
            name: 'Test User',
            telegramId: channel === 'telegram' ? '12345' : undefined,
            whatsappPhone: channel === 'whatsapp' ? '+306912345678' : undefined,
            messengerUserId: channel === 'messenger' ? 'psid_001' : undefined,
            instagramUserId: channel === 'instagram' ? 'igsid_001' : undefined,
          },
          recipients: [],
          contentText: 'Test message',
          attachments: [],
          timestampIso: '2026-03-26T10:00:00Z',
        },
        metadata: {
          providerMessageId: 'msg_001',
          signatureVerified: true,
        },
        schemaVersion: 1,
      },
    },
    agenticResult: makeAgenticResult(),
    channelSenderId: 'sender_001',
    userMessage: 'Test user message',
    isFailedResponse: false,
    ...overrides,
  } as unknown as PostReplyParams;
}

// ── Test Suite ──

describe('post-reply-actions', () => {
  let sendPostReplyActions: typeof import('../post-reply-actions').sendPostReplyActions;

  beforeEach(() => {
    jest.resetModules();
    mockExtractChannelIds.mockReset();
    mockSaveFeedbackSnapshot.mockReset().mockResolvedValue('fb_test_001');
    mockStoreMessageInCRM.mockReset().mockResolvedValue(undefined);
    mockSendTelegramMessage.mockReset().mockResolvedValue(undefined);
    mockStorePendingContactAction.mockReset().mockResolvedValue('pending_001');
    mockCreateDuplicateContactKeyboard.mockReset().mockReturnValue({ inline_keyboard: [] });
    mockSendWhatsAppButtons.mockReset().mockResolvedValue(undefined);
    mockSendMessengerQuickReplies.mockReset().mockResolvedValue(undefined);
    mockSendInstagramMessage.mockReset().mockResolvedValue(undefined);

    // Default: telegram channel IDs
    mockExtractChannelIds.mockReturnValue({
      telegramChatId: '12345',
      whatsappPhone: null,
      messengerPsid: null,
      instagramIgsid: null,
    });

    const mod = require('../post-reply-actions') as typeof import('../post-reply-actions');
    sendPostReplyActions = mod.sendPostReplyActions;
  });

  // ========================================================================
  // Full flow — Telegram
  // ========================================================================

  it('executes full telegram flow: CRM store + feedback', async () => {
    const params = makeParams('telegram');
    await sendPostReplyActions(params);

    // CRM store called
    expect(mockStoreMessageInCRM).toHaveBeenCalledTimes(1);

    // Feedback snapshot saved
    expect(mockSaveFeedbackSnapshot).toHaveBeenCalledTimes(1);

    // Telegram feedback messages sent (suggestions + feedback keyboard)
    expect(mockSendTelegramMessage).toHaveBeenCalled();
  });

  // ========================================================================
  // Non-telegram channel — skips CRM + duplicate keyboard
  // ========================================================================

  it('skips CRM store and duplicate keyboard for non-telegram channel', async () => {
    mockExtractChannelIds.mockReturnValue({
      telegramChatId: null,
      whatsappPhone: '+306912345678',
      messengerPsid: null,
      instagramIgsid: null,
    });

    const params = makeParams('whatsapp');
    await sendPostReplyActions(params);

    expect(mockStoreMessageInCRM).not.toHaveBeenCalled();

    // Feedback still saved
    expect(mockSaveFeedbackSnapshot).toHaveBeenCalledTimes(1);
  });

  // ========================================================================
  // Failed response — skips feedback
  // ========================================================================

  it('skips feedback and suggestions for failed response', async () => {
    const params = makeParams('telegram', { isFailedResponse: true });
    await sendPostReplyActions(params);

    // CRM store still happens for telegram
    expect(mockStoreMessageInCRM).toHaveBeenCalledTimes(1);

    // Feedback NOT saved
    expect(mockSaveFeedbackSnapshot).not.toHaveBeenCalled();
  });

  // ========================================================================
  // Duplicate contact detected — sends keyboard
  // ========================================================================

  it('sends duplicate contact keyboard when tool detected duplicates', async () => {
    const duplicateResult = JSON.stringify({
      duplicateDetected: true,
      requestedContact: {
        firstName: 'Γιώργος',
        lastName: 'Παπαδάκης',
        email: 'g@test.com',
        phone: null,
        contactType: 'individual',
        companyName: null,
      },
      matches: [{ id: 'ct_001', firstName: 'Γιώργος', lastName: 'Παπαδάκης' }],
    });

    const params = makeParams('telegram', {
      agenticResult: makeAgenticResult({
        toolCalls: [
          { name: 'create_contact', args: '{}', result: duplicateResult },
        ],
      }),
    });

    await sendPostReplyActions(params);

    expect(mockStorePendingContactAction).toHaveBeenCalledTimes(1);
    expect(mockCreateDuplicateContactKeyboard).toHaveBeenCalledWith('pending_001');
    expect(mockSendTelegramMessage).toHaveBeenCalled();
  });

  // ========================================================================
  // No duplicate contact — skips keyboard
  // ========================================================================

  it('skips duplicate keyboard when no duplicate tool call exists', async () => {
    const params = makeParams('telegram', {
      agenticResult: makeAgenticResult({
        toolCalls: [
          { name: 'search_contacts', args: '{}', result: '{"found": true}' },
        ],
      }),
    });

    await sendPostReplyActions(params);

    expect(mockStorePendingContactAction).not.toHaveBeenCalled();
    expect(mockCreateDuplicateContactKeyboard).not.toHaveBeenCalled();
  });

  // ========================================================================
  // Feedback save failure — continues without error
  // ========================================================================

  it('continues without error when feedback save fails', async () => {
    mockSaveFeedbackSnapshot.mockRejectedValue(new Error('Firestore write failed'));

    const params = makeParams('telegram');

    // Should not throw
    await expect(sendPostReplyActions(params)).resolves.toBeUndefined();

    // CRM store still called
    expect(mockStoreMessageInCRM).toHaveBeenCalledTimes(1);
  });

  // ========================================================================
  // WhatsApp channel feedback
  // ========================================================================

  it('sends WhatsApp feedback buttons for whatsapp channel', async () => {
    mockExtractChannelIds.mockReturnValue({
      telegramChatId: null,
      whatsappPhone: '+306912345678',
      messengerPsid: null,
      instagramIgsid: null,
    });

    const params = makeParams('whatsapp');
    await sendPostReplyActions(params);

    expect(mockSendWhatsAppButtons).toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  // ========================================================================
  // Messenger channel feedback
  // ========================================================================

  it('sends Messenger quick replies for messenger channel', async () => {
    mockExtractChannelIds.mockReturnValue({
      telegramChatId: null,
      whatsappPhone: null,
      messengerPsid: 'psid_001',
      instagramIgsid: null,
    });

    const params = makeParams('messenger');
    await sendPostReplyActions(params);

    expect(mockSendMessengerQuickReplies).toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  // ========================================================================
  // Instagram channel feedback
  // ========================================================================

  it('sends Instagram text-based feedback for instagram channel', async () => {
    mockExtractChannelIds.mockReturnValue({
      telegramChatId: null,
      whatsappPhone: null,
      messengerPsid: null,
      instagramIgsid: 'igsid_001',
    });

    const params = makeParams('instagram');
    await sendPostReplyActions(params);

    expect(mockSendInstagramMessage).toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  // ========================================================================
  // CRM store failure — non-fatal
  // ========================================================================

  it('continues without error when CRM store fails', async () => {
    mockStoreMessageInCRM.mockRejectedValue(new Error('Firestore unavailable'));

    const params = makeParams('telegram');

    await expect(sendPostReplyActions(params)).resolves.toBeUndefined();

    // Feedback still attempted
    expect(mockSaveFeedbackSnapshot).toHaveBeenCalledTimes(1);
  });

  // ========================================================================
  // No feedback doc ID — skips keyboards
  // ========================================================================

  it('skips channel keyboards when feedback snapshot returns null', async () => {
    mockSaveFeedbackSnapshot.mockResolvedValue(null);

    const params = makeParams('telegram');
    await sendPostReplyActions(params);

    // CRM stored, but no telegram keyboard messages (only CRM call)
    expect(mockStoreMessageInCRM).toHaveBeenCalledTimes(1);
    // Telegram message NOT called for feedback (only CRM store uses storeMessageInCRM)
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });

  // ========================================================================
  // No suggestions — skips suggestion keyboard
  // ========================================================================

  it('skips suggestion keyboard when no suggestions provided', async () => {
    const params = makeParams('telegram', {
      agenticResult: makeAgenticResult({ suggestions: [] }),
    });
    await sendPostReplyActions(params);

    // Only 1 call for feedback keyboard (not 2 for suggestions + feedback)
    const telegramCalls = mockSendTelegramMessage.mock.calls;
    // Should have exactly 1 call (feedback keyboard only, no suggestions)
    expect(telegramCalls.length).toBe(1);
  });
});
