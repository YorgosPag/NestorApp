/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α36.1–Α36.6 του ADR-866 Φ1.1** — η γέννηση του φακέλου: ένα ίχνος στο
 * **προσωπικό** βιβλίο, ποτέ για γραφή που απέτυχε, ιδεμπότητη επανάληψη, καμία επιβεβαίωση ξένου
 * φακέλου, και σταδιοποίηση που **μόνο** γράφει (για τη δέσμη της αγγελίας, Ε-Φ1-1).
 * @related ADR-866 §2.8 · services/property-dossier/property-dossier-write.service.ts
 *
 * Εκτελεί τον **πραγματικό** γραφέα πάνω σε ψεύτικη Firestore, με τον **πραγματικό** υπολογισμό
 * διαφοράς (`EntityAuditService.diffFields` + `PROPERTY_DOSSIER_TRACKED_FIELDS`). Μοκάρεται **μόνο** η
 * εγγραφή του ίχνους (`recordChange`), για να μετρηθεί τι της ζητήθηκε.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | ίχνος **πριν** το `commit()` | Α36.2 ⇒ 🔴 |
 * | βιβλίο από τον δρώντα / χωρίς `userId` | Α36.1 ⇒ 🔴 |
 * | `set()` αντί `create()` στη σταδιοποίηση | Α36.4 + Α36.5 ⇒ 🔴 |
 * | επανάληψη χωρίς έλεγχο κατόχου | Α36.4 ⇒ 🔴 |
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

const { COLLECTIONS } = require('@/config/firestore-collections') as
  typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as
  typeof import('@/services/places/__tests__/fake-firestore');
const { enterpriseIdService } = require('@/services/enterprise-id.service') as
  typeof import('@/services/enterprise-id.service');
const write = require('../property-dossier-write.service') as
  typeof import('../property-dossier-write.service');
const { newPropertyDossier } = require('@/types/property-dossier') as
  typeof import('@/types/property-dossier');

const OWNER = 'citizen-1';
const DRAFT = { label: '  Διαμέρισμα Καλαμαριάς  ', type: 'apartment' as const };

function fresh() {
  const db = new FakeFirestore();
  return { db, adminDb: db as unknown as AdminFirestore, id: enterpriseIdService.generatePropertyDossierId() };
}

function stored(db: InstanceType<typeof FakeFirestore>): readonly Record<string, unknown>[] {
  return db.all<Record<string, unknown>>(COLLECTIONS.PROPERTY_DOSSIERS);
}

beforeEach(() => {
  recordChange.mockReset();
  recordChange.mockResolvedValue('eaud_test');
});

describe('🏆 Α36.1 — γέννηση ⇒ ΕΝΑ ίχνος `created`, στο ΠΡΟΣΩΠΙΚΟ βιβλίο του κατόχου', () => {
  it('ένα έγγραφο, `active`, όνομα κανονικοποιημένο, ένα ίχνος με `userId` και ΚΑΝΕΝΑ `companyId`', async () => {
    const { db, adminDb, id } = fresh();

    const result = await write.createPropertyDossier(adminDb, { id, userId: OWNER }, DRAFT);

    expect(result.kind).toBe('saved');
    expect(result.kind === 'saved' && result.replayed).toBe(false);
    expect(stored(db)).toEqual([
      expect.objectContaining({ id, userId: OWNER, label: 'Διαμέρισμα Καλαμαριάς', type: 'apartment', lifecycle: 'active' }),
    ]);

    expect(recordChange).toHaveBeenCalledTimes(1);
    const call = recordChange.mock.calls[0][0];
    expect(call).toEqual(expect.objectContaining({
      entityType: 'property_dossier', entityId: id, action: 'created', performedBy: OWNER, userId: OWNER,
    }));
    expect(call).not.toHaveProperty('companyId');
    const fields = (call.changes as ReadonlyArray<{ field: string }>).map((c) => c.field).sort();
    expect(fields).toEqual(['label', 'lifecycle', 'type']);
  });
});

describe('🏆 Α36.2 — γραφή που απέτυχε ⇒ ΜΗΔΕΝ ίχνη', () => {
  it('αστοχία του commit ⇒ `failed`, κανένα ίχνος, κανένα έγγραφο', async () => {
    const { db, adminDb, id } = fresh();
    const failingDb = {
      collection: adminDb.collection.bind(adminDb),
      batch: () => ({ create: () => undefined, commit: async () => { throw new Error('UNAVAILABLE'); } }),
    } as unknown as AdminFirestore;

    const result = await write.createPropertyDossier(failingDb, { id, userId: OWNER }, DRAFT);

    expect(result).toEqual({ kind: 'failed', message: 'UNAVAILABLE' });
    expect(recordChange).not.toHaveBeenCalled();
    expect(stored(db)).toEqual([]);
  });
});

describe('🏆 Α36.3 — επανάληψη της ΙΔΙΑΣ γέννησης από τον ΙΔΙΟ κάτοχο ⇒ ο υπάρχων, χωρίς δεύτερο ίχνος', () => {
  it('διπλό κλικ / επανάληψη δικτύου ⇒ `saved` + `replayed`, ένα έγγραφο, ένα ίχνος συνολικά', async () => {
    const { db, adminDb, id } = fresh();

    await write.createPropertyDossier(adminDb, { id, userId: OWNER }, DRAFT);
    const again = await write.createPropertyDossier(adminDb, { id, userId: OWNER }, { label: 'Άλλο', type: null });

    expect(again.kind).toBe('saved');
    expect(again.kind === 'saved' && again.replayed).toBe(true);
    // Ο ΥΠΑΡΧΩΝ — όχι το δεύτερο προσχέδιο (Stripe: η επανάληψη επιστρέφει την ΠΡΩΤΗ απάντηση).
    expect(again.kind === 'saved' && again.dossier.label).toBe('Διαμέρισμα Καλαμαριάς');
    expect(stored(db)).toHaveLength(1);
    expect(recordChange).toHaveBeenCalledTimes(1);
  });
});

describe('🏆 Α36.4 — ξένη ταυτότητα ⇒ `absent`, ο ξένος φάκελος ΑΝΕΓΓΙΧΤΟΣ', () => {
  it('ταυτότητα φακέλου άλλου κατόχου ⇒ 404-σημασιολογία, κανένα ίχνος, καμία αλλαγή', async () => {
    const { db, adminDb, id } = fresh();
    const foreign = newPropertyDossier({ id, userId: 'someone-else' }, { label: 'Ξένο σπίτι', type: 'villa' }, '2026-09-01T00:00:00.000Z');
    db.seed(COLLECTIONS.PROPERTY_DOSSIERS, id, { ...foreign });

    const result = await write.createPropertyDossier(adminDb, { id, userId: OWNER }, DRAFT);

    expect(result).toEqual({ kind: 'absent' });
    expect(recordChange).not.toHaveBeenCalled();
    expect(stored(db)).toEqual([expect.objectContaining({ userId: 'someone-else', label: 'Ξένο σπίτι' })]);
  });
});

describe('🏆 Α36.5 — η σταδιοποίηση ΜΟΝΟ γράφει (δέσμη/συναλλαγή του καλούντος, Ε-Φ1-1)', () => {
  it('καλεί ΜΟΝΟ `create` — καμία ανάγνωση, κανένα `set`, κανένα ίχνος', () => {
    const { adminDb, id } = fresh();
    const calls: string[] = [];
    const recorder = new Proxy({}, {
      get: (_target, name) => (...args: unknown[]) => { calls.push(String(name)); return args; },
    }) as import('../property-dossier-write.service').PropertyDossierBirthWriter;
    const dossier = newPropertyDossier({ id, userId: OWNER }, DRAFT, '2026-09-18T10:00:00.000Z');

    write.stagePropertyDossierBirth(recorder, adminDb, dossier);

    expect(calls).toEqual(['create']);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('μέσα σε συναλλαγή ⇒ ο φάκελος γεννιέται μαζί με ό,τι άλλο γράφει ο καλών', async () => {
    const { db, adminDb, id } = fresh();
    const dossier = newPropertyDossier({ id, userId: OWNER }, DRAFT, '2026-09-18T10:00:00.000Z');

    await adminDb.runTransaction(async (tx) => {
      write.stagePropertyDossierBirth(tx, adminDb, dossier);
    });

    expect(stored(db)).toEqual([expect.objectContaining({ id, userId: OWNER })]);
  });
});

describe('🏆 Α36.6 — άκυρο προσχέδιο ⇒ `invalid`, καμία εγγραφή', () => {
  it.each([
    ['κενό όνομα', '   ', 'label-required'],
    ['όνομα > 120', 'α'.repeat(121), 'label-too-long'],
  ])('%s ⇒ %s', async (_case, label, violation) => {
    const { db, adminDb, id } = fresh();

    const result = await write.createPropertyDossier(adminDb, { id, userId: OWNER }, { label, type: null });

    expect(result).toEqual({ kind: 'invalid', violations: [violation] });
    expect(stored(db)).toEqual([]);
    expect(recordChange).not.toHaveBeenCalled();
  });
});

// =============================================================================
// ADR-866 Φ1.2 — ΜΕΤΑΒΟΛΗ ΦΑΚΕΛΟΥ (`updatePropertyDossier`) · άγκυρες Α37.1–Α37.4
// =============================================================================

const SEEDED_AT = '2026-09-01T00:00:00.000Z';

/** Ένας υπάρχων φάκελος, σπαρμένος όπως θα τον έγραφε η γέννηση. */
function seedDossier(db: InstanceType<typeof FakeFirestore>, id: string, userId = OWNER) {
  const dossier = newPropertyDossier({ id, userId }, { label: 'Διαμέρισμα Καλαμαριάς', type: 'apartment' }, SEEDED_AT);
  db.seed(COLLECTIONS.PROPERTY_DOSSIERS, id, { ...dossier });
  return dossier;
}

const ARCHIVE = { kind: 'lifecycle', lifecycle: 'archived' } as const;

describe('🏆 Α37.1 — αρχειοθέτηση ⇒ `archived` + ΕΝΑ ίχνος `status_changed` στο ΠΡΟΣΩΠΙΚΟ βιβλίο', () => {
  it('κύκλος ζωής και `updatedAt` αλλάζουν, όνομα/είδος μένουν· το ίχνος κρατά μόνο το `lifecycle`', async () => {
    const { db, adminDb, id } = fresh();
    seedDossier(db, id);

    const result = await write.updatePropertyDossier(adminDb, { dossierId: id, userId: OWNER }, ARCHIVE);

    expect(result.kind === 'saved' && result.replayed).toBe(false);
    const [after] = stored(db);
    expect(after).toEqual(expect.objectContaining({ lifecycle: 'archived', label: 'Διαμέρισμα Καλαμαριάς', type: 'apartment' }));
    expect(after.updatedAt).not.toBe(SEEDED_AT);

    expect(recordChange).toHaveBeenCalledTimes(1);
    const call = recordChange.mock.calls[0][0];
    expect(call).toEqual(expect.objectContaining({
      entityType: 'property_dossier', entityId: id, action: 'status_changed', userId: OWNER,
    }));
    expect(call).not.toHaveProperty('companyId');
    expect((call.changes as { field: string }[]).map((change) => change.field)).toEqual(['lifecycle']);
  });

  it('μετονομασία ⇒ `updated`, όνομα κανονικοποιημένο', async () => {
    const { db, adminDb, id } = fresh();
    seedDossier(db, id);

    await write.updatePropertyDossier(
      adminDb, { dossierId: id, userId: OWNER }, { kind: 'details', draft: { label: '  Μεζονέτα  ', type: 'maisonette' } },
    );

    expect(stored(db)[0]).toEqual(expect.objectContaining({ label: 'Μεζονέτα', type: 'maisonette', lifecycle: 'active' }));
    expect(recordChange.mock.calls[0][0]).toEqual(expect.objectContaining({ action: 'updated' }));
  });
});

describe('🏆 Α37.2 — ίδια κατάσταση ⇒ ΜΗΔΕΝ εγγραφές, ΜΗΔΕΝ ίχνη (ιδεμπότητο)', () => {
  it.each([
    ['επαναφορά ήδη ενεργού', { kind: 'lifecycle', lifecycle: 'active' } as const],
    ['μετονομασία στο ίδιο όνομα (με κενά)', { kind: 'details', draft: { label: ' Διαμέρισμα Καλαμαριάς ', type: 'apartment' } } as const],
  ])('%s ⇒ `replayed`, το έγγραφο byte-για-byte ίδιο', async (_case, change) => {
    const { db, adminDb, id } = fresh();
    seedDossier(db, id);
    const before = db.snapshotOf(COLLECTIONS.PROPERTY_DOSSIERS, id);

    const result = await write.updatePropertyDossier(adminDb, { dossierId: id, userId: OWNER }, change);

    expect(result.kind === 'saved' && result.replayed).toBe(true);
    expect(db.snapshotOf(COLLECTIONS.PROPERTY_DOSSIERS, id)).toBe(before);
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('🏆 Α37.3 — ξένος ή ανύπαρκτος ⇒ `absent` (ΙΔΙΑ απάντηση), ο ξένος ΑΝΕΓΓΙΧΤΟΣ', () => {
  it('ξένος φάκελος: καμία εγγραφή, κανένα ίχνος', async () => {
    const { db, adminDb, id } = fresh();
    seedDossier(db, id, 'someone-else');
    const before = db.snapshotOf(COLLECTIONS.PROPERTY_DOSSIERS, id);

    const result = await write.updatePropertyDossier(adminDb, { dossierId: id, userId: OWNER }, ARCHIVE);

    expect(result).toEqual({ kind: 'absent' });
    expect(db.snapshotOf(COLLECTIONS.PROPERTY_DOSSIERS, id)).toBe(before);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('ανύπαρκτος: ίδια απάντηση, κανένα έγγραφο δεν γεννιέται', async () => {
    const { db, adminDb, id } = fresh();

    const result = await write.updatePropertyDossier(adminDb, { dossierId: id, userId: OWNER }, ARCHIVE);

    expect(result).toEqual({ kind: 'absent' });
    expect(stored(db)).toEqual([]);
  });
});

describe('🏆 Α37.4 — άκυρο όνομα ⇒ `invalid` ΠΡΙΝ από κάθε εγγραφή', () => {
  it('κενό όνομα ⇒ κωδικός, το έγγραφο ανέγγιχτο, κανένα ίχνος', async () => {
    const { db, adminDb, id } = fresh();
    seedDossier(db, id);
    const before = db.snapshotOf(COLLECTIONS.PROPERTY_DOSSIERS, id);

    const result = await write.updatePropertyDossier(
      adminDb, { dossierId: id, userId: OWNER }, { kind: 'details', draft: { label: '  ', type: null } },
    );

    expect(result).toEqual({ kind: 'invalid', violations: ['label-required'] });
    expect(db.snapshotOf(COLLECTIONS.PROPERTY_DOSSIERS, id)).toBe(before);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('η αρχειοθέτηση ΔΕΝ ξανακρίνει το όνομα: φάκελος με (πλέον) άκυρο όνομα αρχειοθετείται', async () => {
    const { db, adminDb, id } = fresh();
    db.seed(COLLECTIONS.PROPERTY_DOSSIERS, id, { ...seedDossier(db, id), label: 'α'.repeat(200) });

    const result = await write.updatePropertyDossier(adminDb, { dossierId: id, userId: OWNER }, ARCHIVE);

    expect(result.kind).toBe('saved');
    expect(stored(db)[0]).toEqual(expect.objectContaining({ lifecycle: 'archived' }));
  });
});

describe('🏆 Α37.1β — ΣΥΝΑΛΛΑΓΗ: άλλη καρτέλα μετονομάζει ανάμεσα σε ανάγνωση και εγγραφή', () => {
  it('η αρχειοθέτηση ξαναδιαβάζει και ΚΡΑΤΑ τη μετονομασία του άλλου (καμία χαμένη αλλαγή)', async () => {
    const { db, adminDb, id } = fresh();
    const seeded = seedDossier(db, id);
    db.interfere = () => db.write(COLLECTIONS.PROPERTY_DOSSIERS, id, { ...seeded, label: 'Μετονομάστηκε αλλού' });

    await write.updatePropertyDossier(adminDb, { dossierId: id, userId: OWNER }, ARCHIVE);

    expect(stored(db)[0]).toEqual(expect.objectContaining({ lifecycle: 'archived', label: 'Μετονομάστηκε αλλού' }));
    expect(recordChange).toHaveBeenCalledTimes(1);
  });
});
