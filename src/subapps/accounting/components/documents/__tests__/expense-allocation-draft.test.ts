/**
 * ADR-917 Φ4 — the allocation DRAFT of the review form: the form refuses before the request what the writer
 * would refuse after it (same `validateAllocations`), amounts are text in either decimal convention, and editing
 * a proposed line makes its origin visible as `manual`. All data is synthetic.
 */

import type { ExpenseCostAllocation } from '@/subapps/accounting/types/documents';
import {
  addDirectDraftLine,
  editDraftAmount,
  removeDraftLine,
  resolveDraft,
  toDraftLines,
} from '../expense-allocation-draft';

const proposed: ExpenseCostAllocation = {
  projectId: 'proj_1', costCode: 'OIK-3', netAmount: 300, purchaseOrderId: 'po_1', origin: 'po_proposal',
};

describe('expense allocation draft', () => {
  it('round-trips stored lines through text, in either decimal convention', () => {
    const draft = toDraftLines([proposed]);
    expect(resolveDraft(draft, 1000)).toEqual({ ok: true, lines: [proposed] });
    expect(resolveDraft(editDraftAmount(draft, 0, '1.200,50'), 2000)).toEqual({
      ok: true, lines: [{ ...proposed, netAmount: 1200.5, origin: 'manual' }],
    });
  });

  it('🔴 editing a proposed line makes it manual (the origin never lies)', () => {
    expect(editDraftAmount(toDraftLines([proposed]), 0, '250')[0].origin).toBe('manual');
  });

  it('🔴 Σ above the net amount is refused BEFORE the request, with both figures', () => {
    expect(resolveDraft(toDraftLines([proposed]), 200)).toEqual({ ok: false, problem: { kind: 'exceeds', allocated: 300, net: 200 } });
  });

  it('unreadable or non-positive amounts are refused', () => {
    expect(resolveDraft(editDraftAmount(toDraftLines([proposed]), 0, 'abc'), 1000)).toEqual({ ok: false, problem: { kind: 'amount' } });
    expect(resolveDraft(editDraftAmount(toDraftLines([proposed]), 0, '0'), 1000)).toEqual({ ok: false, problem: { kind: 'amount' } });
  });

  it('a direct line needs project, code and a positive amount — and may not duplicate', () => {
    expect(addDirectDraftLine([], { projectId: '', costCode: 'SOFT-LEGAL', amountText: '10' })).toEqual({ error: 'missingFields' });
    const added = addDirectDraftLine([], { projectId: 'proj_1', costCode: 'SOFT-LEGAL', amountText: '10' });
    expect('draft' in added && added.draft).toEqual([
      { projectId: 'proj_1', costCode: 'SOFT-LEGAL', purchaseOrderId: null, origin: 'manual', amountText: '10' },
    ]);
    const again = 'draft' in added ? addDirectDraftLine(added.draft, { projectId: 'proj_1', costCode: 'SOFT-LEGAL', amountText: '5' }) : null;
    expect(again).toEqual({ error: 'duplicate' });
  });

  it('removing every line resolves to [] — it clears the allocation', () => {
    expect(resolveDraft(removeDraftLine(toDraftLines([proposed]), 0), null)).toEqual({ ok: true, lines: [] });
  });
});
