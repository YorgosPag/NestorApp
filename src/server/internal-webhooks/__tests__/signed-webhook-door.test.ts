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

const handler = jest.fn(async (_body: unknown) => NextResponse.json({ ok: true }));
const door = withSignedInternalWebhook({ source: 'test' }, handler);

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
