/**
 * Ο φύλακας εμβέλειας μέσα στην ΠΡΑΓΜΑΤΙΚΗ `updateFrameworkAgreement` / `createFrameworkAgreement`
 * (ADR-923 §5.11 «3γ», Βήμα 2). Κάθε άρνηση ρωτά τον ΤΥΠΟ του σφάλματος **και** ότι δεν έγινε εγγραφή.
 */

import type { AuthContext } from '@/lib/auth';
import { FrameworkAgreementValidationError } from '../../types/framework-agreement';
import { makeAgreement } from '../../__fixtures__/framework-agreement-fixture';

jest.mock('firebase-admin', () => ({
  firestore: Object.assign(jest.fn(), {
    Timestamp: {
      now: jest.fn(() => 'ts_now'),
      fromDate: jest.fn((d: Date) => d.toISOString()),
    },
  }),
}));
jest.mock('@/utils/firestore-sanitize', () => ({ sanitizeForFirestore: jest.fn((x: unknown) => x) }));
jest.mock('@/services/enterprise-id.service', () => ({ generateFrameworkAgreementId: jest.fn(() => 'fwa_new') }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn().mockResolvedValue(null) } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

type Row = Record<string, unknown> & { id: string };
const store: Record<string, Map<string, Row>> = {};
const writes: { op: string; id: string }[] = [];

function docRef(collection: string, id: string) {
  return {
    id,
    get: async () => snapshotOf(collection, id),
    set: async () => writes.push({ op: 'set', id }),
    update: async () => writes.push({ op: 'update', id }),
  };
}

function snapshotOf(collection: string, id: string) {
  const row = store[collection]?.get(id);
  return { id, exists: row !== undefined, data: () => row };
}

function queryOf(collection: string, filters: [string, unknown][] = []) {
  return {
    where: (field: string, _op: string, value: unknown) => queryOf(collection, [...filters, [field, value]]),
    orderBy: () => queryOf(collection, filters),
    limit: () => queryOf(collection, filters),
    get: async () => {
      const rows = [...(store[collection]?.values() ?? [])].filter((row) => filters.every(([f, v]) => row[f] === v));
      return { docs: rows.map((row) => ({ id: row.id, data: () => row })) };
    },
  };
}

const mockDb = {
  collection: (name: string) => ({ ...queryOf(name), doc: (id: string) => ({ ...docRef(name, id), __collection: name }) }),
  getAll: async (...refs: { id: string; __collection: string }[]) => refs.map((ref) => snapshotOf(ref.__collection, ref.id)),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: jest.fn((fn: (db: unknown) => unknown) => fn(mockDb)),
}));

import { createFrameworkAgreement, updateFrameworkAgreement } from '../framework-agreement-service';

const CTX = { uid: 'user_1', companyId: 'co_1', globalRole: 'user' } as unknown as AuthContext;

function seed(collection: string, rows: Row[]): void {
  store[collection] = new Map(rows.map((row) => [row.id, row]));
}

const BASE_DTO = {
  agreementNumber: 'FWA-NEW',
  title: 'New',
  vendorContactId: 'sup_1',
  status: 'active' as const,
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2026-12-31T00:00:00.000Z',
  discountType: 'flat' as const,
  flatDiscountPercent: 10,
};

beforeEach(() => {
  writes.length = 0;
  seed('framework_agreements', []);
  seed('materials', [{ id: 'm_1', companyId: 'co_1' }, { id: 'm_foreign', companyId: 'co_2' }]);
  seed('projects', [{ id: 'p_1', companyId: 'co_1' }]);
});

async function expectRejected(promise: Promise<unknown>, field: string): Promise<void> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(FrameworkAgreementValidationError);
  expect((error as FrameworkAgreementValidationError).field).toBe(field);
  expect(writes).toEqual([]);
}

describe('createFrameworkAgreement — φύλακας εμβέλειας', () => {
  it('«Επιλεγμένα» με κενή λίστα ⇒ άρνηση, καμία εγγραφή', async () => {
    await expectRejected(createFrameworkAgreement(CTX, { ...BASE_DTO, applicableMaterialIds: [] }), 'applicableMaterialIds');
  });

  it('άγνωστη κατηγορία ΑΤΟΕ ⇒ άρνηση', async () => {
    await expectRejected(createFrameworkAgreement(CTX, { ...BASE_DTO, applicableAtoeCategoryCodes: ['OIK-99'] }), 'applicableAtoeCategoryCodes');
  });

  it('υλικό ΑΛΛΗΣ εταιρείας ≡ ανύπαρκτο ⇒ άρνηση', async () => {
    await expectRejected(createFrameworkAgreement(CTX, { ...BASE_DTO, applicableMaterialIds: ['m_foreign'] }), 'applicableMaterialIds');
    await expectRejected(createFrameworkAgreement(CTX, { ...BASE_DTO, applicableProjectIds: ['p_missing'] }), 'applicableProjectIds');
  });

  it('ισοπαλία με ενεργή σύμβαση του προμηθευτή ⇒ άρνηση, καμία εγγραφή', async () => {
    seed('framework_agreements', [{ ...makeAgreement('fwa_old', { companyId: 'co_1', applicableMaterialIds: ['m_1'] }) }]);
    await expectRejected(createFrameworkAgreement(CTX, { ...BASE_DTO, applicableMaterialIds: ['m_1'] }), 'scope');
  });

  it('ισοπαλία σε ΠΡΟΧΕΙΡΗ ⇒ επιτρέπεται (μπλοκάρει μόνο η ενεργοποίηση)', async () => {
    seed('framework_agreements', [{ ...makeAgreement('fwa_old', { companyId: 'co_1', applicableMaterialIds: ['m_1'] }) }]);
    await createFrameworkAgreement(CTX, { ...BASE_DTO, status: 'draft', applicableMaterialIds: ['m_1'] });
    expect(writes).toEqual([{ op: 'set', id: 'fwa_new' }]);
  });

  it('ειδικότερη (υλικό + έργο) από την υπάρχουσα ⇒ επιτρέπεται', async () => {
    seed('framework_agreements', [{ ...makeAgreement('fwa_old', { companyId: 'co_1', applicableMaterialIds: ['m_1'] }) }]);
    await createFrameworkAgreement(CTX, { ...BASE_DTO, applicableMaterialIds: ['m_1'], applicableProjectIds: ['p_1'] });
    expect(writes).toEqual([{ op: 'set', id: 'fwa_new' }]);
  });
});

describe('updateFrameworkAgreement — ο φύλακας κρίνει την ΤΕΛΙΚΗ μορφή', () => {
  const STORED = (id: string, overrides = {}) => ({ ...makeAgreement(id, { companyId: 'co_1', applicableMaterialIds: ['m_1'], ...overrides }) });

  it('ενεργοποίηση πρόχειρης που ισοβαθμεί ⇒ άρνηση, καμία εγγραφή', async () => {
    seed('framework_agreements', [STORED('fwa_a'), STORED('fwa_b', { status: 'draft' })]);
    await expectRejected(updateFrameworkAgreement(CTX, 'fwa_b', { status: 'active' }), 'scope');
  });

  it('στένεμα της εμβέλειας λύνει την ισοπαλία ⇒ εγγραφή', async () => {
    seed('framework_agreements', [STORED('fwa_a'), STORED('fwa_b')]);
    await updateFrameworkAgreement(CTX, 'fwa_b', { applicableProjectIds: ['p_1'] });
    expect(writes).toEqual([{ op: 'update', id: 'fwa_b' }]);
  });

  it('ο εαυτός της δεν μετρά ως αντίπαλος', async () => {
    seed('framework_agreements', [STORED('fwa_a')]);
    await updateFrameworkAgreement(CTX, 'fwa_a', { title: 'Renamed' });
    expect(writes).toEqual([{ op: 'update', id: 'fwa_a' }]);
  });
});
