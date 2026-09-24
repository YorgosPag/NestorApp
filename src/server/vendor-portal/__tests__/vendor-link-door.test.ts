/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΠΡΟΜΗΘΕΥΤΗ** (ADR-876 §5 · CHECK 3.92).
 *
 * Π1 χωρίς `Authorization` ⇒ 401, **κανένας** αναλυτής · Π2 αλλοιωμένος σύνδεσμος ⇒ 400 πριν από
 * κάθε βάση · Π3 principal ιδεμποτίας = ο ΣΥΝΔΕΣΜΟΣ, ποτέ `anon` (δύο σύνδεσμοι με ίδιο κλειδί δεν
 * μοιράζονται απάντηση) · Π4 άρνηση του αναλυτή ⇒ ονομασμένος κωδικός · Π5 προσαρμοσμένη
 * άρνηση (ουδέτερη ανανέωση) · Π6 το token ΔΕΝ διαβάζεται ποτέ από τη διαδρομή.
 */

import { NextRequest, NextResponse } from 'next/server';

const mockParse = jest.fn();
jest.mock('@/services/vendor-portal/vendor-invite-credential', () => ({
  parseVendorLink: (...args: unknown[]) => mockParse(...args),
}));

const mockResolve = jest.fn();
jest.mock('@/subapps/procurement/services/vendor-invite-resolver', () => ({
  resolveVendorInvite: (...args: unknown[]) => mockResolve(...args),
}));

const mockRunIdempotently = jest.fn(
  async (_req: unknown, _principal: string, _policy: unknown, execute: () => Promise<{ response: NextResponse }>) =>
    (await execute()).response,
);
jest.mock('@/lib/api/idempotency/with-idempotency', () => ({
  runIdempotently: (...args: Parameters<typeof mockRunIdempotently>) => mockRunIdempotently(...args),
}));

import { withVendorLinkDoor } from '../vendor-link-door';

const handler = jest.fn(async () => NextResponse.json({ success: true }));
const door = withVendorLinkDoor({ purpose: 'read' }, handler);

function request(headers: Record<string, string> = {}, path = '/api/vendor/quote'): NextRequest {
  return new NextRequest(`https://app.test${path}`, { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParse.mockResolvedValue({ ok: true, credentialId: 'vic_A', nonceHash: 'h' });
  mockResolve.mockResolvedValue({ ok: true, invite: { id: 'vi_1' }, credential: { id: 'vic_A' }, linkExpired: false });
});

describe('withVendorLinkDoor', () => {
  it('Π1 — χωρίς Authorization ⇒ 401 missing_link, κανένας αναλυτής', async () => {
    const res = await door(request());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: 'missing_link' });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('Π2 — αλλοιωμένος σύνδεσμος ⇒ 400 invalid_link, πριν από κάθε βάση', async () => {
    mockParse.mockResolvedValue({ ok: false, reason: 'invalid_link' });
    const res = await door(request({ authorization: 'Bearer bad' }));
    expect(res.status).toBe(400);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockRunIdempotently).not.toHaveBeenCalled();
  });

  it('Π3 — principal ιδεμποτίας = ο σύνδεσμος, ΟΧΙ anon', async () => {
    await door(request({ authorization: 'Bearer good' }));
    expect(mockRunIdempotently.mock.calls[0][1]).toBe('vendor-link:vic_A');
  });

  it('Π4 — άρνηση αναλυτή ⇒ ονομασμένος κωδικός (ανακλημένη πρόσκληση = 410)', async () => {
    mockResolve.mockResolvedValue({ ok: false, reason: 'invite_revoked' });
    const res = await door(request({ authorization: 'Bearer good' }));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ success: false, error: 'invite_revoked' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('Π5 — προσαρμοσμένη άρνηση: η ανανέωση απαντά ουδέτερα σε ΟΛΑ', async () => {
    const neutral = () => NextResponse.json({ ok: 'neutral' }, { status: 202 });
    const renewDoor = withVendorLinkDoor({ purpose: 'renew', onRefusal: neutral }, handler);
    mockResolve.mockResolvedValue({ ok: false, reason: 'link_not_found' });
    expect((await renewDoor(request({ authorization: 'Bearer good' }))).status).toBe(202);
    expect((await renewDoor(request())).status).toBe(202);
  });

  it('Π6 — το token δεν διαβάζεται από τη διαδρομή: σύνδεσμος σε path χωρίς κεφαλίδα ⇒ 401', async () => {
    const res = await door(request({}, '/api/vendor/quote/SOME-TOKEN'));
    expect(res.status).toBe(401);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('ανοιχτή πρόσκληση ⇒ ο handler παίρνει την ανάλυση, με τον σκοπό της πόρτας', async () => {
    await door(request({ authorization: 'Bearer good' }));
    expect(mockResolve).toHaveBeenCalledWith('good', 'read');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
