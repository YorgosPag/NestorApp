/**
 * @jest-environment node
 *
 * =============================================================================
 * ΟΙ ΔΥΟ ΠΑΡΑΓΩΓΟΙ ΤΑΥΤΟΤΗΤΑΣ, ΕΝΑΣ ΠΙΝΑΚΑΣ (ADR-853 §14 · ADR-817 §11)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: ο server έχει **δύο** παραγωγούς ταυτότητας — `buildApiIdentity`
 * (διαδρομές API) και `readPageIdentity` (Server Components). Μέχρι 2026-09-13 ο κανόνας
 * «ρόλος × χώρος» ήταν **γραμμένος και στους δύο**, και **και οι δύο** απέρριπταν τον
 * **απόντα** ρόλο. Αποτέλεσμα μετρημένο ζωντανά: ο νέος προσκεκλημένος δεν έβλεπε ποτέ
 * κουμπί αποδοχής (σελίδα), και ακόμη κι αν το έβλεπε, η εξαργύρωση θα απαντούσε 401 (API).
 *
 * ⚠️ **Ο ΙΔΙΟΣ ΠΙΝΑΚΑΣ ΤΡΕΧΕΙ ΚΑΙ ΣΤΟΥΣ ΔΥΟ** — αν ένας παρακάμψει τον ταξινομητή, η άγκυρα
 * ισοδυναμίας (Ι1) κοκκινίζει, ακόμη κι αν ο καθένας «μοιάζει» σωστός μόνος του.
 *
 * Μετάλλαξη που ΠΡΕΠΕΙ να την κοκκινίσει (εκτελεσμένη): ο `readPageIdentity` ξαναγράφει
 * δικό του `isValidGlobalRole` αντί να ρωτήσει τον ταξινομητή.
 */

const mockVerify = jest.fn();
const mockCookieGet = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({ verifyIdToken: mockVerify }),
  getAdminFirestore: () => {
    throw new Error('Ο Firestore ΔΕΝ πρέπει να κληθεί: η ταυτότητα κρίνεται μόνο από το token.');
  },
}));

jest.mock('next/headers', () => ({
  cookies: async () => ({ get: mockCookieGet }),
}));

jest.mock('@/server/admin/admin-guards', () => ({
  verifySessionCookieToken: (...args: unknown[]) => mockVerify(...args),
}));

// ⚠️ Όχι `development`: εκεί μπορεί να κατασκευαστεί ταυτότητα χωρίς διαπιστευτήριο και η
//    άγκυρα θα δοκίμαζε μονοπάτι που δεν κρίνει claims (πρότυπο `page-identity-permissions`).
jest.mock('@/config/environment-security-config', () => ({
  ...jest.requireActual('@/config/environment-security-config'),
  getCurrentRuntimeEnvironment: () => 'production',
}));

jest.mock('@/config/dev-environment', () => ({
  getDevCompanyId: async () => 'comp_dev',
}));

import { NextRequest } from 'next/server';
import { buildApiIdentity, buildRequestContext } from '@/lib/auth/auth-context';
import { isAuthenticated } from '@/lib/auth/types';
import { readPageIdentity } from '../page-identity';

const IDENTITY = { uid: 'uid-invitee', email: 'pagonis.oe@gmail.com' };
const COMPANY = 'comp_alpha';

type Outcome = 'organization' | 'personal' | 'rejected';

interface Row {
  readonly label: string;
  readonly claims: Record<string, unknown>;
  readonly outcome: Outcome;
  /** Ο ρόλος που πρέπει να κουβαλά η ταυτότητα, όταν υπάρχει. */
  readonly role?: string | null;
}

/** Ο πίνακας του ADR-853 §14 — **μία** πηγή για **δύο** παραγωγούς. */
const ROWS: readonly Row[] = [
  { label: 'Ρ1 έγκυρος ρόλος + εταιρεία', claims: { globalRole: 'company_admin', companyId: COMPANY }, outcome: 'organization', role: 'company_admin' },
  { label: 'Ρ2 έγκυρος ρόλος, χωρίς εταιρεία', claims: { globalRole: 'external_user' }, outcome: 'personal', role: 'external_user' },
  { label: 'Ρ3 άκυρος ρόλος, χωρίς εταιρεία', claims: { globalRole: 'not_a_real_role' }, outcome: 'rejected' },
  { label: 'Ρ4 άκυρος ρόλος + εταιρεία', claims: { globalRole: 'not_a_real_role', companyId: COMPANY }, outcome: 'rejected' },
  { label: 'Ρ5 απών ρόλος + εταιρεία', claims: { companyId: COMPANY }, outcome: 'rejected' },
  { label: 'Ρ6 🔑 απών ρόλος, χωρίς εταιρεία (ο νέος άνθρωπος)', claims: {}, outcome: 'personal', role: null },
  { label: 'Ρ7 🔑 ρόλος null (όπως τον γράφει το identity-record)', claims: { globalRole: null, companyId: null }, outcome: 'personal', role: null },
  { label: 'Ρ8 🔑 κενός ρόλος + κενή εταιρεία', claims: { globalRole: '', companyId: '' }, outcome: 'personal', role: null },
  { label: 'Ρ9 🔒 μη-συμβολοσειρά ρόλος', claims: { globalRole: 42 }, outcome: 'rejected' },
];

function bearer(): NextRequest {
  return new NextRequest('https://nestorconstruct.gr/api/x', {
    headers: { authorization: 'Bearer a-token' },
  });
}

interface Observed {
  readonly outcome: Outcome;
  readonly role?: string | null;
}

async function viaApi(row: Row): Promise<Observed> {
  mockVerify.mockResolvedValue({ ...IDENTITY, ...row.claims });
  const identity = await buildApiIdentity(bearer());
  return identity.ok ? { outcome: identity.scope, role: identity.ctx.globalRole } : { outcome: 'rejected' };
}

async function viaPage(row: Row): Promise<Observed> {
  mockVerify.mockResolvedValue({ ...IDENTITY, ...row.claims });
  const identity = await readPageIdentity();
  return identity.ok ? { outcome: identity.scope, role: identity.ctx.globalRole } : { outcome: 'rejected' };
}

function expected(row: Row): Observed {
  return row.outcome === 'rejected' ? { outcome: 'rejected' } : { outcome: row.outcome, role: row.role };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCookieGet.mockReturnValue({ value: 'a-session-cookie' });
});

describe('Α. buildApiIdentity — ο πίνακας στο σύνορο API', () => {
  it.each(ROWS.map((row) => [row.label, row] as const))('%s', async (_label, row) => {
    expect(await viaApi(row)).toEqual(expected(row));
  });
});

describe('Σ. readPageIdentity — ο πίνακας στις σελίδες', () => {
  it.each(ROWS.map((row) => [row.label, row] as const))('%s', async (_label, row) => {
    expect(await viaPage(row)).toEqual(expected(row));
  });
});

describe('Ι. Οι δύο παραγωγοί ΣΥΜΦΩΝΟΥΝ σε κάθε γραμμή', () => {
  it('Ι1 — καμία γραμμή δεν δίνει άλλη απάντηση στη σελίδα και άλλη στο API', async () => {
    const disagreements: string[] = [];
    for (const row of ROWS) {
      const [api, page] = [await viaApi(row), await viaPage(row)];
      if (JSON.stringify(api) !== JSON.stringify(page)) disagreements.push(row.label);
    }
    expect(disagreements).toEqual([]);
  });
});

describe('Κ. Η ΑΚΤΙΝΑ ΜΕΝΕΙ ΚΛΕΙΣΤΗ', () => {
  it('Κ1 — 🔒 ο άνθρωπος χωρίς ρόλο παίρνει ΑΚΟΜΗ 401 στις 319 εταιρικές διαδρομές', async () => {
    mockVerify.mockResolvedValue({ ...IDENTITY });

    const ctx = await buildRequestContext(bearer());

    expect(isAuthenticated(ctx)).toBe(false);
    if (isAuthenticated(ctx)) throw new Error('unreachable');
    expect(ctx.reason).toBe('missing_claims');
  });

  it('Κ2 — η προσωπική ταυτότητα χωρίς ρόλο ΔΕΝ κουβαλά πεδίο companyId', async () => {
    mockVerify.mockResolvedValue({ ...IDENTITY });

    const identity = await buildApiIdentity(bearer());
    if (!identity.ok || identity.scope !== 'personal') throw new Error('unreachable');

    expect(Object.prototype.hasOwnProperty.call(identity.ctx, 'companyId')).toBe(false);
    expect(identity.ctx.globalRole).toBeNull();
  });
});
