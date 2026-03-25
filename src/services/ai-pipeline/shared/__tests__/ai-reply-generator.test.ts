/**
 * AI REPLY GENERATOR TESTS
 *
 * Tests the centralized AI reply generation module:
 * - generateAIReply: customer email replies with validation
 * - generateAdminConversationalReply: admin conversational replies
 * - generateCompositeReply: multi-intent reply composition
 *
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 * @module __tests__/ai-reply-generator
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

jest.mock('@/lib/type-guards', () => ({
  isRecord: jest.fn(
    (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v),
  ),
  isNonEmptyTrimmedString: jest.fn(
    (v: unknown) => typeof v === 'string' && v.trim().length > 0,
  ),
  isNonEmptyString: jest.fn(
    (v: unknown) => typeof v === 'string' && v.length > 0,
  ),
}));

jest.mock('@/config/ai-analysis-config', () => ({
  AI_ANALYSIS_DEFAULTS: {
    OPENAI: {
      BASE_URL: 'https://api.openai.com/v1',
      TEXT_MODEL: 'gpt-4o-mini',
    },
  },
}));

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_REPLY_CONFIG: {
    MAX_ORIGINAL_MESSAGE_CHARS: 2000,
    TIMEOUT_MS: 15000,
    MAX_RETRIES: 1,
    MAX_REPLY_CHARS: 3000,
  },
}));

jest.mock('../sender-history', () => ({}));

// ── Global fetch mock ──
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Imports ──
import type { AIReplyContext, CompositeReplyInput } from '../ai-reply-generator';

// ── Helpers ──

const VALID_GREEK_REPLY =
  'Αγαπητέ Γιώργο,\n\nΣας ευχαριστούμε για το μήνυμά σας. Θα επικοινωνήσουμε μαζί σας σύντομα για να κανονίσουμε ραντεβού.\n\nΜε εκτίμηση,';

function makeOpenAIResponse(outputText: string): { ok: true; json: () => Promise<{ output_text: string }> } {
  return {
    ok: true,
    json: async () => ({ output_text: outputText }),
  };
}

function makeContext(overrides?: Partial<AIReplyContext>): AIReplyContext {
  return {
    useCase: 'appointment',
    senderName: 'Γιώργος Παπαδόπουλος',
    isKnownContact: true,
    originalMessage: 'Θα ήθελα να κλείσω ραντεβού για επίσκεψη στο ακίνητο.',
    originalSubject: 'Ραντεβού επίσκεψης',
    moduleContext: {
      appointmentType: 'property_visit',
      proposedDate: '2026-04-01',
    },
    ...overrides,
  };
}

function makeFallback(): jest.Mock<string> {
  return jest.fn(() => 'Στατική απάντηση template.');
}

// ── Test Suite ──

describe('ai-reply-generator', () => {
  let generateAIReply: typeof import('../ai-reply-generator').generateAIReply;
  let generateAdminConversationalReply: typeof import('../ai-reply-generator').generateAdminConversationalReply;
  let generateCompositeReply: typeof import('../ai-reply-generator').generateCompositeReply;

  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';

    // Re-require after reset to get fresh module
    const mod = require('../ai-reply-generator') as typeof import('../ai-reply-generator');
    generateAIReply = mod.generateAIReply;
    generateAdminConversationalReply = mod.generateAdminConversationalReply;
    generateCompositeReply = mod.generateCompositeReply;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  // ========================================================================
  // generateAIReply
  // ========================================================================

  describe('generateAIReply', () => {
    it('returns AI-generated reply on valid response', async () => {
      mockFetch.mockResolvedValue(makeOpenAIResponse(VALID_GREEK_REPLY));

      const result = await generateAIReply(makeContext(), makeFallback(), 'req_001');

      expect(result.aiGenerated).toBe(true);
      expect(result.replyText).toBe(VALID_GREEK_REPLY);
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('falls back when API returns empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ output_text: '' }),
      });

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_002');

      expect(result.aiGenerated).toBe(false);
      expect(result.replyText).toBe('Στατική απάντηση template.');
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('falls back when reply lacks greeting (no Αγαπητ)', async () => {
      mockFetch.mockResolvedValue(
        makeOpenAIResponse('Καλησπέρα, σας ευχαριστούμε για το μήνυμά σας. Θα επικοινωνήσουμε σύντομα.'),
      );

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_003');

      expect(result.aiGenerated).toBe(false);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('falls back when reply contains HTML tags', async () => {
      mockFetch.mockResolvedValue(
        makeOpenAIResponse('Αγαπητέ Γιώργο,\n\n<p>Σας ευχαριστούμε</p>\n\nΜε εκτίμηση,'),
      );

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_004');

      expect(result.aiGenerated).toBe(false);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('falls back when reply contains markdown formatting', async () => {
      mockFetch.mockResolvedValue(
        makeOpenAIResponse('Αγαπητέ Γιώργο,\n\n**Σας ευχαριστούμε** για το μήνυμά σας. Θα σας ενημερώσουμε σύντομα.\n\nΜε εκτίμηση,'),
      );

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_005');

      expect(result.aiGenerated).toBe(false);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('falls back when reply is too short (< 50 chars)', async () => {
      mockFetch.mockResolvedValue(
        makeOpenAIResponse('Αγαπητέ Γιώργο, ευχαριστούμε.'),
      );

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_006');

      expect(result.aiGenerated).toBe(false);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('falls back when API returns non-ok status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_007');

      expect(result.aiGenerated).toBe(false);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('falls back on unexpected thrown error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const fallback = makeFallback();
      const result = await generateAIReply(makeContext(), fallback, 'req_008');

      expect(result.aiGenerated).toBe(false);
      expect(fallback).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // generateAdminConversationalReply
  // ========================================================================

  describe('generateAdminConversationalReply', () => {
    it('returns AI reply for valid admin response', async () => {
      const adminReply = 'Γεια σου Γιώργο! Η λέξη "synergy" σημαίνει συνεργασία.';
      mockFetch.mockResolvedValue(makeOpenAIResponse(adminReply));

      const result = await generateAdminConversationalReply('Τι σημαίνει synergy;', 'req_010');

      expect(result.aiGenerated).toBe(true);
      expect(result.replyText).toBe(adminReply);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns null replyText on empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ output_text: '' }),
      });

      const result = await generateAdminConversationalReply('Γεια', 'req_011');

      expect(result.replyText).toBeNull();
      expect(result.aiGenerated).toBe(false);
    });

    it('returns null replyText when response contains HTML', async () => {
      mockFetch.mockResolvedValue(
        makeOpenAIResponse('<b>Καλημέρα!</b> Πώς μπορώ να βοηθήσω;'),
      );

      const result = await generateAdminConversationalReply('Καλημέρα', 'req_012');

      expect(result.replyText).toBeNull();
      expect(result.aiGenerated).toBe(false);
    });

    it('returns null replyText when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await generateAdminConversationalReply('Τι ώρα είναι;', 'req_013');

      expect(result.replyText).toBeNull();
      expect(result.aiGenerated).toBe(false);
    });
  });

  // ========================================================================
  // generateCompositeReply
  // ========================================================================

  describe('generateCompositeReply', () => {
    const baseInput: CompositeReplyInput = {
      moduleReplies: [],
      senderName: 'Μαρία Παπαδάκη',
      originalMessage: 'Θέλω ραντεβού και πληροφορίες για ακίνητα.',
      originalSubject: 'Ραντεβού + Ακίνητα',
    };

    it('returns single reply directly without AI call', async () => {
      const input: CompositeReplyInput = {
        ...baseInput,
        moduleReplies: [
          { useCase: 'appointment', draftReply: VALID_GREEK_REPLY },
        ],
      };

      const result = await generateCompositeReply(input, 'req_020');

      expect(result.replyText).toBe(VALID_GREEK_REPLY);
      expect(result.aiGenerated).toBe(true);
      expect(result.model).toBeNull();
      expect(result.durationMs).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('composes multiple replies via AI', async () => {
      const composedReply =
        'Αγαπητή Μαρία,\n\nΣας ευχαριστούμε για το ενδιαφέρον σας. Θα κανονίσουμε ραντεβού και θα σας στείλουμε πληροφορίες για τα διαθέσιμα ακίνητα.\n\nΜε εκτίμηση,';

      mockFetch.mockResolvedValue(makeOpenAIResponse(composedReply));

      const input: CompositeReplyInput = {
        ...baseInput,
        moduleReplies: [
          { useCase: 'appointment', draftReply: 'Draft ραντεβού...' },
          { useCase: 'property_search', draftReply: 'Draft ακίνητα...' },
        ],
      };

      const result = await generateCompositeReply(input, 'req_021');

      expect(result.aiGenerated).toBe(true);
      expect(result.replyText).toBe(composedReply);
      expect(result.model).toBe('gpt-4o-mini');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to concatenation when composition fails validation', async () => {
      // Return invalid reply (no greeting)
      mockFetch.mockResolvedValue(
        makeOpenAIResponse('Ευχαριστούμε. Θα σας ενημερώσουμε.'),
      );

      const input: CompositeReplyInput = {
        ...baseInput,
        moduleReplies: [
          { useCase: 'appointment', draftReply: 'Draft ραντεβού' },
          { useCase: 'property_search', draftReply: 'Draft ακίνητα' },
        ],
      };

      const result = await generateCompositeReply(input, 'req_022');

      expect(result.aiGenerated).toBe(false);
      expect(result.replyText).toBe('Draft ραντεβού\n\nDraft ακίνητα');
      expect(result.model).toBeNull();
    });

    it('returns empty string when no replies provided', async () => {
      const input: CompositeReplyInput = {
        ...baseInput,
        moduleReplies: [],
      };

      const result = await generateCompositeReply(input, 'req_023');

      expect(result.replyText).toBe('');
      expect(result.aiGenerated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falls back to concatenation on unexpected error', async () => {
      mockFetch.mockRejectedValue(new Error('Connection reset'));

      const input: CompositeReplyInput = {
        ...baseInput,
        moduleReplies: [
          { useCase: 'appointment', draftReply: 'Draft A' },
          { useCase: 'general', draftReply: 'Draft B' },
        ],
      };

      const result = await generateCompositeReply(input, 'req_024');

      expect(result.aiGenerated).toBe(false);
      expect(result.replyText).toBe('Draft A\n\nDraft B');
    });
  });
});
