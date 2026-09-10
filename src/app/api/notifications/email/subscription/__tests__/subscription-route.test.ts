/**
 * @jest-environment node
 *
 * Άγκυρα — **Η ΔΙΑΓΡΑΦΗ ΕΝΟΣ ΚΛΙΚ (RFC 8058)** (ADR-848)
 *
 * Εκτελείται ο **αληθινός** handler με **αληθινό** υπογεγραμμένο token. Mock γίνονται
 * μόνο ο ρυθμιστής ρυθμού (Redis) και ο συγγραφέας (Firestore) — αν γινόταν mock ο
 * έλεγχος του token, η άγκυρα θα δοκίμαζε τον εαυτό της.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withWebhookRateLimit: <T>(handler: T): T => handler,
}));

const mockApply = jest.fn();
jest.mock('@/server/notifications/email-subscription', () => ({
  applyEmailSubscriptionChange: (...args: unknown[]) => mockApply(...args),
}));

import { NextRequest } from 'next/server';

import * as route from '@/app/api/notifications/email/subscription/route';
import { emailOneClickHref } from '@/lib/notifications/email-subscription-routes';
import {
  EMAIL_SUBSCRIPTION_SECRET_ENV,
  issueEmailSubscriptionToken,
} from '@/services/notifications/email-subscription-token.service';

const ORIGINAL = process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];
const STATE_ON = { emailEnabled: true, emailFrequency: 'realtime' } as const;
const STATE_OFF = { emailEnabled: false, emailFrequency: 'realtime' } as const;

beforeEach(() => {
  process.env[EMAIL_SUBSCRIPTION_SECRET_ENV] = 'route-secret';
  mockApply.mockReset().mockResolvedValue({ previous: STATE_ON, current: STATE_OFF });
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];
  else process.env[EMAIL_SUBSCRIPTION_SECRET_ENV] = ORIGINAL;
});

function tokenFor(uid: string): string {
  const token = issueEmailSubscriptionToken(uid);
  if (token === null) throw new Error('Δεν εκδόθηκε token — η άγκυρα δεν κοίταξε τίποτα.');
  return token;
}

function post(token: string, init: { contentType: string; body: string }): NextRequest {
  return new NextRequest(`https://nestorconstruct.gr${emailOneClickHref(token)}`, {
    method: 'POST',
    headers: { 'content-type': init.contentType },
    body: init.body,
  });
}

const ONE_CLICK = { contentType: 'application/x-www-form-urlencoded', body: 'List-Unsubscribe=One-Click' };

describe('Α — το πρόγραμμα email (RFC 8058)', () => {
  it('Α1 🔑 — το ακριβές σώμα του RFC ⇒ διαγραφή του ΣΩΣΤΟΥ χρήστη', async () => {
    const response = await route.POST(post(tokenFor('u1'), ONE_CLICK));

    expect(response.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith('u1', { kind: 'unsubscribe' });
  });

  it('Α2 🔴 — ΑΔΕΙΟ POST ΔΕΝ διαγράφει (αλλιώς ο σαρωτής που κάνει POST θα διέγραφε)', async () => {
    const response = await route.POST(
      post(tokenFor('u1'), { contentType: 'application/x-www-form-urlencoded', body: '' }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: 'request-invalid' });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('Α3 🔴 — ΚΑΝΕΝΑ GET: ο Next απαντά 405, ο σαρωτής δεν αλλάζει τίποτα', () => {
    expect('GET' in route).toBe(false);
  });
});

describe('Β — η σελίδα προτιμήσεων (JSON)', () => {
  it('Β1 — αναίρεση: η κατάσταση ταξιδεύει ελεγμένη', async () => {
    await route.POST(
      post(tokenFor('u1'), {
        contentType: 'application/json',
        body: JSON.stringify({ change: { kind: 'restore', state: STATE_ON } }),
      }),
    );
    expect(mockApply).toHaveBeenCalledWith('u1', { kind: 'restore', state: STATE_ON });
  });

  it('Β2 — η απάντηση φέρει previous + current (το εισιτήριο της αναίρεσης)', async () => {
    const response = await route.POST(
      post(tokenFor('u1'), { contentType: 'application/json', body: JSON.stringify({ change: { kind: 'daily' } }) }),
    );
    expect(await response.json()).toEqual({ ok: true, previous: STATE_ON, current: STATE_OFF });
  });
});

describe('Γ — αρνήσεις με όνομα', () => {
  it('Γ1 — πλαστό token ⇒ 400 link-invalid, καμία εγγραφή', async () => {
    const response = await route.POST(post('forged-token', ONE_CLICK));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: 'link-invalid' });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('Γ2 — λείπει το μυστικό ⇒ 503 (φταίμε εμείς, όχι ο σύνδεσμος)', async () => {
    const token = tokenFor('u1');
    delete process.env[EMAIL_SUBSCRIPTION_SECRET_ENV];
    const response = await route.POST(post(token, ONE_CLICK));
    expect(response.status).toBe(503);
  });

  it('Γ3 — αποτυχία εγγραφής ⇒ 500 write-failed, ΠΟΤΕ «πέτυχε»', async () => {
    mockApply.mockRejectedValue(new Error('firestore down'));
    const response = await route.POST(post(tokenFor('u1'), ONE_CLICK));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, reason: 'write-failed' });
  });
});
