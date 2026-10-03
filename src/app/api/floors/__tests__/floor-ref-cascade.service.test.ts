/**
 * ⚓ ADR-903 §6 — «Home Story»: αλλάζει ο όροφος ⇒ ακίνητα · θέσεις · αποθήκες ακολουθούν.
 *
 * - διαδίδει αριθμό **και** είδος στις τρεις συλλογές
 * - ιδεμποτία: δεύτερη κλήση = καμία γραφή, κανένα ίχνος
 * - ξένη εταιρεία / άλλος όροφος δεν αγγίζονται
 * - μεζονέτες: το `levels[]` ακολουθεί (αριθμός + όνομα), σε **μία** γραφή με το αντίγραφο
 * - παρτίδες ≤ 450 (το Firestore σπάει στις 500)
 * - αποτυχημένη παρτίδα ⇒ `failed > 0` και **κανένα** ίχνος για ό,τι δεν γράφτηκε σίγουρα
 */

import { COLLECTIONS } from '@/config/firestore-collections';

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue('audit_1') },
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { cascadeFloorRefToHosted, type CascadeFloor } from '../floor-ref-cascade.service';
import { EntityAuditService } from '@/services/entity-audit.service';

const recordChange = EntityAuditService.recordChange as jest.Mock;

interface SeedDoc { id: string; data: Record<string, unknown> }
type Store = Record<string, SeedDoc[]>;

const COMPANY = 'co_1';
const FLOOR: CascadeFloor = { id: 'fl_1', buildingId: 'b_1', number: 2, kind: 'standard', name: '2ος Όροφος' };

/** In-memory Admin double: where-ισότητες + παρτίδες που εφαρμόζουν στη μνήμη (ή αποτυγχάνουν). */
function makeDb(store: Store, opts: { failCommits?: boolean } = {}) {
  const commits: number[] = [];
  const matches = (data: Record<string, unknown>, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([f, v]) => data[f] === v);
  const makeQuery = (col: string, filters: Record<string, unknown> = {}) => ({
    where: (field: string, _op: string, value: unknown) => makeQuery(col, { ...filters, [field]: value }),
    get: async () => ({
      docs: (store[col] ?? []).filter((d) => matches(d.data, filters)).map((d) => ({
        id: d.id,
        ref: { id: d.id, path: `${col}/${d.id}`, seed: d },
        data: () => d.data,
      })),
    }),
  });
  const db = {
    collection: (name: string) => makeQuery(name),
    batch: () => {
      const ops: Array<{ seed: SeedDoc; patch: Record<string, unknown> }> = [];
      return {
        update: (ref: { seed: SeedDoc }, patch: Record<string, unknown>) => ops.push({ seed: ref.seed, patch }),
        commit: async () => {
          if (opts.failCommits) throw new Error('commit failed');
          commits.push(ops.length);
          for (const { seed, patch } of ops) seed.data = { ...seed.data, ...patch };
        },
      };
    },
  };
  return { db: db as unknown as Parameters<typeof cascadeFloorRefToHosted>[0], commits };
}

const hosted = (id: string, extra: Record<string, unknown> = {}): SeedDoc => ({
  id, data: { companyId: COMPANY, buildingId: 'b_1', floorId: 'fl_1', floor: 1, floorKind: 'standard', ...extra },
});

beforeEach(() => recordChange.mockClear());

describe('cascadeFloorRefToHosted', () => {
  it('διαδίδει αριθμό στις τρεις συλλογές· άλλος όροφος / ξένη εταιρεία μένουν ανέγγιχτοι', async () => {
    const store: Store = {
      [COLLECTIONS.PROPERTIES]: [hosted('p1'), hosted('p_other_floor', { floorId: 'fl_9' })],
      [COLLECTIONS.PARKING_SPACES]: [hosted('k1'), hosted('k_foreign', { companyId: 'co_2' })],
      [COLLECTIONS.STORAGE]: [hosted('s1')],
    };
    const { db } = makeDb(store);
    const result = await cascadeFloorRefToHosted(db, FLOOR, COMPANY, 'u1');

    expect(result).toEqual({ properties: 1, parking: 1, storage: 1, failed: 0 });
    expect(store[COLLECTIONS.PARKING_SPACES][0].data.floor).toBe(2);
    expect(store[COLLECTIONS.PARKING_SPACES][1].data.floor).toBe(1);
    expect(store[COLLECTIONS.PROPERTIES][1].data.floor).toBe(1);
    expect(recordChange).toHaveBeenCalledTimes(3);
  });

  it('αλλαγή ΜΟΝΟ είδους (ισόγειο → πυλωτή) διαδίδεται', async () => {
    const store: Store = { [COLLECTIONS.PARKING_SPACES]: [hosted('k1', { floor: 0, floorKind: 'ground' })] };
    const { db } = makeDb(store);
    await cascadeFloorRefToHosted(db, { ...FLOOR, number: 0, kind: 'pilotis' }, COMPANY, 'u1');
    expect(store[COLLECTIONS.PARKING_SPACES][0].data).toMatchObject({ floor: 0, floorKind: 'pilotis' });
  });

  it('🔑 ιδεμποτία: δεύτερη κλήση = καμία γραφή, κανένα ίχνος', async () => {
    const store: Store = { [COLLECTIONS.STORAGE]: [hosted('s1')] };
    const { db, commits } = makeDb(store);
    await cascadeFloorRefToHosted(db, FLOOR, COMPANY, 'u1');
    recordChange.mockClear();
    const second = await cascadeFloorRefToHosted(db, FLOOR, COMPANY, 'u1');
    expect(second).toEqual({ properties: 0, parking: 0, storage: 0, failed: 0 });
    expect(commits).toEqual([1]);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('μεζονέτα: `levels[]` ακολουθεί σε ΜΙΑ γραφή με το αντίγραφο', async () => {
    const levels = [
      { floorId: 'fl_0', floorNumber: 0, name: 'Ισόγειο', isPrimary: false },
      { floorId: 'fl_1', floorNumber: 1, name: '1ος Όροφος', isPrimary: true },
    ];
    const store: Store = { [COLLECTIONS.PROPERTIES]: [hosted('m1', { isMultiLevel: true, levels })] };
    const { db, commits } = makeDb(store);
    const result = await cascadeFloorRefToHosted(db, FLOOR, COMPANY, 'u1');

    expect(result.properties).toBe(1);
    expect(commits).toEqual([1]);
    const written = store[COLLECTIONS.PROPERTIES][0].data;
    expect(written.floor).toBe(2);
    expect(written.levels).toEqual([levels[0], { ...levels[1], floorNumber: 2, name: '2ος Όροφος' }]);
  });

  it('παρτίδες ≤ 450: 1000 θέσεις ⇒ 450 + 450 + 100', async () => {
    const store: Store = {
      [COLLECTIONS.PARKING_SPACES]: Array.from({ length: 1000 }, (_, i) => hosted(`k${i}`)),
    };
    const { db, commits } = makeDb(store);
    const result = await cascadeFloorRefToHosted(db, FLOOR, COMPANY, 'u1');
    expect(commits).toEqual([450, 450, 100]);
    expect(result.parking).toBe(1000);
  });

  it('🔴 αποτυχημένη παρτίδα ⇒ `failed`, και ΚΑΝΕΝΑ ίχνος για ό,τι δεν γράφτηκε σίγουρα', async () => {
    const store: Store = { [COLLECTIONS.STORAGE]: [hosted('s1')] };
    const { db } = makeDb(store, { failCommits: true });
    const result = await cascadeFloorRefToHosted(db, FLOOR, COMPANY, 'u1');
    expect(result.failed).toBe(1);
    expect(recordChange).not.toHaveBeenCalled();
    expect(store[COLLECTIONS.STORAGE][0].data.floor).toBe(1);
  });
});
