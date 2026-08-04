/**
 * 🔴 ADR-751 — **ο σύνδεσμος κάτω από τον δείκτη**, ως SSoT μηδενικής κατάστασης React.
 *
 * Αδελφός του `systems/hover/HoverStore.ts` — ίδιο μοτίβο (μεταβλητό singleton +
 * `skip-if-unchanged` + προαιρετική συνδρομή), γιατί απαντά την ίδια κατηγορία ερώτησης σε
 * κάθε κίνηση ποντικιού.
 *
 * ## Γιατί ΞΕΧΩΡΙΣΤΟ store και όχι πεδίο στο `HoverStore`
 * Το `HoverStore` κρατά **ταυτότητες οντοτήτων** (`hoveredEntityId: string | null`) και το
 * διαβάζουν τα micro-leaves του καμβά για να επανασχεδιάσουν. Ο σύνδεσμος είναι **υπο-μέρος**
 * μιας οντότητας και δεν προκαλεί καμία επανασχεδίαση — αλλάζει μόνο τον δείκτη του ποντικιού.
 * Αν έμπαινε εκεί, κάθε κίνηση πάνω από πίνακα με διευθύνσεις θα ειδοποιούσε συνδρομητές που
 * δεν έχουν τίποτα να κάνουν. Την ίδια απόφαση πήρε ήδη το `stair-sub-element-selection-store`
 * για τα υπο-στοιχεία σκάλας: υπο-μέρος ⇒ δικό του store.
 *
 * ## Γιατί κρατά ΟΛΟΚΛΗΡΟ το `TableCellLinkHit` και όχι απλώς `boolean`
 * Ο δείκτης χρειάζεται μόνο «ναι/όχι», αλλά το κλικ χρειάζεται τον **προορισμό**. Κρατώντας
 * το αποτέλεσμα, το κλικ μπορεί να διαβάσει ό,τι ήδη υπολόγισε το hover αντί να ξανατρέξει
 * τον επιλυτή — και, το κρίσιμο, είναι **αδύνατο** να διαφωνήσουν: ανοίγει κυριολεκτικά αυτό
 * που έδειχνε το χεράκι.
 *
 * @module subapps/dxf-viewer/state/table-cell-link-hover-store
 * @see bim/table/table-cell-link-hit.ts — ο επιλυτής που το τροφοδοτεί
 */

import { createExternalStore } from '../stores/createExternalStore';

import type { TableCellLinkHit } from '../bim/table/table-cell-link-hit';

/** Η οντότητα του πίνακα μαζί με τον σύνδεσμο — το κλικ χρειάζεται και τα δύο. */
export interface HoveredCellLink {
  readonly entityId: string;
  readonly hit: TableCellLinkHit;
  /**
   * 🔴 ADR-751 Φ7 — η άγκυρα του tooltip σε συντεταγμένες σελίδας, **παγωμένη τη στιγμή που
   * ο δείκτης μπήκε** στον σύνδεσμο.
   *
   * ## Γιατί ΔΕΝ ακολουθεί τον δείκτη — και γιατί ο αδελφός του κάνει το αντίθετο
   * Το `OverlapBadgeStore` (ADR-659) ξαναγράφει `clientX/clientY` σε κάθε throttled tick, και
   * σωστά: εκείνο **μετράει** κάτι που αλλάζει με τη θέση («πόσες οντότητες κάτω από τον
   * δείκτη»), οπότε ένα ακίνητο chip θα έδειχνε νούμερο άλλου σημείου.
   *
   * Εδώ ο σύνδεσμος είναι **ο ίδιος σε όλο του το εύρος**. Ένα tooltip που τρέμει ακολουθώντας
   * το ποντίκι μέσα στα ίδια γράμματα είναι θόρυβος — και δεν είναι αυτό που κάνει κανένα
   * πρότυπο: τα native tooltips, όπως και του Excel, εμφανίζονται **μία φορά** και μένουν.
   *
   * Το πάγωμα δεν χρειάστηκε μηχανισμό: το {@link sameLink} συγκρίνει μόνο ταυτότητα
   * (οντότητα · κελί · προορισμός), οπότε κάθε επόμενη κίνηση μέσα στον ίδιο σύνδεσμο
   * συμπίπτει και **δεν γράφεται καν**. Άρα μηδέν επανασχεδιάσεις tooltip και — το κρίσιμο —
   * μηδέν περιττά `apply()` στον δείκτη, που είναι κι αυτός συνδρομητής εδώ.
   */
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Το `skip-if-unchanged` δίνεται στο **factory** ως `equals` — δεν ξαναγράφεται εδώ φύλακας.
 *
 * Η σύγκριση ταυτότητας είναι **δομική στα τρία πεδία που μετρούν** (οντότητα, κελί,
 * προορισμός) και όχι by-reference: ο επιλυτής παράγει **νέο** αντικείμενο σε κάθε κίνηση,
 * οπότε μια σύγκριση αναφοράς θα ειδοποιούσε σε κάθε pixel — δηλαδή θα ακύρωνε ακριβώς την
 * προστασία που το `skip-if-unchanged` υπάρχει για να δίνει.
 */
const store = createExternalStore<HoveredCellLink | null>(null, { equals: sameLink });

/** Ορίζει τον σύνδεσμο κάτω από τον δείκτη. */
export function setHoveredCellLink(next: HoveredCellLink | null): void {
  store.set(next);
}

export function getHoveredCellLink(): HoveredCellLink | null {
  return store.get();
}

export function subscribeHoveredCellLink(cb: () => void): () => void {
  return store.subscribe(cb);
}

function sameLink(a: HoveredCellLink | null, b: HoveredCellLink | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.entityId === b.entityId &&
    a.hit.rowId === b.hit.rowId &&
    a.hit.colId === b.hit.colId &&
    a.hit.span.href === b.hit.span.href
  );
}
