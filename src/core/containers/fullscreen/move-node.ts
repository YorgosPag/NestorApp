/**
 * ADR-241 — **Μετακίνηση κόμβου DOM που ΚΡΑΤΑ την κατάσταση, όπου το επιτρέπει ο browser.**
 *
 * Ο σταθερός ξενιστής της πλήρους οθόνης μετακινείται ανάμεσα στη θέση του μέσα στη σελίδα και στην επιφάνεια. Το
 * κλασικό `appendChild` είναι **αφαίρεση + εισαγωγή**: χάνεται το focus, τα `<iframe>` ξαναφορτώνουν, τα CSS
 * animations/transitions ξεκινούν από την αρχή.
 *
 * Το `Element.prototype.moveBefore` (DOM Standard, «state-preserving atomic move» — Chrome 133+) μετακινεί **χωρίς**
 * αφαίρεση: ό,τι είχε focus το κρατά, τα iframes δεν ξαναφορτώνουν. Όπου λείπει, το εφεδρικό `appendChild` δίνει το
 * ίδιο αποτέλεσμα **διάταξης** — και τα contexts WebGL των καμβάδων επιβιώνουν ούτως ή άλλως μιας μετακίνησης στο DOM
 * (το context ανήκει στο στοιχείο `<canvas>`, όχι στη θέση του).
 *
 * ⚠️ Το `moveBefore` πετά `HierarchyRequestError` όταν ο κόμβος ή ο νέος γονέας **δεν** είναι συνδεδεμένοι στο ίδιο
 * έγγραφο — γι' αυτό ελέγχεται η σύνδεση πριν, και το σφάλμα οδηγεί στο εφεδρικό, ποτέ σε αποτυχία της μετακίνησης.
 */

/** Γονέας που υποστηρίζει μετακίνηση χωρίς αφαίρεση — type guard, χωρίς cast. */
function supportsMoveBefore(
  parent: Element,
): parent is Element & { moveBefore: (node: Node, child: Node | null) => void } {
  return 'moveBefore' in parent && typeof parent.moveBefore === 'function';
}

/** Μετακινεί τον `node` ως τελευταίο παιδί του `newParent`. No-op αν είναι ήδη εκεί. */
export function moveNode(node: Element, newParent: Element): void {
  if (node.parentNode === newParent) return;
  if (supportsMoveBefore(newParent) && node.isConnected && newParent.isConnected) {
    try {
      newParent.moveBefore(node, null);
      return;
    } catch {
      // HierarchyRequestError (π.χ. άλλο έγγραφο) — πέφτουμε στο εφεδρικό, που πάντα μετακινεί.
    }
  }
  newParent.appendChild(node);
}
