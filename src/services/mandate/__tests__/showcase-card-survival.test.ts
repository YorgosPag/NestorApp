/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΚΑΡΤΑ ΕΠΙΒΙΩΝΕΙ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ — ΚΑΙ ΤΑ ΚΑΝΑΛΙΑ ΔΕΝ ΕΠΙΒΙΩΝΟΥΝ ΤΗΣ ΑΠΟΣΥΡΣΗΣ**
 *   (ADR-841 §7 Α21.16).
 * @related services/mandate/showcase-card-custody · services/mandate/agency-profile.service ·
 *   showcase-mark-survival.test.ts (το πρότυπο — ίδιο μάθημα, τρίτη φορά)
 *
 * Ρωτά **τον δίσκο**, ποτέ τι επέστρεψε η συνάρτηση:
 *   • Κ1 — αλλαγή επωνυμίας **δεν** σβήνει την κάρτα (το `set` χωρίς `merge`)
 *   • Κ2 — 🔴 το **δημόσιο** έγγραφο δεν κρατά **ποτέ** αριθμό ή email (άγκυρα διαρροής)
 *   • Κ3 — η απόσυρση σβήνει **και** τα ιδιωτικά κανάλια (ανάκληση συγκατάθεσης)
 *   • Κ4 — κάρτα χωρίς βιτρίνα: ονομαστική άρνηση, **τίποτα** δεν γράφεται
 *   • Κ5 — το reveal: ταυτόσημο `absent` για ανύπαρκτο κατάστημα / αποσυρμένη βιτρίνα
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type { ClassifiedOccupation } from '@/types/agency-profile';
import type { VerifiedLocationDeclaration } from '@/lib/agency/showcase-card-form';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
const markSources = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  getAdminFirestore: () => markSources,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcase, withdrawAgencyProfile } = require('../agency-profile.service') as
  typeof import('../agency-profile.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveShowcaseCard } = require('../showcase-card-custody') as typeof import('../showcase-card-custody');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { revealLocationCard, revealLocationChannels } = require('../showcase-card-reveal') as
  typeof import('../showcase-card-reveal');

const COMPANY = 'comp_card_0001';

const PAINTER: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/painter-fixture',
  label: { el: 'ελαιοχρωματιστής', en: 'painter' },
  iscoCode: '7131',
};

const HEADQUARTERS: VerifiedLocationDeclaration = {
  wire: {
    id: null,
    role: 'headquarters',
    label: null,
    place: { landId: 'land_thessaloniki', buildingId: null },
    street: { street: 'Τσιμισκή', number: '12', postalCode: '54624' },
    hours: null,
    phones: [{ number: '2310 123456', extension: null }],
    emails: ['office@vafes.gr'],
  },
  position: { lat: 40.63, lng: 22.94 },
};

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

async function raw(fake: FakeFirestore, collection: string): Promise<Record<string, unknown> | undefined> {
  const snap = await fake.collection(collection).doc(COMPANY).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
}

async function givenShowcase(admin: AdminFirestore, displayName = 'ΒΑΦΕΣ ΠΑΓΩΝΗ'): Promise<void> {
  const authority: ShowcaseAuthority = { kind: 'unregulated', companyId: COMPANY };
  const result = await publishShowcase(admin, authority, {
    alias: 'vafes-pagoni',
    displayName,
    credentials: [{ occupation: PAINTER, registrationNumber: '', registrationChapter: '' }],
    place: null,
    position: null,
    coverage: null,
  });
  if (result.kind !== 'published') throw new Error(`fixture: ${result.kind}`);
}

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
});

describe('🔴 Κ — Η ΚΑΡΤΑ ΩΣ ΠΡΑΞΗ', () => {
  it('🔴 Κ1 — αλλαγή ΜΟΝΟ της επωνυμίας ΔΕΝ σβήνει την κάρτα', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    expect((await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], null)).kind).toBe('saved');
    const before = (await raw(fake, COLLECTIONS.AGENCY_PROFILES))?.locations;

    await givenShowcase(admin, 'ΧΡΩΜΑΤΑ ΠΑΓΩΝΗ Α.Ε.');

    const after = await raw(fake, COLLECTIONS.AGENCY_PROFILES);
    expect(after?.displayName).toBe('ΧΡΩΜΑΤΑ ΠΑΓΩΝΗ Α.Ε.');
    expect(after?.locations).toEqual(before);
    expect((before as unknown[]).length).toBe(1);
  });

  it('🔴 Κ2 — ΤΟ ΔΗΜΟΣΙΟ ΕΓΓΡΑΦΟ ΔΕΝ ΚΡΑΤΑ ΑΡΙΘΜΟ Ή EMAIL· τα ιδιωτικά κρατούν', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], null);

    const publicDoc = JSON.stringify(await raw(fake, COLLECTIONS.AGENCY_PROFILES));
    expect(publicDoc).not.toContain('2310123456');
    expect(publicDoc).not.toContain('office@vafes.gr');
    expect(publicDoc).toContain('"channelKinds":["phone","email"]');

    const privateDoc = JSON.stringify(await raw(fake, COLLECTIONS.SHOWCASE_CARD_CHANNELS));
    expect(privateDoc).toContain('+302310123456');
    expect(privateDoc).toContain('office@vafes.gr');
  });

  it('🔴 Κ3 — η απόσυρση σβήνει ΚΑΙ τα ιδιωτικά κανάλια', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);
    await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], null);

    expect((await withdrawAgencyProfile(admin, COMPANY)).kind).toBe('withdrawn');

    expect(await raw(fake, COLLECTIONS.AGENCY_PROFILES)).toBeUndefined();
    expect(await raw(fake, COLLECTIONS.SHOWCASE_CARD_CHANNELS)).toBeUndefined();
  });

  it('🔑 Κ4 — κάρτα χωρίς βιτρίνα: ονομαστική άρνηση, κανένα κανάλι στον δίσκο', async () => {
    const { fake, admin } = db();

    const result = await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], null);

    expect(result).toEqual({ kind: 'rejected', reason: 'agency-profile-card-without-showcase' });
    expect(await raw(fake, COLLECTIONS.SHOWCASE_CARD_CHANNELS)).toBeUndefined();
  });

  it('🔑 Κ5 — reveal: ΜΟΝΟ του ζητούμενου καταστήματος, και ταυτόσημο absent αλλιώς', async () => {
    const { admin } = db();
    await givenShowcase(admin);
    const saved = await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], null);
    if (saved.kind !== 'saved') throw new Error(saved.kind);
    const locationId = saved.locations[0].id;

    expect(await revealLocationChannels(admin, COMPANY, locationId)).toEqual({
      kind: 'revealed',
      channels: {
        phones: [{ display: '+30 231 012 3456', href: 'tel:+302310123456' }],
        emails: ['office@vafes.gr'],
        emailConfirmations: [],
      },
    });
    expect(await revealLocationChannels(admin, COMPANY, 'sloc_unknown')).toEqual({ kind: 'absent' });

    await withdrawAgencyProfile(admin, COMPANY);
    expect(await revealLocationChannels(admin, COMPANY, locationId)).toEqual({ kind: 'absent' });
  });

  it('🔴 Κ7 — η ιστοσελίδα: κανονικοποιείται, ΕΠΙΒΙΩΝΕΙ της αλλαγής επωνυμίας, άκυρη ⇒ ονομασμένη άρνηση (Α21.17)', async () => {
    const { fake, admin } = db();
    await givenShowcase(admin);

    expect((await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], 'www.vafes.gr')).kind).toBe('saved');
    expect((await raw(fake, COLLECTIONS.AGENCY_PROFILES))?.website).toBe('https://www.vafes.gr/');

    await givenShowcase(admin, 'ΧΡΩΜΑΤΑ ΠΑΓΩΝΗ Α.Ε.');
    expect((await raw(fake, COLLECTIONS.AGENCY_PROFILES))?.website).toBe('https://www.vafes.gr/');

    expect(await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], 'https://bank.gr@evil.example')).toEqual({
      kind: 'rejected',
      reason: 'agency-profile-card-website-invalid',
    });
    expect((await raw(fake, COLLECTIONS.AGENCY_PROFILES))?.website).toBe('https://www.vafes.gr/');
  });

  it('🔴 Κ6 — η vCard διαβάζει τον ΙΔΙΟ αναγνώστη: ίδια κανάλια, ίδιο absent (Α21.17)', async () => {
    const { admin } = db();
    await givenShowcase(admin);
    const saved = await saveShowcaseCard(admin, COMPANY, [HEADQUARTERS], null);
    if (saved.kind !== 'saved') throw new Error(saved.kind);
    const locationId = saved.locations[0].id;

    const card = await revealLocationCard(admin, COMPANY, locationId);
    expect(card).toMatchObject({
      kind: 'revealed',
      showcase: { displayName: 'ΒΑΦΕΣ ΠΑΓΩΝΗ', alias: 'vafes-pagoni' },
      location: { id: locationId, street: { street: 'Τσιμισκή', number: '12', postalCode: '54624' } },
      channels: { phones: [{ e164: '+302310123456', extension: null }], emails: ['office@vafes.gr'] },
    });
    expect(await revealLocationCard(admin, COMPANY, 'sloc_unknown')).toEqual({ kind: 'absent' });

    await withdrawAgencyProfile(admin, COMPANY);
    expect(await revealLocationCard(admin, COMPANY, locationId)).toEqual({ kind: 'absent' });
  });
});
