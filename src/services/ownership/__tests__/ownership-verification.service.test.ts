/**
 * @jest-environment node
 *
 * ADR-900 §3.8 — άγκυρα του ΕΝΟΣ γραφέα επαλήθευσης κατοχής, πάνω στο fake Firestore.
 *
 * Υ1 ευτυχής δρόμος ⇒ verified + κλειδαριές · Υ2 ο ίδιος ΚΑΕΚ σε ΔΕΥΤΕΡΟ λογαριασμό ⇒ ουρά, όχι δεύτερος κάτοχος ·
 * Υ3 ξένη αγγελία ⇒ not-your-property · Υ4 ελλιπής ταυτότητα ⇒ identity-incomplete · Υ5 εκδότης μη
 * επιβεβαιωμένος ⇒ ουρά (το σημερινό μητρώο) · Υ6 ο αναγνώστης βλέπει ΜΟΝΟ τον κάτοχο της απόδειξης ·
 * Υ7 ο ΑΦΜ δεν γράφεται ποτέ καθαρός.
 * Τα πρόσωπα και οι ΑΦΜ είναι συνθετικά.
 */
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { PdfSealVerdict } from '@/server/pdf-seal/pdf-seal.types';
import { submitOwnershipVerification, type SubmitDeps } from '../ownership-verification.service';
import { isVerifiedOwner } from '../verified-ownership.reader';

jest.mock('server-only', () => ({}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'audit') } }));
jest.mock('@/config/trust/pdf-seal-trust', () => ({
  ...jest.requireActual('@/config/trust/pdf-seal-trust'),
  // Το μητρώο είναι κενό μέχρι το πρώτο πραγματικό ΠΚΑ· εδώ προσομοιώνεται η μέρα που θα γεμίσει.
  isExpectedSigner: (_kind: string, id: string | null) => id === 'VATEL-KTIMATOLOGIO-TEST',
}));

const NOW = '2026-10-02T12:00:00.000Z';
const TAX_A = '123456709';
const TAX_B = '123535891';
const KAEK = '050681726003/0/1';

process.env.OWNERSHIP_TAX_ID_HMAC_SECRET = 'test-secret-for-hmac';

const asAdmin = (fake: FakeFirestore) => fake as unknown as Parameters<typeof submitOwnershipVerification>[0];

function seedAccount(fake: FakeFirestore, uid: string, givenName: string, familyName: string, vatNumber: string) {
  fake.seed('users', uid, { givenName, familyName, email: `${uid}@example.test`, vatNumber });
}

function seedListing(fake: FakeFirestore, id: string, uid: string) {
  fake.seed('owner_properties', id, { ...validOwnerProperty({ id, authorUserId: uid }), dossierId: `pdos_${id}` });
  fake.seed('files_personal', `file_${id}`, {
    userId: uid, entityType: 'property_dossier', entityId: `pdos_${id}`,
    status: 'ready', contentType: 'application/pdf', storagePath: `x/${id}.pdf`,
  });
}

const TRUSTED_SEAL: PdfSealVerdict = {
  kind: 'valid',
  signer: { commonName: 'TEST', organization: 'TEST', organizationIdentifier: 'VATEL-KTIMATOLOGIO-TEST', certificateSha256: 'aa' },
  signedAt: '2026-09-30T08:00:00.000Z',
  timestamped: true,
  chainTrusted: true,
};

function deps(seal: PdfSealVerdict, beneficiaryLine: string): SubmitDeps {
  return {
    verifySeal: async () => seal,
    readPdfText: async () => [`ΚΑΕΚ ${KAEK}\n${beneficiaryLine}`],
    readBytes: async () => ({ size: 10, read: async () => Buffer.from('%PDF-synthetic') }),
    nowIso: NOW,
  };
}

const OWNER_LINE = `ΔΙΚΑΙΟΥΧΟΣ: ΠΑΠΑΔΟΠΟΥΛΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ ΑΦΜ: ${TAX_A}`;

function world(): FakeFirestore {
  const fake = new FakeFirestore();
  seedAccount(fake, 'user-1', 'Κωνσταντίνος', 'Παπαδόπουλος', TAX_A);
  seedAccount(fake, 'user-2', 'Νίκος', 'Γεωργίου', TAX_B);
  seedListing(fake, 'ownp_a', 'user-1');
  seedListing(fake, 'ownp_b', 'user-2');
  return fake;
}

const submit = (fake: FakeFirestore, uid: string, ownerPropertyId: string, d: SubmitDeps) =>
  submitOwnershipVerification(asAdmin(fake), { uid, ownerPropertyId, fileId: `file_${ownerPropertyId}` }, d);

describe('Υ1 — ευτυχής δρόμος', () => {
  it('σφραγίδα επιβεβαιωμένη + ίδιος ΑΦΜ + ίδιο όνομα ⇒ verified, και οι δύο κλειδαριές γράφονται', async () => {
    const fake = world();
    const outcome = await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE));
    expect(outcome).toMatchObject({ kind: 'judged', view: { status: 'verified', reasons: [], kaek: KAEK } });
    expect(Object.keys(fake.getAllDocs('ownership_kaek_claims'))).toHaveLength(1);
    expect(Object.keys(fake.getAllDocs('tax_identity_claims'))).toHaveLength(1);
  });
});

describe('Υ2 — ένας ΚΑΕΚ = ένας επαληθευμένος λογαριασμός', () => {
  it('🔴 ο ίδιος ΚΑΕΚ από δεύτερο λογαριασμό ⇒ pending-review [kaek-claimed-elsewhere], ΟΧΙ δεύτερος κάτοχος', async () => {
    const fake = world();
    await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE));
    const second = await submit(fake, 'user-2', 'ownp_b', deps(TRUSTED_SEAL, `ΔΙΚΑΙΟΥΧΟΣ: ΓΕΩΡΓΙΟΥ ΝΙΚΟΣ ΑΦΜ: ${TAX_B}`));
    expect(second).toMatchObject({ kind: 'judged', view: { status: 'pending-review', reasons: ['kaek-claimed-elsewhere'] } });
    expect(Object.values(fake.getAllDocs('ownership_kaek_claims'))[0]).toMatchObject({ uid: 'user-1' });
  });
});

describe('Υ3 / Υ4 — αρνήσεις πριν από κάθε ανάγνωση αρχείου', () => {
  it('ξένη αγγελία ⇒ not-your-property', async () => {
    expect(await submit(world(), 'user-2', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE))).toEqual({
      kind: 'refused',
      reason: 'not-your-property',
    });
  });

  it('λογαριασμός χωρίς ΑΦΜ ⇒ identity-incomplete', async () => {
    const fake = world();
    seedAccount(fake, 'user-1', 'Κωνσταντίνος', 'Παπαδόπουλος', '');
    expect(await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE))).toEqual({
      kind: 'refused',
      reason: 'identity-incomplete',
    });
  });
});

describe('Υ5 — εκδότης μη επιβεβαιωμένος (το σημερινό, κενό μητρώο)', () => {
  it('γνήσια σφραγίδα, άγνωστος φορέας ⇒ ουρά, καμία κλειδαριά', async () => {
    const fake = world();
    const outcome = await submit(fake, 'user-1', 'ownp_a', deps({ ...TRUSTED_SEAL, chainTrusted: false }, OWNER_LINE));
    expect(outcome).toMatchObject({ view: { status: 'pending-review', reasons: ['issuer-unconfirmed'] } });
    expect(fake.getAllDocs('ownership_kaek_claims')).toEqual({});
  });
});

describe('Υ6 — ο ΕΝΑΣ αναγνώστης', () => {
  it('επαληθευμένος μόνο για τον κάτοχο της απόδειξης, ΟΧΙ για άλλον uid στην ίδια αγγελία', async () => {
    const fake = world();
    await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE));
    expect(await isVerifiedOwner(asAdmin(fake), 'ownp_a', 'user-1')).toBe(true);
    expect(await isVerifiedOwner(asAdmin(fake), 'ownp_a', 'user-2')).toBe(false);
  });
});

describe('Υ7 — ελαχιστοποίηση', () => {
  it('🔒 ο ΑΦΜ δεν εμφανίζεται καθαρός σε ΚΑΝΕΝΑ γραμμένο έγγραφο', async () => {
    const fake = world();
    await submit(fake, 'user-1', 'ownp_a', deps(TRUSTED_SEAL, OWNER_LINE));
    const written = JSON.stringify([
      fake.getAllDocs('ownership_verifications'),
      fake.getAllDocs('ownership_kaek_claims'),
      fake.getAllDocs('tax_identity_claims'),
    ]);
    expect(written).not.toContain(TAX_A);
    expect(written).toContain('"last3":"709"');
  });
});
