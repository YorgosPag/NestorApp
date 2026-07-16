/**
 * CHARACTERIZATION TESTS — relationship-type AI inference (ADR-336)
 *
 * Written BEFORE the ADR-294 migration of this module onto the Responses SSoT,
 * to pin the behaviour the migration must preserve exactly:
 *  - deterministic fallback whenever the key is absent, the API errors, the
 *    output is empty/unparseable, or the category is not in the catalog
 *  - `aiBacked` flag discipline (true only on a fully validated AI result)
 *  - the wire request shape (model, `/responses` URL, json_schema format)
 *  - never throws — every failure path yields the fallback
 *
 * @see ADR-336 — Self-extending relationship taxonomy
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 */

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import type { RelationshipInferenceInput } from '../relationship-type-ai-inference';

const mockFetch = jest.fn();
global.fetch = mockFetch;

/** A non-OK response. `text()` mirrors a real `Response`'s raw body. */
function errorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function okResponse(outputText: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: outputText }),
    text: async () => JSON.stringify({ output_text: outputText }),
  };
}

const VALID_AI_PAYLOAD = {
  labelEn: 'Architect',
  reverseLabelEl: 'Πελάτης',
  reverseLabelEn: 'Client',
  category: 'professional',
};

const BASIC_INPUT: RelationshipInferenceInput = { labelEl: 'Αρχιτέκτονας' };

describe('inferRelationshipTypeAttributes', () => {
  let inferRelationshipTypeAttributes:
    typeof import('../relationship-type-ai-inference').inferRelationshipTypeAttributes;

  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';

    const mod = require('../relationship-type-ai-inference') as typeof import('../relationship-type-ai-inference');
    inferRelationshipTypeAttributes = mod.inferRelationshipTypeAttributes;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TEXT_MODEL;
    delete process.env.OPENAI_API_BASE_URL;
  });

  // ── Fallback paths ──

  it('falls back deterministically when OPENAI_API_KEY is absent, without calling the API', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result).toEqual({
      labelEn: 'Αρχιτέκτονας',
      reverseLabelEl: 'Αρχιτέκτονας (αντίστροφο)',
      reverseLabelEn: 'Αρχιτέκτονας (αντίστροφο)',
      category: 'professional',
      aiBacked: false,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('honours a user-supplied reverse label in the fallback', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await inferRelationshipTypeAttributes({
      labelEl: 'Αρχιτέκτονας',
      reverseLabelEl: 'Πελάτης',
    });

    expect(result.reverseLabelEl).toBe('Πελάτης');
    expect(result.aiBacked).toBe(false);
  });

  it('falls back when the API returns a non-OK status', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(429, { error: { message: 'Rate limit reached' } }),
    );

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.aiBacked).toBe(false);
    expect(result.labelEn).toBe('Αρχιτέκτονας');
  });

  it('falls back when the response carries no output text', async () => {
    mockFetch.mockResolvedValue(okResponse(''));

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.aiBacked).toBe(false);
  });

  it('falls back when the output text is not valid JSON', async () => {
    mockFetch.mockResolvedValue(okResponse('this is not json'));

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.aiBacked).toBe(false);
  });

  it('falls back when the AI returns a category outside the catalog', async () => {
    mockFetch.mockResolvedValue(
      okResponse(JSON.stringify({ ...VALID_AI_PAYLOAD, category: 'invented-bucket' })),
    );

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.aiBacked).toBe(false);
    expect(result.category).toBe('professional');
  });

  it('falls back — never throws — when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.aiBacked).toBe(false);
  });

  // ── Success path ──

  it('returns the AI result with aiBacked=true on a valid response', async () => {
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_AI_PAYLOAD)));

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result).toEqual({
      labelEn: 'Architect',
      reverseLabelEl: 'Πελάτης',
      reverseLabelEn: 'Client',
      category: 'professional',
      aiBacked: true,
    });
  });

  it('reads output from the structured output[].content[] shape', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(VALID_AI_PAYLOAD) }],
          },
        ],
      }),
      text: async () => '',
    });

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.aiBacked).toBe(true);
    expect(result.labelEn).toBe('Architect');
  });

  it('substitutes defaults for blank AI fields', async () => {
    mockFetch.mockResolvedValue(
      okResponse(
        JSON.stringify({
          labelEn: '  ',
          reverseLabelEl: '  ',
          reverseLabelEn: '  ',
          category: 'professional',
        }),
      ),
    );

    const result = await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(result.labelEn).toBe('Αρχιτέκτονας');
    expect(result.reverseLabelEl).toBe('Αρχιτέκτονας (αντίστροφο)');
    expect(result.aiBacked).toBe(true);
  });

  // ── Wire contract ──

  it('POSTs to {baseUrl}/responses with the model and json_schema format', async () => {
    process.env.OPENAI_TEXT_MODEL = 'gpt-4o-mini';
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_AI_PAYLOAD)));

    await inferRelationshipTypeAttributes(BASIC_INPUT);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const body = JSON.parse(init.body as string) as {
      model: string;
      input: Array<{ role: string }>;
      text: { format: { type: string; name: string } };
    };
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.input.map(m => m.role)).toEqual(['system', 'user']);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.name).toBe('relationship_type_inference');
  });

  it('passes the user-supplied reverse label into the prompt', async () => {
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_AI_PAYLOAD)));

    await inferRelationshipTypeAttributes({
      labelEl: 'Αρχιτέκτονας',
      reverseLabelEl: 'Πελάτης',
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body as string).toContain('Πελάτης');
  });

  it('honours a custom base URL', async () => {
    process.env.OPENAI_API_BASE_URL = 'https://proxy.internal/v1';
    mockFetch.mockResolvedValue(okResponse(JSON.stringify(VALID_AI_PAYLOAD)));

    await inferRelationshipTypeAttributes(BASIC_INPUT);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('https://proxy.internal/v1/responses');
  });

  it('issues exactly one request — this call site does not retry', async () => {
    mockFetch.mockResolvedValue(errorResponse(503, {}));

    await inferRelationshipTypeAttributes(BASIC_INPUT);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
