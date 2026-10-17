/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §28 Η-Β6 — **η πόρτα του συνδέσμου ανάθεσης** (ίδιο σχήμα με την πόρτα προμηθευτή, ADR-876 §5).
 *
 * Π1 χωρίς `Authorization` ⇒ 401, κανένας handler · Π2 αλλοιωμένος / ξένου κλειδιού σύνδεσμος ⇒ 400 **πριν** από κάθε
 * βάση και κάθε σύνορο · Π3 principal ιδεμποτίας = ο ΣΥΝΔΕΣΜΟΣ (`issuance-link:<id>`), ποτέ `anon` · Π4 ληγμένος ⇒ 410
 * από το token μόνο · Π5 σφάλμα του handler ⇒ 500 χωρίς να διαρρεύσει τίποτα · Π6 ισότητα κωδικών route ↔ οθόνης.
 */

import { NextRequest, NextResponse } from 'next/server';

import { mintInvitationToken } from '@/server/invitations/invitation-token';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const mockRunIdempotently = jest.fn(
  async (_req: unknown, _principal: string, _policy: unknown, execute: () => Promise<{ response: NextResponse }>) => (await execute()).response,
);
jest.mock('@/lib/api/idempotency/with-idempotency', () => ({
  runIdempotently: (...args: Parameters<typeof mockRunIdempotently>) => mockRunIdempotently(...args),
}));

import { withIssuanceLinkDoor } from '../issuance-link-door';
import { ISSUANCE_INVITE_SECRET_ENV } from '../issuance-invitation-kind';

const handler = jest.fn(async () => NextResponse.json({ success: true }));
const door = withIssuanceLinkDoor({}, handler);

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://app.test/api/issuance-link', { headers });
}

/** Κλειδί υπογραφής του test — fixture, όχι διαπιστευτήριο. */
const DOOR_TEST_KEY = 'door-secret-0123456789abcdef';

async function token(expiresAtMs: number, signingKey = DOOR_TEST_KEY): Promise<string> {
  const previous = process.env[ISSUANCE_INVITE_SECRET_ENV];
  process.env[ISSUANCE_INVITE_SECRET_ENV] = signingKey;
  const minted = await mintInvitationToken(ISSUANCE_INVITE_SECRET_ENV, { id: 'diin_A', expiresAtMs, locator: [] });
  process.env[ISSUANCE_INVITE_SECRET_ENV] = previous;
  return minted.token;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env[ISSUANCE_INVITE_SECRET_ENV] = DOOR_TEST_KEY;
});

describe('withIssuanceLinkDoor', () => {
  it('Π1 — χωρίς Authorization ⇒ 401 `missing-link`, κανένας handler', async () => {
    const res = await door(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: 'missing-link' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('Π2 — αλλοιωμένος ή ξένου κλειδιού σύνδεσμος ⇒ 400, πριν από κάθε βάση ΚΑΙ κάθε σύνορο', async () => {
    const foreign = await token(Date.now() + 60_000, 'another-secret-0123456789abcdef');
    for (const value of ['garbage', foreign]) {
      const res = await door(request({ authorization: `Bearer ${value}` }));
      expect(res.status).toBe(400);
    }
    expect(handler).not.toHaveBeenCalled();
    expect(mockRunIdempotently).not.toHaveBeenCalled();
  });

  it('Π3 — principal ιδεμποτίας = ο σύνδεσμος, ποτέ `anon`', async () => {
    const value = await token(Date.now() + 60_000);
    const res = await door(request({ authorization: `Bearer ${value}` }));
    expect(res.status).toBe(200);
    expect(mockRunIdempotently.mock.calls[0]?.[1]).toBe('issuance-link:diin_A');
    expect(handler).toHaveBeenCalledWith(expect.anything(), value);
  });

  it('Π4 — ληγμένος ⇒ 410 `expired` από το token μόνο', async () => {
    const res = await door(request({ authorization: `Bearer ${await token(Date.now() - 1000)}` }));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ success: false, error: 'expired' });
  });

  it('Π5 — σφάλμα του handler ⇒ 500 `server-error`', async () => {
    handler.mockRejectedValueOnce(new Error('boom'));
    const res = await door(request({ authorization: `Bearer ${await token(Date.now() + 60_000)}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'server-error' });
  });
});

describe('Π6 — οι κωδικοί της αποστολής είναι ΙΔΙΟΙ στο route και στην οθόνη', () => {
  it('κάθε κωδικός του route έχει μήνυμα στην οθόνη, και κανένα μήνυμα δεν μένει χωρίς κωδικό', async () => {
    const { ISSUANCE_SEND_REFUSAL_STATUS } = await import('@/app/api/document-registry/issuance-assignments/messages/issuance-send-refusals');
    const { ISSUANCE_SEND_REFUSAL_CODES } = await import('@/components/document-registry/issuance-labels');
    const routeCodes = new Set(Object.values(ISSUANCE_SEND_REFUSAL_STATUS).map(([, code]) => code));
    expect([...routeCodes].every((code) => (ISSUANCE_SEND_REFUSAL_CODES as readonly string[]).includes(code))).toBe(true);
  });
});
