/**
 * @jest-environment node
 *
 * @fileoverview ADR-777 §8.94 — **ο γραφέας του ενεργειακού πιστοποιητικού του ιδιώτη**: το μπλοκ και η αξίωση
 * νομιμότητας στην **ίδια** εγγραφή, και ό,τι από αυτά φτάνει στη δημόσια αγγελία.
 * @related services/owner-property/owner-property-energy-certificate.service.ts ·
 *   lib/energy-certificate/energy-certificate-claim.ts
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

type RecordCall = Record<string, unknown>;

const recordChange = jest.fn<Promise<string | null>, [RecordCall]>();

jest.mock('@/services/entity-audit.service', () => {
  const actual = jest.requireActual('@/services/entity-audit.service');
  class RecordingAuditService extends actual.EntityAuditService {
    static override recordChange(params: RecordCall): Promise<string | null> {
      return recordChange(params);
    }
  }
  return { ...actual, EntityAuditService: RecordingAuditService };
});
jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/listings/public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
// ADR-920 Β3β — το κεφάλι του εδάφους: αλλιώς το αληθινό θα ζητούσε κάδο.
jest.mock('@/services/listings/public-shelf-terrain.service', () => ({
  reconcilePublicTerrainShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
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
const { setOwnerPropertyEnergyCertificate: setEnergy } = require('../owner-property-energy-certificate.service') as
  typeof import('../owner-property-energy-certificate.service');
/* eslint-enable @typescript-eslint/no-require-imports */

const OWNER = { uid: 'user-1', companyId: null };
const STRANGER = { uid: 'user-2', companyId: null };

interface StoredSignal { readonly kind: string; readonly state: string; readonly value?: string | null }
interface StoredClaim { readonly kind: string; readonly tier: string; readonly value: string | null; readonly validUntil: string | null }

function seeded() {
  const property = validOwnerProperty();
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return { property, db, adminDb: db as unknown as AdminFirestore };
}

function docOf(db: InstanceType<typeof FakeFirestore>, collection: string, id: string): Record<string, unknown> | undefined {
  return db.all<Record<string, unknown>>(collection).find((doc) => doc.id === id);
}

function energySignalOf(listing: Record<string, unknown> | undefined): StoredSignal | undefined {
  return (listing?.legality as readonly StoredSignal[] | undefined)?.find((signal) => signal.kind === 'energy-performance');
}

beforeEach(() => {
  recordChange.mockReset();
  recordChange.mockResolvedValue('eaud_test');
});

describe('Ε1 — θεματοφυλακή και εγγραφή', () => {
  it('ο κάτοχος δηλώνει κλάση · φτάνει στο έγγραφο ΚΑΙ στη δημόσια αγγελία', async () => {
    const { property, db, adminDb } = seeded();

    const result = await setEnergy(adminDb, property.id, { class: 'B+' }, OWNER);

    expect(result.kind).toBe('saved');
    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.energy).toMatchObject({ class: 'B+', primaryEnergy: null });
    const listing = docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id);
    expect(listing?.energyClass).toBe('B+');
    expect(listing?.energyCertificate).toEqual({ primaryEnergy: null, co2Emissions: null, usefulArea: null, finalEnergy: null, scope: null, absence: null });
  });

  it('ξένος ή ανύπαρκτη αγγελία ⇒ `absent` — και τίποτα δεν γράφεται', async () => {
    const { property, db, adminDb } = seeded();

    expect(await setEnergy(adminDb, property.id, { class: 'A' }, STRANGER)).toEqual({ kind: 'absent' });
    expect(await setEnergy(adminDb, 'ownp_missing', { class: 'A' }, OWNER)).toEqual({ kind: 'absent' });

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.energy).toMatchObject({ class: null });
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('Ε2 — 🔴 μερική διόρθωση: καμία απάντηση δεν σβήνει την άλλη', () => {
  it('κλάση, αριθμοί και ημερομηνία σε χωριστές απαντήσεις επιβιώνουν όλα', async () => {
    const { property, db, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { class: 'C' }, OWNER);
    await setEnergy(adminDb, property.id, { primaryEnergy: 180.5 }, OWNER);
    await setEnergy(adminDb, property.id, { co2Emissions: 52 }, OWNER);
    await setEnergy(adminDb, property.id, { issuedOn: '2023-05-02' }, OWNER);

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.energy).toEqual({
      class: 'C',
      primaryEnergy: 180.5,
      co2Emissions: 52,
      issuedOn: '2023-05-02',
      usefulArea: null,
      finalEnergy: null,
      scope: null,
      sourceFileId: null,
      absence: null,
    });
    expect(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id)?.energyCertificate).toEqual({
      primaryEnergy: 180.5,
      co2Emissions: 52,
      usefulArea: null,
      finalEnergy: null,
      scope: null,
      absence: null,
    });
  });

  it('«υπό έκδοση» χωρίς κλάση φτάνει στην αγγελία ως λόγος απουσίας· δήλωση κλάσης το σβήνει', async () => {
    const { property, db, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { absence: 'pending' }, OWNER);
    expect(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id)?.energyCertificate).toMatchObject({ absence: 'pending' });

    await setEnergy(adminDb, property.id, { class: 'D' }, OWNER);
    expect(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id)?.energyCertificate).toMatchObject({ absence: null });
  });

  it('⛔ η ημερομηνία έκδοσης ΔΕΝ φτάνει στη δημόσια αγγελία ως πεδίο', async () => {
    const { property, db, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { class: 'C', issuedOn: '2023-05-02' }, OWNER);

    expect(JSON.stringify(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id)?.energyCertificate)).not.toContain('2023');
  });
});

describe('Ε3 — η αξίωση νομιμότητας γράφεται στην ΙΔΙΑ εγγραφή', () => {
  it('κλάση με ημερομηνία ⇒ αυτοδηλωμένη αξίωση με ισχύ +10 έτη · η αγγελία απαντά `declared`', async () => {
    const { property, db, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { class: 'B', issuedOn: '2023-05-02' }, OWNER);

    const claims = docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.legality as readonly StoredClaim[];
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ kind: 'energy-performance', tier: 'self-declared', value: 'B', validUntil: '2033-05-02' });
    expect(energySignalOf(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id))).toMatchObject({ state: 'declared', value: 'B' });
  });

  it('κλάση χωρίς ημερομηνία ⇒ `expiry-unknown` — ποτέ «ισχύει»', async () => {
    const { property, db, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { class: 'B' }, OWNER);

    expect(energySignalOf(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id))?.state).toBe('expiry-unknown');
  });

  it('🔴 ληγμένο πιστοποιητικό ⇒ `expired`', async () => {
    const { property, db, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { class: 'E', issuedOn: '2012-01-10' }, OWNER);

    expect(energySignalOf(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id))?.state).toBe('expired');
  });

  it('σβήσιμο κλάσης ⇒ η αξίωση φεύγει, η αγγελία απαντά `undeclared`', async () => {
    const { property, db, adminDb } = seeded();
    await setEnergy(adminDb, property.id, { class: 'B', issuedOn: '2023-05-02' }, OWNER);

    await setEnergy(adminDb, property.id, { class: null }, OWNER);

    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.legality).toEqual([]);
    expect(energySignalOf(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id))?.state).toBe('undeclared');
  });
});

describe('Ε4 — το ίχνος', () => {
  it('ΕΝΑ ίχνος, με το πεδίο που άλλαξε', async () => {
    const { property, adminDb } = seeded();

    await setEnergy(adminDb, property.id, { class: 'C' }, OWNER);

    expect(recordChange).toHaveBeenCalledTimes(1);
    const changes = recordChange.mock.calls[0][0].changes as ReadonlyArray<{ readonly field: string }>;
    expect(changes.map((change) => change.field)).toEqual(['energy.class']);
  });
});

describe('Ε5 — ADR-915 Φ3β-2: η δήλωση διαβάζεται απέναντι στο ΠΕΑ του φακέλου', () => {
  const FILE = {
    userId: 'user-1', entityType: 'property_dossier', entityId: 'pdos_1', status: 'ready', contentType: 'application/pdf',
    storagePath: 'people/user-1/x.pdf',
    documentFacts: {
      kind: 'energy-certificate', issuedOn: '2023-05-02', printedValidUntil: '2033-04-30',
      source: { kind: 'document-text', reader: 'pea-text' }, recordedBy: 'user-1', recordedAt: '2026-10-14T09:00:00.000Z',
    },
  };
  const FROM_PEA = { class: 'B' as const, issuedOn: '2023-05-02', sourceFileId: 'file_pea_1' };

  function seededWithFile(file: Record<string, unknown> = FILE) {
    const property = validOwnerProperty({ dossierId: 'pdos_1' });
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
    db.seed(COLLECTIONS.FILES_PERSONAL, 'file_pea_1', file);
    return { property, db, adminDb: db as unknown as AdminFirestore };
  }
  const claimOf = (db: InstanceType<typeof FakeFirestore>, id: string) =>
    (docOf(db, COLLECTIONS.OWNER_PROPERTIES, id)?.legality as readonly StoredClaim[])[0];

  it('🔴 η αξίωση παίρνει την τυπωμένη λήξη του αρχείου (Α4)', async () => {
    const { property, db, adminDb } = seededWithFile();

    expect((await setEnergy(adminDb, property.id, FROM_PEA, OWNER)).kind).toBe('saved');
    expect(claimOf(db, property.id).validUntil).toBe('2033-04-30');
  });

  it('🔴 Α3: δήλωση χωρίς ημερομηνία, αρχείο που την ξέρει ⇒ ΟΧΙ `expiry-unknown`', async () => {
    const { property, db, adminDb } = seededWithFile();

    await setEnergy(adminDb, property.id, { ...FROM_PEA, issuedOn: null }, OWNER);

    expect(claimOf(db, property.id).validUntil).toBe('2033-04-30');
    expect(energySignalOf(docOf(db, COLLECTIONS.PUBLIC_LISTINGS, property.id))?.state).toBe('declared');
  });

  it('🔒 αρχείο ΑΛΛΟΥ χρήστη ⇒ τα γεγονότα του αγνοούνται', async () => {
    const { property, db, adminDb } = seededWithFile({ ...FILE, userId: 'user-2' });

    await setEnergy(adminDb, property.id, FROM_PEA, OWNER);

    expect(claimOf(db, property.id).validUntil).toBe('2033-05-02');
  });

  it('🔴 πλαστό σώμα (πηγή + ημερομηνία ≠ ανάγνωσης) ⇒ άρνηση με όνομα, ΤΙΠΟΤΑ δεν γράφεται', async () => {
    const { property, db, adminDb } = seededWithFile();

    const result = await setEnergy(adminDb, property.id, { ...FROM_PEA, issuedOn: '2023-05-01' }, OWNER);

    expect(result).toEqual({ kind: 'invalid-energy-certificate', violations: ['issued-on-contradicts-document'] });
    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.energy).toMatchObject({ class: null });
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('τίμιος πελάτης που αλλάζει την ημερομηνία ⇒ η πηγή σβήνει, καμία άρνηση', async () => {
    const { property, db, adminDb } = seededWithFile();
    await setEnergy(adminDb, property.id, FROM_PEA, OWNER);

    const result = await setEnergy(adminDb, property.id, { issuedOn: '2023-05-01' }, OWNER);

    expect(result.kind).toBe('saved');
    expect(docOf(db, COLLECTIONS.OWNER_PROPERTIES, property.id)?.energy).toMatchObject({ sourceFileId: null, issuedOn: '2023-05-01' });
    expect(claimOf(db, property.id).validUntil).toBe('2033-05-01');
  });
});
