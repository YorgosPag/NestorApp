/**
 * @jest-environment node
 */
/**
 * ADR-829 §7 — the trigger runs the portable admission rule.
 *
 * Runs the real `onFileWrite` handler with the writer replaced, to prove WHICH write each
 * change produces. The version fence itself is `search-index-writer.test.ts`; together they
 * prove a WIP file leaves the index and that leaving WIP brings it back.
 */

import { onFileWrite } from '../indexTriggers';
import { applySearchIndexTombstone, applySearchIndexWrite } from '../search-index-writer';

jest.mock('firebase-functions/v1', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  runWith: () => ({
    firestore: { document: () => ({ onWrite: (handler: unknown) => handler }) },
  }),
}), { virtual: true });
jest.mock('firebase-admin', () => ({
  firestore: Object.assign(
    () => ({ collection: () => ({ doc: (id: string) => ({ id }) }) }),
    { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } },
  ),
}));
jest.mock('../search-index-writer', () => ({
  applySearchIndexWrite: jest.fn(async () => 'applied'),
  applySearchIndexTombstone: jest.fn(async () => 'applied'),
}));

const BEFORE_VERSION = { seconds: 100, nanoseconds: 0 };
const AFTER_VERSION = { seconds: 200, nanoseconds: 0 };

const snapshot = (data: Record<string, unknown> | undefined, updateTime: unknown) => ({
  exists: data !== undefined,
  data: () => data,
  updateTime,
});

const FILE = { companyId: 'co_a', displayName: 'Κάτοψη', status: 'ready' };

type TriggerHandler = (change: unknown, context: unknown) => Promise<void>;

async function writeFile(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  const change = { before: snapshot(before, BEFORE_VERSION), after: snapshot(after, AFTER_VERSION) };
  await (onFileWrite as unknown as TriggerHandler)(change, {
    params: { docId: 'file_1' },
    timestamp: '2026-11-01T00:00:00.000Z',
  });
}

const tombstones = applySearchIndexTombstone as jest.Mock;
const writes = applySearchIndexWrite as jest.Mock;

beforeEach(() => {
  tombstones.mockClear();
  writes.mockClear();
});

describe('onFileWrite — reach decides, ADR-829 §7', () => {
  it('Τ1: a WIP file leaves the index, with the version of the `after` snapshot', async () => {
    await writeFile({ ...FILE, cdeReadReach: 'tenant' }, { ...FILE, cdeReadReach: 'author' });
    expect(writes).not.toHaveBeenCalled();
    expect(tombstones).toHaveBeenCalledTimes(1);
    expect(tombstones.mock.calls[0][2]).toEqual(AFTER_VERSION);
    expect(tombstones.mock.calls[0][1]).toEqual({ tenantId: 'co_a', entityType: 'file', entityId: 'file_1' });
  });

  it('Τ2: leaving WIP is an ordinary newer write, stamped for the results fence', async () => {
    await writeFile({ ...FILE, cdeReadReach: 'author' }, { ...FILE, cdeReadReach: 'tenant' });
    expect(tombstones).not.toHaveBeenCalled();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0][1]).toMatchObject({ readReach: 'tenant', entityType: 'file' });
    expect(writes.mock.calls[0][2]).toEqual(AFTER_VERSION);
  });

  it('Τ3: a file with no reach stays out: closed on doubt', async () => {
    await writeFile(undefined, { ...FILE });
    expect(writes).not.toHaveBeenCalled();
    expect(tombstones).toHaveBeenCalledTimes(1);
  });

  it('Τ4: a hard delete still takes the version of `before`', async () => {
    await writeFile({ ...FILE, cdeReadReach: 'tenant' }, undefined);
    expect(tombstones.mock.calls[0][2]).toEqual(BEFORE_VERSION);
  });

  it('Τ5: an archived file leaves the index through the same rule', async () => {
    await writeFile({ ...FILE, cdeReadReach: 'tenant' }, { ...FILE, cdeReadReach: 'tenant', status: 'archived' });
    expect(writes).not.toHaveBeenCalled();
    expect(tombstones).toHaveBeenCalledTimes(1);
  });
});
