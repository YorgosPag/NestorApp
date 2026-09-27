/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΟΙΚΕΙΟΣ ΧΩΡΟΣ ΜΕΤΑ ΤΗΝ ΕΞΟΔΟ** — ADR-892 §3.2 βήμα 3 · §8.1 (Φ1).
 * @related server/workspace/member-exit-claims.ts
 *
 * Ερώτημα: ο αφαιρεθείς είχε αυτό το γραφείο για «σπίτι». Πού προσγειώνεται — και κόβονται οι ανοιχτές
 * συνεδρίες του; Κι αν το γραφείο ήταν ξένος χώρος, μένει **ανέγγιχτος** ο προσωπικός του;
 */

jest.mock('server-only', () => ({}));

const mockGetUser = jest.fn();
const mockRevoke = jest.fn(async () => undefined);
const mockSetClaims = jest.fn(async () => ({ claimsUpdatedAt: 1, firestoreMirrorOk: true }));
const mockListWorkspaces = jest.fn();
const mockForget = jest.fn();
const seats = new Map<string, Record<string, unknown>>();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({ getUser: (uid: string) => mockGetUser(uid), revokeRefreshTokens: (uid: string) => mockRevoke(uid) }),
  getAdminFirestore: () => ({}),
}));
jest.mock('@/lib/auth', () => ({ isValidGlobalRole: (role: string) => ['company_admin', 'external_user'].includes(role) }));
jest.mock('@/lib/auth/set-claims-with-mirror', () => ({ setClaimsWithMirror: (...args: unknown[]) => mockSetClaims(...(args as [])) }));
jest.mock('@/lib/auth/revocation-watermark', () => ({ forgetRevocationState: (uid: string) => mockForget(uid) }));
jest.mock('@/lib/workspace/workspace-member-ref', () => ({
  workspaceMemberRef: (_db: unknown, companyId: string) => ({
    get: async () => ({ exists: seats.has(companyId), data: () => seats.get(companyId) }),
  }),
}));
jest.mock('@/lib/auth/workspace-membership', () => {
  const actual = jest.requireActual('@/lib/auth/workspace-membership');
  return { normalizeMembership: actual.normalizeMembership, listMemberWorkspaces: (uid: string) => mockListWorkspaces(uid) };
});
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { classifyIdentityClaims } from '@/lib/auth/identity-claims';

import { adoptHomeWorkspace, releaseHomeWorkspace } from '../member-exit-claims';

const UID = 'uid_x';
const LEAVING = 'comp_leaving';

function millisStamp(ms: number) {
  return { toMillis: () => ms };
}

beforeEach(() => {
  jest.clearAllMocks();
  seats.clear();
  mockListWorkspaces.mockResolvedValue({ outcome: 'ok', companyIds: [] });
});

describe('Ξ — ξένος χώρος: ΤΙΠΟΤΑ δεν αγγίζεται', () => {
  it('Ξ1 — το claim δείχνει αλλού ⇒ untouched· κανένα claim, ΚΑΜΙΑ αποσύνδεση', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: 'comp_home', globalRole: 'company_admin' } });
    await expect(releaseHomeWorkspace(UID, LEAVING)).resolves.toEqual({ kind: 'untouched' });
    expect(mockSetClaims).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });
});

describe('Ο — οικείος χώρος', () => {
  it('Ο1 🔴 κανένα άλλο γραφείο ⇒ προσωπικός χώρος (claim ΧΩΡΙΣ companyId) + ανάκληση + λήθη σφραγίδας', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: LEAVING, globalRole: 'external_user', mfaEnrolled: true } });
    await expect(releaseHomeWorkspace(UID, LEAVING)).resolves.toEqual({ kind: 'personal' });
    const written = mockSetClaims.mock.calls[0][1] as Record<string, unknown>;
    expect(written).not.toHaveProperty('companyId');
    expect(written.mfaEnrolled).toBe(true);
    expect(mockRevoke).toHaveBeenCalledWith(UID);
    expect(mockForget).toHaveBeenCalledWith(UID);
  });

  it('Ο2 — δύο άλλα γραφεία ⇒ το ΠΑΛΑΙΟΤΕΡΟ, με τον ρόλο του ΕΚΕΙ (όχι του γραφείου που άφησε)', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: LEAVING, globalRole: 'external_user' } });
    mockListWorkspaces.mockResolvedValue({ outcome: 'ok', companyIds: [LEAVING, 'comp_new', 'comp_old'] });
    seats.set('comp_new', { status: 'active', globalRole: 'external_user', joinedAt: millisStamp(2_000) });
    seats.set('comp_old', { status: 'active', globalRole: 'company_admin', joinedAt: millisStamp(1_000) });
    await expect(releaseHomeWorkspace(UID, LEAVING)).resolves.toEqual({ kind: 'moved', companyId: 'comp_old' });
    expect(mockSetClaims.mock.calls[0][1]).toEqual(expect.objectContaining({ companyId: 'comp_old', globalRole: 'company_admin' }));
  });

  it('Ο3 — «δεν μπόρεσα να ρωτήσω» ⇒ προσωπικός χώρος (λιγότερη πρόσβαση, ποτέ περισσότερη)', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: LEAVING, globalRole: 'external_user' } });
    mockListWorkspaces.mockResolvedValue({ outcome: 'unknown', reason: 'boom' });
    await expect(releaseHomeWorkspace(UID, LEAVING)).resolves.toEqual({ kind: 'personal' });
  });

  it('Ο4 🔴 το claim αποτυγχάνει ⇒ οι συνεδρίες κόβονται ΠΑΡΟΛΑ ΑΥΤΑ, και το σφάλμα ΦΤΑΝΕΙ στον καλούντα', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: LEAVING, globalRole: 'external_user' } });
    mockSetClaims.mockRejectedValueOnce(new Error('AUTH_DOWN'));
    await expect(releaseHomeWorkspace(UID, LEAVING)).rejects.toThrow('AUTH_DOWN');
    expect(mockRevoke).toHaveBeenCalledWith(UID);
  });
});

describe('Ε — επαναφορά: ο οικείος χώρος επιστρέφει ΜΟΝΟ όταν λείπει (§12.4, διόρθωση 27/09)', () => {
  it('Ε1 🔴 χωρίς οικείο χώρο ⇒ το γραφείο ξαναγίνεται οικείος — και ο ταξινομητής του `withAuth` δίνει ΕΤΑΙΡΙΚΗ ταυτότητα', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { globalRole: 'external_user', mfaEnrolled: true, permissions: [] } });
    await expect(adoptHomeWorkspace(UID, LEAVING, 'external_user')).resolves.toEqual({ kind: 'adopted', companyId: LEAVING });
    const written = mockSetClaims.mock.calls[0][1] as Record<string, unknown>;
    // Η άγκυρα ΔΕΝ ρωτά «γράφτηκε companyId;» — ρωτά ό,τι ρωτά το σύνορο: περνά ο άνθρωπος το `buildRequestContext`;
    expect(classifyIdentityClaims(written)).toEqual({ kind: 'organization', globalRole: 'external_user', companyId: LEAVING });
    expect(written.mfaEnrolled).toBe(true);
    // Προσθέτουμε πρόσβαση ⇒ ΚΑΜΙΑ αποσύνδεση.
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockForget).not.toHaveBeenCalled();
  });

  it('Ε2 — οικείος χώρος σε ΑΛΛΟ γραφείο ⇒ untouched: η επαναφορά δεν μετακινεί κανέναν', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: 'comp_home', globalRole: 'company_admin' } });
    await expect(adoptHomeWorkspace(UID, LEAVING, 'external_user')).resolves.toEqual({ kind: 'untouched' });
    expect(mockSetClaims).not.toHaveBeenCalled();
  });

  it('Ε3 — ήδη οικείος ΕΔΩ ⇒ untouched (ιδεμποτία: δεύτερη κλήση = καμία γραφή)', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { companyId: LEAVING, globalRole: 'external_user' } });
    await expect(adoptHomeWorkspace(UID, LEAVING, 'external_user')).resolves.toEqual({ kind: 'untouched' });
    expect(mockSetClaims).not.toHaveBeenCalled();
  });

  it('Ε4 — claims που το σύνορο ΑΠΟΡΡΙΠΤΕΙ (άκυρος ρόλος) ⇒ untouched: δεν είναι δουλειά της επαναφοράς να τα κρίνει', async () => {
    mockGetUser.mockResolvedValue({ customClaims: { globalRole: 'ghost_role' } });
    await expect(adoptHomeWorkspace(UID, LEAVING, 'external_user')).resolves.toEqual({ kind: 'untouched' });
    expect(mockSetClaims).not.toHaveBeenCalled();
  });
});
