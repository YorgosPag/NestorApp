/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΝΟΜΙΚΗ ΤΑΥΤΟΤΗΤΑ ΣΤΟΝ ΔΙΣΚΟ — δημοσίευση ΚΑΙ ανανέωση** (ADR-841 §7 Α23, Φ3.1).
 * @related services/mandate/showcase-legal-identity-custody · services/mandate/agency-profile.service
 *
 * Ρωτά **τον δίσκο**, ποτέ τι επέστρεψε η συνάρτηση:
 *   • Δ1-Δ3 — δημοσίευση: σήμα ΓΕΜΗ στην ταυτότητα **και** στο διαπιστευτήριο μεσίτη (Α9.2) · τίτλος
 *   • Α1-Α4 — ανανέωση: μετονομασία ρίχνει το σήμα · αποσυρμένη επωνυμία ⇒ ταυτότητα `null` · ιδεμποτής · παλιά βιτρίνα
 *   • Κ1 — η οδός της κάρτας τροφοδοτεί το `business-address`, και η αλλαγή της φτάνει με ανανέωση
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';
import { requireBrokerageCapability, isBrokerageDenial } from '@/lib/auth/brokerage-authority';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { VerifiedLocationDeclaration } from '@/lib/agency/showcase-card-form';
import type { ClassifiedOccupation } from '@/types/agency-profile';
import type { ShowcaseLegalDeclaration } from '@/types/showcase-legal-identity';
import { REGISTRY_CHECKED_AT, registryRecord } from '@/lib/company/__fixtures__/registry-record-fixture';
import { givenCompanyProfile, givenRegistryCheck } from './showcase-legal-fixture';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
const markSources = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  getAdminFirestore: () => markSources,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcase } = require('../agency-profile.service') as typeof import('../agency-profile.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveShowcaseCard } = require('../showcase-card-custody') as typeof import('../showcase-card-custody');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { refreshShowcaseLegalIdentity } = require('../showcase-legal-identity-custody') as
  typeof import('../showcase-legal-identity-custody');

const COMPANY = 'comp_legal_0001';

const BROKER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab',
  label: { el: 'μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας', en: 'real estate agent' },
  iscoCode: '3334',
};

const ACTIVE = {
  brokerage_listings: {
    status: 'active' as const,
    requirements: [],
    declaration: null,
    decidedByUserId: 'user-super',
    decidedAt: '2026-08-20T10:00:00.000Z',
    revocationReason: null,
  },
};

function brokerAuthority(): ShowcaseAuthority {
  const verdict = requireBrokerageCapability(COMPANY, ACTIVE);
  if (isBrokerageDenial(verdict)) throw new Error('το fixture οφείλει να είναι ενεργό');
  return { kind: 'regulated', proof: verdict };
}

function headquarters(street: string): VerifiedLocationDeclaration {
  return {
    wire: {
      id: null,
      role: 'headquarters',
      label: null,
      place: { landId: 'land_thessaloniki', buildingId: null },
      street: { street, number: '12', postalCode: '54624' },
      hours: null,
      phones: [],
      emails: [],
    },
    position: { lat: 40.63, lng: 22.94 },
  };
}

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  givenCompanyProfile(fake, COMPANY);
  return { fake, admin: fake as unknown as AdminFirestore };
}

async function stored(fake: FakeFirestore): Promise<Record<string, unknown>> {
  const snap = await fake.collection(COLLECTIONS.AGENCY_PROFILES).doc(COMPANY).get();
  if (!snap.exists) throw new Error('καμία βιτρίνα στον δίσκο');
  return snap.data() as Record<string, unknown>;
}

async function publish(admin: AdminFirestore, legal: Partial<ShowcaseLegalDeclaration> = {}) {
  return publishShowcase(admin, brokerAuthority(), {
    alias: 'pagonis',
    legal: { publicName: { kind: 'legal-name' }, seatDisclosure: null, ...legal },
    credentials: [{ occupation: BROKER, registrationNumber: '', registrationChapter: '' }],
    place: null,
    position: null,
    coverage: null,
  });
}

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
});

describe('Δ — η δημοσίευση γράφει τη νομική ταυτότητα', () => {
  it('🔴 Δ1 — επαληθευμένη ⇒ σήμα ΓΕΜΗ με ημερομηνία ΚΑΙ το διαπιστευτήριο του μεσίτη `verified` (Α9.2)', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);

    expect((await publish(admin)).kind).toBe('published');

    const doc = await stored(fake);
    expect(doc.displayName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
    expect(doc.legalIdentity).toMatchObject({
      legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
      gemiNumber: '123456789000',
      attestation: { state: 'verified', issuer: 'gemi', checkedAt: REGISTRY_CHECKED_AT },
    });
    expect((doc.credentials as { attestation: unknown }[])[0]?.attestation).toEqual({
      state: 'verified',
      registration: { authorityKind: 'national', authority: 'gemi', number: '123456789000' },
    });
  });

  it('🔑 Δ2 — χωρίς έλεγχο ΓΕΜΗ ⇒ `declared` και στα δύο: κανένα σήμα χωρίς απάντηση αρχής', async () => {
    const { fake, admin } = db();

    await publish(admin);

    const doc = await stored(fake);
    expect((doc.legalIdentity as { attestation: unknown }).attestation).toEqual({ state: 'declared' });
    expect((doc.credentials as { attestation: { state: string } }[])[0]?.attestation.state).toBe('declared');
  });

  it('🔴 Δ3 — τίτλος εκτός ΓΕΜΗ ⇒ ονομασμένη άρνηση, και ΤΙΠΟΤΑ στον δίσκο', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);

    const result = await publish(admin, { publicName: { kind: 'distinctive-title', title: 'Δοκιμαστικό Γραφείο' } });

    expect(result).toEqual({ kind: 'rejected', reason: 'agency-profile-title-not-in-registry' });
    await expect(stored(fake)).rejects.toThrow('καμία βιτρίνα');
  });
});

describe('Α — η ανανέωση: το στιγμιότυπο δεν μπαγιατεύει σιωπηλά', () => {
  it('🔴 Α1 — ΜΕΤΟΝΟΜΑΣΙΑ στο προφίλ ⇒ νέο όνομα, σήμα ΠΕΦΤΕΙ (ταυτότητα ΚΑΙ διαπιστευτήριο)', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);
    await publish(admin);
    givenCompanyProfile(fake, COMPANY, { businessName: 'ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.' });

    expect(await refreshShowcaseLegalIdentity(admin, COMPANY)).toEqual({ kind: 'refreshed', publicNameChanged: true });

    const doc = await stored(fake);
    expect(doc.displayName).toBe('ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.');
    expect((doc.legalIdentity as { attestation: unknown }).attestation).toEqual({ state: 'declared' });
    expect((doc.credentials as { attestation: { state: string } }[])[0]?.attestation.state).toBe('declared');
  });

  it('🔴 Α2 — η κρίση δεν περνά πια ⇒ ταυτότητα `null` (ψευδώς αρνητικό, ποτέ ψευδώς θετικό), όνομα μένει', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);
    await publish(admin);
    givenCompanyProfile(fake, COMPANY, { businessName: '' });

    expect(await refreshShowcaseLegalIdentity(admin, COMPANY)).toEqual({
      kind: 'withheld',
      reason: 'agency-profile-name-missing',
    });

    const doc = await stored(fake);
    expect(doc.legalIdentity).toBeNull();
    expect(doc.displayName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
    expect((doc.credentials as { attestation: { state: string } }[])[0]?.attestation.state).toBe('declared');
  });

  it('🔴 Α2α — το ΓΕΜΗ λέει ΑΝΕΝΕΡΓΗ ⇒ ταυτότητα ΜΕΝΕΙ με κλείσιμο, σήμα ΠΕΦΤΕΙ, όνομα μένει (GBP «Οριστικά κλειστή»)', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);
    await publish(admin);
    givenRegistryCheck(fake, COMPANY, registryRecord({ status: { code: { id: '9', label: 'Διαγραμμένη' }, activity: 'inactive' } }));

    expect(await refreshShowcaseLegalIdentity(admin, COMPANY)).toEqual({ kind: 'refreshed', publicNameChanged: false });

    const doc = await stored(fake);
    // 🔑 Το όνομα ΔΕΝ αλλάζει με το κλείσιμο (ορθογραφία του μητρώου) ⇒ καμία επανεγγραφή αγγελιών.
    expect(doc.displayName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
    expect(doc.legalIdentity).toMatchObject({
      legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
      attestation: { state: 'declared' },
      registryClosure: { issuer: 'gemi', checkedAt: REGISTRY_CHECKED_AT },
    });
    expect((doc.credentials as { attestation: { state: string } }[])[0]?.attestation.state).toBe('declared');
  });

  it('🔴 Α2β — ο τίτλος ΔΕΝ στηρίζεται πια από το ΓΕΜΗ ⇒ όνομα = ΕΠΩΝΥΜΙΑ, και οι αγγελίες ενημερώνονται', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);
    await publish(admin, { publicName: { kind: 'distinctive-title', title: 'ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ' } });
    givenRegistryCheck(fake, COMPANY, registryRecord({ distinctiveTitles: [] }));

    expect(await refreshShowcaseLegalIdentity(admin, COMPANY)).toEqual({ kind: 'refreshed', publicNameChanged: true });

    const doc = await stored(fake);
    expect(doc.displayName).toBe('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ');
    expect(doc.legalIdentity).toMatchObject({ publicName: 'legal-name' });
  });

  it('🔴 Δ4 — ΝΕΑ δημοσίευση κλεισμένης στο ΓΕΜΗ ⇒ registry-inactive, και ΤΙΠΟΤΑ στον δίσκο', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY, registryRecord({ status: { code: null, activity: 'inactive' } }));

    expect(await publish(admin)).toEqual({ kind: 'rejected', reason: 'agency-profile-registry-inactive' });
    await expect(stored(fake)).rejects.toThrow('καμία βιτρίνα');
  });

  it('🔑 Α3 — ΙΔΕΜΠΟΤΗΣ: καμία αλλαγή εισόδου ⇒ ίδιο έγγραφο, ίδιο `publishedAt`', async () => {
    const { fake, admin } = db();
    givenRegistryCheck(fake, COMPANY);
    await publish(admin);
    const before = await stored(fake);

    expect(await refreshShowcaseLegalIdentity(admin, COMPANY)).toEqual({ kind: 'refreshed', publicNameChanged: false });

    expect(await stored(fake)).toEqual(before);
  });

  it('🔴 Α4 — ΠΑΛΙΑ βιτρίνα (πριν την Α23) ⇒ not-applicable, κανένα άγγιγμα: η επιλογή δεν επινοείται', async () => {
    const { fake, admin } = db();
    const legacy = { alias: 'pagonis', displayName: 'Δοκιμαστικό', gemiNumber: '123456789000', publishedAt: '2026-09-01T10:00:00.000Z' };
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, legacy);

    expect(await refreshShowcaseLegalIdentity(admin, COMPANY)).toEqual({ kind: 'not-applicable' });
    expect(await stored(fake)).toEqual(legacy);
  });
});

describe('Κ — η κάρτα τροφοδοτεί την «διεύθυνση επιχείρησης»', () => {
  it('🔴 Κ1 — business-address: οδός της κάρτας στη δημοσίευση, και η ΑΛΛΑΓΗ της φτάνει με ανανέωση', async () => {
    const { fake, admin } = db();
    await publish(admin);
    expect((await saveShowcaseCard(admin, COMPANY, [headquarters('Τσιμισκή')], null)).kind).toBe('saved');

    await publish(admin, { seatDisclosure: 'business-address' });
    expect((await stored(fake)).legalIdentity).toMatchObject({ seat: { disclosure: 'business-address', streetLine: 'Τσιμισκή 12' } });

    await saveShowcaseCard(admin, COMPANY, [headquarters('Εγνατίας')], null);
    await refreshShowcaseLegalIdentity(admin, COMPANY);

    expect((await stored(fake)).legalIdentity).toMatchObject({ seat: { streetLine: 'Εγνατίας 12' } });
  });

  it('🔑 Κ2 — business-address ΧΩΡΙΣ οδό στην κάρτα ⇒ seat-address-missing', async () => {
    const { admin } = db();

    expect(await publish(admin, { seatDisclosure: 'business-address' })).toEqual({
      kind: 'rejected',
      reason: 'agency-profile-seat-address-missing',
    });
  });
});
