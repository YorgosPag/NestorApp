/**
 * @jest-environment node
 *
 * ADR-905 §6 — η πόρτα των εσωτερικών webhooks: υπογραφή ΠΡΙΝ από κάθε ανάλυση, κωδικοί που λένε στον trigger
 * αν να ξαναδοκιμάσει.
 */

import { NextRequest, NextResponse } from 'next/server';

import { INTERNAL_WEBHOOK_SIGNATURE_HEADER, signInternalWebhook } from '@/lib/webhooks/internal-webhook-signature';
import { INTERNAL_WEBHOOK_PREVIOUS_SECRET_ENV, INTERNAL_WEBHOOK_SECRET_ENV, withSignedInternalWebhook } from '../signed-webhook-door';

const SECRET = 's'.repeat(64);
const URL = 'https://app.example/api/internal/conveyance/dependency-changed';

function request(body: string, header: string | null): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (header !== null) headers[INTERNAL_WEBHOOK_SIGNATURE_HEADER] = header;
  return new NextRequest(URL, { method: 'POST', body, headers });
}

const signed = (body: string, secret = SECRET) => signInternalWebhook([secret], body, Math.floor(Date.now() / 1000));

/** Κατάσκοπος πάνω στο **πραγματικό** σύνορο ιδεμποτίας: «έφτασε ως εκεί το αίτημα;». */
const mockIdempotencyReached = jest.fn();
jest.mock('@/lib/api/idempotency/with-idempotency', () => {
  const actual = jest.requireActual('@/lib/api/idempotency/with-idempotency');
  return {
    ...actual,
    runIdempotently: (...args: unknown[]) => {
      mockIdempotencyReached();
      return actual.runIdempotently(...args);
    },
  };
});

const MINUTE = 60_000;
const ROOMY = { limit: 1000, windowMs: MINUTE } as const;

const handler = jest.fn(async (_body: unknown) => NextResponse.json({ ok: true }));
const door = withSignedInternalWebhook({ source: 'test', quota: ROOMY }, handler);

/** Κάθε περίπτωση ρυθμού παίρνει **δική της** πηγή: ο κάδος ζει στον store της διεργασίας. */
let sourceSeq = 0;
const freshSource = () => `quota-test-${++sourceSeq}`;
const BODY = '{"eventId":"e-quota"}';
const send = (target: ReturnType<typeof withSignedInternalWebhook>, header = signed(BODY)) => target(request(BODY, header));
const statuses = async (target: ReturnType<typeof withSignedInternalWebhook>, times: number): Promise<number[]> => {
  const seen: number[] = [];
  for (let i = 0; i < times; i++) seen.push((await send(target)).status);
  return seen;
};

beforeEach(() => {
  handler.mockClear();
  process.env[INTERNAL_WEBHOOK_SECRET_ENV] = SECRET;
  delete process.env[INTERNAL_WEBHOOK_PREVIOUS_SECRET_ENV];
});

describe('withSignedInternalWebhook', () => {
  it('έγκυρη υπογραφή ⇒ ο handler παίρνει το αναλυμένο σώμα', async () => {
    const body = JSON.stringify({ eventId: 'e1' });
    const response = await door(request(body, signed(body)));
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith({ eventId: 'e1' });
  });

  it('πλαστή υπογραφή ⇒ 401 και ο handler ΔΕΝ τρέχει (καμία ανάγνωση βάσης)', async () => {
    const body = JSON.stringify({ eventId: 'e1' });
    const response = await door(request(body, signed(body, 'x'.repeat(64))));
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('χωρίς υπογραφή ⇒ 401', async () => {
    expect((await door(request('{}', null))).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('λείπει το μυστικό ΕΔΩ ⇒ 503 (ο trigger ξαναδοκιμάζει ώσπου να ρυθμιστεί — τίποτα δεν χάνεται)', async () => {
    delete process.env[INTERNAL_WEBHOOK_SECRET_ENV];
    const body = '{}';
    expect((await door(request(body, signed(body)))).status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it('περιστροφή: υπογραφή με το ΠΡΟΗΓΟΥΜΕΝΟ κλειδί γίνεται δεκτή όσο είναι δηλωμένο', async () => {
    const previous = 'p'.repeat(64);
    process.env[INTERNAL_WEBHOOK_PREVIOUS_SECRET_ENV] = previous;
    const body = '{"eventId":"e2"}';
    expect((await door(request(body, signed(body, previous)))).status).toBe(200);
  });

  it('υπογεγραμμένο αλλά όχι JSON ⇒ 400 (δεν θα γίνει ποτέ έγκυρο — καμία επανάληψη)', async () => {
    const body = 'not-json';
    expect((await door(request(body, signed(body)))).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ο handler πετά ⇒ 500 (ο trigger ξαναδοκιμάζει)', async () => {
    handler.mockRejectedValueOnce(new Error('boom'));
    const body = '{}';
    expect((await door(request(body, signed(body)))).status).toBe(500);
  });
});

describe('ADR-905 §8 Ε3 — προϋπολογισμός ανά ΠΗΓΗ, μετά την υπογραφή', () => {
  it('enforce: πέρα από το όριο ⇒ 429 + Retry-After, ο handler ΔΕΝ τρέχει και η ιδεμποτία ΔΕΝ αγγίζεται', async () => {
    const strict = withSignedInternalWebhook({ source: freshSource(), quota: { limit: 2, windowMs: MINUTE } }, handler);
    expect(await statuses(strict, 2)).toEqual([200, 200]);
    mockIdempotencyReached.mockClear();
    const refused = await send(strict);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('60');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(mockIdempotencyReached).not.toHaveBeenCalled();
  });

  it('shadow: η υπέρβαση καταγράφεται αλλά ΔΕΝ αρνείται', async () => {
    const shadow = withSignedInternalWebhook({ source: freshSource(), quota: { limit: 1, windowMs: MINUTE, enforcement: 'shadow' } }, handler);
    expect(await statuses(shadow, 3)).toEqual([200, 200, 200]);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('πλαστή υπογραφή ΔΕΝ καταναλώνει τον κάδο της πηγής (αλλιώς ο ανώνυμος θα έκοβε τον δικό μας καλούντα)', async () => {
    const strict = withSignedInternalWebhook({ source: freshSource(), quota: { limit: 1, windowMs: MINUTE } }, handler);
    const forged = signed(BODY, 'x'.repeat(64));
    for (let i = 0; i < 5; i++) expect((await send(strict, forged)).status).toBe(401);
    expect((await send(strict)).status).toBe(200);
  });

  it('δύο πηγές ⇒ δύο κάδοι: η εξάντληση της μίας δεν αγγίζει την άλλη', async () => {
    const quota = { limit: 1, windowMs: MINUTE } as const;
    const first = withSignedInternalWebhook({ source: freshSource(), quota }, handler);
    const second = withSignedInternalWebhook({ source: freshSource(), quota }, handler);
    expect(await statuses(first, 2)).toEqual([200, 429]);
    expect((await send(second)).status).toBe(200);
  });
});
