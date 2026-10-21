/**
 * @jest-environment node
 *
 * ADR-917 Φ3β — the ONE writer / reader of `project_budget_lines` on the fake Firestore:
 * one line per (project, code), compare-and-set on `revision`, idempotent replays, archive (never delete),
 * history on the PROJECT through the canonical diff, foreign company ≡ absent, and the ledger reads the lines.
 * All data is synthetic.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { projectBudgetLineIdOf } from '../project-budget-line-schema';
import { readProjectBudgetLines, writeProjectBudgetLine, type BudgetLineWrite } from '../project-budget-lines.server';
import { loadProjectCostLedger } from '../project-cost-ledger.server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));
jest.mock('@/services/procurement/aggregators/project-purchase-orders', () => ({
  fetchProjectPurchaseOrders: jest.fn(async () => []),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
const PROJECT = 'proj_1';
const CODE = 'SOFT-PERMITS';

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;

function write(over: Partial<BudgetLineWrite> = {}) {
  return writeProjectBudgetLine(db(), {
    actor: { companyId: COMPANY, uid: 'user_1', name: 'pm@example.test' },
    target: { projectId: PROJECT, projectName: 'Έργο 1', costCode: CODE },
    next: { amount: 12000, note: null },
    expectedRevision: 0,
    nowIso: '2026-10-21T09:00:00.000Z',
    ...over,
  });
}

const storedDocs = () => fake.getAllDocs(COLLECTIONS.PROJECT_BUDGET_LINES);

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
});

describe('one line per (project, code) — Ζ8', () => {
  it('creates revision 1 at the deterministic id, with history on the PROJECT', async () => {
    const outcome = await write();
    expect(outcome).toEqual({ kind: 'changed', line: expect.objectContaining({ revision: 1, amount: 12000, archivedAt: null }) });
    expect(Object.keys(storedDocs())).toEqual([projectBudgetLineIdOf(COMPANY, PROJECT, CODE)]);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'project', entityId: PROJECT, companyId: COMPANY,
      changes: [expect.objectContaining({ field: 'budgetLines', kind: 'collection', op: 'added', itemLabel: CODE })],
    }));
  });

  it('🔴 a replay of the same values is `unchanged`: no write, no revision bump, no history row', async () => {
    await write();
    EntityAuditService.recordChange.mockClear();
    const outcome = await write({ expectedRevision: 0 });
    expect(outcome).toEqual({ kind: 'unchanged', line: expect.objectContaining({ revision: 1 }) });
    expect(Object.keys(storedDocs())).toHaveLength(1);
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('cents precision — float noise from the client never reaches the disk', async () => {
    const outcome = await write({ next: { amount: 0.1 + 0.2, note: null } });
    expect(outcome.kind === 'changed' && outcome.line.amount).toBe(0.3);
  });
});

describe('compare-and-set — no lost update', () => {
  it('🔴 a stale revision is a conflict and changes nothing', async () => {
    await write();
    await write({ next: { amount: 15000, note: null }, expectedRevision: 1 });
    const outcome = await write({ next: { amount: 9000, note: null }, expectedRevision: 1 });
    expect(outcome).toEqual({ kind: 'conflict', currentRevision: 2 });
    expect(Object.values(storedDocs())[0]).toEqual(expect.objectContaining({ amount: 15000, revision: 2 }));
  });

  it('the update is a `modified` history item with the old and new amount', async () => {
    await write();
    EntityAuditService.recordChange.mockClear();
    await write({ next: { amount: 15000, note: 'ΤΕΕ + Δήμος' }, expectedRevision: 1 });
    const [change] = EntityAuditService.recordChange.mock.calls[0][0].changes;
    expect(change).toEqual(expect.objectContaining({ op: 'modified', itemLabel: CODE }));
    expect(change.subChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ subField: 'amount', oldValue: 12000, newValue: 15000 }),
    ]));
  });
});

describe('archive, never delete — Ζ3', () => {
  it('archiving keeps the document, leaves the ledger, and is a `removed` history item', async () => {
    await write();
    const outcome = await write({ next: null, expectedRevision: 1 });
    expect(outcome.kind).toBe('changed');
    expect(Object.values(storedDocs())[0]).toEqual(expect.objectContaining({ archivedAt: expect.any(String), revision: 2 }));
    expect(await readProjectBudgetLines(db(), COMPANY, PROJECT)).toEqual([]);
    expect(EntityAuditService.recordChange.mock.calls[1][0].changes[0]).toEqual(expect.objectContaining({ op: 'removed' }));
  });

  it('archiving what is absent (or already archived) is `unchanged`', async () => {
    expect(await write({ next: null, expectedRevision: 1 })).toEqual({ kind: 'unchanged', line: null });
    expect(storedDocs()).toEqual({});
  });

  it('🔴 Α28 a set on an archived line revives it on the SAME document — from `0`, what the reader showed (Λ9)', async () => {
    await write();
    await write({ next: null, expectedRevision: 1 });
    const outcome = await write({ next: { amount: 500, note: null }, expectedRevision: 0 });
    expect(outcome).toEqual({ kind: 'changed', line: expect.objectContaining({ revision: 3, archivedAt: null, amount: 500 }) });
    expect(Object.keys(storedDocs())).toHaveLength(1);
  });

  it('🔴 Α28 the archived revision is not an address: reviving with it is a conflict at `0`', async () => {
    await write();
    await write({ next: null, expectedRevision: 1 });
    expect(await write({ next: { amount: 500, note: null }, expectedRevision: 2 })).toEqual({ kind: 'conflict', currentRevision: 0 });
  });

  it('🔴 Α28 two revivals from `0`: the second one is a conflict with the revived revision', async () => {
    await write();
    await write({ next: null, expectedRevision: 1 });
    await write({ next: { amount: 500, note: null }, expectedRevision: 0 });
    expect(await write({ next: { amount: 700, note: null }, expectedRevision: 0 })).toEqual({ kind: 'conflict', currentRevision: 3 });
  });
});

describe('tenant + fail-closed', () => {
  it('🔴 a line of another company never reads as ours (Α7-type)', async () => {
    await write();
    expect(await readProjectBudgetLines(db(), OTHER, PROJECT)).toEqual([]);
  });

  it('🔴 a FOREIGN document at our id is never read as our line, never overwritten', async () => {
    const id = projectBudgetLineIdOf(COMPANY, PROJECT, CODE);
    fake.seed(COLLECTIONS.PROJECT_BUDGET_LINES, id, {
      id, companyId: OTHER, projectId: PROJECT, costCode: CODE, amount: 1, note: null, revision: 1,
      createdAt: 'x', createdBy: 'u', updatedAt: 'x', updatedBy: 'u', archivedAt: null,
    });
    await expect(write()).rejects.toThrow('Unreadable project budget line');
    expect(storedDocs()[id]).toEqual(expect.objectContaining({ companyId: OTHER, amount: 1 }));
  });

  it('🔴 an unreadable document at our id is never overwritten by a guess', async () => {
    fake.seed(COLLECTIONS.PROJECT_BUDGET_LINES, projectBudgetLineIdOf(COMPANY, PROJECT, CODE), { companyId: COMPANY, amount: 'x' });
    await expect(write()).rejects.toThrow('Unreadable project budget line');
  });
});

describe('the ledger reads the lines — Φ3β', () => {
  it('🔴 a soft-cost line becomes the row budget with source `soft`', async () => {
    await write();
    const ledger = await loadProjectCostLedger(db(), COMPANY, PROJECT);
    expect(ledger.rows.find(row => row.categoryCode === CODE)).toEqual(
      expect.objectContaining({ budgetSource: 'soft', budget: 12000 }),
    );
  });
});
