/**
 * ADR-923 §5.11 «3γ» Α13 — a PO save always tells the caller what happened.
 *
 *   Σ1 · create ⇒ `created` with the server's id/number AND the project the form chose
 *        (the page opens the new PO, not the hub).
 *   Σ2 · update ⇒ `updated` with the PO id (the page leaves edit mode) — never `{}`.
 */

const post = jest.fn();
const patch = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) },
}));
jest.mock('@/lib/cache/spend-analytics-bus', () => ({ emitSpendAnalyticsInvalidate: jest.fn() }));

import type { CreatePurchaseOrderDTO } from '@/types/procurement';
import {
  createPurchaseOrderWithPolicy,
  updatePurchaseOrderWithPolicy,
} from '../procurement-mutation-gateway';

const dto: CreatePurchaseOrderDTO = {
  projectId: 'proj_chosen_in_form', supplierId: 'cont_1', items: [], taxRate: 24,
};

beforeEach(() => { post.mockReset(); patch.mockReset(); });

describe('PO save result (ADR-923 «3γ» Α13)', () => {
  it('Σ1 · create returns the new id, number and the stored project', async () => {
    post.mockResolvedValue({ id: 'po_new', poNumber: 'PO-0042' });
    await expect(createPurchaseOrderWithPolicy(dto)).resolves.toEqual({
      kind: 'created', id: 'po_new', poNumber: 'PO-0042', projectId: 'proj_chosen_in_form',
    });
  });

  it('Σ2 · update returns `updated` with the PO id', async () => {
    patch.mockResolvedValue(undefined);
    await expect(updatePurchaseOrderWithPolicy('po_1', { supplierNotes: 'x' })).resolves.toEqual({
      kind: 'updated', id: 'po_1',
    });
    expect(patch).toHaveBeenCalledTimes(1);
  });
});
