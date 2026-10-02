/**
 * ADR-900 §3.8 — άγκυρα του ΕΝΟΣ κριτή επαλήθευσης κατοχής.
 *
 * Ε1 ο ευτυχής δρόμος · Ε2 κάθε κριτήριο έχει ΔΙΚΟ του λόγο · Ε3 όλοι οι λόγοι μαζί, ποτέ ο πρώτος μόνο ·
 * Ε4 το όνομα: ακριβές/συνεσταλμένο ναι, προσεγγιστικό όχι · Ε5 ο ίδιος λογαριασμός ξανά = ιδεμπότητο.
 * Τα ονόματα είναι συνθετικά.
 */
import {
  CERTIFICATE_MAX_AGE_DAYS,
  judgeOwnershipVerification,
  type VerdictInput,
} from '../verification-verdict';

const NOW = '2026-10-02T12:00:00.000Z';
const KAEK = '050681726003/0/1';

function input(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    seal: {
      kind: 'valid',
      reason: null,
      signer: 'ΕΛΛΗΝΙΚΟ ΚΤΗΜΑΤΟΛΟΓΙΟ',
      signedAt: '2026-09-30T08:00:00.000Z',
      issuerConfirmed: true,
    },
    kaekCodes: [KAEK],
    beneficiaries: [
      { name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ ΤΟΥ ΙΩΑΝΝΗ', taxIdHmac: 'hmac-a' },
      { name: 'ΠΑΠΑΔΟΠΟΥΛΟΥ ΜΑΡΙΑ ΤΟΥ ΓΕΩΡΓΙΟΥ', taxIdHmac: 'hmac-b' },
    ],
    claimant: { legalName: 'Κωνσταντίνος Παπαδόπουλος', taxIdHmac: 'hmac-a' },
    kaekHolderUid: null,
    taxIdHolderUid: null,
    uid: 'user-1',
    nowIso: NOW,
    ...overrides,
  };
}

describe('Ε1 — ο ευτυχής δρόμος', () => {
  it('σφραγίδα + εκδότης + φρέσκο + ένας ΚΑΕΚ + ίδιος ΑΦΜ + ίδιο όνομα ⇒ verified', () => {
    expect(judgeOwnershipVerification(input())).toEqual({ status: 'verified', reasons: [], kaek: KAEK });
  });
});

describe('Ε2 — κάθε κριτήριο έχει δικό του λόγο', () => {
  const sealOf = (patch: Partial<VerdictInput['seal']>): VerdictInput['seal'] => ({ ...input().seal, ...patch });

  it.each<[string, Partial<VerdictInput>, string]>([
    ['άκυρη σφραγίδα', { seal: sealOf({ kind: 'invalid', reason: 'digest-mismatch' }) }, 'seal-invalid'],
    ['εκδότης μη επιβεβαιωμένος', { seal: sealOf({ issuerConfirmed: false }) }, 'issuer-unconfirmed'],
    ['παλιό ΠΚΑ', { seal: sealOf({ signedAt: '2026-06-01T00:00:00.000Z' }) }, 'stale-certificate'],
    ['χωρίς ώρα υπογραφής', { seal: sealOf({ signedAt: null }) }, 'stale-certificate'],
    ['κανένας ΚΑΕΚ', { kaekCodes: [] }, 'kaek-unreadable'],
    ['δύο ΚΑΕΚ', { kaekCodes: [KAEK, '050681726003/0/2'] }, 'kaek-unreadable'],
    ['κανένας δικαιούχος', { beneficiaries: [] }, 'beneficiaries-unreadable'],
    ['ΠΚΑ χωρίς ΑΦΜ', { beneficiaries: [{ name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ', taxIdHmac: null }] }, 'tax-id-absent'],
    ['άλλος ΑΦΜ', { claimant: { legalName: 'Κωνσταντίνος Παπαδόπουλος', taxIdHmac: 'hmac-z' } }, 'tax-id-mismatch'],
    ['ίδιος ΑΦΜ, άλλο όνομα', { claimant: { legalName: 'Νίκος Γεωργίου', taxIdHmac: 'hmac-a' } }, 'name-mismatch'],
    ['ΚΑΕΚ σε άλλον', { kaekHolderUid: 'user-2' }, 'kaek-claimed-elsewhere'],
    ['ΑΦΜ σε άλλον', { taxIdHolderUid: 'user-2' }, 'tax-id-claimed-elsewhere'],
  ])('%s ⇒ pending-review [%s]', (_label, overrides, reason) => {
    const verdict = judgeOwnershipVerification(input(overrides));
    expect(verdict.status).toBe('pending-review');
    expect(verdict.reasons).toEqual([reason]);
  });

  it(`🔑 το όριο φρεσκάδας είναι ${CERTIFICATE_MAX_AGE_DAYS} ημέρες — ακριβώς στο όριο περνά`, () => {
    const signedAt = new Date(Date.parse(NOW) - CERTIFICATE_MAX_AGE_DAYS * 86_400_000).toISOString();
    expect(judgeOwnershipVerification(input({ seal: { ...input().seal, signedAt } })).status).toBe('verified');
  });
});

describe('Ε3 — όλοι οι λόγοι μαζί, ποτέ μόνο ο πρώτος', () => {
  it('ο άνθρωπος της ουράς βλέπει ΚΑΘΕ αποτυχία', () => {
    const verdict = judgeOwnershipVerification(
      input({ seal: { ...input().seal, issuerConfirmed: false }, kaekCodes: [], taxIdHolderUid: 'user-9' }),
    );
    expect(verdict.reasons).toEqual(['issuer-unconfirmed', 'kaek-unreadable', 'tax-id-claimed-elsewhere']);
    expect(verdict.kaek).toBeNull();
  });
});

describe('Ε4 — το όνομα', () => {
  it('συνεσταλμένο (ΚΩΝ/ΝΟΣ) ⇒ δεκτό', () => {
    const verdict = judgeOwnershipVerification(
      input({ beneficiaries: [{ name: 'ΠΑΠΑΔΟΠΟΥΛΟΣ ΚΩΝ/ΝΟΣ', taxIdHmac: 'hmac-a' }] }),
    );
    expect(verdict.status).toBe('verified');
  });

  it('🔴 προσεγγιστικό (ένα γράμμα διαφορά) ⇒ άνθρωπος, ΟΧΙ αυτόματο', () => {
    const verdict = judgeOwnershipVerification(
      input({ claimant: { legalName: 'Κωνσταντίνος Παπαδόπολος', taxIdHmac: 'hmac-a' } }),
    );
    expect(verdict.reasons).toEqual(['name-mismatch']);
  });

  it('🔴 το όνομα κρίνεται ΜΟΝΟ απέναντι στον δικαιούχο με τον ίδιο ΑΦΜ', () => {
    // Η Μαρία είναι συνιδιοκτήτρια με ΑΛΛΟ ΑΦΜ: το όνομά της δεν «δανείζεται» σε ξένο ΑΦΜ.
    const verdict = judgeOwnershipVerification(
      input({ claimant: { legalName: 'Μαρία Παπαδοπούλου', taxIdHmac: 'hmac-a' } }),
    );
    expect(verdict.reasons).toEqual(['name-mismatch']);
  });
});

describe('Ε5 — ιδεμποτία', () => {
  it('οι κλειδαριές στον ΙΔΙΟ λογαριασμό δεν είναι σύγκρουση (ξανα-επαλήθευση)', () => {
    expect(judgeOwnershipVerification(input({ kaekHolderUid: 'user-1', taxIdHolderUid: 'user-1' })).status).toBe(
      'verified',
    );
  });
});
