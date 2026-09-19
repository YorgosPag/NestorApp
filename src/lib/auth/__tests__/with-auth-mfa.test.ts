/**
 * @jest-environment node
 *
 * ⚓ ADR-868 — η πόρτα MFA του `withAuth` είναι **δήλωση**, όχι προεπιλογή
 *
 * Το `requireMfa` προστέθηκε για να είναι η διαδρομή API της κονσόλας **το ίδιο αυστηρή**
 * με τη σελίδα της (`requireAdminForPage`). Το `withAuth` όμως φυλάει ~319 διαδρομές που
 * **δεν** το δηλώνουν: αν ο έλεγχος διέρρεε στην προεπιλογή, κάθε χρήστης χωρίς MFA θα
 * έχανε πρόσβαση παντού — σκλήρυνση που θα έμοιαζε με ασφάλεια ενώ θα έσπαγε λειτουργία.
 */

jest.mock('../auth-context', () => ({
  buildRequestContext: jest.fn(),
}));

import { withAuth } from '../middleware';
import { buildRequestContext } from '../auth-context';
import type { NextRequest } from 'next/server';

const handler = jest.fn(async () => new Response('ok') as never);
const request = { nextUrl: { pathname: '/api/x' }, method: 'GET' } as unknown as NextRequest;

function signInWithoutMfa(): void {
  (buildRequestContext as jest.Mock).mockResolvedValue({
    uid: 'u1', email: 'u1@a.test', companyId: 'comp_A',
    globalRole: 'company_admin', mfaEnrolled: false, isAuthenticated: true,
  });
}

beforeEach(() => {
  handler.mockClear();
  signInWithoutMfa();
});

describe('ADR-868 — requireMfa', () => {
  it('Μ1 — χωρίς τη δήλωση, συνεδρία χωρίς MFA ΠΕΡΝΑ (καμία αλλαγή στις υπόλοιπες διαδρομές)', async () => {
    await withAuth(handler)(request);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('Μ2 — με τη δήλωση, 403 MFA_REQUIRED και ο handler ΔΕΝ τρέχει', async () => {
    const response = await withAuth(handler, { requireMfa: true })(request);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('MFA_REQUIRED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('Μ3 — ρόλος εκτός ταβανιού ⇒ ROLE_REQUIRED, όχι MFA_REQUIRED (η πόρτα δεν λέει τι θα χρειαζόταν)', async () => {
    const response = await withAuth(handler, { requiredGlobalRoles: ['super_admin'], requireMfa: true })(request);

    expect((await response.json()).code).toBe('ROLE_REQUIRED');
  });
});
