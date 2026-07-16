/**
 * =============================================================================
 * OPENAI ANALYSIS PROVIDER — CHARACTERIZATION TESTS
 * =============================================================================
 *
 * 🔒 SAFETY NET for the upcoming refactor that will make OpenAIAnalysisProvider
 * consume a central OpenAI Responses-API SSoT. These tests lock in the CURRENT
 * behaviour of `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts`
 * — including quirks that look like bugs — so the refactor can be proven
 * behaviour-preserving. Do NOT "fix" anything here; if behaviour looks wrong,
 * it is intentionally locked as-is (see the final report for a list).
 *
 * Tests exercise ONLY the public surface (`analyze`, `healthCheck`,
 * `createOpenAIProvider`, the class constructor) — never the private
 * `executeRequest` method directly — because that method is an internal
 * implementation detail the refactor is expected to remove/replace.
 *
 * @module services/ai-analysis/providers/__tests__/OpenAIAnalysisProvider.test
 */

// server-only is globally mapped via jest.config.js moduleNameMapper, but we
// mock it explicitly too (matches project convention in sibling test files).
jest.mock('server-only', () => ({}));

import {
  OpenAIAnalysisProvider,
  createOpenAIProvider,
} from '../OpenAIAnalysisProvider';
import type {
  MessageIntentInput,
  DocumentClassifyInput,
  ProviderOptions,
} from '../IAIAnalysisProvider';
import { AI_ANALYSIS_PROMPTS, AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { ADMIN_TOOL_SYSTEM_PROMPT } from '@/config/admin-tool-definitions';
import { isMessageIntentAnalysis, isDocumentClassifyAnalysis } from '@/schemas/ai-analysis';

// ============================================================================
// TEST HELPERS
// ============================================================================

interface TestOpenAIConfig {
  apiKey: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  timeoutMs: number;
  maxRetries: number;
}

/** Small timeoutMs by default so dangling AbortController timers never delay the suite. */
function makeConfig(overrides: Partial<TestOpenAIConfig> = {}): TestOpenAIConfig {
  return {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.example.test/v1',
    textModel: 'gpt-test-text',
    visionModel: 'gpt-test-vision',
    timeoutMs: 50,
    maxRetries: 1,
    ...overrides,
  };
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function errResponse(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

/** Valid multi_intent payload — satisfies AIAnalysisResultSchema. */
function validMultiIntentPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'multi_intent',
    aiModel: 'gpt-test-text',
    analysisTimestamp: new Date().toISOString(),
    confidence: 0.9,
    needsTriage: false,
    extractedEntities: {},
    rawMessage: 'Test message',
    primaryIntent: {
      intentType: 'general_inquiry',
      confidence: 0.9,
      rationale: 'test rationale',
    },
    secondaryIntents: [],
    ...overrides,
  };
}

function messageIntentInput(overrides: Partial<MessageIntentInput> = {}): MessageIntentInput {
  return {
    kind: 'message_intent',
    messageText: 'Γεια σου, πότε είναι το ραντεβού;',
    ...overrides,
  };
}

function documentClassifyInput(
  overrides: Partial<DocumentClassifyInput> = {}
): DocumentClassifyInput {
  return {
    kind: 'document_classify',
    content: 'Invoice #12345',
    filename: 'invoice.pdf',
    mimeType: 'application/pdf',
    ...overrides,
  };
}

function fetchMock(): jest.Mock {
  return global.fetch as jest.Mock;
}

// ============================================================================
// SUITE
// ============================================================================

describe('OpenAIAnalysisProvider', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  // ==========================================================================
  // REQUEST WIRE PROTOCOL — most important: locks the exact fetch call shape
  // ==========================================================================

  describe('request wire protocol (non-admin, message_intent)', () => {
    it('POSTs to <baseUrl>/responses with headers, model, input, and text.format', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output_text: JSON.stringify(validMultiIntentPayload()) }));

      await provider.analyze(messageIntentInput());

      expect(fetchMock()).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock().mock.calls[0];
      expect(url).toBe(`${config.baseUrl}/responses`);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(init.body as string);
      expect(body.model).toBe(config.textModel);
      expect(body.input).toEqual([
        {
          role: 'system',
          content: [{ type: 'input_text', text: AI_ANALYSIS_PROMPTS.MULTI_INTENT_SYSTEM }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: expect.stringContaining('Γεια σου') }],
        },
      ]);
      expect(body.text.format.type).toBe('json_schema');
      expect(body.text.format.name).toBe('multi_intent_result');
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
    });
  });

  describe('model selection', () => {
    it('uses visionModel for document_classify', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(
        okResponse({
          output_text: JSON.stringify({
            kind: 'document_classify',
            aiModel: config.visionModel,
            analysisTimestamp: new Date().toISOString(),
            confidence: 0.9,
            needsTriage: false,
            extractedEntities: {},
            documentType: 'invoice',
          }),
        })
      );

      await provider.analyze(documentClassifyInput());

      const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
      expect(body.model).toBe(config.visionModel);
      expect(body.input[0].content[0].text).toBe(AI_ANALYSIS_PROMPTS.DOCUMENT_CLASSIFY_SYSTEM);
    });

    it('uses textModel for message_intent', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output_text: JSON.stringify(validMultiIntentPayload()) }));

      await provider.analyze(messageIntentInput());

      const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
      expect(body.model).toBe(config.textModel);
    });
  });

  // ==========================================================================
  // CONTENT BUILDING (document_classify)
  // ==========================================================================

  describe('content building for document_classify', () => {
    it('adds an input_image entry with a base64 data URL for image mime types', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(
        okResponse({
          output_text: JSON.stringify({
            kind: 'document_classify',
            aiModel: config.visionModel,
            analysisTimestamp: new Date().toISOString(),
            confidence: 0.9,
            needsTriage: false,
            extractedEntities: {},
            documentType: 'photo-exterior',
          }),
        })
      );

      const buffer = Buffer.from('fake-image-bytes');
      await provider.analyze(
        documentClassifyInput({ content: buffer, mimeType: 'image/jpeg', filename: 'photo.jpg' })
      );

      const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
      const userContent = body.input[1].content;
      expect(userContent).toHaveLength(2);
      expect(userContent[1]).toEqual({
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      });
    });

    it.each(['text/plain', 'text/csv', 'text/html', 'text/xml', 'application/xml'])(
      'adds a second input_text entry with utf-8 content for %s buffers',
      async (mimeType) => {
        const config = makeConfig();
        const provider = new OpenAIAnalysisProvider(config);
        fetchMock().mockResolvedValue(
          okResponse({
            output_text: JSON.stringify({
              kind: 'document_classify',
              aiModel: config.visionModel,
              analysisTimestamp: new Date().toISOString(),
              confidence: 0.9,
              needsTriage: false,
              extractedEntities: {},
              documentType: 'other',
            }),
          })
        );

        const buffer = Buffer.from('plain text content', 'utf-8');
        await provider.analyze(documentClassifyInput({ content: buffer, mimeType }));

        const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
        const userContent = body.input[1].content;
        expect(userContent).toHaveLength(2);
        expect(userContent[1]).toEqual({ type: 'input_text', text: 'plain text content' });
      }
    );

    it('adds an input_file entry with filename fallback "document" for binary content', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(
        okResponse({
          output_text: JSON.stringify({
            kind: 'document_classify',
            aiModel: config.visionModel,
            analysisTimestamp: new Date().toISOString(),
            confidence: 0.9,
            needsTriage: false,
            extractedEntities: {},
            documentType: 'other',
          }),
        })
      );

      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46]); // arbitrary binary bytes
      await provider.analyze(
        documentClassifyInput({ content: buffer, mimeType: 'application/pdf', filename: undefined })
      );

      const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
      const userContent = body.input[1].content;
      expect(userContent).toHaveLength(2);
      expect(userContent[1]).toEqual({
        type: 'input_file',
        filename: 'document',
        file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
      });
    });

    it('does NOT add a second content entry when input.content is a string (even with an image mime type)', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(
        okResponse({
          output_text: JSON.stringify({
            kind: 'document_classify',
            aiModel: config.visionModel,
            analysisTimestamp: new Date().toISOString(),
            confidence: 0.9,
            needsTriage: false,
            extractedEntities: {},
            documentType: 'other',
          }),
        })
      );

      await provider.analyze(
        documentClassifyInput({ content: 'plain string content', mimeType: 'image/jpeg' })
      );

      const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
      const userContent = body.input[1].content;
      expect(userContent).toHaveLength(1);
      expect(userContent[0].type).toBe('input_text');
    });
  });

  // ==========================================================================
  // extractOutputText — exercised indirectly through analyze()
  // ==========================================================================

  describe('output text extraction (via analyze results)', () => {
    it('reads the output_text shortcut field', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      const payload = validMultiIntentPayload({ aiModel: config.textModel });
      fetchMock().mockResolvedValue(okResponse({ output_text: JSON.stringify(payload) }));

      const result = await provider.analyze(messageIntentInput());

      expect(result.kind).toBe('multi_intent');
      expect(result.aiModel).toBe(config.textModel);
    });

    it('reads structured output[].content[] (type message + output_text)', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      const payload = validMultiIntentPayload({ aiModel: config.textModel });
      fetchMock().mockResolvedValue(
        okResponse({
          output: [
            { type: 'reasoning', content: [{ type: 'output_text', text: 'ignored-wrong-type' }] },
            {
              type: 'message',
              content: [
                { type: 'refusal', text: 'ignored-wrong-content-type' },
                { type: 'output_text', text: JSON.stringify(payload) },
              ],
            },
          ],
        })
      );

      const result = await provider.analyze(messageIntentInput());

      expect(result.kind).toBe('multi_intent');
      expect(result.aiModel).toBe(config.textModel);
    });

    it('falls back when no output_text and no output array are present', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({}));

      const result = await provider.analyze(messageIntentInput({ messageText: 'hello' }));

      expect(isMessageIntentAnalysis(result)).toBe(true);
      if (isMessageIntentAnalysis(result)) {
        expect(result.rawMessage).toBe('hello');
        expect(result.intentType).toBe(AI_ANALYSIS_DEFAULTS.FALLBACK_INTENT);
        expect(result.confidence).toBe(AI_ANALYSIS_DEFAULTS.FALLBACK_CONFIDENCE);
        expect(result.needsTriage).toBe(AI_ANALYSIS_DEFAULTS.FALLBACK_NEEDS_TRIAGE);
      }
    });

    it('falls back when output_text is whitespace-only and no output array is present', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output_text: '   \n\t  ' }));

      const result = await provider.analyze(documentClassifyInput());

      expect(isDocumentClassifyAnalysis(result)).toBe(true);
      if (isDocumentClassifyAnalysis(result)) {
        expect(result.documentType).toBe(AI_ANALYSIS_DEFAULTS.FALLBACK_DOCUMENT);
      }
    });

    it('falls back when output_text is non-parseable JSON', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output_text: 'not-json{{{' }));

      const result = await provider.analyze(messageIntentInput());

      expect(isMessageIntentAnalysis(result)).toBe(true);
    });
  });

  // ==========================================================================
  // executeRequest behaviour — exercised via analyze() (public surface only)
  // ==========================================================================

  describe('non-OK responses', () => {
    it('throws the error.message from the response payload', async () => {
      const config = makeConfig({ maxRetries: 0 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(errResponse(400, { error: { message: 'Invalid request body' } }));

      await expect(provider.analyze(messageIntentInput())).rejects.toThrow('Invalid request body');
    });

    it('throws "OpenAI error (<status>)" when the payload has no parseable error message', async () => {
      const config = makeConfig({ maxRetries: 0 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error('not json');
        },
      });

      await expect(provider.analyze(messageIntentInput())).rejects.toThrow('OpenAI error (503)');
    });
  });

  describe('retry behaviour', () => {
    it('retries on failure and succeeds once a later attempt returns OK', async () => {
      const config = makeConfig({ maxRetries: 2 });
      const provider = new OpenAIAnalysisProvider(config);
      const payload = validMultiIntentPayload({ aiModel: config.textModel });
      fetchMock()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce(okResponse({ output_text: JSON.stringify(payload) }));

      const result = await provider.analyze(messageIntentInput());

      expect(fetchMock()).toHaveBeenCalledTimes(3);
      expect(result.kind).toBe('multi_intent');
    });

    it('throws the last error once retries are exhausted', async () => {
      const config = makeConfig({ maxRetries: 2 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockRejectedValue(new Error('network down'));

      await expect(provider.analyze(messageIntentInput())).rejects.toThrow('network down');
      expect(fetchMock()).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('ProviderOptions override the config timeoutMs/maxRetries', async () => {
      const config = makeConfig({ maxRetries: 5, timeoutMs: 99_999 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockRejectedValue(new Error('network down'));
      const options: ProviderOptions = { maxRetries: 0 };

      await expect(provider.analyze(messageIntentInput(), options)).rejects.toThrow('network down');
      expect(fetchMock()).toHaveBeenCalledTimes(1); // options.maxRetries wins over config.maxRetries
    });
  });

  describe('AbortController timeout', () => {
    it('aborts the request once timeoutMs elapses and rejects', async () => {
      const config = makeConfig({ maxRetries: 0, timeoutMs: 20 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          })
      );

      await expect(provider.analyze(messageIntentInput())).rejects.toThrow('The operation was aborted');
    });
  });

  describe('shouldRetryWithoutStructuredOutput (retries without text.format)', () => {
    it.each(['json_schema', 'response_format', 'text.format'])(
      'retries once without text.format when the error message contains "%s"',
      async (keyword) => {
        const config = makeConfig({ maxRetries: 0 });
        const provider = new OpenAIAnalysisProvider(config);
        const payload = validMultiIntentPayload({ aiModel: config.textModel });
        fetchMock()
          .mockRejectedValueOnce(new Error(`Unsupported parameter: ${keyword}`))
          .mockResolvedValueOnce(okResponse({ output_text: JSON.stringify(payload) }));

        const result = await provider.analyze(messageIntentInput());

        expect(fetchMock()).toHaveBeenCalledTimes(2);
        const secondBody = JSON.parse(fetchMock().mock.calls[1][1].body as string);
        expect(secondBody.text).toBeUndefined();
        expect(result.kind).toBe('multi_intent');
      }
    );

    it('rethrows without a second request when the error message does not match any keyword', async () => {
      const config = makeConfig({ maxRetries: 0 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockRejectedValueOnce(new Error('rate limit exceeded'));

      await expect(provider.analyze(messageIntentInput())).rejects.toThrow('rate limit exceeded');
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // buildFallbackResult — message_intent vs document_classify shape
  // ==========================================================================

  describe('buildFallbackResult', () => {
    it('returns a message_intent fallback with rawMessage for message_intent input', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({}));

      const result = await provider.analyze(messageIntentInput({ messageText: 'το κείμενό μου' }));

      expect(result.kind).toBe('message_intent');
      if (isMessageIntentAnalysis(result)) {
        expect(result.rawMessage).toBe('το κείμενό μου');
      }
    });

    it('returns a document_classify fallback (no rawMessage) for document_classify input', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({}));

      const result = await provider.analyze(documentClassifyInput());

      expect(result.kind).toBe('document_classify');
      expect(result).not.toHaveProperty('rawMessage');
    });
  });

  // ==========================================================================
  // ADR-145: admin tool-calling path
  // ==========================================================================

  describe('ADR-145 admin tool calling (input.context.isAdminCommand === true)', () => {
    function adminInput(messageText = 'Στείλε στοιχεία επικοινωνίας στον Κώστα'): MessageIntentInput {
      return messageIntentInput({ messageText, context: { isAdminCommand: true } });
    }

    it('sends tools, tool_choice=auto, and the admin system prompt', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output: [] }));

      await provider.analyze(adminInput());

      const body = JSON.parse(fetchMock().mock.calls[0][1].body as string);
      expect(body.tool_choice).toBe('auto');
      expect(Array.isArray(body.tools)).toBe(true);
      expect(body.tools.length).toBeGreaterThan(0);
      expect(body.input[0]).toEqual({
        role: 'system',
        content: [{ type: 'input_text', text: ADMIN_TOOL_SYSTEM_PROMPT }],
      });
      expect(body.text).toBeUndefined();
    });

    it('maps a function_call response via mapToolCallToAnalysisResult', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(
        okResponse({
          output: [
            {
              type: 'function_call',
              name: 'search_contacts',
              call_id: 'call_1',
              arguments: JSON.stringify({ projectName: null, searchCriteria: 'Κώστας' }),
            },
          ],
        })
      );

      const result = await provider.analyze(adminInput());

      expect(result.kind).toBe('multi_intent');
      if (result.kind === 'multi_intent') {
        expect(result.primaryIntent.intentType).toBe('admin_contact_search');
        expect(result.primaryIntent.rationale).toBe('tool_call:search_contacts');
        expect(result.extractedEntities).toEqual({ searchCriteria: 'Κώστας' });
        expect(result.confidence).toBe(1);
        expect(result.needsTriage).toBe(false);
      }
    });

    it('builds a conversational fallback when there is no function_call but there is text output', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output_text: 'Γεια σου, πώς μπορώ να βοηθήσω;' }));

      const result = await provider.analyze(adminInput());

      expect(result.kind).toBe('multi_intent');
      if (result.kind === 'multi_intent') {
        expect(result.primaryIntent.intentType).toBe('admin_general_question');
        expect(result.primaryIntent.rationale).toBe('conversational_text_reply');
        expect(result.extractedEntities).toEqual({
          conversationalReply: 'Γεια σου, πώς μπορώ να βοηθήσω;',
        });
      }
    });

    it('falls back to buildFallbackResult when there is neither a function_call nor text', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue(okResponse({ output: [] }));

      const result = await provider.analyze(adminInput('Γεια'));

      expect(result.kind).toBe('message_intent');
      if (isMessageIntentAnalysis(result)) {
        expect(result.rawMessage).toBe('Γεια');
      }
    });

    it('resolves to buildFallbackResult (does NOT throw) when executeRequest fails', async () => {
      const config = makeConfig({ maxRetries: 0 });
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockRejectedValue(new Error('network down'));

      const result = await provider.analyze(adminInput('Γεια σου'));

      expect(result.kind).toBe('message_intent');
      if (isMessageIntentAnalysis(result)) {
        expect(result.rawMessage).toBe('Γεια σου');
      }
    });
  });

  // ==========================================================================
  // Non-admin happy path: stripNullValues → validateAIAnalysisResult
  // ==========================================================================

  describe('non-admin happy path validation', () => {
    it('strips null fields from the parsed JSON before schema validation succeeds', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      const payload = validMultiIntentPayload({
        aiModel: config.textModel,
        eventDate: null, // optional field: OpenAI strict mode returns null, must be stripped
      });
      fetchMock().mockResolvedValue(okResponse({ output_text: JSON.stringify(payload) }));

      const result = await provider.analyze(messageIntentInput());

      expect(result.kind).toBe('multi_intent');
      expect(result).not.toHaveProperty('eventDate');
    });
  });

  // ==========================================================================
  // healthCheck
  // ==========================================================================

  describe('healthCheck', () => {
    it('returns false without calling fetch when apiKey is empty', async () => {
      const provider = new OpenAIAnalysisProvider(makeConfig({ apiKey: '' }));

      const healthy = await provider.healthCheck();

      expect(healthy).toBe(false);
      expect(fetchMock()).not.toHaveBeenCalled();
    });

    it('GETs <baseUrl>/models with the Authorization header and returns true on ok', async () => {
      const config = makeConfig();
      const provider = new OpenAIAnalysisProvider(config);
      fetchMock().mockResolvedValue({ ok: true });

      const healthy = await provider.healthCheck();

      expect(healthy).toBe(true);
      expect(fetchMock()).toHaveBeenCalledWith(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
    });

    it('returns false when fetch throws', async () => {
      const provider = new OpenAIAnalysisProvider(makeConfig());
      fetchMock().mockRejectedValue(new Error('ECONNREFUSED'));

      const healthy = await provider.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  // ==========================================================================
  // createOpenAIProvider factory
  // ==========================================================================

  describe('createOpenAIProvider', () => {
    it('returns null when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;

      expect(createOpenAIProvider()).toBeNull();
    });

    it('returns a provider instance with name "openai-provider" and version === textModel when the key is set', () => {
      process.env.OPENAI_API_KEY = 'a-real-looking-key';

      const provider = createOpenAIProvider();

      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('openai-provider');
      expect(provider?.version).toBe(AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL);
    });
  });
});
