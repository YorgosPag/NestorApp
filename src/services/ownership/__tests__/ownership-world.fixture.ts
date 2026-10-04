/**
 * Ο κόσμος των αγκυρών κατοχής (ADR-900 §3.8 · §8 #2) — λογαριασμοί, αγγελίες, σφραγίδα, ΠΚΑ — **ένα** σημείο για
 * την επαλήθευση (`ownership-verification.service.test`) και την ανάκληση (`ownership-verification-revoke.service.test`).
 * Τα πρόσωπα και οι ΑΦΜ είναι συνθετικά. Τα `jest.mock` μένουν σε κάθε σουίτα (ανυψώνονται ανά αρχείο).
 */
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { PdfSealVerdict } from '@/server/pdf-seal/pdf-seal.types';
import type { OwnerProperty } from '@/types/owner-property';
import { submitOwnershipVerification, type SubmitDeps } from '../ownership-verification.service';

export const NOW = '2026-10-02T12:00:00.000Z';
export const TAX_A = '123456709';
export const TAX_B = '123535891';
export const KAEK = '050681726003/0/1';

process.env.OWNERSHIP_TAX_ID_HMAC_SECRET = 'test-secret-for-hmac';
process.env.PUBLIC_UNIT_ID_HMAC_SECRET = 'test-secret-for-public-unit';

export const asAdmin = (fake: FakeFirestore) => fake as unknown as Parameters<typeof submitOwnershipVerification>[0];

export function seedAccount(fake: FakeFirestore, uid: string, givenName: string, familyName: string, vatNumber: string) {
  fake.seed('users', uid, { givenName, familyName, email: `${uid}@example.test`, vatNumber });
}

export function seedListing(fake: FakeFirestore, id: string, uid: string, overrides: Partial<OwnerProperty> = {}) {
  fake.seed('owner_properties', id, { ...validOwnerProperty({ id, authorUserId: uid, ...overrides }), dossierId: `pdos_${id}` });
  fake.seed('files_personal', `file_${id}`, {
    userId: uid, entityType: 'property_dossier', entityId: `pdos_${id}`,
    status: 'ready', contentType: 'application/pdf', storagePath: `x/${id}.pdf`,
  });
}

export const TRUSTED_SEAL: PdfSealVerdict = {
  kind: 'valid',
  signer: { commonName: 'TEST', organization: 'TEST', organizationIdentifier: 'VATEL-KTIMATOLOGIO-TEST', certificateSha256: 'aa' },
  signedAt: '2026-09-30T08:00:00.000Z',
  timestamped: true,
  chainTrusted: true,
};

export function deps(seal: PdfSealVerdict, beneficiaryLine: string, nowIso: string = NOW): SubmitDeps {
  return {
    verifySeal: async () => seal,
    readPdfText: async () => [`ΚΑΕΚ ${KAEK}\n${beneficiaryLine}`],
    readBytes: async () => ({ size: 10, read: async () => Buffer.from('%PDF-synthetic') }),
    nowIso,
  };
}

export const OWNER_LINE = `ΔΙΚΑΙΟΥΧΟΣ: ΠΑΠΑΔΟΠΟΥΛΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ ΑΦΜ: ${TAX_A}`;
export const OWNER_B_LINE = `ΔΙΚΑΙΟΥΧΟΣ: ΓΕΩΡΓΙΟΥ ΝΙΚΟΣ ΑΦΜ: ${TAX_B}`;

export function world(): FakeFirestore {
  const fake = new FakeFirestore();
  seedAccount(fake, 'user-1', 'Κωνσταντίνος', 'Παπαδόπουλος', TAX_A);
  seedAccount(fake, 'user-2', 'Νίκος', 'Γεωργίου', TAX_B);
  seedListing(fake, 'ownp_a', 'user-1');
  seedListing(fake, 'ownp_b', 'user-2');
  return fake;
}

export const submit = (fake: FakeFirestore, uid: string, ownerPropertyId: string, d: SubmitDeps) =>
  submitOwnershipVerification(asAdmin(fake), { uid, ownerPropertyId, fileId: `file_${ownerPropertyId}` }, d);

// ── Η ΔΗΜΟΣΙΑ ΜΟΝΑΔΑ (ADR-900 §8 #2, 2β.4) — αγγελίες δεμένες σε κτίριο ──────────────────────────────────────
export const linkedTo = (buildingId: string | null, floor = 3): Partial<OwnerProperty> => ({
  floor,
  place: {
    kind: 'declared',
    point: { lat: 40.63, lng: 22.95 },
    label: 'Εγνατίας 147, Θεσσαλονίκη',
    accuracy: 'exact',
    link: { landId: 'land_1', buildingId },
  },
});

export function linkedWorld(buildingId: string | null = 'pbld_1'): FakeFirestore {
  const fake = world();
  seedListing(fake, 'ownp_a', 'user-1', linkedTo(buildingId));
  seedListing(fake, 'ownp_b', 'user-2', linkedTo(buildingId, 5));
  return fake;
}

export const units = (fake: FakeFirestore) => fake.getAllDocs('public_units');
