/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α41.3 · Α41.4 του ADR-866 Φ1.3** — η αγγελία γεννιέται **με** τον φάκελό της, σε **μία**
 * συναλλαγή, και η βιτρίνα της τρέφεται από τα **δηλωμένα** αρχεία του φακέλου.
 * @related ADR-866 §2.11 · services/owner-property/owner-property-dossier-birth ·
 *   services/property-dossier/property-dossier-write.service (`stagePropertyDossierForListing`)
 *
 * Εκτελεί την **πραγματική** `createOwnerProperty` πάνω σε ψεύτικη Firestore (με αληθινή σημασιολογία συναλλαγής:
 * `create` πετά σε υπάρχον, το σώμα ξανατρέχει σε σύγκρουση). Μοκάρονται **μόνο** η γραφή ίχνους (για να μετρηθεί) και
 * τα ράφια (αλλιώς GCS) — το ράφι φωτογραφιών **καταγράφει** ποιες πηγές του ζητήθηκαν.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | η αγγελία γράφεται **έξω** από τη συναλλαγή του φακέλου | Α41.3 «ξένος ⇒ τίποτα» |
 * | σύνδεση σε ξένο φάκελο | Α41.3 «ξένος» |
 * | ίχνος φακέλου και σε **σύνδεση** | Α41.3 «υπάρχων» |
 * | η δημοσίευση διαβάζει `media[]` σε αγγελία με φάκελο | Α41.4 |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

type RecordCall = Record<string, unknown>;
const recordChange = jest.fn<Promise<string | null>, [RecordCall]>();
const shelfSources = jest.fn<void, [readonly { readonly privateStoragePath: string }[]]>();

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
  reconcilePublicShelf: async (_kind: unknown, _id: string, sources: readonly { privateStoragePath: string }[]) => {
    shelfSources(sources);
    return { outcome: 'reconciled', published: [], removed: 0, rejected: 0 };
  },
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: async () => ({ outcome: 'reconciled', published: [], removed: 0, rejected: 0 }),
}));
jest.mock('@/services/mandate/showcase-presence.service', () => ({
  refreshShowcasePresence: async () => undefined,
}));

const { COLLECTIONS } = require('@/config/firestore-collections') as
  typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as
  typeof import('@/services/places/__tests__/fake-firestore');
const { validDraft } = require('@/lib/owner-property/__tests__/owner-property-fixtures') as
  typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const write = require('../owner-property-write.service') as
  typeof import('../owner-property-write.service');

const DOSSIER_ID = 'pdos_a';
const AUTHORSHIP = { id: 'ownp_new', authorUserId: 'user-1', authorCompanyId: null, mandates: [], dossierId: DOSSIER_ID };

function stored(db: InstanceType<typeof FakeFirestore>, collection: string, id: string): Record<string, unknown> | null {
  return JSON.parse(db.snapshotOf(collection, id)) as Record<string, unknown> | null;
}

function dossierAudits(): RecordCall[] {
  return recordChange.mock.calls.map(([call]) => call).filter((call) => call.entityType === 'property_dossier');
}

beforeEach(() => {
  recordChange.mockReset();
  recordChange.mockResolvedValue('eaud_test');
  shelfSources.mockReset();
});

describe('Α41.3 — αγγελία + φάκελος σε ΜΙΑ συναλλαγή: γέννηση ή σύνδεση, ποτέ ξένος', () => {
  it('φάκελος που δεν υπάρχει ⇒ γεννιέται με τίτλο/είδος της αγγελίας, ίδια στιγμή, με ίχνος', async () => {
    const db = new FakeFirestore();

    const result = await write.createOwnerProperty(db as unknown as AdminFirestore, AUTHORSHIP, validDraft());

    expect(result.kind).toBe('saved');
    const dossier = stored(db, COLLECTIONS.PROPERTY_DOSSIERS, DOSSIER_ID);
    const listing = stored(db, COLLECTIONS.OWNER_PROPERTIES, 'ownp_new');
    expect(dossier).toMatchObject({ id: DOSSIER_ID, userId: 'user-1', label: 'Διαμέρισμα 92 τ.μ.', type: 'apartment', lifecycle: 'active' });
    expect(listing).toMatchObject({ dossierId: DOSSIER_ID });
    expect(dossier?.createdAt).toBe(listing?.createdAt);
    expect(dossierAudits()).toEqual([expect.objectContaining({ action: 'created', entityId: DOSSIER_ID })]);
  });

  it('φάκελος που υπάρχει, ΔΙΚΟΣ του (γεννήθηκε στο πρώτο ανέβασμα) ⇒ σύνδεση, όνομα αμετάβλητο, κανένα ίχνος φακέλου', async () => {
    const db = new FakeFirestore();
    const own = { id: DOSSIER_ID, userId: 'user-1', label: 'Το σπίτι μου', type: 'apartment', lifecycle: 'active', createdAt: 'x', updatedAt: 'x' };
    db.seed(COLLECTIONS.PROPERTY_DOSSIERS, DOSSIER_ID, own);

    const result = await write.createOwnerProperty(db as unknown as AdminFirestore, AUTHORSHIP, validDraft());

    expect(result.kind).toBe('saved');
    expect(stored(db, COLLECTIONS.PROPERTY_DOSSIERS, DOSSIER_ID)).toMatchObject({ label: 'Το σπίτι μου' });
    expect(stored(db, COLLECTIONS.OWNER_PROPERTIES, 'ownp_new')).toMatchObject({ dossierId: DOSSIER_ID });
    expect(dossierAudits()).toEqual([]);
  });

  it('ΞΕΝΟΣ φάκελος ⇒ `absent`, καμία αγγελία, κανένα ίχνος (ποτέ επιβεβαίωση ύπαρξης)', async () => {
    const db = new FakeFirestore();
    // ⚠️ **ΕΓΚΥΡΟΣ φάκελος, μόνο ο κάτοχος διαφέρει**: χωρίς `createdAt`/`updatedAt` το σύνορο τον διαβάζει `null` και
    //    η άγκυρα θα περνούσε από τον κλάδο «μη αναγνώσιμο» — η μετάλλαξη M4 το απέδειξε (έμεινε πράσινη).
    const foreign = { id: DOSSIER_ID, userId: 'user-2', label: 'Ξένο', type: null, lifecycle: 'active', createdAt: 'x', updatedAt: 'x' };
    db.seed(COLLECTIONS.PROPERTY_DOSSIERS, DOSSIER_ID, foreign);

    const result = await write.createOwnerProperty(db as unknown as AdminFirestore, AUTHORSHIP, validDraft());

    expect(result.kind).toBe('absent');
    expect(stored(db, COLLECTIONS.OWNER_PROPERTIES, 'ownp_new')).toBeNull();
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('επανάληψη της ίδιας γέννησης ⇒ αποτυχία, ΟΧΙ δεύτερος φάκελος ούτε δεύτερο ίχνος', async () => {
    const db = new FakeFirestore();
    const adminDb = db as unknown as AdminFirestore;
    await write.createOwnerProperty(adminDb, AUTHORSHIP, validDraft());
    recordChange.mockClear();

    const replay = await write.createOwnerProperty(adminDb, AUTHORSHIP, validDraft());

    expect(replay.kind).toBe('failed');
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Ε-Φ1-2 — φάκελος σε αγγελία ΓΡΑΦΕΙΟΥ ⇒ άρνηση (σφάλμα δικό μας), τίποτα δεν γράφεται', async () => {
    const db = new FakeFirestore();
    const mandate = { agencyCompanyId: 'comp_a' } as unknown as (typeof AUTHORSHIP.mandates)[number];

    const result = await write.createOwnerProperty(
      db as unknown as AdminFirestore,
      { ...AUTHORSHIP, authorCompanyId: 'comp_a', mandates: [mandate] },
      validDraft(),
    );

    expect(result.kind).toBe('failed');
    expect(stored(db, COLLECTIONS.PROPERTY_DOSSIERS, DOSSIER_ID)).toBeNull();
  });
});

describe('Α41.4 — η βιτρίνα αγγελίας με φάκελο = τα ΔΗΛΩΜΕΝΑ αρχεία του φακέλου', () => {
  it('δηλωμένη φωτογραφία του φακέλου φτάνει στο ράφι· το `media[]` και τα αδήλωτα όχι', async () => {
    const db = new FakeFirestore();
    const base = {
      entityType: 'property_dossier', entityId: DOSSIER_ID, userId: 'user-1', contentType: 'image/png', status: 'ready',
      lifecycleState: 'active', isDeleted: false, createdAt: '2026-09-22T10:00:00.000Z', domain: 'sales', category: 'photos', purpose: 'view',
    };
    db.seed(COLLECTIONS.FILES_PERSONAL, 'file_view', { ...base, storagePath: 'people/user-1/declared.png' });
    db.seed(COLLECTIONS.FILES_PERSONAL, 'file_other', { ...base, storagePath: 'people/user-1/undeclared.png' });
    const draft = validDraft({
      publishedFileIds: ['file_view'],
      media: [{ storagePath: 'owner_properties/user-1/old.png', fileName: 'old.png', sizeBytes: 1, uploadedAt: 'x', published: true }],
    });

    const result = await write.createOwnerProperty(db as unknown as AdminFirestore, AUTHORSHIP, draft);

    expect(result.kind).toBe('saved');
    const requested = shelfSources.mock.calls.flatMap(([sources]) => sources.map((s) => s.privateStoragePath));
    expect(requested).toEqual(['people/user-1/declared.png']);
  });
});
