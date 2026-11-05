/**
 * **Η προεπισκόπηση κυλά στην ενότητα που ζητήθηκε — και την περιμένει αν δεν έχει αποδοθεί ακόμη** (ADR-928 §5.23).
 * @module components/procurement/subcontracts/editor/preview-section-sync
 *
 * 🔴 Ζωντανός έλεγχος (2026-11-05): ανανέωση στο `#editor-clauses` ⇒ η καρτέλα επανερχόταν, η προεπισκόπηση όμως
 *    έμενε στην κορυφή. Δύο αιτίες: κανένα αίτημα για την καρτέλα της διεύθυνσης (`useEditorSection`), και ένα αίτημα που
 *    έφτανε πριν αποδοθεί το έγγραφο (η βιβλιοθήκη φτάνει μετά το split) **χανόταν σιωπηλά**.
 * 🔑 Ο στόχος βρίσκεται ⇒ κύλιση αμέσως. Δεν βρίσκεται ⇒ `MutationObserver` στον κυλιόμενο ως ότου εμφανιστεί· η
 *    επιστρεφόμενη συνάρτηση ακυρώνει την αναμονή (νέο αίτημα ή αποπροσάρτηση).
 */

const NOOP = () => undefined;

export function revealSectionWhenPresent(scroller: HTMLElement, section: string): () => void {
  const reveal = (): boolean => {
    const target = scroller.querySelector<HTMLElement>(`[data-doc-section="${section}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return target !== null;
  };
  if (reveal() || typeof MutationObserver === 'undefined') return NOOP;
  const observer = new MutationObserver(() => {
    if (reveal()) observer.disconnect();
  });
  observer.observe(scroller, { childList: true, subtree: true });
  return () => observer.disconnect();
}
