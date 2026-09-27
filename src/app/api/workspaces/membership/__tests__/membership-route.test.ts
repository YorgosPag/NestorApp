/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΠΟΧΩΡΗΣΗ ΤΟΥ ΙΔΙΟΥ** — άγκυρα της διαδρομής `…/workspaces/membership` (ADR-892 Φ3, §13).
 * @related app/api/workspaces/membership/route.ts · server/workspace/member-exit-session.ts
 *
 * Ερωτήσεις: (Σ) ο στόχος είναι **πάντα** ο καλών και ο χώρος ο κριμένος — ποτέ το σώμα · (Ι) ίχνος
 * `workspace_member_left` **μία** φορά ανά θητεία · (Κ) κλειδί νέας συνεδρίας **μόνο** όταν ελευθερώθηκε ο
 * οικείος χώρος **και** το αίτημα ήρθε με Bearer (ποτέ από σκέτο cookie) · (Α) άρνηση με **όνομα** · (Π) η
 * προεπισκόπηση φέρνει τα **ονόματα** που ο αποχωρών δεν μπορεί να βρει μόνος.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }),
  },
  NextRequest: class {},
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));

const CTX = { uid: 'user_self', companyId: 'comp_office', globalRole: 'company_staff', email: 'me@x.gr', membershipVerdict: { kind: 'home' } };
const auditMock = jest.fn();
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) => async (request: unknown) => callback(request, CTX, {}),
  logAuditEvent: (...args: unknown[]) => auditMock(...args),
}));

jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));

const createCustomToken = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({}),
  getAdminAuth: () => ({ createCustomToken: (...args: unknown[]) => createCustomToken(...args) }),
}));

const executeMock = jest.fn();
const previewMock = jest.fn();
jest.mock('@/server/workspace/member-exit', () => ({
  executeMemberExit: (...args: unknown[]) => executeMock(...args),
  previewMemberExit: (...args: unknown[]) => previewMock(...args),
}));

jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: async () => 'PLATO' }));
const displayNameMock = jest.fn();
jest.mock('@/services/entity-audit.service', () => ({
  resolveUserDisplayName: (...args: unknown[]) => displayNameMock(...args),
}));

import type { NextRequest } from 'next/server';

import { GET, POST } from '../route';

type Json = { status: number; json: () => Promise<Record<string, unknown>> };

function requestWith(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers), json: async () => ({ targetUid: 'someone_else' }) } as unknown as NextRequest;
}
const BEARER = { authorization: 'Bearer id_token' };
const COOKIE_ONLY = { cookie: '__session=abc' };

function ended(home: { kind: string }, alreadyEnded = false) {
  return { kind: 'ended', alreadyEnded, home, heirUid: 'heir_1', transferredActTeams: 2, orphanedActTeams: 0 };
}

async function post(headers: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = (await POST(requestWith(headers))) as unknown as Json;
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  createCustomToken.mockResolvedValue('custom_token_1');
});

describe('Σ — ο στόχος είναι ο καλών, ο χώρος ο κριμένος', () => {
  it('Σ1 🔴 — POST: `departure` του `ctx.uid` στο `ctx.companyId`, το σώμα αγνοείται', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'untouched' }));
    await post(BEARER);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][1]).toMatchObject({ kind: 'departure', targetUid: 'user_self', companyId: 'comp_office' });
  });
});

describe('Ι — ίχνος μία φορά ανά θητεία', () => {
  it('Ι1 — νέα αποχώρηση ⇒ `workspace_member_left` με status `left` στο `newValue`', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'untouched' }));
    await post(BEARER);
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][1]).toBe('workspace_member_left');
    expect(auditMock.mock.calls[0][4]).toMatchObject({ newValue: { type: 'membership', value: { status: 'left' } } });
  });

  it('Ι2 🔴 — επισκευή (ήδη κλειστή) ⇒ ΚΑΝΕΝΑ δεύτερο ίχνος', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'untouched' }, true));
    await post(BEARER);
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe('Κ — η συνέχεια της συνεδρίας', () => {
  it('Κ1 — ξένος χώρος ⇒ `unchanged`, ΚΑΝΕΝΑ κλειδί', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'untouched' }));
    const { body } = await post(BEARER);
    expect(body.session).toEqual({ kind: 'unchanged' });
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('Κ2 — οικείος χώρος + Bearer ⇒ `reissued` με κλειδί του ΙΔΙΟΥ του καλούντος', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'personal' }));
    const { body } = await post(BEARER);
    expect(body.session).toEqual({ kind: 'reissued', token: 'custom_token_1' });
    expect(createCustomToken).toHaveBeenCalledWith('user_self');
  });

  it('Κ3 🔴 — οικείος χώρος από ΣΚΕΤΟ cookie ⇒ `ended`, ΚΑΝΕΝΑ κλειδί (δεν ξεπλένεται κλεμμένο cookie)', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'moved', companyId: 'comp_next' }));
    const { body } = await post(COOKIE_ONLY);
    expect(body.session).toEqual({ kind: 'ended' });
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('Κ4 — αποτυχία έκδοσης ⇒ `ended` (η αποχώρηση ΕΓΙΝΕ, 200)', async () => {
    executeMock.mockResolvedValue(ended({ kind: 'personal' }));
    createCustomToken.mockRejectedValue(new Error('iam'));
    const { status, body } = await post(BEARER);
    expect(status).toBe(200);
    expect(body.session).toEqual({ kind: 'ended' });
  });
});

describe('Α — άρνηση με όνομα', () => {
  it('Α1 — τελευταίος διαχειριστής ⇒ 409 `last-manager`, κανένα ίχνος', async () => {
    executeMock.mockResolvedValue({ kind: 'refused', verdict: { kind: 'last-manager' } });
    const { status, body } = await post(BEARER);
    expect([status, body]).toEqual([409, { error: 'EXIT_REFUSED', reason: 'last-manager' }]);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it('Α2 — σφάλμα στον ενορχηστρωτή ⇒ 503 (ασφαλής επανάληψη)', async () => {
    executeMock.mockRejectedValue(new Error('boom'));
    const { status } = await post(BEARER);
    expect(status).toBe(503);
  });
});

describe('Π — η προεπισκόπηση', () => {
  it('Π1 — `departure` του καλούντος + όνομα γραφείου + όνομα κληρονόμου', async () => {
    previewMock.mockResolvedValue({ verdict: { kind: 'allowed' }, heirUid: 'heir_1', actTeams: 2, isHomeWorkspace: true });
    displayNameMock.mockResolvedValue('Μαρία');
    const response = (await GET(requestWith(BEARER))) as unknown as Json;
    const body = await response.json();
    expect(previewMock.mock.calls[0][1]).toMatchObject({ kind: 'departure', targetUid: 'user_self' });
    expect(body).toMatchObject({ workspaceName: 'PLATO', heirName: 'Μαρία' });
  });

  it('Π2 — χωρίς κληρονόμο ⇒ `heirName: null`, καμία ανάγνωση ονόματος', async () => {
    previewMock.mockResolvedValue({ verdict: { kind: 'allowed' }, heirUid: null, actTeams: 0, isHomeWorkspace: false });
    const response = (await GET(requestWith(BEARER))) as unknown as Json;
    expect((await response.json()).heirName).toBeNull();
    expect(displayNameMock).not.toHaveBeenCalled();
  });
});
