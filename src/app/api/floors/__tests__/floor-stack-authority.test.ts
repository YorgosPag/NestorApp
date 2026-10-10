/**
 * @jest-environment node
 *
 * ⚓ **Η ΑΡΧΗ ΤΗΣ ΣΤΟΙΒΑΣ ΟΡΟΦΩΝ** — η μοναδικότητα ορόφου ανά κτίριο είναι ΑΤΟΜΙΚΗ (γέννηση · επεξεργασία · αφαίρεση).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): ο κανόνας ήταν «διάβασε τα αδέλφια, μετά γράψε», χωρίς συναλλαγή. Δύο αιτήματα
 * περνούσαν και τα δύο. Εδώ ο ανταγωνιστής (`fake.interfere`) χτυπά **ανάμεσα** στην ανάγνωση και στο commit.
 *
 * Πραγματικά: το σύνορο, ο κανόνας, η γέννηση, ο συνοδός, η αφαίρεση, το `withVersionCheck`, και το ψεύτικο Firestore
 * (verified fake — το συμβόλαιό του τρέχει και στον emulator). Αντικαθίστανται μόνο τα άκρα: `createEntity` (καλεί το
 * `commit` όπως το πραγματικό), `executeDeletion` (το ίδιο) και το βιβλίο ιστορικού.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { AuthContext } from '@/lib/auth';
import type { EntityCreationParams } from '@/lib/firestore/entity-creation.types';
import type { ExecuteDeletionOptions } from '@/lib/firestore/deletion-guard';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
  resolveUserDisplayName: async () => 'Γιώργος',
}));

const COMPANY = 'co_1';
const BUILDING = 'bldg_1';
let nextFloorId = 0;

// Το `createEntity` όπως το βλέπει η γέννηση: έτοιμο έγγραφο (με τον ενοικιαστή του κτιρίου) → `commit`.
jest.mock('@/lib/firestore/entity-creation.service', () => ({
  createEntity: async (_type: string, params: EntityCreationParams) => {
    const db = fake as unknown as Firestore;
    nextFloorId += 1;
    const entityId = `flr_new_${nextFloorId}`;
    const doc = { companyId: COMPANY, ...params.entitySpecificFields };
    await params.commit?.({ db, ref: db.collection('floors').doc(entityId), entityId, doc });
    return { id: entityId, code: null, doc };
  },
}));
jest.mock('@/lib/firestore/deletion-guard', () => ({
  executeDeletion: async (db: Firestore, _type: string, id: string, _by: string, _co: string, options: ExecuteDeletionOptions = {}) => {
    const ref = db.collection('floors').doc(id);
    if (options.commit) await options.commit(ref); else await ref.delete();
    return { success: true, entityId: id };
  },
}));

let fake: FakeFirestore;
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): Firestore => fake as unknown as Firestore,
}));

import { EntityAuditService } from '@/services/entity-audit.service';
import { withVersionCheck } from '@/lib/firestore/version-check';
import { writeFloorBirth } from '../floor-birth';
import { removeFloor } from '../floor-removal';
import { floorSlotCompanion } from '../floor-slot-companion';
import { reconcileSpecialLevelPlacement } from '../floor-stack-reconcile.service';
import { CASCADE_ACTOR } from './floor-cascade-actor.fixture';

const recordChange = EntityAuditService.recordChange as jest.Mock;
const ctx = { uid: 'u1', companyId: COMPANY, globalRole: 'user', email: 'a@b.gr' } as unknown as AuthContext;
const db = (): Firestore => fake as unknown as Firestore;

type FloorSeed = Record<string, unknown>;
const floor = (number: number, name: string, kind: string, extra: FloorSeed = {}): FloorSeed => ({
  companyId: COMPANY, buildingId: BUILDING, number, name, kind, elevation: number * 3, height: 3, ...extra,
});

const birth = (number: number, name: string, kind: string, extra: FloorSeed = {}) =>
  writeFloorBirth({ db: db(), ctx, buildingId: BUILDING, fields: { ...floor(number, name, kind, extra) } });

async function refusalOf(run: Promise<unknown>): Promise<{ statusCode?: number; errorCode?: string } | undefined> {
  try { await run; return undefined; } catch (e) { return e as { statusCode?: number; errorCode?: string }; }
}

const floors = () => fake.getAllDocs(COLLECTIONS.FLOORS);
const lockRev = () => fake.getData(COLLECTIONS.FLOOR_STACK_LOCKS, BUILDING)?.rev;

beforeEach(() => {
  fake = new FakeFirestore();
  nextFloorId = 0;
  recordChange.mockClear();
});

describe('γέννηση ορόφου', () => {
  it('Γ1 — ελεύθερη θέση ⇒ ο όροφος γράφεται και το κλειδί σφραγίζεται (rev 1)', async () => {
    const result = await birth(0, 'Ισόγειο', 'ground');

    expect(floors()[result.floorId]).toMatchObject({ number: 0, name: 'Ισόγειο' });
    expect(lockRev()).toBe(1);
  });

  it('Γ2 — 🔴 δεύτερο «Ισόγειο» (το περιστατικό) ⇒ 409, ΚΑΝΕΝΑ δεύτερο έγγραφο, το κλειδί αμετάβλητο', async () => {
    await birth(0, 'Ισόγειο', 'ground');

    const refusal = await refusalOf(birth(0, 'Ισόγειο Β', 'standard'));

    expect(refusal).toMatchObject({ statusCode: 409, errorCode: 'FLOOR_NUMBER_TAKEN' });
    expect(Object.keys(floors())).toHaveLength(1);
    expect(lockRev()).toBe(1);
  });

  it('Γ3 — 🔴 ΤΑΥΤΟΧΡΟΝΟ αίτημα: ο ανταγωνιστής γράφει ανάμεσα στην ανάγνωση και στο commit ⇒ 409', async () => {
    // Ο ανταγωνιστής πέρασε από το ίδιο σύνορο: έγραψε όροφο ΚΑΙ ανέβασε το κλειδί.
    fake.interfere = () => {
      fake.write(COLLECTIONS.FLOORS, 'flr_rival', floor(0, 'Ισόγειο', 'ground'));
      fake.write(COLLECTIONS.FLOOR_STACK_LOCKS, BUILDING, { rev: 1 });
    };

    const refusal = await refusalOf(birth(0, 'Ισόγειο μου', 'ground'));

    expect(refusal).toMatchObject({ statusCode: 409, errorCode: 'FLOOR_NUMBER_TAKEN' });
    expect(Object.keys(floors())).toEqual(['flr_rival']);
  });

  it('Γ4 — ο ανταγωνιστής άλλαξε ΑΛΛΗ θέση ⇒ η συναλλαγή ξανατρέχει πάνω στο νέο κλειδί και περνά (rev 2, όχι 1)', async () => {
    fake.interfere = () => {
      fake.write(COLLECTIONS.FLOORS, 'flr_rival', floor(1, '1ος Όροφος', 'standard'));
      fake.write(COLLECTIONS.FLOOR_STACK_LOCKS, BUILDING, { rev: 1 });
    };

    await birth(0, 'Ισόγειο', 'ground');

    expect(Object.keys(floors())).toHaveLength(2);
    expect(lockRev()).toBe(2);
  });

  it('Γ5 — 🔴 ίδιο όνομα με άλλον όροφο ⇒ 409 FLOOR_NAME_TAKEN', async () => {
    await birth(0, 'Ισόγειο', 'ground');

    expect(await refusalOf(birth(1, 'ΙΣΟΓΕΙΟ', 'standard'))).toMatchObject({ errorCode: 'FLOOR_NAME_TAKEN' });
  });

  it('Γ6 — ειδική στάθμη μοιράζεται αριθμό με μετρούμενο (ADR-461 R6)· δεύτερη ίδιου είδους ⇒ 409', async () => {
    await birth(0, 'Ισόγειο', 'ground');
    await birth(1, 'Δώμα', 'roof', { elevation: 3 });

    expect(await refusalOf(birth(9, 'Δώμα Β', 'roof'))).toMatchObject({ errorCode: 'FLOOR_KIND_TAKEN' });
  });

  it('Γ7 — 🏆 γέννηση υπογείου ⇒ η θεμελίωση κατεβαίνει ΣΤΗΝ ΙΔΙΑ συναλλαγή, με παράγωγη γραμμή ιστορικού', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g', floor(0, 'Ισόγειο', 'ground'));
    fake.seed(COLLECTIONS.FLOORS, 'flr_fnd', floor(-1, 'F', 'foundation', { elevation: -1, height: 1 }));

    await birth(-1, 'Υπόγειο', 'basement');

    expect(floors().flr_fnd).toMatchObject({ number: -2, elevation: -4 }); // υπόγειο(−3) − βάθος(1)
    const derived = recordChange.mock.calls.map(([entry]) => entry).find((entry) => entry.entityId === 'flr_fnd');
    expect(derived).toMatchObject({ performedBy: 'system:floor-stack', action: 'updated' });
  });

  it('Γ8 — θεμελίωση που ζητήθηκε σε λάθος αριθμό γεννιέται ΗΔΗ στη θέση της', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g', floor(0, 'Ισόγειο', 'ground'));

    const result = await birth(-7, 'F', 'foundation', { elevation: -9, height: 1 });

    expect(floors()[result.floorId]).toMatchObject({ number: -1, elevation: -1 });
  });

  it('Γ9 — ίδιο υψόμετρο με άλλον μετρούμενο ⇒ προειδοποίηση, ΟΧΙ άρνηση', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g', floor(0, 'Ισόγειο', 'ground'));

    const result = await birth(1, 'Ημιώροφος', 'standard', { elevation: 0 });

    expect(result.sameElevationFloorIds).toEqual(['flr_g']);
  });

  it('Γ10 — 🔴 κτίριο χωρίς ενοικιαστή ⇒ ρητή άρνηση 422, όχι σιωπηλή παράλειψη του κανόνα', async () => {
    const refusal = await refusalOf(
      writeFloorBirth({ db: db(), ctx, buildingId: BUILDING, fields: { ...floor(0, 'Ισόγειο', 'ground'), companyId: '' } }),
    );

    expect(refusal).toMatchObject({ statusCode: 422, errorCode: 'FLOOR_OWNER_MISSING' });
    expect(Object.keys(floors())).toHaveLength(0);
  });
});

describe('επεξεργασία ορόφου — ο συνοδός του withVersionCheck', () => {
  const patch = (floorId: string, updates: Record<string, unknown>) =>
    withVersionCheck({
      db: db(), collection: COLLECTIONS.FLOORS, docId: floorId, expectedVersion: undefined, updates, userId: 'u1',
      companion: floorSlotCompanion(db(), floorId, updates, 'u1'),
    });

  beforeEach(() => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g', floor(0, 'Ισόγειο', 'ground'));
    fake.seed(COLLECTIONS.FLOORS, 'flr_1', floor(1, '1ος Όροφος', 'standard'));
  });

  it('Ε1 — 🔴 αλλαγή σε πιασμένο αριθμό ⇒ 409 και ο όροφος ΔΕΝ αλλάζει', async () => {
    expect(await refusalOf(patch('flr_1', { number: 0 }))).toMatchObject({ statusCode: 409, errorCode: 'FLOOR_NUMBER_TAKEN' });
    expect(floors().flr_1.number).toBe(1);
  });

  it('Ε2 — αλλαγή σε ελεύθερο αριθμό ⇒ γράφεται, με το κλειδί σφραγισμένο στην ίδια συναλλαγή', async () => {
    await patch('flr_1', { number: 2 });

    expect(floors().flr_1).toMatchObject({ number: 2, _v: 1 });
    expect(lockRev()).toBe(1);
  });

  it('Ε3 — 🔴 μετονομασία σε όνομα άλλου ορόφου ⇒ 409 FLOOR_NAME_TAKEN', async () => {
    expect(await refusalOf(patch('flr_1', { name: 'ισόγειο' }))).toMatchObject({ errorCode: 'FLOOR_NAME_TAKEN' });
  });

  it('Ε4 — αλλαγή ύψους ⇒ ο συνοδός ΔΕΝ αγγίζει το κλειδί (η αυτόματη αποθήκευση δεν σειριοποιεί το κτίριο)', async () => {
    await patch('flr_1', { height: 3.2, number: 1, name: '1ος Όροφος' });

    expect(floors().flr_1.height).toBe(3.2);
    expect(lockRev()).toBeUndefined();
  });

  it('Ε5 — 🔑 παλαιό διπλότυπο ΔΕΝ μπλοκάρει άσχετη αλλαγή πάνω του', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g2', floor(0, 'Ισόγειο', 'standard'));

    await patch('flr_g2', { height: 2.8 });

    expect(floors().flr_g2.height).toBe(2.8);
  });

  it('Ε6 — 🔴 ΤΑΥΤΟΧΡΟΝΑ: ο ανταγωνιστής πιάνει τον αριθμό ανάμεσα στην ανάγνωση και στο commit ⇒ 409', async () => {
    fake.interfere = () => {
      fake.write(COLLECTIONS.FLOORS, 'flr_rival', floor(2, '2ος Όροφος', 'standard'));
      fake.write(COLLECTIONS.FLOOR_STACK_LOCKS, BUILDING, { rev: 1 });
    };

    expect(await refusalOf(patch('flr_1', { number: 2 }))).toMatchObject({ errorCode: 'FLOOR_NUMBER_TAKEN' });
    expect(floors().flr_1.number).toBe(1);
  });
});

describe('αφαίρεση ορόφου', () => {
  const remove = (floorId: string) =>
    removeFloor({ db: db(), ctx, floorId, floor: floors()[floorId] });

  beforeEach(() => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_b', floor(-1, 'Υπόγειο', 'basement'));
    fake.seed(COLLECTIONS.FLOORS, 'flr_g', floor(0, 'Ισόγειο', 'ground'));
    fake.seed(COLLECTIONS.FLOORS, 'flr_1', floor(1, '1ος Όροφος', 'standard'));
  });

  it('Α1 — ενδιάμεσος όροφος ⇒ 422 FLOOR_INTERMEDIATE, τίποτα δεν σβήνεται', async () => {
    expect(await refusalOf(remove('flr_g'))).toMatchObject({ statusCode: 422, errorCode: 'FLOOR_INTERMEDIATE' });
    expect(Object.keys(floors())).toHaveLength(3);
  });

  it('Α2 — ακραίος όροφος ⇒ σβήνεται και το κλειδί σφραγίζεται', async () => {
    await remove('flr_1');

    expect(floors().flr_1).toBeUndefined();
    expect(lockRev()).toBe(1);
  });

  it('Α3 — 🔴 ΤΑΥΤΟΧΡΟΝΑ: ο ανταγωνιστής προσθέτει όροφο από πάνω ⇒ ο δικός μας έγινε ενδιάμεσος ⇒ 422', async () => {
    // Η πρώτη κρίση (εκτός συναλλαγής — ο ανταγωνιστής χτυπά μόνο σε ανάγνωση συναλλαγής) περνά· η οριστική,
    // μέσα στη συναλλαγή, βλέπει τον νέο όροφο.
    fake.interfere = () => {
      fake.write(COLLECTIONS.FLOORS, 'flr_2', floor(2, '2ος Όροφος', 'standard'));
      fake.write(COLLECTIONS.FLOOR_STACK_LOCKS, BUILDING, { rev: 1 });
    };

    expect(await refusalOf(remove('flr_1'))).toMatchObject({ errorCode: 'FLOOR_INTERMEDIATE' });
    expect(floors().flr_1).toBeDefined();
  });

  it('Α4 — 🔑 διπλότυπο στη μέση του κτιρίου σβήνεται (δεν αφήνει κενό)', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g2', floor(0, 'Ισόγειο', 'standard'));

    await remove('flr_g2');

    expect(floors().flr_g2).toBeUndefined();
  });

  it('Α5 — αφαίρεση του υπογείου ⇒ η θεμελίωση ανεβαίνει στην ίδια συναλλαγή', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_fnd', floor(-2, 'F', 'foundation', { elevation: -4, height: 1 }));

    await remove('flr_b');

    expect(floors().flr_fnd).toMatchObject({ number: -1, elevation: -1 });
  });
});

describe('επανατοποθέτηση ειδικών σταθμών — κάτω από το ίδιο κλειδί', () => {
  it('Τ1 — γράφει μέσα στη συναλλαγή της στοίβας και σφραγίζει το κλειδί', async () => {
    fake.seed(COLLECTIONS.FLOORS, 'flr_g', floor(0, 'Ισόγειο', 'ground'));
    fake.seed(COLLECTIONS.FLOORS, 'flr_sp', floor(5, 'SP', 'stair-penthouse', { elevation: 20, height: 2.4 }));

    const placed = await reconcileSpecialLevelPlacement(db(), BUILDING, COMPANY, CASCADE_ACTOR);

    expect(placed).toBe(1);
    expect(floors().flr_sp).toMatchObject({ number: 1, elevation: 3 });
    expect(lockRev()).toBe(1);
  });
});
