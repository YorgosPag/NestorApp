/**
 * OpenAI Quote Analyzer — CHARACTERIZATION TESTS (pre-refactor safety net).
 *
 * These tests lock the CURRENT behavior of `openai-quote-analyzer.ts` before it
 * is refactored to consume a centralized OpenAI Responses-API SSoT. Every test
 * here must stay green, UNCHANGED, after the refactor — that is the proof that
 * the refactor is behavior-preserving.
 *
 * Do NOT "fix" surprising behavior found while writing these tests — lock it
 * as-is and flag it in the accompanying report instead.
 *
 * @see ADR-327 §6 — AI Extraction Strategy v2.0
 * @see ../openai-quote-analyzer.ts
 */

// ============================================================================
// MOCKS
// ============================================================================

const mockGetAdminBucket = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: (...args: unknown[]) => mockGetAdminBucket(...args),
}));

const mockRasterizePdfPages = jest.fn();
jest.mock('@/services/pdf/pdf-rasterize.service', () => {
  // Real RasterizeUnavailableError (cheap type/error class — no heavy deps at
  // module top-level; pdfjs-dist/@napi-rs/canvas are dynamically imported only
  // inside rasterizePdfPages, which we override below).
  const actual = jest.requireActual('@/services/pdf/pdf-rasterize.service');
  return {
    ...actual,
    rasterizePdfPages: (...args: unknown[]) => mockRasterizePdfPages(...args),
  };
});

const mockValidateExtraction = jest.fn();
const mockBuildRetryFeedback = jest.fn();
jest.mock('../quote-analyzer.validation', () => ({
  validateExtraction: (...args: unknown[]) => mockValidateExtraction(...args),
  buildRetryFeedback: (...args: unknown[]) => mockBuildRetryFeedback(...args),
}));

const mockNormalizeExtracted = jest.fn();
const mockBuildFallbackExtractedData = jest.fn();
jest.mock('../quote-analyzer.normalizers', () => ({
  normalizeExtracted: (...args: unknown[]) => mockNormalizeExtracted(...args),
  buildFallbackExtractedData: (...args: unknown[]) => mockBuildFallbackExtractedData(...args),
}));

import { OpenAIQuoteAnalyzer, createOpenAIQuoteAnalyzer } from '../openai-quote-analyzer';
import {
  QUOTE_CLASSIFY_SCHEMA,
  QUOTE_EXTRACT_SCHEMA,
  QUOTE_CLASSIFY_PROMPT,
  QUOTE_EXTRACT_PROMPT,
} from '../quote-analyzer.schemas';
import { RasterizeUnavailableError } from '@/services/pdf/pdf-rasterize.service';

// ============================================================================
// TEST HELPERS
// ============================================================================

interface AnalyzerConfigShape {
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  escalateModel: string | null;
  timeoutMs: number;
  maxRetries: number;
  maxValidationRetries: number;
  rasterizePdf: boolean;
  rasterDpi: number;
}

function makeAnalyzer(overrides: Partial<AnalyzerConfigShape> = {}): OpenAIQuoteAnalyzer {
  return new OpenAIQuoteAnalyzer({
    apiKey: 'sk-test',
    baseUrl: 'https://api.openai.com/v1',
    visionModel: 'gpt-4o',
    escalateModel: null,
    timeoutMs: 5000,
    maxRetries: 0,
    maxValidationRetries: 1,
    rasterizePdf: true,
    rasterDpi: 200,
    ...overrides,
  });
}

/** Peeks the private `config` field — factory tests assert env-var wiring without a network call. */
function getConfig(analyzer: OpenAIQuoteAnalyzer): AnalyzerConfigShape {
  return (analyzer as unknown as { config: AnalyzerConfigShape }).config;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function parseBody(call: unknown[]): {
  model: string;
  input: Array<{ role: string; content: Array<Record<string, unknown>> }>;
  text?: { format?: Record<string, unknown> };
} {
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

function bucketMock(name: string) {
  const download = jest.fn().mockResolvedValue([Buffer.from('pdf-bytes')]);
  const file = jest.fn().mockReturnValue({ download });
  return { name, file };
}

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;

beforeEach(() => {
  mockFetch.mockReset();
  mockGetAdminBucket.mockReset();
  mockRasterizePdfPages.mockReset();
  mockValidateExtraction.mockReset();
  mockBuildRetryFeedback.mockReset();
  mockNormalizeExtracted.mockReset();
  mockBuildFallbackExtractedData.mockReset();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  consoleInfoSpy.mockRestore();
});

const FALLBACK_CLASSIFICATION = { isQuote: false, confidence: 0, detectedLanguage: 'unknown' };

// ============================================================================
// REQUEST BODY WIRE PROTOCOL (most important — locks the OpenAI contract)
// ============================================================================

describe('request body wire protocol', () => {
  it('classifyQuote sends the exact Responses-API shape for an image', async () => {
    const analyzer = makeAnalyzer({ apiKey: 'sk-abc', baseUrl: 'https://api.openai.com/v1', visionModel: 'gpt-4o' });
    mockFetch.mockResolvedValueOnce(jsonResponse({
      output_text: JSON.stringify({ isQuote: true, confidence: 90, detectedLanguage: 'el' }),
    }));

    await analyzer.classifyQuote('https://files/x.jpg', 'image/jpeg');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer sk-abc',
      'Content-Type': 'application/json',
    });

    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.model).toBe('gpt-4o');
    expect(body.input).toHaveLength(2);
    expect(body.input[0]).toEqual({
      role: 'system',
      content: [{ type: 'input_text', text: QUOTE_CLASSIFY_PROMPT }],
    });
    expect(body.input[1]).toEqual({
      role: 'user',
      content: [
        { type: 'input_text', text: 'Είναι αυτό το αρχείο προσφορά προμηθευτή;' },
        { type: 'input_image', image_url: 'https://files/x.jpg' },
      ],
    });
    expect(body.text?.format).toEqual({
      type: 'json_schema',
      name: QUOTE_CLASSIFY_SCHEMA.name,
      description: QUOTE_CLASSIFY_SCHEMA.description,
      strict: QUOTE_CLASSIFY_SCHEMA.strict,
      schema: QUOTE_CLASSIFY_SCHEMA.schema,
    });
  });

  it('extractQuote sends the extract schema/prompt on the first attempt', async () => {
    const analyzer = makeAnalyzer({ visionModel: 'gpt-4o' });
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ vendorName: 'ACME' }) }));
    mockValidateExtraction.mockReturnValueOnce({ valid: true, issues: [], warnings: [] });
    mockNormalizeExtracted.mockReturnValueOnce({});

    await analyzer.extractQuote('https://files/x.jpg', 'image/jpeg');

    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.model).toBe('gpt-4o');
    expect(body.input[0]).toEqual({
      role: 'system',
      content: [{ type: 'input_text', text: QUOTE_EXTRACT_PROMPT }],
    });
    expect(body.input[1].content[0]).toEqual({ type: 'input_text', text: 'Εξάγαγε τα δεδομένα της προσφοράς.' });
    expect(body.text?.format).toEqual({
      type: 'json_schema',
      name: QUOTE_EXTRACT_SCHEMA.name,
      description: QUOTE_EXTRACT_SCHEMA.description,
      strict: QUOTE_EXTRACT_SCHEMA.strict,
      schema: QUOTE_EXTRACT_SCHEMA.schema,
    });
  });
});

// ============================================================================
// buildVisionContent (private — exercised via classifyQuote)
// ============================================================================

describe('buildVisionContent (via classifyQuote)', () => {
  it('image mime → single input_image with the plain fileUrl', async () => {
    const analyzer = makeAnalyzer();
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 5, detectedLanguage: 'el' }) }));

    await analyzer.classifyQuote('https://x/img.png', 'image/png');

    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.input[1].content).toEqual([
      { type: 'input_text', text: 'Είναι αυτό το αρχείο προσφορά προμηθευτή;' },
      { type: 'input_image', image_url: 'https://x/img.png' },
    ]);
  });

  it('pdf + rasterizePdf=true → one input_image per rasterized page (base64 PNG)', async () => {
    const analyzer = makeAnalyzer({ rasterizePdf: true, rasterDpi: 150 });
    const fileBuffer = Buffer.from('pdf-bytes');
    mockRasterizePdfPages.mockResolvedValueOnce([Buffer.from('page1'), Buffer.from('page2')]);
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: false, confidence: 10, detectedLanguage: 'en' }) }));

    await analyzer.classifyQuote('https://x/quote.pdf', 'application/pdf', fileBuffer);

    expect(mockRasterizePdfPages).toHaveBeenCalledWith(fileBuffer, { dpi: 150, maxPages: 10 });
    expect(mockGetAdminBucket).not.toHaveBeenCalled(); // fileBuffer bypasses fetchFileAsBuffer

    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.input[1].content).toEqual([
      { type: 'input_text', text: 'Είναι αυτό το αρχείο προσφορά προμηθευτή;' },
      { type: 'input_image', image_url: `data:image/png;base64,${Buffer.from('page1').toString('base64')}` },
      { type: 'input_image', image_url: `data:image/png;base64,${Buffer.from('page2').toString('base64')}` },
    ]);
  });

  it('pdf + RasterizeUnavailableError → falls back to input_file (native pdf) + console.warn', async () => {
    const analyzer = makeAnalyzer({ rasterizePdf: true });
    const fileBuffer = Buffer.from('pdf-bytes');
    mockRasterizePdfPages.mockRejectedValueOnce(new RasterizeUnavailableError('no canvas binding'));
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 50, detectedLanguage: 'el' }) }));

    await analyzer.classifyQuote('https://x/quote.pdf', 'application/pdf', fileBuffer);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('falling back to native input_file'),
      expect.any(String),
    );
    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.input[1].content[1]).toEqual({
      type: 'input_file',
      filename: 'quote.pdf',
      file_data: `data:application/pdf;base64,${fileBuffer.toString('base64')}`,
    });
  });

  it('pdf + generic rasterize throw → falls back to input_file + console.error', async () => {
    const analyzer = makeAnalyzer({ rasterizePdf: true });
    const fileBuffer = Buffer.from('pdf-bytes');
    mockRasterizePdfPages.mockRejectedValueOnce(new Error('boom'));
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 50, detectedLanguage: 'el' }) }));

    await analyzer.classifyQuote('https://x/quote.pdf', 'application/pdf', fileBuffer);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('falling back to native input_file'),
      expect.any(Error),
    );
    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.input[1].content[1]).toEqual({
      type: 'input_file',
      filename: 'quote.pdf',
      file_data: `data:application/pdf;base64,${fileBuffer.toString('base64')}`,
    });
  });

  it('pdf + rasterizePdf=false → goes straight to input_file, never calls rasterizePdfPages', async () => {
    const analyzer = makeAnalyzer({ rasterizePdf: false });
    const fileBuffer = Buffer.from('pdf-bytes');
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: false, confidence: 0, detectedLanguage: 'unknown' }) }));

    await analyzer.classifyQuote('https://x/quote.pdf', 'application/pdf', fileBuffer);

    expect(mockRasterizePdfPages).not.toHaveBeenCalled();
    const body = parseBody(mockFetch.mock.calls[0]);
    expect(body.input[1].content[1]).toEqual({
      type: 'input_file',
      filename: 'quote.pdf',
      file_data: `data:application/pdf;base64,${fileBuffer.toString('base64')}`,
    });
  });
});

// ============================================================================
// fetchFileAsBuffer (private — exercised via classifyQuote pdf path, no fileBuffer)
// ============================================================================

describe('fetchFileAsBuffer (via classifyQuote, pdf, no fileBuffer override)', () => {
  it('downloads from storage when the URL matches the bucket prefix', async () => {
    const bucket = bucketMock('my-bucket');
    mockGetAdminBucket.mockReturnValue(bucket);
    mockRasterizePdfPages.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 10, detectedLanguage: 'el' }) }));

    const analyzer = makeAnalyzer({ rasterizePdf: true });
    await analyzer.classifyQuote('https://storage.googleapis.com/my-bucket/quotes/q1.pdf', 'application/pdf');

    expect(bucket.file).toHaveBeenCalledWith('quotes/q1.pdf');
  });

  it('throws "Unexpected storage URL" for URLs outside the bucket prefix (surfaces as fallback classification)', async () => {
    mockGetAdminBucket.mockReturnValue(bucketMock('my-bucket'));

    const analyzer = makeAnalyzer();
    const result = await analyzer.classifyQuote('https://evil.example.com/q1.pdf', 'application/pdf');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OpenAIQuoteAnalyzer] classifyQuote failed:',
      expect.objectContaining({
        message: expect.stringContaining('Unexpected storage URL'),
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('decodes URL-encoded storage paths', async () => {
    const bucket = bucketMock('my-bucket');
    mockGetAdminBucket.mockReturnValue(bucket);
    mockRasterizePdfPages.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 10, detectedLanguage: 'el' }) }));

    const analyzer = makeAnalyzer({ rasterizePdf: true });
    await analyzer.classifyQuote('https://storage.googleapis.com/my-bucket/quotes/q%201.pdf', 'application/pdf');

    expect(bucket.file).toHaveBeenCalledWith('quotes/q 1.pdf');
  });
});

// ============================================================================
// executeRequest — error handling & retries (private — exercised via classifyQuote)
// ============================================================================

describe('executeRequest error handling & retries (via classifyQuote)', () => {
  it('surfaces error.message from a non-OK JSON payload', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 0 });
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: { message: 'Invalid API key' } }, false, 401));

    const result = await analyzer.classifyQuote('https://x/img.png', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OpenAIQuoteAnalyzer] classifyQuote failed:',
      expect.objectContaining({ message: 'Invalid API key' }),
    );
  });

  it('falls back to "OpenAI error (<status>)" when the error payload is not parseable', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 0 });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: jest.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response);

    const result = await analyzer.classifyQuote('https://x/img.png', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OpenAIQuoteAnalyzer] classifyQuote failed:',
      expect.objectContaining({ message: 'OpenAI error (503)' }),
    );
  });

  it('retries transient failures up to maxRetries then succeeds', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 2 });
    mockFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down again'))
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 77, detectedLanguage: 'el' }) }));

    const result = await analyzer.classifyQuote('https://x/img.png', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ isQuote: true, confidence: 77, detectedLanguage: 'el' });
  });

  it('throws after exhausting maxRetries (surfaces as fallback classification)', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 2 });
    mockFetch.mockRejectedValue(new Error('always down'));

    const result = await analyzer.classifyQuote('https://x/img.png', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(3); // attempts 0,1,2
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('aborts the in-flight request via AbortController once timeoutMs elapses', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 0, timeoutMs: 15 });
    mockFetch.mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    }));

    const result = await analyzer.classifyQuote('https://x/img.png', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OpenAIQuoteAnalyzer] classifyQuote failed:',
      expect.objectContaining({ name: 'AbortError' }),
    );
  }, 2000);
});

// ============================================================================
// classifyQuote
// ============================================================================

describe('classifyQuote', () => {
  it('happy path returns the classification verbatim', async () => {
    const analyzer = makeAnalyzer();
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: true, confidence: 88, detectedLanguage: 'el' }) }));

    const result = await analyzer.classifyQuote('https://x', 'image/png');

    expect(result).toEqual({ isQuote: true, confidence: 88, detectedLanguage: 'el' });
  });

  it('never throws — returns fallback classification on failure', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 0 });
    mockFetch.mockRejectedValue(new Error('boom'));

    await expect(analyzer.classifyQuote('https://x', 'image/png')).resolves.toEqual(FALLBACK_CLASSIFICATION);
  });

  it('coerces truthy isQuote, non-numeric confidence → 0, missing detectedLanguage → unknown', async () => {
    const analyzer = makeAnalyzer();
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ isQuote: 'yes', confidence: 'high' }) }));

    const result = await analyzer.classifyQuote('https://x', 'image/png');

    expect(result).toEqual({ isQuote: true, confidence: 0, detectedLanguage: 'unknown' });
  });

  it('falls back to classification when there is no extractable output text', async () => {
    const analyzer = makeAnalyzer();
    mockFetch.mockResolvedValueOnce(jsonResponse({ output: [] }));

    const result = await analyzer.classifyQuote('https://x', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('treats whitespace-only output_text as absent (falls back)', async () => {
    const analyzer = makeAnalyzer();
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: '   ' }));

    const result = await analyzer.classifyQuote('https://x', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('reads the structured output[].content[] shape (type=message/output_text)', async () => {
    const analyzer = makeAnalyzer();
    mockFetch.mockResolvedValueOnce(jsonResponse({
      output: [
        { type: 'reasoning', content: [] },
        {
          type: 'message',
          content: [
            { type: 'refusal' },
            { type: 'output_text', text: JSON.stringify({ isQuote: true, confidence: 95, detectedLanguage: 'en' }) },
          ],
        },
      ],
    }));

    const result = await analyzer.classifyQuote('https://x', 'image/png');

    expect(result).toEqual({ isQuote: true, confidence: 95, detectedLanguage: 'en' });
  });
});

// ============================================================================
// extractQuote — validation retry loop (the core behavior at stake)
// ============================================================================

describe('extractQuote — validation retry loop', () => {
  it('valid on the first attempt → normalizeExtracted(parsed, [], warnings), single fetch', async () => {
    const analyzer = makeAnalyzer({ maxValidationRetries: 2 });
    const parsed = { vendorName: 'ACME' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify(parsed) }));
    mockValidateExtraction.mockReturnValueOnce({ valid: true, issues: [], warnings: ['soft warning'] });
    const sentinel = { sentinel: 'ok' };
    mockNormalizeExtracted.mockReturnValueOnce(sentinel);

    const result = await analyzer.extractQuote('https://x', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockNormalizeExtracted).toHaveBeenCalledWith(parsed, [], ['soft warning']);
    expect(result).toBe(sentinel);
  });

  it('invalid on attempt 0 → retries with escalateModel + buildRetryFeedback(issues) as the prompt', async () => {
    const analyzer = makeAnalyzer({ maxValidationRetries: 2, visionModel: 'gpt-4o', escalateModel: 'gpt-4o-escalated' });
    const parsed0 = { attempt: 0 };
    const parsed1 = { attempt: 1 };
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify(parsed0) }))
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify(parsed1) }));
    mockValidateExtraction
      .mockReturnValueOnce({ valid: false, issues: ['bad math'], warnings: [] })
      .mockReturnValueOnce({ valid: true, issues: [], warnings: [] });
    mockBuildRetryFeedback.mockReturnValueOnce('please fix: bad math');
    const sentinel = { sentinel: 'retried' };
    mockNormalizeExtracted.mockReturnValueOnce(sentinel);

    const result = await analyzer.extractQuote('https://x', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockBuildRetryFeedback).toHaveBeenCalledWith(['bad math']);

    const secondBody = parseBody(mockFetch.mock.calls[1]);
    expect(secondBody.model).toBe('gpt-4o-escalated');
    expect(secondBody.input[1].content[0]).toEqual({ type: 'input_text', text: 'please fix: bad math' });

    expect(mockNormalizeExtracted).toHaveBeenCalledWith(parsed1, [], []);
    expect(result).toBe(sentinel);
  });

  it('invalid on attempt 0, escalateModel=null → retries with the SAME visionModel', async () => {
    const analyzer = makeAnalyzer({ maxValidationRetries: 1, visionModel: 'gpt-4o', escalateModel: null });
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ a: 1 }) }))
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify({ a: 2 }) }));
    mockValidateExtraction
      .mockReturnValueOnce({ valid: false, issues: ['x'], warnings: [] })
      .mockReturnValueOnce({ valid: true, issues: [], warnings: [] });
    mockBuildRetryFeedback.mockReturnValueOnce('retry text');
    mockNormalizeExtracted.mockReturnValueOnce({});

    await analyzer.extractQuote('https://x', 'image/png');

    const secondBody = parseBody(mockFetch.mock.calls[1]);
    expect(secondBody.model).toBe('gpt-4o');
  });

  it('exhausts maxValidationRetries → normalizeExtracted(lastParsed, lastIssues) — NO warnings arg', async () => {
    const analyzer = makeAnalyzer({ maxValidationRetries: 1 }); // attempts 0,1 = 2 fetches
    const parsed0 = { attempt: 0 };
    const parsed1 = { attempt: 1 };
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify(parsed0) }))
      .mockResolvedValueOnce(jsonResponse({ output_text: JSON.stringify(parsed1) }));
    mockValidateExtraction
      .mockReturnValueOnce({ valid: false, issues: ['issue-a'], warnings: [] })
      .mockReturnValueOnce({ valid: false, issues: ['issue-b'], warnings: [] });
    mockBuildRetryFeedback.mockReturnValueOnce('retry');
    const sentinel = { sentinel: 'exhausted' };
    mockNormalizeExtracted.mockReturnValueOnce(sentinel);

    const result = await analyzer.extractQuote('https://x', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockNormalizeExtracted).toHaveBeenCalledWith(parsed1, ['issue-b']);
    expect(mockNormalizeExtracted.mock.calls[0]).toHaveLength(2); // 2-arg call, not 3
    expect(result).toBe(sentinel);
  });

  it('JSON never parses → breaks on attempt 0 (single fetch) → buildFallbackExtractedData()', async () => {
    const analyzer = makeAnalyzer({ maxValidationRetries: 2 });
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: 'not json at all {{{' }));
    const fallback = { fallback: 'unparseable' };
    mockBuildFallbackExtractedData.mockReturnValueOnce(fallback);

    const result = await analyzer.extractQuote('https://x', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockValidateExtraction).not.toHaveBeenCalled();
    expect(result).toBe(fallback);
  });

  it('empty outputText → breaks the loop immediately → buildFallbackExtractedData()', async () => {
    const analyzer = makeAnalyzer({ maxValidationRetries: 2 });
    mockFetch.mockResolvedValueOnce(jsonResponse({ output_text: '   ' }));
    const fallback = { fallback: 'empty' };
    mockBuildFallbackExtractedData.mockReturnValueOnce(fallback);

    const result = await analyzer.extractQuote('https://x', 'image/png');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(fallback);
  });

  it('request throws (network failure) → returns buildFallbackExtractedData(), never throws', async () => {
    const analyzer = makeAnalyzer({ maxRetries: 0 });
    mockFetch.mockRejectedValue(new Error('down'));
    const fallback = { fallback: 'network' };
    mockBuildFallbackExtractedData.mockReturnValueOnce(fallback);

    const result = await analyzer.extractQuote('https://x', 'image/png');

    expect(result).toBe(fallback);
  });
});

// ============================================================================
// createOpenAIQuoteAnalyzer — factory / env wiring
// ============================================================================

describe('createOpenAIQuoteAnalyzer factory', () => {
  const ENV_KEYS = [
    'OPENAI_API_KEY',
    'OPENAI_QUOTE_VISION_MODEL',
    'OPENAI_VISION_MODEL',
    'OPENAI_QUOTE_ESCALATE_MODEL',
    'OPENAI_QUOTE_RASTERIZE_PDF',
    'OPENAI_API_BASE_URL',
    'OPENAI_TIMEOUT_MS',
    'OPENAI_MAX_RETRIES',
    'OPENAI_QUOTE_VALIDATION_RETRIES',
    'OPENAI_QUOTE_RASTER_DPI',
  ] as const;
  let originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string>>;

  beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns null when OPENAI_API_KEY is missing', () => {
    expect(createOpenAIQuoteAnalyzer()).toBeNull();
  });

  it('returns null when OPENAI_API_KEY is blank/whitespace', () => {
    process.env.OPENAI_API_KEY = '   ';
    expect(createOpenAIQuoteAnalyzer()).toBeNull();
  });

  it('prefers OPENAI_QUOTE_VISION_MODEL over OPENAI_VISION_MODEL over the gpt-4o default', () => {
    process.env.OPENAI_API_KEY = 'sk-1';
    process.env.OPENAI_VISION_MODEL = 'from-generic';
    process.env.OPENAI_QUOTE_VISION_MODEL = 'from-quote-specific';

    const analyzer = createOpenAIQuoteAnalyzer();

    expect(getConfig(analyzer as OpenAIQuoteAnalyzer).visionModel).toBe('from-quote-specific');
  });

  it('falls back to OPENAI_VISION_MODEL when OPENAI_QUOTE_VISION_MODEL is unset', () => {
    process.env.OPENAI_API_KEY = 'sk-1';
    process.env.OPENAI_VISION_MODEL = 'from-generic';

    const analyzer = createOpenAIQuoteAnalyzer();

    expect(getConfig(analyzer as OpenAIQuoteAnalyzer).visionModel).toBe('from-generic');
  });

  it('defaults to gpt-4o when no vision model env var is set', () => {
    process.env.OPENAI_API_KEY = 'sk-1';

    const analyzer = createOpenAIQuoteAnalyzer();

    expect(getConfig(analyzer as OpenAIQuoteAnalyzer).visionModel).toBe('gpt-4o');
  });

  it('escalateModel is null when OPENAI_QUOTE_ESCALATE_MODEL is unset', () => {
    process.env.OPENAI_API_KEY = 'sk-1';

    const analyzer = createOpenAIQuoteAnalyzer();

    expect(getConfig(analyzer as OpenAIQuoteAnalyzer).escalateModel).toBeNull();
  });

  it('OPENAI_QUOTE_RASTERIZE_PDF="0" disables rasterization; any other value keeps it enabled', () => {
    process.env.OPENAI_API_KEY = 'sk-1';
    process.env.OPENAI_QUOTE_RASTERIZE_PDF = '0';
    expect(getConfig(createOpenAIQuoteAnalyzer() as OpenAIQuoteAnalyzer).rasterizePdf).toBe(false);

    process.env.OPENAI_QUOTE_RASTERIZE_PDF = 'anything-else';
    expect(getConfig(createOpenAIQuoteAnalyzer() as OpenAIQuoteAnalyzer).rasterizePdf).toBe(true);
  });

  it('applies documented defaults for baseUrl/timeout/retries/dpi', () => {
    process.env.OPENAI_API_KEY = 'sk-1';

    const config = getConfig(createOpenAIQuoteAnalyzer() as OpenAIQuoteAnalyzer);

    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.timeoutMs).toBe(120000);
    expect(config.maxRetries).toBe(2);
    expect(config.maxValidationRetries).toBe(2);
    expect(config.rasterDpi).toBe(200);
    expect(config.rasterizePdf).toBe(true);
  });
});
