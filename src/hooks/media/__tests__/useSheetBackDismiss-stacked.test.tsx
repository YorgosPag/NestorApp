/**
 * @fileoverview ADR-912 §12.17 — **ΣΤΟΙΒΑΓΜΕΝΟΙ ΚΑΤΟΧΟΙ ΤΟΥ «ΠΙΣΩ»**: λεπτομέρεια θεατή + φύλλο στοιχείων από πάνω της.
 *
 * 🔴 Το `popstate` το ακούνε όλοι, η καταχώριση που αφαιρείται είναι ΜΙΑ. Πριν: ένα «πίσω» του τηλεφώνου έκλεινε το
 * φύλλο ΚΑΙ γύριζε στη λίστα. Τώρα κάθε κάτοχος ρωτά αν η κατάσταση όπου προσγειωθήκαμε κρατά ακόμη το δικό του κλειδί.
 *
 * ΣΚ-1 «πίσω» από το φύλλο ⇒ κλείνει ΜΟΝΟ το φύλλο.
 * ΣΚ-2 δεύτερο «πίσω» ⇒ κλείνει η λεπτομέρεια.
 */

import { renderHook } from '@testing-library/react';

import { useSheetBackDismiss } from '../useSheetBackDismiss';

function popTo(state: Record<string, true> | null): void {
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}

describe('useSheetBackDismiss — στοιβαγμένοι κάτοχοι', () => {
  beforeEach(() => window.history.replaceState(null, ''));

  it('🔴 ΣΚ-1 / ΣΚ-2 κάθε «πίσω» κλείνει ΜΟΝΟ την επάνω επιφάνεια', () => {
    const dismissDetail = jest.fn();
    const dismissSheet = jest.fn();
    renderHook(() => useSheetBackDismiss({ historyKey: 'detail', active: true, expanded: true, dismiss: dismissDetail }));
    renderHook(() => useSheetBackDismiss({ historyKey: 'sheet', active: true, expanded: true, dismiss: dismissSheet }));

    popTo({ detail: true });
    expect(dismissSheet).toHaveBeenCalledTimes(1);
    expect(dismissDetail).not.toHaveBeenCalled();

    popTo(null);
    expect(dismissDetail).toHaveBeenCalledTimes(1);
    expect(dismissSheet).toHaveBeenCalledTimes(1);
  });
});
