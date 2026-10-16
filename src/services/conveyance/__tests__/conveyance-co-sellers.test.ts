/**
 * ⚓ ADR-915 §23 — συμμεταβιβάζοντες μέσα από την υπηρεσία της υπόθεσης (fake Firestore): ο server **κρίνει** την επαφή
 * (μισθωτής · τύπος · ιδιότητα από το έργο), το ευρετήριο CDC ξαναγράφεται με κάθε αλλαγή προσώπων, και η αφαίρεση
 * αφήνει ίχνος. Συνθετικά αναγνωριστικά — καμία πραγματική επαφή.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import { applyConveyanceCaseCommand, openConveyanceCase, readOwnedConveyanceCase, type ConveyanceActor } from '../conveyance-case.service';

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async () => undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const actor: ConveyanceActor = { uid: 'u1', email: 'u1@a.test', companyId: 'comp_a' };
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

function seedWorld(): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: 'comp_a', name: 'Δ1', type: 'apartment', buildingId: null, projectId: 'proj_1',
    commercial: { owners: [{ contactId: 'cont_buyer' }], legalPhase: 'preliminary_signed' },
  });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: 'comp_a', linkedCompanyId: 'cont_co', landownerContactIds: ['cont_lo1'] });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_lo1', { companyId: 'comp_a', type: 'individual', status: 'active', firstName: 'Test', lastName: 'Landowner' });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_peer', { companyId: 'comp_a', type: 'company', status: 'active' });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_svc', { companyId: 'comp_a', type: 'service', status: 'active' });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_foreign', { companyId: 'comp_b', type: 'individual', status: 'active' });
}

async function opened() {
  seedWorld();
  const outcome = await openConveyanceCase(db(), actor, 'prop_1');
  if (!outcome.ok) throw new Error('open failed');
  const record = await readOwnedConveyanceCase(db(), actor, outcome.value.view.conveyanceCase.id);
  if (!record) throw new Error('read failed');
  return record;
}

async function command(cmd: ConveyanceCommand) {
  const record = await readOwnedConveyanceCase(db(), actor, (await opened()).id);
  if (!record) throw new Error('read failed');
  return applyConveyanceCaseCommand(db(), actor, record, { expectedVersion: record.version, command: cmd });
}

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
});

describe('add_sellers — ο server κρίνει την επαφή', () => {
  it('οικοπεδούχος του έργου ⇒ `landowner`, φυσικό πρόσωπο · μπαίνει στο ευρετήριο CDC · χωρίς δική του φορολογική', async () => {
    const outcome = await command({ type: 'add_sellers', contactIds: ['cont_lo1'] });
    if (!outcome.ok) throw new Error(outcome.failure.kind);
    expect(outcome.value.conveyanceCase.parties.sellers.map((p) => [p.key, p.kind, p.capacity])).toEqual([
      ['cont_co', 'legal_entity', 'principal'], ['cont_lo1', 'person', 'landowner'],
    ]);
    const stored = fake.getData(COLLECTIONS.CONVEYANCE_CASES, outcome.value.conveyanceCase.id);
    expect(stored?.dependencyKeys).toEqual(expect.arrayContaining(['contact:cont_lo1', 'contact:cont_co']));
    const tax = outcome.value.checklist.rows.filter((row) => row.item.id === 'seller_tax_clearance');
    expect(tax.map((row) => [row.party?.key, row.status === 'not_applicable'])).toEqual([['cont_co', false], ['cont_lo1', true]]);
    expect(EntityAuditService.recordChange).toHaveBeenLastCalledWith(expect.objectContaining({
      action: 'updated', changes: [{ field: 'parties.sellers.cont_lo1', oldValue: null, newValue: 'landowner' }],
    }));
  });

  it('επαφή που δεν είναι οικοπεδούχος ⇒ `other`, είδος από τον τύπο της (εταιρεία ⇒ νομικό πρόσωπο)', async () => {
    const outcome = await command({ type: 'add_sellers', contactIds: ['cont_peer'] });
    if (!outcome.ok) throw new Error(outcome.failure.kind);
    expect(outcome.value.conveyanceCase.parties.sellers[1]).toMatchObject({ key: 'cont_peer', kind: 'legal_entity', capacity: 'other' });
  });

  it.each([
    ['ΑΛΛΟΥ μισθωτή (ξένη ≡ ανύπαρκτη)', 'cont_foreign'],
    ['υπηρεσία', 'cont_svc'],
    ['ανύπαρκτη', 'cont_ghost'],
  ])('επαφή %s ⇒ seller_not_eligible, καμία εγγραφή', async (_label, contactId) => {
    const outcome = await command({ type: 'add_sellers', contactIds: [contactId] });
    expect(outcome).toEqual({ ok: false, failure: { kind: 'rejected', rejection: 'seller_not_eligible' } });
  });
});

describe('§23.10 — ονόματα στην όψη του οικοδεσπότη', () => {
  it('ένας πωλητής ⇒ καμία ετικέτα· δεύτερος ⇒ ονόματα ζωντανά από τις επαφές, η επαφή που λείπει ⇒ κενό', async () => {
    seedWorld();
    const opened = await openConveyanceCase(db(), actor, 'prop_1');
    if (!opened.ok) throw new Error('open failed');
    expect(opened.value.view.parties).toEqual([]);
    const outcome = await command({ type: 'add_sellers', contactIds: ['cont_lo1'] });
    if (!outcome.ok) throw new Error(outcome.failure.kind);
    expect(outcome.value.parties).toEqual([
      { key: 'cont_co', ordinal: 1, name: '' },
      { key: 'cont_lo1', ordinal: 2, name: 'Test Landowner' },
    ]);
    expect(fake.getData(COLLECTIONS.CONVEYANCE_CASES, outcome.value.conveyanceCase.id)).not.toHaveProperty('parties.sellers.1.name');
  });
});

describe('remove_seller', () => {
  it('αφαίρεση οικοπεδούχου ⇒ βγαίνει από τη λίστα ΚΑΙ από το ευρετήριο CDC · ίχνος', async () => {
    const added = await command({ type: 'add_sellers', contactIds: ['cont_lo1'] });
    if (!added.ok) throw new Error(added.failure.kind);
    const record = await readOwnedConveyanceCase(db(), actor, added.value.conveyanceCase.id);
    if (!record) throw new Error('read failed');
    const removed = await applyConveyanceCaseCommand(db(), actor, record, { expectedVersion: record.version, command: { type: 'remove_seller', partyKey: 'cont_lo1' } });
    if (!removed.ok) throw new Error(removed.failure.kind);
    expect(removed.value.conveyanceCase.parties.sellers.map((p) => p.key)).toEqual(['cont_co']);
    expect(fake.getData(COLLECTIONS.CONVEYANCE_CASES, record.id)?.dependencyKeys).not.toContain('contact:cont_lo1');
    expect(EntityAuditService.recordChange).toHaveBeenLastCalledWith(expect.objectContaining({
      changes: [{ field: 'parties.sellers.cont_lo1', oldValue: 'landowner', newValue: null }],
    }));
  });

  it('η εταιρεία του έργου ⇒ principal_not_removable', async () => {
    expect(await command({ type: 'remove_seller', partyKey: 'cont_co' }))
      .toEqual({ ok: false, failure: { kind: 'rejected', rejection: 'principal_not_removable' } });
  });
});
