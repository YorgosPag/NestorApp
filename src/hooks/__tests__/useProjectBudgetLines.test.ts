/**
 * @jest-environment jsdom
 */

/**
 * ADR-917 Φ3γ · Α29 — the ONE client of the budget-line routes: compare-and-set from the confirmed revision,
 * one write per code at a time, 409 ⇒ re-read + conflict kept, 403 ⇒ read-only, ledger invalidated on success ONLY.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

const get = jest.fn();
const put = jest.fn();
const del = jest.fn();
const invalidate = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), delete: (...a: unknown[]) => del(...a) },
  ApiClientError: jest.requireActual('@/lib/api/api-client-types').ApiClientError,
}));
jest.mock('@/hooks/useProjectCostLedger', () => ({ invalidateProjectCostLedger: (id: string) => invalidate(id) }));

import { ApiClientError } from '@/lib/api/api-client-types';
import { useProjectBudgetLines } from '../useProjectBudgetLines';

const line = (costCode: string, amount: number, revision: number) => ({ costCode, amount, note: null, revision });

async function ready(lines = [line('SOFT-LAND', 100, 2)]) {
  get.mockResolvedValue({ lines });
  const hook = renderHook(() => useProjectBudgetLines('proj_1'));
  await waitFor(() => expect(hook.result.current.lines).toHaveLength(lines.length));
  return hook;
}

beforeEach(() => jest.clearAllMocks());

it('🔴 CAS: the PUT carries the CONFIRMED revision; success replaces the overlay and invalidates the ledger', async () => {
  const hook = await ready();
  put.mockResolvedValue({ outcome: 'changed', line: line('SOFT-LAND', 900, 3) });
  await act(async () => { await hook.result.current.setLine('SOFT-LAND', { amount: 900, note: null }); });
  expect(put).toHaveBeenCalledWith(expect.stringContaining('/budget-lines/SOFT-LAND'), { amount: 900, note: null, expectedRevision: 2 });
  expect(hook.result.current.lines[0]).toEqual({ costCode: 'SOFT-LAND', amount: 900, note: null, pending: false });
  expect(invalidate).toHaveBeenCalledWith('proj_1');
});

it('🔴 two quick edits of one code: the second waits and sends the revision the first produced', async () => {
  const hook = await ready();
  put.mockResolvedValueOnce({ outcome: 'changed', line: line('SOFT-LAND', 1, 3) })
    .mockResolvedValueOnce({ outcome: 'changed', line: line('SOFT-LAND', 2, 4) });
  await act(async () => {
    await Promise.all([
      hook.result.current.setLine('SOFT-LAND', { amount: 1, note: null }),
      hook.result.current.setLine('SOFT-LAND', { amount: 2, note: null }),
    ]);
  });
  expect(put.mock.calls.map(call => call[1].expectedRevision)).toEqual([2, 3]);
});

it('🔴 409: rollback, re-read, the human\'s version kept as a conflict; no ledger invalidation', async () => {
  const hook = await ready();
  put.mockRejectedValue(new ApiClientError('conflict', 409));
  get.mockResolvedValue({ lines: [line('SOFT-LAND', 300, 5)] });
  let result = '';
  await act(async () => { result = await hook.result.current.setLine('SOFT-LAND', { amount: 900, note: null }); });
  expect(result).toBe('conflict');
  expect(hook.result.current.lines[0].amount).toBe(300);
  expect(hook.result.current.conflicts).toEqual([
    { costCode: 'SOFT-LAND', mine: { amount: 900, note: null }, theirs: line('SOFT-LAND', 300, 5) },
  ]);
  expect(invalidate).not.toHaveBeenCalled();

  put.mockReset().mockResolvedValue({ outcome: 'changed', line: line('SOFT-LAND', 900, 6) });
  await act(async () => { hook.result.current.resolveConflict('SOFT-LAND', 'mine'); });
  await waitFor(() => expect(hook.result.current.lines[0].amount).toBe(900));
  expect(put.mock.calls[0][1].expectedRevision).toBe(5);
  expect(hook.result.current.conflicts).toEqual([]);
});

it('403 ⇒ read-only and the value returns', async () => {
  const hook = await ready();
  put.mockRejectedValue(new ApiClientError('forbidden', 403));
  await act(async () => { await hook.result.current.setLine('SOFT-LAND', { amount: 900, note: null }); });
  expect(hook.result.current.readOnly).toBe(true);
  expect(hook.result.current.lines[0].amount).toBe(100);
});

it('archive = DELETE with the expected revision in the query; a new code is sent from `0`', async () => {
  const hook = await ready();
  del.mockResolvedValue({ outcome: 'changed', line: null });
  put.mockResolvedValue({ outcome: 'changed', line: line('SOFT-DESIGN', 5, 1) });
  await act(async () => { await hook.result.current.archiveLine('SOFT-LAND'); });
  expect(del).toHaveBeenCalledWith(expect.stringContaining('/budget-lines/SOFT-LAND?expectedRevision=2'));
  await act(async () => { await hook.result.current.setLine('SOFT-DESIGN', { amount: 5, note: null }); });
  expect(put.mock.calls[0][1].expectedRevision).toBe(0);
  expect(hook.result.current.lines.map(row => row.costCode)).toEqual(['SOFT-DESIGN']);
});
