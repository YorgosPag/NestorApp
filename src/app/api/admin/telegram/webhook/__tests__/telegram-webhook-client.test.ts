/**
 * Unit tests for `telegram-webhook-client.ts` — ADR-705 split.
 *
 * Verifies the Telegram Bot API webhook-management SSoT:
 *   - callTelegramApi builds the correct URL + JSON body and returns the raw envelope
 *   - fail-safe branches: missing bot token (no fetch) and fetch rejection (never throws)
 *   - getWebhookInfo / setWebhook / deleteWebhook target the right methods/bodies
 *   - buildSetWebhookParams defaults + optional-flag omission (byte-for-byte with old route)
 *   - getDefaultWebhookUrl env precedence (explicit → Vercel fallback → null)
 *
 * The module captures `TELEGRAM_BOT_TOKEN` at load time, so token scenarios use
 * `jest.resetModules()` + dynamic import via `loadClient()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-705-telegram-webhook-admin-split.md
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

const ORIGINAL_FETCH = global.fetch;
const ENV_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_URL', 'VERCEL_URL'] as const;
const savedEnv: Record<string, string | undefined> = {};

/** Resolve a Response-like object exposing only what the client reads (`json()`). */
function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
}

/** Reset modules with a given (or absent) bot token and import a fresh client instance. */
async function loadClient(token?: string) {
  jest.resetModules();
  if (token === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = token;
  }
  return import('../telegram-webhook-client');
}

beforeEach(() => {
  ENV_KEYS.forEach((k) => { savedEnv[k] = process.env[k]; });
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = savedEnv[k];
    }
  });
  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

// =============================================================================
// callTelegramApi + typed operations
// =============================================================================

describe('callTelegramApi', () => {
  it('POSTs to the correct Bot API URL with a JSON body and returns the raw envelope', async () => {
    const fetchMock = jest.fn().mockReturnValue(jsonResponse({ ok: true, result: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { setWebhook } = await loadClient('BOT123');
    const res = await setWebhook({
      url: 'https://e.gr/hook',
      secret_token: 's3cr3t',
      allowed_updates: ['message'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botBOT123/setWebhook');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://e.gr/hook',
      secret_token: 's3cr3t',
      allowed_updates: ['message'],
    });
    expect(res).toEqual({ ok: true, result: true });
  });

  it('sends no body for parameterless calls (getWebhookInfo)', async () => {
    const fetchMock = jest.fn().mockReturnValue(jsonResponse({ ok: true, result: { url: 'x' } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getWebhookInfo } = await loadClient('BOT');
    await getWebhookInfo();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botBOT/getWebhookInfo');
    expect(init.body).toBeUndefined();
  });

  it('returns a fail envelope (and never calls fetch) when the bot token is missing', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getWebhookInfo } = await loadClient(undefined);
    const res = await getWebhookInfo();

    expect(res).toEqual({ ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('catches fetch rejection and returns a fail envelope (never throws)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const { getWebhookInfo } = await loadClient('BOT');
    const res = await getWebhookInfo();

    expect(res.ok).toBe(false);
    expect(res.description).toContain('network down');
  });
});

describe('deleteWebhook', () => {
  it('posts the drop_pending_updates flag to the deleteWebhook method', async () => {
    const fetchMock = jest.fn().mockReturnValue(jsonResponse({ ok: true, result: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { deleteWebhook } = await loadClient('BOT');
    await deleteWebhook(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botBOT/deleteWebhook');
    expect(JSON.parse(init.body as string)).toEqual({ drop_pending_updates: true });
  });

  it('defaults to keeping pending updates (drop_pending_updates=false)', async () => {
    const fetchMock = jest.fn().mockReturnValue(jsonResponse({ ok: true, result: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { deleteWebhook } = await loadClient('BOT');
    await deleteWebhook();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ drop_pending_updates: false });
  });
});

// =============================================================================
// buildSetWebhookParams — pure (byte-for-byte with the pre-split route)
// =============================================================================

describe('buildSetWebhookParams', () => {
  it('defaults allowed_updates and omits optional flags', async () => {
    const { buildSetWebhookParams } = await loadClient('BOT');
    expect(buildSetWebhookParams('https://e.gr/h', 'secret', {})).toEqual({
      url: 'https://e.gr/h',
      secret_token: 'secret',
      allowed_updates: ['message', 'callback_query'],
    });
  });

  it('includes drop_pending_updates and max_connections when truthy', async () => {
    const { buildSetWebhookParams } = await loadClient('BOT');
    expect(
      buildSetWebhookParams('u', 's', {
        drop_pending_updates: true,
        max_connections: 40,
        allowed_updates: ['message'],
      }),
    ).toEqual({
      url: 'u',
      secret_token: 's',
      allowed_updates: ['message'],
      drop_pending_updates: true,
      max_connections: 40,
    });
  });

  it('omits max_connections when 0 (falsy) — preserves old route behavior', async () => {
    const { buildSetWebhookParams } = await loadClient('BOT');
    const params = buildSetWebhookParams('u', 's', { max_connections: 0 });
    expect(params.max_connections).toBeUndefined();
  });
});

// =============================================================================
// getDefaultWebhookUrl — env precedence
// =============================================================================

describe('getDefaultWebhookUrl', () => {
  it('prefers the explicit TELEGRAM_WEBHOOK_URL', async () => {
    process.env.TELEGRAM_WEBHOOK_URL = 'https://explicit.gr/hook';
    process.env.VERCEL_URL = 'preview.vercel.app';
    const { getDefaultWebhookUrl } = await loadClient('BOT');
    expect(getDefaultWebhookUrl()).toBe('https://explicit.gr/hook');
  });

  it('falls back to VERCEL_URL when no explicit URL is set', async () => {
    delete process.env.TELEGRAM_WEBHOOK_URL;
    process.env.VERCEL_URL = 'preview.vercel.app';
    const { getDefaultWebhookUrl } = await loadClient('BOT');
    expect(getDefaultWebhookUrl()).toBe(
      'https://preview.vercel.app/api/communications/webhooks/telegram',
    );
  });

  it('returns null when neither env var is configured', async () => {
    delete process.env.TELEGRAM_WEBHOOK_URL;
    delete process.env.VERCEL_URL;
    const { getDefaultWebhookUrl } = await loadClient('BOT');
    expect(getDefaultWebhookUrl()).toBeNull();
  });
});
