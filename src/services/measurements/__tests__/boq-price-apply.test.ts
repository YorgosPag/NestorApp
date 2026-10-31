/**
 * Η εγγραφή τιμής από τον τιμοκατάλογο: μόνο πρόχειρη γραμμή, ιδεμπότητη, και καμία σιωπηλή αλλαγή δοσμένης τιμής
 * (ADR-923 §5.11 «3ε» · απόφαση #3).
 */

const store = new Map<string, Record<string, unknown>>();
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ id: segments[segments.length - 1] })),
  getDoc: async (ref: { id: string }) => ({ id: ref.id, exists: () => store.has(ref.id), data: () => store.get(ref.id) }),
  updateDoc: async (ref: { id: string }, data: Record<string, unknown>) => {
    updates.push({ id: ref.id, data });
    store.set(ref.id, { ...store.get(ref.id), ...data });
  },
  runTransaction: async (_db: unknown, run: (tx: unknown) => Promise<number>) =>
    run({
      get: async (ref: { id: string }) => ({ id: ref.id, exists: () => store.has(ref.id), data: () => store.get(ref.id) }),
      update: (ref: { id: string }, data: Record<string, unknown>) => updates.push({ id: ref.id, data }),
    }),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/services/enterprise-id.service', () => ({ generateBoqItemId: () => 'boq_new' }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθεί ο κώδικας */
import type { BoqPriceSource, UpdateBOQItemInput } from '@/types/boq';
import { FirestoreBOQRepository } from '../boq-repository';
import { BOQService } from '../boq-service';
/* eslint-enable import/first */

const OWNER = 'comp_owner';

const source = (lineId = 'line_a'): BoqPriceSource => ({
  authority: 'master',
  priceListId: 'cprl_master',
  priceListVersionId: 'cplv_1',
  versionNumber: 1,
  lineId,
  subjectKey: 'costItem:OIK-4.01:*',
  unit: 'm2',
  priceQuantity: 1,
  breakdown: { material: 800, labor: 300, equipment: 100 },
  defaultWasteBp: 0,
  appliedAt: '2026-10-31T10:00:00.000Z',
  appliedBy: 'user_1',
});

const fields = (lineId?: string): UpdateBOQItemInput => ({ materialUnitCost: 8, laborUnitCost: 3, equipmentUnitCost: 1, priceSource: source(lineId), priceAuthority: 'master' });

function seed(id: string, overrides: Record<string, unknown> = {}): void {
  store.set(id, { companyId: OWNER, projectId: 'p', buildingId: 'b', categoryCode: 'OIK-4.01', title: 't', unit: 'm2', estimatedQuantity: 1, status: 'draft', ...overrides });
}

const repository = new FirestoreBOQRepository();
const service = BOQService.getInstance();

beforeEach(() => {
  store.clear();
  updates.length = 0;
});

describe('applyPriceFields', () => {
  it('γράφει μόνο πρόχειρη δική μας γραμμή, όχι δοσμένη, όχι σύνοψη, όχι ξένη', async () => {
    seed('draft');
    seed('given', { status: 'submitted' });
    seed('summary', { isGroupParent: true, groupRole: 'summary' });
    seed('foreign', { companyId: 'comp_other' });
    const applied = await repository.applyPriceFields(OWNER, ['draft', 'given', 'summary', 'foreign', 'missing'].map((id) => ({ id, fields: fields() })));
    expect(applied).toBe(1);
    expect(updates.map((update) => update.id)).toEqual(['draft']);
  });

  it('ιδεμπότητη: ίδιος δεσμός ⇒ καμία εγγραφή', async () => {
    seed('bound', { priceSource: source() });
    await expect(repository.applyPriceFields(OWNER, [{ id: 'bound', fields: fields() }])).resolves.toBe(0);
    expect(updates).toEqual([]);
  });
});

describe('service.update — η δοσμένη τιμή δεν αλλάζει σιωπηλά', () => {
  it('⛔ νέος δεσμός σε γραμμή που δόθηκε', async () => {
    seed('given', { status: 'submitted', priceSource: source() });
    await expect(service.update(OWNER, 'given', fields('line_b'))).rejects.toThrow('GOVERNANCE_ERROR');
    expect(updates).toEqual([]);
  });

  it('η φόρμα που ξαναστέλνει τον ίδιο δεσμό περνά', async () => {
    seed('given', { status: 'submitted', priceSource: source() });
    await service.update(OWNER, 'given', { notes: 'x', priceSource: source() });
    expect(updates).toHaveLength(1);
  });
});

describe('repository.update — ο δεσμός φεύγει με τη δεμένη τιμή', () => {
  it('πληκτρολογημένη άλλη τιμή ⇒ item, χωρίς δεσμό', async () => {
    seed('bound', { priceSource: source(), materialUnitCost: 8, priceAuthority: 'master' });
    await repository.update(OWNER, 'bound', { materialUnitCost: 9 });
    expect(updates[0].data).toMatchObject({ materialUnitCost: 9, priceSource: null, priceAuthority: 'item' });
  });
});
