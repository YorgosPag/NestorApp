/**
 * @jest-environment node
 *
 * @fileoverview ADR-898 Φ3β — **ο γραφέας των δηλώσεων της αντικειμενικής**: θεματοφυλακή από τη μία αρχή, μερική
 * διόρθωση **μέσα σε συναλλαγή** (καμία απάντηση δεν χάνεται όταν δύο φτάνουν μαζί), επαλήθευση του μετώπου στον
 * server, και η σειρά «γραφή → ίχνος → επαναπροβολή».
 * @related services/owner-property/owner-property-declarations.service.ts · lib/objective-value/objective-value-declarations.ts
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

type RecordCall = Record<string, unknown>;
const recordChange = jest.fn<Promise<string | null>, [RecordCall]>();
const zoneVerdict = jest.fn<Promise<ValueZoneVerdict>, [unknown]>();

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class RecordingAuditService extends actual.EntityAuditService {
    static override recordChange(params: RecordCall): Promise<string | null> {
      return recordChange(params);
    }
  }
  return { ...actual, EntityAuditService: RecordingAuditService };
});
jest.mock('@/services/market/value-zones.reader', () => ({
  readValueZoneAt: (position: unknown) => zoneVerdict(position),
}));
jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/test-utils/fake-firestore/fake-firestore') as
  typeof import('@/test-utils/fake-firestore/fake-firestore');
const { validOwnerProperty } = require('@/lib/owner-property/__tests__/owner-property-fixtures') as
  typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const { setOwnerPropertyObjectiveValueDeclarations: setDeclarations } = require('../owner-property-declarations.service') as
  typeof import('../owner-property-declarations.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const OWNER = { uid: 'user-1', companyId: null };
const STRANGER = { uid: 'user-2', companyId: null };

const FRONTED: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 'z1', name: 'Β', price: 1200, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [{ id: 'f1', name: 'Μ1', price: 1500, validFrom: '2022-01-01', street: 'Εγνατίας', distanceM: 8 }],
};

function seeded() {
  const property = validOwnerProperty();
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return { property, db, adminDb: db as unknown as AdminFirestore };
}

function storedDeclarations(db: InstanceType<typeof FakeFirestore>, id: string): unknown {
  const stored = db.all<Record<string, unknown>>(COLLECTIONS.OWNER_PROPERTIES).find((doc) => doc.id === id);
  return stored?.objectiveValueDeclarations;
}

beforeEach(() => {
  recordChange.mockReset();
  recordChange.mockResolvedValue('eaud_test');
  zoneVerdict.mockReset();
  zoneVerdict.mockResolvedValue(FRONTED);
});

describe('Δ1 — θεματοφυλακή και κανόνες', () => {
  it('ο κάτοχος γράφει · η δήλωση φτάνει στο έγγραφο και στη δημόσια αγγελία', async () => {
    const { property, db, adminDb } = seeded();
    const result = await setDeclarations(adminDb, property.id, { frontage: 'multiple', permitDate: '1998-03-15' }, OWNER);
    expect(result.kind).toBe('saved');
    expect(storedDeclarations(db, property.id)).toMatchObject({ frontage: 'multiple', permitDate: '1998-03-15', display: 'shown' });
    const published = db.all<Record<string, unknown>>(COLLECTIONS.PUBLIC_LISTINGS).find((doc) => doc.id === property.id);
    expect(published).toMatchObject({
      frontage: 'multiple',
      objectiveValueDeclarations: { display: 'shown', declared: { permitDate: '1998-03-15' } },
    });
  });

  it('ξένος ⇒ `absent` (ίδια απάντηση με «δεν υπάρχει») — και τίποτα δεν γράφεται', async () => {
    const { property, db, adminDb } = seeded();
    expect(await setDeclarations(adminDb, property.id, { frontage: 'single' }, STRANGER)).toEqual({ kind: 'absent' });
    expect(await setDeclarations(adminDb, 'ownp_missing', { frontage: 'single' }, OWNER)).toEqual({ kind: 'absent' });
    expect(storedDeclarations(db, property.id)).toMatchObject({ frontage: null });
  });

  it('ημερομηνία άδειας στο μέλλον ⇒ `invalid-declarations`, χωρίς καν ανάγνωση', async () => {
    const { property, adminDb } = seeded();
    const result = await setDeclarations(adminDb, property.id, { permitDate: '2999-01-01' }, OWNER);
    expect(result).toEqual({ kind: 'invalid-declarations', violations: ['permitDateInFuture'] });
  });

  it('απόκρυψη ⇒ η δημόσια αγγελία ΔΕΝ κρατά κανένα στοιχείο υπολογισμού', async () => {
    const { property, db, adminDb } = seeded();
    await setDeclarations(adminDb, property.id, { permitDate: '1998-03-15', hasElevator: true }, OWNER);
    await setDeclarations(adminDb, property.id, { display: 'hidden' }, OWNER);
    const published = db.all<Record<string, unknown>>(COLLECTIONS.PUBLIC_LISTINGS).find((doc) => doc.id === property.id);
    expect(published?.objectiveValueDeclarations).toEqual({ display: 'hidden' });
    // …αλλά οι δηλώσεις δεν χάνονται: ο κάτοχος τις ξαναβρίσκει όταν ξαναδείξει.
    expect(storedDeclarations(db, property.id)).toMatchObject({ display: 'hidden', permitDate: '1998-03-15', hasElevator: true });
  });
});

describe('Δ2 — 🔴 καμία απάντηση δεν χάνεται', () => {
  it('δύο απαντήσεις ΜΑΖΙ ⇒ επιβιώνουν και οι δύο (συναλλαγή, όχι «ανάγνωση και μετά set»)', async () => {
    const { property, db, adminDb } = seeded();
    await Promise.all([
      setDeclarations(adminDb, property.id, { frontage: 'single' }, OWNER),
      setDeclarations(adminDb, property.id, { hasElevator: false }, OWNER),
    ]);
    expect(storedDeclarations(db, property.id)).toMatchObject({ frontage: 'single', hasElevator: false });
  });

  it('ανταγωνιστής γράφει ανάμεσα στην ανάγνωση και το commit ⇒ η συναλλαγή ξανατρέχει πάνω στο φρέσκο', async () => {
    const { property, db, adminDb } = seeded();
    db.interfere = () => {
      db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, {
        ...property,
        objectiveValueDeclarations: { ...property.objectiveValueDeclarations, areaIncludesCommon: true },
      });
    };
    await setDeclarations(adminDb, property.id, { frontage: 'narrow' }, OWNER);
    expect(storedDeclarations(db, property.id)).toMatchObject({ frontage: 'narrow', areaIncludesCommon: true });
  });

  it('ρητό `null` σβήνει ΜΟΝΟ εκείνη την απάντηση', async () => {
    const { property, db, adminDb } = seeded();
    await setDeclarations(adminDb, property.id, { frontage: 'single', hasElevator: true }, OWNER);
    await setDeclarations(adminDb, property.id, { hasElevator: null }, OWNER);
    expect(storedDeclarations(db, property.id)).toMatchObject({ frontage: 'single', hasElevator: null });
  });
});

describe('Δ3 — το μέτωπο επαληθεύεται στον server', () => {
  it('δρόμος που είναι υποψήφιο μέτωπο στη θέση της αγγελίας ⇒ γράφεται', async () => {
    const { property, adminDb } = seeded();
    const result = await setDeclarations(adminDb, property.id, { zoneFront: { kind: 'street', street: 'Εγνατίας' } }, OWNER);
    expect(result.kind).toBe('saved');
    expect(zoneVerdict).toHaveBeenCalledWith(expect.objectContaining({ kind: 'known', point: { lat: 40.63, lng: 22.95 } }));
  });

  it('δρόμος που ΔΕΝ είναι μέτωπο ⇒ `zoneFrontNotCandidate`', async () => {
    const { property, adminDb } = seeded();
    const result = await setDeclarations(adminDb, property.id, { zoneFront: { kind: 'street', street: 'Τσιμισκή' } }, OWNER);
    expect(result).toEqual({ kind: 'invalid-declarations', violations: ['zoneFrontNotCandidate'] });
  });

  it('🔴 ζώνες που δεν διαβάστηκαν ⇒ `zone-unverified` (503), ΠΟΤΕ «άκυρο»', async () => {
    const { property, adminDb } = seeded();
    zoneVerdict.mockResolvedValue({ kind: 'unavailable' });
    const result = await setDeclarations(adminDb, property.id, { zoneFront: { kind: 'street', street: 'Εγνατίας' } }, OWNER);
    expect(result).toEqual({ kind: 'zone-unverified' });
  });

  it('«καμία πρόσοψη σε μέτωπο» δεν χρειάζεται ανάγνωση ζωνών', async () => {
    const { property, adminDb } = seeded();
    await setDeclarations(adminDb, property.id, { zoneFront: { kind: 'none' } }, OWNER);
    expect(zoneVerdict).not.toHaveBeenCalled();
  });
});

describe('Δ4 — ίχνος ελέγχου (CHECK 3.17)', () => {
  it('ΕΝΑ ίχνος ανά πράξη, με τα πεδία που άλλαξαν', async () => {
    const { property, adminDb } = seeded();
    await setDeclarations(adminDb, property.id, { frontage: 'single', display: 'hidden' }, OWNER);
    expect(recordChange).toHaveBeenCalledTimes(1);
    const fields = (recordChange.mock.calls[0][0].changes as ReadonlyArray<{ field: string }>).map((c) => c.field).sort();
    expect(fields).toEqual(['objectiveValueDeclarations.display', 'objectiveValueDeclarations.frontage']);
  });

  it('απόρριψη ⇒ κανένα ίχνος', async () => {
    const { property, adminDb } = seeded();
    await setDeclarations(adminDb, property.id, { frontage: 'single' }, STRANGER);
    expect(recordChange).not.toHaveBeenCalled();
  });
});
