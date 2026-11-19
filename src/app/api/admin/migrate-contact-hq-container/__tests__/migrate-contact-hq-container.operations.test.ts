/**
 * Unit tests — η έδρα σε ΕΝΑ δοχείο: backfill (ADR-332 §D30 Φάση 2).
 *
 * Ελέγχεται το σχέδιο ανά έγγραφο (`planContactHqMigration`) και ο μετρητής του dry-run. Το HTTP
 * περίβλημα (guard/audit/error body) έρχεται από το SSoT (`runMigration`, ADR-704).
 *
 * Συμβόλαιο:
 *  - έγγραφο στο νέο σχήμα ⇒ καμία εγγραφή (ιδεμποτεντικό: 2η εκτέλεση = 0)·
 *  - διαρρεύσαν κλειδί ρίζας + λίστα ⇒ μόνο διαγραφή του κλειδιού·
 *  - μόνη αντιγραφή στη ρίζα ⇒ υλοποίηση λίστας (με ταυτότητα) + παράγωγο + διαγραφή ρίζας·
 *  - ρίζα χωρίς διεύθυνση και χωρίς λίστα ⇒ καμία εγγραφή (ποτέ κενή έδρα)·
 *  - dry-run ⇒ ΜΗΔΕΝ εγγραφές.
 */

const DELETE_SENTINEL = { __delete: true } as const;

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => DELETE_SENTINEL } }));
const flushInBatches = jest.fn(async (_db: unknown, updates: unknown[]) => ({ written: updates.length, errors: [] as string[] }));
jest.mock('@/lib/admin-batch-utils', () => ({
  flushInBatches: (...args: [unknown, unknown[]]) => flushInBatches(...args),
}));

import type { Firestore } from 'firebase-admin/firestore';
import type { ResolvedPerformer } from '@/server/lib/performer-stamp';
import { migrateContactHqContainer, planContactHqMigration } from '../migration-operations';

const PERFORMER: ResolvedPerformer = { id: 'user_admin', name: 'Διαχειριστής' };
const HQ = { id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη' };

const MODERN = { type: 'company', companyId: 'comp_a', customFields: { companyAddresses: [HQ] }, addresses: [] };
const LEAKED = { ...MODERN, neighborhood: 'Μπαγιάτικη', municipality: 'Χ' };
const ROOT_ONLY = { type: 'individual', companyId: 'comp_a', street: 'Τσιμισκή', streetNumber: '43', city: 'Θεσσαλονίκη', neighborhood: 'Κέντρο' };
const EMPTY = { type: 'service', companyId: 'comp_a', serviceName: 'ΔΟΥ' };

describe('planContactHqMigration', () => {
  it('νέο σχήμα ⇒ null (τίποτα να γραφτεί)', () => {
    expect(planContactHqMigration('c1', MODERN)).toBeNull();
  });

  it('διαρρεύσαν κλειδί ρίζας + λίστα ⇒ ΜΟΝΟ διαγραφή των κλειδιών· η λίστα δεν ξαναγράφεται', () => {
    const plan = planContactHqMigration('c1', LEAKED);
    expect(plan?.data).toEqual({ neighborhood: DELETE_SENTINEL, municipality: DELETE_SENTINEL });
    expect(plan?.entry.materializedAddresses).toBe(0);
    expect([...(plan?.entry.removedRootFields ?? [])].sort()).toEqual(['municipality', 'neighborhood']);
  });

  it('μόνη αντιγραφή στη ρίζα ⇒ λίστα (με id, τύπος του είδους) + παράγωγο + διαγραφή ρίζας', () => {
    const plan = planContactHqMigration('c2', ROOT_ONLY);
    const list = plan?.data['customFields.companyAddresses'] as Array<Record<string, unknown>>;
    expect(list).toEqual([expect.objectContaining({ type: 'home', street: 'Τσιμισκή', number: '43', neighborhood: 'Κέντρο' })]);
    expect(typeof list[0].id).toBe('string');
    expect(plan?.data.addresses).toEqual([expect.objectContaining({ street: 'Τσιμισκή', neighborhood: 'Κέντρο', isPrimary: true })]);
    expect(plan?.data.street).toBe(DELETE_SENTINEL);
    expect(plan?.data.streetNumber).toBe(DELETE_SENTINEL);
    expect(plan?.data.neighborhood).toBe(DELETE_SENTINEL);
  });

  it('καμία διεύθυνση πουθενά ⇒ null (ποτέ κενή έδρα στη βάση)', () => {
    expect(planContactHqMigration('c3', EMPTY)).toBeNull();
  });

  it('κενά κλειδιά ρίζας χωρίς λίστα ⇒ σβήνουν, και ΚΑΜΙΑ κενή έδρα δεν υλοποιείται', () => {
    const plan = planContactHqMigration('c4', { ...EMPTY, street: '', neighborhood: '   ' });
    expect(plan?.data).toEqual({ street: DELETE_SENTINEL, neighborhood: DELETE_SENTINEL });
  });

  it('ιδεμποτεντικό: το αποτέλεσμα της εφαρμογής του σχεδίου δεν παράγει νέο σχέδιο', () => {
    const plan = planContactHqMigration('c2', ROOT_ONLY);
    const applied: Record<string, unknown> = { ...ROOT_ONLY, customFields: {} };
    for (const [key, value] of Object.entries(plan?.data ?? {})) {
      if (value === DELETE_SENTINEL) delete applied[key];
      else if (key === 'customFields.companyAddresses') applied.customFields = { companyAddresses: value };
      else applied[key] = value;
    }
    expect(planContactHqMigration('c2', applied)).toBeNull();
  });
});

describe('migrateContactHqContainer — ο μετρητής του contract', () => {
  function fakeDb(docs: Record<string, Record<string, unknown>>): Firestore {
    const snapshot = {
      size: Object.keys(docs).length,
      docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })),
    };
    const query = { get: async () => snapshot, where: () => query, doc: (id: string) => ({ id }) };
    return { collection: () => query } as unknown as Firestore;
  }

  beforeEach(() => flushInBatches.mockClear());

  it('dry-run ⇒ μετρά τα έγγραφα παλαιού σχήματος, ΜΗΔΕΝ εγγραφές', async () => {
    const report = await migrateContactHqContainer(fakeDb({ a: MODERN, b: LEAKED, c: ROOT_ONLY, d: EMPTY }), true, PERFORMER, 'comp_a');
    expect(report).toMatchObject({ scannedContacts: 4, affectedContacts: 2, materializedContacts: 1, cleanedContacts: 2 });
    expect(flushInBatches).not.toHaveBeenCalled();
  });

  it('εκτέλεση ⇒ μία εγγραφή ανά επηρεαζόμενο έγγραφο, με τον φορέα', async () => {
    await migrateContactHqContainer(fakeDb({ a: MODERN, b: LEAKED, c: ROOT_ONLY }), false, PERFORMER, 'comp_a');
    expect(flushInBatches).toHaveBeenCalledTimes(1);
    const [, updates, options] = flushInBatches.mock.calls[0] as unknown as [unknown, unknown[], { performer: ResolvedPerformer }];
    expect(updates).toHaveLength(2);
    expect(options.performer).toBe(PERFORMER);
  });
});
