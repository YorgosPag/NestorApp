/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.3 — η ανώνυμη κλήση **δημόσιας** διαδρομής (`withAuth({ allowUnauthenticated })`: webhook παρόχου,
 * σύνδεσμος πληρωμής) ΔΕΝ είναι άρνηση. Πριν, κάθε webhook έγραφε `WARN [AUTH_CONTEXT] DENY` και έθαβε τις
 * πραγματικές αρνήσεις. Αλλάζει **μόνο** η καταγραφή — η απόφαση (`missing_token`) μένει ίδια, και η **μη** δημόσια
 * διαδρομή συνεχίζει να γράφει WARN.
 */

const mockWarn = jest.fn();
const mockDebug = jest.fn();
jest.mock('@/lib/telemetry', () => ({
  // Οκνηρά: άλλα modules φτιάχνουν logger κατά τη φόρτωση, πριν αρχικοποιηθούν τα mocks.
  createModuleLogger: () => ({
    warn: (...args: unknown[]) => mockWarn(...args),
    debug: (...args: unknown[]) => mockDebug(...args),
    info: () => undefined,
    error: () => undefined,
  }),
}));
jest.mock('../identity-fabrication', () => ({
  decideIdentityFabrication: () => ({ verdict: 'denied-by-policy', reason: 'production' }),
}));

import { NextRequest } from 'next/server';

import { buildApiIdentity, buildRequestContext } from '../auth-context';

const anonymous = () => new NextRequest('https://nestorconstruct.gr/api/payments/webhooks/everypay', { method: 'POST' });

beforeEach(() => jest.clearAllMocks());

describe('ανώνυμο αίτημα — καταγραφή ανάλογα με το αν η διαδρομή είναι δημόσια', () => {
  it('μη δημόσια διαδρομή (προεπιλογή) ⇒ WARN DENY, όπως πάντα', async () => {
    await expect(buildApiIdentity(anonymous())).resolves.toEqual({ ok: false, reason: 'missing_token' });
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('DENY'), expect.anything());
    expect(mockDebug).not.toHaveBeenCalled();
  });

  it('δημόσια διαδρομή ⇒ ΙΔΙΑ απόφαση, αλλά debug αντί για WARN', async () => {
    await expect(buildApiIdentity(anonymous(), { anonymousAllowed: true })).resolves.toEqual({ ok: false, reason: 'missing_token' });
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledTimes(1);
  });

  it('buildRequestContext περνά την επιλογή αυτούσια', async () => {
    const ctx = await buildRequestContext(anonymous(), { anonymousAllowed: true });
    expect(ctx).toMatchObject({ isAuthenticated: false, reason: 'missing_token' });
    expect(mockWarn).not.toHaveBeenCalled();
  });
});
