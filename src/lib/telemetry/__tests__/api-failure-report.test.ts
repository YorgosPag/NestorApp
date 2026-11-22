/**
 * @jest-environment node
 */
/**
 * ADR-327 §7.5 — «ποιος απάντησε;». Ο δρόμος είναι ο αληθινός: πραγματικό `Response` → `fetchJson` → `ApiClientError`
 * → `classifyApiFailure`. Αν το `fetchJson` ξαναπάψει να κρατά το `response`, το `envelope` χάνεται και το Κ1/Κ2 κοκκινίζουν.
 */

const mockCaptureMessage = jest.fn();
jest.mock('../sentry', () => ({ captureMessage: (...args: unknown[]) => mockCaptureMessage(...args) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { fetchJson } from '@/lib/api/fetch-json';
import { classifyApiFailure, reportApiFailure } from '../api-failure-report';
/* eslint-enable import/first */

const realFetch = global.fetch;

function respondWith(response: Response): void {
  global.fetch = jest.fn(async () => response) as unknown as typeof fetch;
}

async function failureOf(response: Response): Promise<unknown> {
  respondWith(response);
  return fetchJson('/api/rfqs/rfq_1/invites/preview').catch((cause: unknown) => cause);
}

afterEach(() => {
  global.fetch = realFetch;
  mockCaptureMessage.mockReset();
});

describe('classifyApiFailure', () => {
  it('Κ1 — σώμα JSON ⇒ απάντησε ο server μας, με status και κωδικό', async () => {
    const cause = await failureOf(new Response(JSON.stringify({ error: 'busy', errorCode: 'WORKSPACE_UNAVAILABLE' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }));
    expect(classifyApiFailure(cause)).toEqual({
      kind: 'http', status: 503, errorCode: 'WORKSPACE_UNAVAILABLE', envelope: 'json',
    });
  });

  it('Κ2 — σώμα που δεν είναι JSON ⇒ ενδιάμεσος (proxy) ή κατάρρευση πριν τον χειριστή', async () => {
    const cause = await failureOf(new Response('no available server', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    }));
    expect(classifyApiFailure(cause)).toEqual({ kind: 'http', status: 503, errorCode: undefined, envelope: 'none' });
  });

  it('Κ3 — δεν ήρθε απάντηση (`fetch` πετά TypeError) ⇒ network, χωρίς status', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const cause = await fetchJson('/api/x').catch((e: unknown) => e);
    expect(classifyApiFailure(cause)).toEqual({ kind: 'network' });
  });

  it('Κ4 — οτιδήποτε άλλο ⇒ unexpected', () => {
    expect(classifyApiFailure(new Error('rfq-invite-preview: response without data'))).toEqual({ kind: 'unexpected' });
    expect(classifyApiFailure('string')).toEqual({ kind: 'unexpected' });
  });
});

describe('reportApiFailure', () => {
  it('Κ5 — στέλνει στο Sentry warning με ετικέτες, χωρίς σώμα απόκρισης', async () => {
    const cause = await failureOf(new Response('<html>Bad Gateway</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    }));
    reportApiFailure('rfq-invite-preview', cause);

    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [message, level, context] = mockCaptureMessage.mock.calls[0] as [string, string, { tags: Record<string, string>; extra?: unknown }];
    expect(message).toBe('API failure: rfq-invite-preview 502 (none)');
    expect(level).toBe('warning');
    expect(context.tags).toEqual({ operation: 'rfq-invite-preview', kind: 'http', status: '502', envelope: 'none' });
    expect(JSON.stringify(context)).not.toContain('Bad Gateway');
  });

  it('Κ6 — αποτυχία δικτύου: ετικέτα kind, χωρίς status', () => {
    reportApiFailure('rfq-invite-preview', new TypeError('Failed to fetch'));
    const [message, , context] = mockCaptureMessage.mock.calls[0] as [string, string, { tags: Record<string, string> }];
    expect(message).toBe('API failure: rfq-invite-preview network');
    expect(context.tags).toEqual({ operation: 'rfq-invite-preview', kind: 'network' });
  });
});
