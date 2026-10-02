/**
 * ADR-901 Φ1 — η υπηρεσία της υπόθεσης πάνω στο επαληθευμένο fake Firestore:
 * ιδεμποτές άνοιγμα (N.7.2 #3), CAS (409), πάγωμα μετά την υπογραφή (Ε-6), απομόνωση
 * μισθωτή, ίχνος (ADR-195), και κατάλογος που γεμίζει από τα ΗΔΗ ανεβασμένα αρχεία (Σ-1).
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import {
  applyConveyanceCaseCommand,
  getConveyanceCaseView,
  openConveyanceCase,
  readOwnedConveyanceCase,
  type ConveyanceActor,
} from '../conveyance-case.service';

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const actor: ConveyanceActor = { uid: 'u1', email: 'u1@a.gr', companyId: 'comp_a' };
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

function seedWorld(legalPhase: string | null = 'preliminary_signed'): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: 'comp_a', name: 'Δ3', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1',
    linkedSpaces: [{ spaceId: 'park_1', spaceType: 'parking', includedInSale: true }],
    commercial: { owners: [{ contactId: 'cont_b' }], legalPhase },
  });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: 'comp_a', linkedCompanyId: 'cont_s', landownerContactIds: [] });
  fake.seed(COLLECTIONS.FILES, 'file_permit', {
    companyId: 'comp_a', entityType: 'project', entityId: 'proj_1', purpose: 'permit', status: 'ready',
    lifecycleState: 'active', displayName: 'permit.pdf', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  });
  fake.seed(COLLECTIONS.FILES, 'file_trashed', {
    companyId: 'comp_a', entityType: 'project', entityId: 'proj_1', purpose: 'study-title-deed', status: 'ready',
    lifecycleState: 'trashed', isDeleted: true, displayName: 'old.pdf', createdAt: '2026-08-01T00:00:00Z',
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
});

describe('openConveyanceCase', () => {
  it('ανοίγει υπόθεση · ο κατάλογος γεμίζει από το ήδη ανεβασμένο αρχείο έργου (Σ-1)', async () => {
    seedWorld();
    const outcome = await openConveyanceCase(db(), actor, 'prop_1');
    if (!outcome.ok) throw new Error(outcome.failure.kind);
    const rows = outcome.value.view.checklist.rows;
    expect(outcome.value.created).toBe(true);
    expect(rows.find((row) => row.itemId === 'building_permit')?.status).toBe('uploaded');
    expect(rows.find((row) => row.itemId === 'title_deed')?.status).toBe('missing'); // ο κάδος δεν μετράει
    expect(outcome.value.view.derivedFacts).toMatchObject({ seller_is_legal_entity: true, has_appurtenances: true, has_antiparochi: false });
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'conveyance_case', action: 'created', companyId: 'comp_a' }));
  });

  it('ιδεμποτές: δεύτερο άνοιγμα επιστρέφει την ΙΔΙΑ υπόθεση, χωρίς δεύτερο ίχνος', async () => {
    seedWorld();
    const first = await openConveyanceCase(db(), actor, 'prop_1');
    const second = await openConveyanceCase(db(), actor, 'prop_1');
    if (!first.ok || !second.ok) throw new Error('open failed');
    expect(second.value.created).toBe(false);
    expect(second.value.view.conveyanceCase.id).toBe(first.value.view.conveyanceCase.id);
    expect(EntityAuditService.recordChange).toHaveBeenCalledTimes(1);
  });

  it('ακίνητο ΑΛΛΟΥ μισθωτή ⇒ property_not_found (καμία μαρτυρία ύπαρξης)', async () => {
    seedWorld();
    const outcome = await openConveyanceCase(db(), { ...actor, companyId: 'comp_b' }, 'prop_1');
    expect(outcome).toEqual({ ok: false, failure: { kind: 'property_not_found' } });
  });
});

describe('applyConveyanceCaseCommand', () => {
  async function opened() {
    seedWorld();
    const outcome = await openConveyanceCase(db(), actor, 'prop_1');
    if (!outcome.ok) throw new Error('open failed');
    const record = await readOwnedConveyanceCase(db(), actor, outcome.value.view.conveyanceCase.id);
    if (!record) throw new Error('read failed');
    return record;
  }

  it('εφαρμόζει εντολή, αυξάνει έκδοση, γράφει ίχνος', async () => {
    const record = await opened();
    const outcome = await applyConveyanceCaseCommand(db(), actor, record, {
      expectedVersion: 0,
      command: { type: 'review', itemId: 'building_permit', verdict: 'accepted', fileId: 'file_permit', issuedOn: null, reason: null },
    });
    if (!outcome.ok) throw new Error(outcome.failure.kind);
    expect(outcome.value.conveyanceCase.version).toBe(1);
    expect(outcome.value.checklist.rows.find((row) => row.itemId === 'building_permit')?.status).toBe('accepted');
    expect(EntityAuditService.recordChange).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'updated' }));
  });

  it('CAS: παλιά έκδοση ⇒ version_conflict, τίποτα δεν γράφεται', async () => {
    const record = await opened();
    const writesBefore = fake.writes;
    const outcome = await applyConveyanceCaseCommand(db(), actor, record, {
      expectedVersion: 7, command: { type: 'set_target_signing_date', date: '2026-12-01' },
    });
    expect(outcome).toEqual({ ok: false, failure: { kind: 'version_conflict' } });
    expect(fake.writes).toBe(writesBefore);
  });

  it('πάγωμα (Ε-6): υπογεγραμμένο οριστικό ⇒ not_editable', async () => {
    const record = await opened();
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
      companyId: 'comp_a', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1', commercial: { legalPhase: 'final_signed' },
    });
    const outcome = await applyConveyanceCaseCommand(db(), actor, record, {
      expectedVersion: 0, command: { type: 'set_target_signing_date', date: '2026-12-01' },
    });
    expect(outcome).toEqual({ ok: false, failure: { kind: 'rejected', rejection: 'not_editable' } });
  });

  it('readOwnedConveyanceCase: ξένος μισθωτής ⇒ null', async () => {
    const record = await opened();
    expect(await readOwnedConveyanceCase(db(), { ...actor, companyId: 'comp_b' }, record.id)).toBeNull();
  });
});

describe('getConveyanceCaseView', () => {
  it('χωρίς υπόθεση ⇒ null · μετά το άνοιγμα ⇒ η υπόθεση', async () => {
    seedWorld();
    const before = await getConveyanceCaseView(db(), actor, 'prop_1');
    expect(before).toEqual({ ok: true, value: null });
    await openConveyanceCase(db(), actor, 'prop_1');
    const after = await getConveyanceCaseView(db(), actor, 'prop_1');
    expect(after.ok && after.value?.state).toBe('open');
  });
});
