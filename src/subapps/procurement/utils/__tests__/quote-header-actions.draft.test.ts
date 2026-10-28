/**
 * @fileoverview Η χειροκίνητη προσφορά (`draft`) ΕΧΕΙ διαδρομή προς τη Σύγκριση (ADR-327 §8.5.4, 2026-10-28).
 *
 * Ζωντανά: η QT-0003 (χειροκίνητη, ρητά δεμένη) δημιουργήθηκε `draft` και το ΜΟΝΟ κουμπί ήταν «Επεξεργασία» → «σύντομα»·
 * η Σύγκριση μετρά `submitted/under_review/accepted` ⇒ η προσφορά δεν μπορούσε ΠΟΤΕ να συγκριθεί.
 *
 * Δ1 `draft` ⇒ «Επιβεβαίωση» (ίδιο κουμπί με το `submitted`) + «Επεξεργασία» ·
 * Δ2 μετά την ανάθεση σε άλλη προσφορά ⇒ «Επιβεβαίωση» απενεργή (καμία καθυστερημένη είσοδος στη Σύγκριση).
 */

import type { Quote } from '../../types/quote';
import type { RFQ } from '../../types/rfq';
import { buildQuoteHeaderActions, type BuildQuoteHeaderActionsParams } from '../quote-header-actions';

const noop = () => undefined;
const params = (status: Quote['status'], rfq: RFQ | null = null): BuildQuoteHeaderActionsParams => ({
  quote: { id: 'qt_3', status, source: 'manual' } as Quote,
  rfq,
  onConfirm: noop, onApprove: noop, onReject: noop, onCreatePo: noop, onViewPo: noop, onRestore: noop,
  onDownload: noop, onOpenComments: noop, onEdit: noop, onDuplicate: noop, onDelete: noop,
  t: (key) => key,
  isConnected: true,
});

describe('buildQuoteHeaderActions — draft', () => {
  it('Δ1 «Επιβεβαίωση» + «Επεξεργασία», ίδιο confirm με το submitted', () => {
    const draft = buildQuoteHeaderActions(params('draft')).primaryActions;
    expect(draft.map((a) => a.id)).toEqual(['confirm', 'edit']);
    const submitted = buildQuoteHeaderActions(params('submitted')).primaryActions[0];
    expect({ ...draft[0], onClick: null }).toEqual({ ...submitted, onClick: null });
    expect(draft[0].disabled).toBe(false);
  });

  it('Δ2 μετά την ανάθεση σε άλλη ⇒ «Επιβεβαίωση» απενεργή', () => {
    const awarded = { winnerQuoteId: 'qt_other' } as RFQ;
    expect(buildQuoteHeaderActions(params('draft', awarded)).primaryActions[0]).toMatchObject({ id: 'confirm', disabled: true });
  });
});
