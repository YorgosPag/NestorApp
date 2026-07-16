/**
 * @jest-environment node
 *
 * CHARACTERIZATION TESTS — POST /api/dxf/text/ai/command (ADR-344 Phase 12)
 *
 * Written BEFORE the ADR-294 migration of this route onto the Responses SSoT,
 * to pin the behaviour the migration must preserve exactly.
 *
 * The load-bearing case is the timeout → **504 `ai_timeout`** split from
 * **502 `ai_error`**. The route decides between them with
 * `message.includes('abort')`. Today the timeout arrives as an `AbortError`
 * ("This operation was aborted"); after the migration it arrives as a
 * `TimeoutError` ("The operation was aborted due to timeout"). Both strings
 * contain "abort", so the split survives — these tests are what keeps that
 * true if the SSoT's timeout mechanism is ever changed again.
 *
 * `withAuth` / `withHeavyRateLimit` are stubbed to pass-through: this suite is
 * about the AI call, not the auth and rate-limit gates (both covered by their
 * own suites).
 *
 * @see ADR-344 — DXF Text Engine AI
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 */

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/auth', () => ({
  withAuth: (handler: unknown) => (request: unknown) =>
    (handler as (r: unknown, a: unknown, c: unknown) => unknown)(
      request,
      { uid: 'test-uid', companyId: 'test-co' },
      {},
    ),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHeavyRateLimit: (handler: unknown) => handler,
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import type { NextRequest } from 'next/server';

const mockFetch = jest.fn();
global.fetch = mockFetch;

interface CommandBody {
  success: boolean;
  intent?: { command: string };
  error?: string;
}

/** Minimal NextRequest stand-in — the route only ever calls `.json()`. */
function makeRequest(body: unknown, malformed = false): NextRequest {
  return {
    json: async () => {
      if (malformed) throw new Error('Unexpected token');
      return body;
    },
  } as unknown as NextRequest;
}

const VALID_INTENT = { command: 'setHeight', value: 2.5 };

function okResponse(outputText: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: outputText }),
    text: async () => JSON.stringify({ output_text: outputText }),
  };
}

describe('POST /api/dxf/text/ai/command', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';

    const mod = require('../route') as { POST: typeof POST };
    POST = mod.POST;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  // ── Request validation ──

  it('returns 400 invalid_body when the payload is not JSON', async () => {
    const res = await POST(makeRequest(null, true));

    expect(res.status).toBe(400);
    expect(((await res.json()) as CommandBody).error).toBe('invalid_body');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 text_required when text is missing', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(((await res.json()) as CommandBody).error).toBe('text_required');
  });

  it('returns 400 text_required when text is blank', async () => {
    const res = await POST(makeRequest({ text: '   ' }));

    expect(res.status).toBe(400);
    expect(((await res.json()) as CommandBody).error).toBe('text_required');
  });

  it('returns 503 ai_unavailable when the API key is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await POST(makeRequest({ text: 'κάνε το κείμενο μεγαλύτερο' }));

    expect(res.status).toBe(503);
    expect(((await res.json()) as CommandBody).error).toBe('ai_unavailable');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Success ──

  it('returns the parsed intent on a valid AI response', async () => {
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_INTENT)));

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));
    const body = (await res.json()) as CommandBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.intent).toEqual(VALID_INTENT);
  });

  it('POSTs to {baseUrl}/responses with a strict json_schema format', async () => {
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_INTENT)));

    await POST(makeRequest({ text: 'ύψος 2.5' }));

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/responses$/);
    expect(init.method).toBe('POST');

    const sent = JSON.parse(init.body as string) as {
      input: Array<{ role: string }>;
      text: { format: { type: string; strict: boolean } };
    };
    expect(sent.input.map(m => m.role)).toEqual(['system', 'user']);
    expect(sent.text.format.type).toBe('json_schema');
    expect(sent.text.format.strict).toBe(true);
  });

  it('trims the incoming text before sending it', async () => {
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_INTENT)));

    await POST(makeRequest({ text: '  ύψος 2.5  ' }));

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as {
      input: Array<{ content: Array<{ text: string }> }>;
    };
    expect(sent.input[1].content[0].text).toBe('ύψος 2.5');
  });

  // ── Failure mapping ──

  it('returns 502 ai_error on a non-OK OpenAI status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":{"message":"Rate limit reached"}}',
      json: async () => ({ error: { message: 'Rate limit reached' } }),
    });

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(502);
    expect(((await res.json()) as CommandBody).error).toBe('ai_error');
  });

  it('returns 502 ai_error when the AI response carries no output text', async () => {
    mockFetch.mockResolvedValue(okResponse(''));

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(502);
    expect(((await res.json()) as CommandBody).error).toBe('ai_error');
  });

  it('returns 502 ai_error when the intent shape is invalid (no command)', async () => {
    mockFetch.mockResolvedValue(okResponse(JSON.stringify({ value: 2.5 })));

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(502);
    expect(((await res.json()) as CommandBody).error).toBe('ai_error');
  });

  it('returns 502 ai_error when the output text is not JSON', async () => {
    mockFetch.mockResolvedValue(okResponse('not json at all'));

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(502);
    expect(((await res.json()) as CommandBody).error).toBe('ai_error');
  });

  // ── The timeout split (the migration's real risk) ──

  it('returns 504 ai_timeout on an AbortError (hand-rolled AbortController)', async () => {
    mockFetch.mockRejectedValue(
      new DOMException('This operation was aborted', 'AbortError'),
    );

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(504);
    expect(((await res.json()) as CommandBody).error).toBe('ai_timeout');
  });

  it('returns 504 ai_timeout on a TimeoutError (AbortSignal.timeout)', async () => {
    mockFetch.mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    );

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(504);
    expect(((await res.json()) as CommandBody).error).toBe('ai_timeout');
  });

  it('returns 502 ai_error on a plain network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    const res = await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(res.status).toBe(502);
    expect(((await res.json()) as CommandBody).error).toBe('ai_error');
  });

  it('issues exactly one request — this route does not retry', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'upstream down',
      json: async () => ({}),
    });

    await POST(makeRequest({ text: 'ύψος 2.5' }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
