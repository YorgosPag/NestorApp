/**
 * @fileoverview ADR-894 §10.7 — το claim `revokedSignIns`: ο καθαρός πυρήνας (Κ) και η ΠΡΟΒΟΛΗ στον ΕΝΑ γραφέα (Π).
 *
 * | Άγκυρα | Τι φυλά |
 * |---|---|
 * | Κ1–Κ3 | ανεκτική ανάγνωση · «ανακλήθηκε η δική μου σύνδεση;» · το πεδίο του καλούντα αγνοείται |
 * | Κ4 | το όριο καταχωρίσεων ΧΩΡΑ στα 1000 bytes δίπλα στα μετρημένα claims της παραγωγής |
 * | Π1–Π2 | αλλαγή ρόλου ΔΕΝ σβήνει τις ανακλήσεις · πλαστή/μπαγιάτικη λίστα του καλούντα αντικαθίσταται |
 * | Π3 | ανάκληση ΑΝΑΜΕΣΑ σε ανάγνωση και εγγραφή ⇒ σύγκλιση (ο τελευταίος γραφέας τη βλέπει) |
 * | Π4–Π5 | συγχρονισμός ιδεμποτικός · σύγκλιση φραγμένη (ποτέ ατέρμων βρόχος) |
 * | Π6 | αλλαγή ρόλου μέσα στο παράθυρο του συγχρονισμού ΔΕΝ χάνεται (lease εγγραφής claims) |
 */

jest.mock('server-only', () => ({}));

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const fake = new FakeFirestore();
const claimsOf = new Map<string, Record<string, unknown>>();
const setCustomUserClaims = jest.fn(async (uid: string, claims: Record<string, unknown>) => {
  claimsOf.set(uid, claims);
});
/** Π6: μια ανάγνωση claims που «κολλά» μέχρι να την αφήσει το test — για να ανοίξει το παράθυρο του αγώνα. */
let getUserGate: Promise<void> | null = null;
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUser: async (uid: string) => {
      // Η τιμή «φωτογραφίζεται» ΠΡΙΝ από την καθυστέρηση — όπως μια ανάγνωση που ο server απάντησε και φτάνει αργά.
      const snapshot = claimsOf.get(uid);
      if (getUserGate) await getUserGate;
      return { customClaims: snapshot };
    },
    setCustomUserClaims: (uid: string, claims: Record<string, unknown>) => setCustomUserClaims(uid, claims),
  }),
  // Ο πλαστός ΞΑΝΑΕΚΤΕΛΕΙ συναλλαγή σε σύγκρουση (όπως το αληθινό) ⇒ το lease δοκιμάζεται στ' αλήθεια.
  getAdminFirestore: () => fake,
}));
jest.mock('@/lib/auth/claims-seat', () => ({ assertClaimsHaveSeat: async () => undefined }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

/** Η λίστα-πηγή ανά ανάγνωση: κάθε κλήση παίρνει την επόμενη τιμή (η τελευταία επαναλαμβάνεται). */
let listReads: number[][] = [];
jest.mock('@/lib/auth/revoked-sign-ins', () => ({
  readRevokedSignIns: async () => new Set(listReads.length > 1 ? listReads.shift() : listReads[0] ?? []),
}));

import {
  CLAIMS_LIMIT_BYTES,
  MAX_CLAIMED_REVOKED_SIGN_INS,
  REVOKED_SIGN_INS_CLAIM,
  isOwnSignInRevoked,
  readRevokedSignInsClaim,
  withRevokedSignInsClaim,
} from '../revoked-sign-ins-claim';
import { setClaimsWithMirror, syncRevokedSignInsClaim } from '../set-claims-with-mirror';

const UID = 'u-claim';
const T = 1_790_000_000;

beforeEach(() => {
  fake.reset();
  claimsOf.clear();
  setCustomUserClaims.mockClear();
  getUserGate = null;
  listReads = [[]];
});

describe('Κ — ο καθαρός πυρήνας', () => {
  it('Κ1 — ανεκτική ανάγνωση: σκουπίδια πετιούνται, ταξινόμηση, χωρίς διπλά· απουσία ⇒ []', () => {
    expect(readRevokedSignInsClaim([T + 2, 'x', T, T, -1, 1.5, null])).toEqual([T, T + 2]);
    expect(readRevokedSignInsClaim(undefined)).toEqual([]);
  });

  it('Κ2 — «ανακλήθηκε η ΔΙΚΗ μου σύνδεση;» κρίνεται από το auth_time του ίδιου του token', () => {
    expect(isOwnSignInRevoked({ auth_time: T, [REVOKED_SIGN_INS_CLAIM]: [T] })).toBe(true);
    expect(isOwnSignInRevoked({ auth_time: T + 1, [REVOKED_SIGN_INS_CLAIM]: [T] })).toBe(false);
    expect(isOwnSignInRevoked({ [REVOKED_SIGN_INS_CLAIM]: [T] })).toBe(false);
  });

  it('Κ3 — το πεδίο του καλούντα ΑΓΝΟΕΙΤΑΙ· κενή λίστα ⇒ το πεδίο λείπει', () => {
    expect(withRevokedSignInsClaim({ globalRole: 'x', [REVOKED_SIGN_INS_CLAIM]: [1] }, [T])).toEqual({
      globalRole: 'x', [REVOKED_SIGN_INS_CLAIM]: [T],
    });
    expect(withRevokedSignInsClaim({ globalRole: 'x', [REVOKED_SIGN_INS_CLAIM]: [T] }, [])).toEqual({ globalRole: 'x' });
  });

  it('Κ4 🔴 το όριο ΧΩΡΑ: τα μεγαλύτερα claims της παραγωγής (176 bytes) + γεμάτη λίστα + σφραγίδα < 1000', () => {
    const measuredLargest = {
      companyId: 'comp_00000000-0000-4000-8000-000000000000',
      globalRole: 'company_admin',
      mfaEnrolled: false,
      permissions: ['admin_access', 'manage_users', 'view_reports'],
    };
    const full = Array.from({ length: MAX_CLAIMED_REVOKED_SIGN_INS }, (_, i) => 9_999_999_000 + i);
    const payload = { ...withRevokedSignInsClaim(measuredLargest, full), claimsUpdatedAt: 1_790_000_000_000 };
    expect(MAX_CLAIMED_REVOKED_SIGN_INS).toBeGreaterThanOrEqual(20);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(CLAIMS_LIMIT_BYTES);
  });
});

describe('Π — η προβολή στον ΕΝΑ γραφέα', () => {
  it('Π1 🔴 αλλαγή ρόλου (ο καλών χτίζει τα claims από την αρχή) ΔΕΝ σβήνει τις ανακλήσεις', async () => {
    listReads = [[T]];
    await setClaimsWithMirror(UID, { globalRole: 'external_user' });
    expect(claimsOf.get(UID)).toEqual(expect.objectContaining({ globalRole: 'external_user', [REVOKED_SIGN_INS_CLAIM]: [T] }));
  });

  it('Π2 — πλαστή/μπαγιάτικη λίστα του καλούντα ⇒ αντικαθίσταται από την πηγή', async () => {
    listReads = [[]];
    await setClaimsWithMirror(UID, { globalRole: 'external_user', [REVOKED_SIGN_INS_CLAIM]: [T] });
    expect(claimsOf.get(UID)).not.toHaveProperty(REVOKED_SIGN_INS_CLAIM);
  });

  it('Π3 🔴 ανάκληση ΑΝΑΜΕΣΑ σε ανάγνωση και εγγραφή ⇒ δεύτερη εγγραφή, το claim συγκλίνει', async () => {
    listReads = [[], [T], [T]];
    await setClaimsWithMirror(UID, { globalRole: 'external_user' });
    expect(setCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(claimsOf.get(UID)?.[REVOKED_SIGN_INS_CLAIM]).toEqual([T]);
  });

  it('Π4 — συγχρονισμός ιδεμποτικός: ίδιο claim ⇒ καμία εγγραφή· διαφορετικό ⇒ μία, με τα υπάρχοντα claims', async () => {
    claimsOf.set(UID, { globalRole: 'external_user', [REVOKED_SIGN_INS_CLAIM]: [T] });
    listReads = [[T]];
    expect(await syncRevokedSignInsClaim(UID)).toBe('unchanged');
    expect(setCustomUserClaims).not.toHaveBeenCalled();

    listReads = [[T, T + 1]];
    expect(await syncRevokedSignInsClaim(UID)).toBe('written');
    expect(claimsOf.get(UID)).toEqual(expect.objectContaining({ globalRole: 'external_user', [REVOKED_SIGN_INS_CLAIM]: [T, T + 1] }));
  });

  it('Π5 — λίστα που αλλάζει σε ΚΑΘΕ ανάγνωση ⇒ σύγκλιση φραγμένη σε 3 εγγραφές, ποτέ ατέρμων βρόχος', async () => {
    listReads = [[1], [2], [3], [4], [5], [6], [7], [8]];
    await setClaimsWithMirror(UID, { globalRole: 'external_user' });
    expect(setCustomUserClaims).toHaveBeenCalledTimes(3);
  });

  it('Π6 🔴 αλλαγή ρόλου ΑΝΑΜΕΣΑ στην ανάγνωση και στην εγγραφή του συγχρονισμού ⇒ ο νέος ρόλος ΕΠΙΒΙΩΝΕΙ (lease)', async () => {
    claimsOf.set(UID, { globalRole: 'company_admin' });
    listReads = [[T]];
    let openGate: () => void = () => undefined;
    getUserGate = new Promise<void>((resolve) => { openGate = resolve; });

    const sync = syncRevokedSignInsClaim(UID); // κρατά το lease, «κολλημένο» στην ανάγνωση των claims
    await new Promise((resolve) => setTimeout(resolve, 20));
    const demotion = setClaimsWithMirror(UID, { globalRole: 'external_user' }); // περιμένει το lease
    await new Promise((resolve) => setTimeout(resolve, 20));
    getUserGate = null;
    openGate();
    await Promise.all([sync, demotion]);

    expect(claimsOf.get(UID)).toEqual(expect.objectContaining({ globalRole: 'external_user', [REVOKED_SIGN_INS_CLAIM]: [T] }));
  });
});
