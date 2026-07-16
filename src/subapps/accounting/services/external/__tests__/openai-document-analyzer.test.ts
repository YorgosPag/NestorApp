/**
 * @fileoverview Characterization tests — OpenAIDocumentAnalyzer
 * @description Locks in CURRENT behaviour of openai-document-analyzer.ts BEFORE
 * a planned refactor onto a central OpenAI Responses-API SSoT. These tests are
 * the safety net: they must stay green, unchanged, after the refactor — that is
 * the proof the refactor is behaviour-preserving.
 *
 * IMPORTANT: this file characterizes existing behaviour, including quirks that
 * look questionable. See the final report for anything flagged as suspicious —
 * none of it was "fixed" here, only locked in.
 *
 * @see ../openai-document-analyzer.ts
 */

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: jest.fn(),
}));

import { getAdminBucket } from '@/lib/firebaseAdmin';
import {
  OpenAIDocumentAnalyzer,
  createOpenAIDocumentAnalyzer,
} from '../openai-document-analyzer';
import {
  EXPENSE_CLASSIFY_SCHEMA,
  EXPENSE_EXTRACT_SCHEMA,
  CLASSIFY_SYSTEM_PROMPT,
  EXTRACT_SYSTEM_PROMPT,
} from '../document-analyzer.schemas';
import type { DocumentClassification, ExtractedDocumentData } from '../../../types/documents';

const getAdminBucketMock = getAdminBucket as jest.Mock;

// ============================================================================
// FIXTURES — mirror the production fallback builders (not exported), so the
// tests assert against the SAME literal shape the code returns on failure.
// ============================================================================

const FALLBACK_CLASSIFICATION: DocumentClassification = {
  documentType: 'other',
  suggestedCategory: 'other_expense',
  typeConfidence: 0,
  categoryConfidence: 0,
  alternativeCategories: [],
};

const FALLBACK_EXTRACTED: ExtractedDocumentData = {
  issuerName: null,
  issuerVatNumber: null,
  issuerAddress: null,
  documentNumber: null,
  issueDate: null,
  netAmount: null,
  vatAmount: null,
  grossAmount: null,
  vatRate: null,
  lineItems: [],
  paymentMethod: null,
  overallConfidence: 0,
};

const SAMPLE_CLASSIFICATION: DocumentClassification = {
  documentType: 'purchase_invoice',
  suggestedCategory: 'office_supplies',
  typeConfidence: 92,
  categoryConfidence: 81,
  alternativeCategories: [{ category: 'equipment', confidence: 40 }],
};

const SAMPLE_EXTRACTED: ExtractedDocumentData = {
  issuerName: 'ACME Α.Ε.',
  issuerVatNumber: '123456789',
  issuerAddress: 'Λεωφ. Συγγρού 1',
  documentNumber: 'INV-2026-001',
  issueDate: '2026-01-15',
  netAmount: 100,
  vatAmount: 24,
  grossAmount: 124,
  vatRate: 24,
  lineItems: [{ description: 'Χαρτί Α4', quantity: 2, unitPrice: 5, netAmount: 10, vatRate: 24 }],
  paymentMethod: 'card',
  overallConfidence: 88,
};

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeAnalyzer(
  overrides: Partial<{
    apiKey: string;
    baseUrl: string;
    visionModel: string;
    timeoutMs: number;
    maxRetries: number;
  }> = {}
): OpenAIDocumentAnalyzer {
  return new OpenAIDocumentAnalyzer({
    apiKey: 'test-api-key',
    baseUrl: 'https://api.openai.com/v1',
    visionModel: 'gpt-4o-mini',
    timeoutMs: 30000,
    maxRetries: 2,
    ...overrides,
  });
}

function mockFetchOk(payload: unknown): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => payload,
  });
}

/**
 * A non-OK response. `text()` serves the raw body the way a real `Response`
 * does — the SSoT reads the error body as text so that non-JSON payloads
 * survive onto `ResponsesApiError.body`. A `jsonImpl` that rejects models a
 * body that is not JSON at all, so `text()` yields a non-JSON string.
 */
function mockFetchError(status: number, jsonImpl: () => Promise<unknown>): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    json: jsonImpl,
    text: async () => {
      try {
        return JSON.stringify(await jsonImpl());
      } catch {
        return '<html>upstream failure</html>';
      }
    },
  });
}

function lastFetchCall(): { url: string; options: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal } } {
  const calls = (global.fetch as jest.Mock).mock.calls;
  const [url, options] = calls[calls.length - 1];
  return { url, options };
}

function mockBucket(bucketName: string, download: (path: string) => Promise<[Buffer]>): jest.Mock {
  const fileFn = jest.fn((path: string) => ({ download: () => download(path) }));
  getAdminBucketMock.mockReturnValue({ name: bucketName, file: fileFn });
  return fileFn;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = jest.fn() as unknown as typeof fetch;
  getAdminBucketMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// REQUEST BODY — exact wire protocol (the part the refactor MUST preserve)
// ============================================================================

describe('classifyDocument — request wire protocol', () => {
  it('builds the exact request body and calls the exact endpoint/headers', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    const analyzer = makeAnalyzer();

    const result = await analyzer.classifyDocument('https://x/a.png', 'image/png');

    expect(result).toEqual(SAMPLE_CLASSIFICATION);
    const { url, options } = lastFetchCall();
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      Authorization: 'Bearer test-api-key',
      'Content-Type': 'application/json',
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: CLASSIFY_SYSTEM_PROMPT }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Ταξινόμησε αυτό το παραστατικό.' },
            { type: 'input_image', image_url: 'https://x/a.png' },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: EXPENSE_CLASSIFY_SCHEMA.name,
          description: EXPENSE_CLASSIFY_SCHEMA.description,
          strict: EXPENSE_CLASSIFY_SCHEMA.strict,
          schema: EXPENSE_CLASSIFY_SCHEMA.schema,
        },
      },
    });
  });
});

describe('extractData — request wire protocol', () => {
  it('builds the exact request body for extraction (system prompt + schema)', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });
    const analyzer = makeAnalyzer();

    const result = await analyzer.extractData('https://x/a.png', 'purchase_invoice');

    expect(result).toEqual(SAMPLE_EXTRACTED);
    const { options } = lastFetchCall();
    const body = JSON.parse(options.body);
    expect(body.input[0]).toEqual({
      role: 'system',
      content: [{ type: 'input_text', text: EXTRACT_SYSTEM_PROMPT }],
    });
    expect(body.input[1].content[0]).toEqual({
      type: 'input_text',
      text: 'Εξάγαγε δεδομένα από αυτό το purchase_invoice. Τύπος εγγράφου: purchase_invoice',
    });
    expect(body.text.format).toEqual({
      type: 'json_schema',
      name: EXPENSE_EXTRACT_SCHEMA.name,
      description: EXPENSE_EXTRACT_SCHEMA.description,
      strict: EXPENSE_EXTRACT_SCHEMA.strict,
      schema: EXPENSE_EXTRACT_SCHEMA.schema,
    });
  });
});

// ============================================================================
// extractOutputText — exercised indirectly through classifyDocument
// ============================================================================

describe('extractOutputText (via classifyDocument)', () => {
  it('uses the output_text shortcut when present', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(SAMPLE_CLASSIFICATION);
  });

  it('falls back to the structured output[].content[] shape (type message/output_text)', async () => {
    mockFetchOk({
      output: [
        { type: 'reasoning', content: [] },
        {
          type: 'message',
          content: [
            { type: 'refusal', text: 'ignored' },
            { type: 'output_text', text: JSON.stringify(SAMPLE_CLASSIFICATION) },
          ],
        },
      ],
    });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(SAMPLE_CLASSIFICATION);
  });

  it('returns the fallback classification when the payload has no usable text anywhere', async () => {
    mockFetchOk({ output: [] });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('treats a whitespace-only output_text as absent and falls back', async () => {
    // NOTE: characterized as-is — a whitespace-only top-level output_text is
    // silently ignored (no structured `output` array present either), so the
    // caller gets the generic fallback rather than an explicit "empty" signal.
    mockFetchOk({ output_text: '   ' });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });

  it('returns the fallback classification when output_text is not valid JSON', async () => {
    mockFetchOk({ output_text: 'this is not json' });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });
});

// ============================================================================
// executeRequest — success / error-message shaping / retry / timeout
// ============================================================================

describe('executeRequest (via classifyDocument)', () => {
  it('returns the parsed classification on a straightforward success', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(SAMPLE_CLASSIFICATION);
  });

  it('logs error.message from a non-OK response payload (single attempt, maxRetries=0)', async () => {
    mockFetchError(400, async () => ({ error: { message: 'Bad request: invalid schema' } }));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await makeAnalyzer({ maxRetries: 0 }).classifyDocument('https://x/a.png', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const loggedError = consoleErrorSpy.mock.calls[0][1] as Error;
    expect(loggedError.message).toBe('Bad request: invalid schema');
  });

  it('logs "OpenAI error (<status>)" when the error payload is not parseable', async () => {
    mockFetchError(503, async () => {
      throw new Error('response body is not JSON');
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await makeAnalyzer({ maxRetries: 0 }).classifyDocument('https://x/a.png', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    const loggedError = consoleErrorSpy.mock.calls[0][1] as Error;
    expect(loggedError.message).toBe('OpenAI error (503)');
  });

  it('retries up to maxRetries then gives up (fallback), calling fetch maxRetries+1 times', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    const result = await makeAnalyzer({ maxRetries: 2 }).classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('recovers if a later attempt succeeds within maxRetries', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) }) });

    const result = await makeAnalyzer({ maxRetries: 2 }).classifyDocument('https://x/a.png', 'image/png');

    expect(result).toEqual(SAMPLE_CLASSIFICATION);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('aborts the in-flight request via AbortController once timeoutMs elapses', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
    );

    const promise = makeAnalyzer({ timeoutMs: 50, maxRetries: 0 }).classifyDocument(
      'https://x/a.png',
      'image/png'
    );

    await jest.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    jest.useRealTimers();
  });
});

// ============================================================================
// buildVisionContent / guessMimeFromUrl — exercised via classifyDocument
// (explicit mimeType) and extractData (mimeType guessed from the URL)
// ============================================================================

describe('buildVisionContent', () => {
  it('adds an input_image entry for image mime types, using the plain fileUrl', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    await makeAnalyzer().classifyDocument('https://x/photo.png', 'image/jpeg');
    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content).toContainEqual({ type: 'input_image', image_url: 'https://x/photo.png' });
  });

  it('adds an input_file entry (base64 data URL) for application/pdf, fetched via fetchFileAsBase64', async () => {
    mockBucket('my-bucket', async () => [Buffer.from('PDF-BYTES')]);
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });

    await makeAnalyzer().classifyDocument(
      'https://storage.googleapis.com/my-bucket/invoices/doc.pdf',
      'application/pdf'
    );

    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    const expectedB64 = Buffer.from('PDF-BYTES').toString('base64');
    // The real filename is forwarded — it is a signal the model reads. Was
    // hardcoded to 'document.pdf'; changed deliberately (Giorgio, 2026-07-16).
    expect(content).toContainEqual({
      type: 'input_file',
      filename: 'doc.pdf',
      file_data: `data:application/pdf;base64,${expectedB64}`,
    });
  });

  it('falls back to "document.pdf" when the URL carries no filename segment', async () => {
    mockBucket('my-bucket', async () => [Buffer.from('PDF-BYTES')]);
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });

    await makeAnalyzer().classifyDocument('https://storage.googleapis.com/my-bucket/', 'application/pdf');

    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content).toContainEqual(
      expect.objectContaining({ type: 'input_file', filename: 'document.pdf' }),
    );
  });

  it('adds no image/file entry for other mime types — only the prompt text', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    await makeAnalyzer().classifyDocument('https://x/file.docx', 'application/octet-stream');
    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content).toEqual([{ type: 'input_text', text: 'Ταξινόμησε αυτό το παραστατικό.' }]);
  });
});

describe('guessMimeFromUrl (via extractData)', () => {
  it.each([
    ['https://x/receipt.jpg', 'input_image'],
    ['https://x/receipt.JPEG', 'input_image'],
    ['https://x/receipt.png', 'input_image'],
    ['https://x/receipt.webp', 'input_image'],
  ])('treats %s as an image and adds %s content', async (url, expectedType) => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });
    await makeAnalyzer().extractData(url, 'receipt');
    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content.some((entry: { type: string }) => entry.type === expectedType)).toBe(true);
  });

  it('treats a .pdf URL as application/pdf and fetches it from storage', async () => {
    mockBucket('my-bucket', async () => [Buffer.from('PDF-BYTES')]);
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });
    await makeAnalyzer().extractData('https://storage.googleapis.com/my-bucket/x.pdf', 'receipt');
    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content.some((entry: { type: string }) => entry.type === 'input_file')).toBe(true);
  });

  it('treats an unrecognized extension as application/octet-stream — no image/file content added', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });
    await makeAnalyzer().extractData('https://x/scan.tiff', 'receipt');
    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('input_text');
  });

  it('resolves a double extension by the LAST one — report.png.pdf is a PDF', async () => {
    // Was the reverse: substring `includes('.png')` matched first and won.
    // MIME resolution now goes through the ADR-296 registry, which reads the
    // trailing extension only. Fixed deliberately (Giorgio, 2026-07-16).
    mockBucket('my-bucket', async () => [Buffer.from('PDF-BYTES')]);
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });

    await makeAnalyzer().extractData('https://storage.googleapis.com/my-bucket/report.png.pdf', 'receipt');

    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content.some((entry: { type: string }) => entry.type === 'input_file')).toBe(true);
    expect(content.some((entry: { type: string }) => entry.type === 'input_image')).toBe(false);
  });

  it('ignores the query string when resolving the extension (signed storage URLs)', async () => {
    // A token like `?alt=media&token=a.b.c` ends in ".c" — substring probing
    // never saw it, but any trailing-extension parser must strip it first.
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });

    await makeAnalyzer().extractData('https://x/receipt.png?alt=media&token=a.b.c', 'receipt');

    const { options } = lastFetchCall();
    const content = JSON.parse(options.body).input[1].content;
    expect(content.some((entry: { type: string }) => entry.type === 'input_image')).toBe(true);
  });
});

// ============================================================================
// fetchFileAsBase64 — storage URL validation + decode
// ============================================================================

describe('fetchFileAsBase64 (via classifyDocument with mimeType=application/pdf)', () => {
  it('downloads the file at the decoded storage path and base64-encodes it', async () => {
    const fileFn = mockBucket('my-bucket', async () => [Buffer.from('hello world')]);
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });

    await makeAnalyzer().classifyDocument(
      'https://storage.googleapis.com/my-bucket/invoices/doc%201.pdf',
      'application/pdf'
    );

    expect(fileFn).toHaveBeenCalledWith('invoices/doc 1.pdf');
  });

  it('throws "Unexpected storage URL" for a URL outside the bucket prefix, surfacing as fallback classification', async () => {
    mockBucket('my-bucket', async () => [Buffer.from('x')]);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await makeAnalyzer().classifyDocument('https://evil.example.com/x.pdf', 'application/pdf');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(global.fetch).not.toHaveBeenCalled();
    const loggedError = consoleErrorSpy.mock.calls[0][1] as Error;
    expect(loggedError.message).toBe('Unexpected storage URL: https://evil.example.com/x.pdf');
  });
});

// ============================================================================
// classifyDocument / extractData — top-level orchestration + normalization
// ============================================================================

describe('classifyDocument', () => {
  it('defaults alternativeCategories to [] when the parsed payload omits it', async () => {
    mockFetchOk({
      output_text: JSON.stringify({
        documentType: 'receipt',
        suggestedCategory: 'fuel',
        typeConfidence: 50,
        categoryConfidence: 50,
      }),
    });
    const result = await makeAnalyzer().classifyDocument('https://x/a.png', 'image/png');
    expect(result.alternativeCategories).toEqual([]);
  });

  it('returns the fallback classification (not a throw) when the whole request pipeline fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('boom'));
    const result = await makeAnalyzer({ maxRetries: 0 }).classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
  });
});

describe('extractData', () => {
  it('returns the fallback extracted data (not a throw) when the whole request pipeline fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('boom'));
    const result = await makeAnalyzer({ maxRetries: 0 }).extractData('https://x/a.png', 'receipt');
    expect(result).toEqual(FALLBACK_EXTRACTED);
  });

  it('normalizeExtractedData: fills in every default when the parsed payload is empty', async () => {
    mockFetchOk({ output_text: JSON.stringify({}) });
    const result = await makeAnalyzer().extractData('https://x/a.png', 'receipt');
    expect(result).toEqual(FALLBACK_EXTRACTED);
  });

  it('normalizeExtractedData: null-coalesces missing lineItem fields and defaults netAmount to 0', async () => {
    mockFetchOk({
      output_text: JSON.stringify({
        netAmount: 50,
        lineItems: [{ description: 'Partial item' }],
      }),
    });
    const result = await makeAnalyzer().extractData('https://x/a.png', 'receipt');
    expect(result.netAmount).toBe(50);
    expect(result.lineItems).toEqual([
      { description: 'Partial item', quantity: null, unitPrice: null, netAmount: 0, vatRate: null },
    ]);
  });

  it('normalizeExtractedData: passes through a fully-populated payload unchanged', async () => {
    mockFetchOk({ output_text: JSON.stringify(SAMPLE_EXTRACTED) });
    const result = await makeAnalyzer().extractData('https://x/a.png', 'purchase_invoice');
    expect(result).toEqual(SAMPLE_EXTRACTED);
  });

  it('treats a non-array lineItems as absent, defaulting to []', async () => {
    mockFetchOk({
      output_text: JSON.stringify({ netAmount: 10, lineItems: 'not-an-array' }),
    });
    const result = await makeAnalyzer().extractData('https://x/a.png', 'receipt');
    expect(result.lineItems).toEqual([]);
  });
});

// ============================================================================
// categorizeExpense — Phase 1 stub, always null
// ============================================================================

describe('categorizeExpense', () => {
  it('always resolves null (vendor learning not implemented yet)', async () => {
    const result = await makeAnalyzer().categorizeExpense('123456789', 'κάποια περιγραφή');
    expect(result).toBeNull();
  });
});

// ============================================================================
// createOpenAIDocumentAnalyzer — factory / env wiring
// ============================================================================

describe('createOpenAIDocumentAnalyzer', () => {
  it('returns null when OPENAI_API_KEY is not set', () => {
    delete process.env.OPENAI_API_KEY;
    expect(createOpenAIDocumentAnalyzer()).toBeNull();
  });

  it('returns null when OPENAI_API_KEY is whitespace-only', () => {
    process.env.OPENAI_API_KEY = '   ';
    expect(createOpenAIDocumentAnalyzer()).toBeNull();
  });

  it('uses documented defaults when only OPENAI_API_KEY is set', async () => {
    process.env.OPENAI_API_KEY = 'env-key';
    delete process.env.OPENAI_API_BASE_URL;
    delete process.env.OPENAI_VISION_MODEL;
    delete process.env.OPENAI_MAX_RETRIES;

    const analyzer = createOpenAIDocumentAnalyzer();
    expect(analyzer).not.toBeNull();

    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    await analyzer?.classifyDocument('https://x/a.png', 'image/png');

    const { url, options } = lastFetchCall();
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.Authorization).toBe('Bearer env-key');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('default maxRetries is 2 (fetch called 3 times on persistent failure)', async () => {
    process.env.OPENAI_API_KEY = 'env-key';
    delete process.env.OPENAI_MAX_RETRIES;
    const analyzer = createOpenAIDocumentAnalyzer();

    (global.fetch as jest.Mock).mockRejectedValue(new Error('down'));
    const result = await analyzer?.classifyDocument('https://x/a.png', 'image/png');

    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('default timeoutMs is 30000 (aborts exactly at 30s, not before)', async () => {
    process.env.OPENAI_API_KEY = 'env-key';
    delete process.env.OPENAI_TIMEOUT_MS;
    // maxRetries pinned to 0 here so a single abort settles the promise —
    // default maxRetries is characterized separately above.
    process.env.OPENAI_MAX_RETRIES = '0';
    const analyzer = createOpenAIDocumentAnalyzer();

    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
    );

    const promise = analyzer?.classifyDocument('https://x/a.png', 'image/png');
    await jest.advanceTimersByTimeAsync(29999);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    jest.useRealTimers();
  });

  it('respects env overrides (base URL trimmed, custom model, custom maxRetries)', async () => {
    process.env.OPENAI_API_KEY = 'env-key';
    process.env.OPENAI_API_BASE_URL = '  https://custom.example.com/v1  ';
    process.env.OPENAI_VISION_MODEL = 'gpt-custom-vision';
    process.env.OPENAI_MAX_RETRIES = '0';
    const analyzer = createOpenAIDocumentAnalyzer();

    mockFetchOk({ output_text: JSON.stringify(SAMPLE_CLASSIFICATION) });
    await analyzer?.classifyDocument('https://x/a.png', 'image/png');

    const { url, options } = lastFetchCall();
    expect(url).toBe('https://custom.example.com/v1/responses');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-custom-vision');

    // maxRetries=0 override: a single failure gives up immediately (no retry).
    (global.fetch as jest.Mock).mockRejectedValue(new Error('down'));
    const result = await analyzer?.classifyDocument('https://x/a.png', 'image/png');
    expect(result).toEqual(FALLBACK_CLASSIFICATION);
    expect(global.fetch).toHaveBeenCalledTimes(2); // 1 from above + 1 here
  });
});
