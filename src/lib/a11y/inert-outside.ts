/**
 * ADR-711 · ADR-241 — **Ό,τι είναι έξω από την επιφάνεια γίνεται πραγματικά αδρανές.**
 *
 * Μια επιφάνεια που δηλώνει `role="dialog"` υπόσχεται ότι το υπόλοιπο της σελίδας δεν απαντά. Ως 2026-09-11 η πλήρης
 * οθόνη το υποσχόταν (`aria-modal`) χωρίς να το τηρεί: το Tab δραπέτευε στη σελίδα από κάτω.
 *
 * ── ΓΙΑΤΙ `inert` ΚΑΙ ΟΧΙ ΠΑΓΙΔΑ FOCUS ΜΕ JS ──
 *
 * Το εγγενές `inert` (Baseline 2023) αφαιρεί με **μία** δήλωση focus, κλικ, εύρεση-στη-σελίδα **και** δέντρο
 * προσβασιμότητας — ό,τι ο Radix κάνει με **δύο** μηχανισμούς (`FocusScope` + `aria-hidden`) και ό,τι μια παγίδα JS
 * δεν πιάνει ποτέ ολόκληρο (ο αναγνώστης οθόνης διαβάζει και ό,τι δεν παίρνει focus). Το ADR-711 απέρριψε το `inert`
 * **μόνο** ως μηχανισμό για listeners πληκτρολογίου (δεν σταματά `window`/`document`) — εδώ κάνει αυτό για το οποίο
 * φτιάχτηκε: περιορισμό.
 *
 * ── Ο ΑΛΓΟΡΙΘΜΟΣ (του `hideOthers` του πακέτου `aria-hidden`, με `inert`) ──
 *
 * Από το `body` προς τα κάτω: ένα στοιχείο που **περιέχει** κρατούμενο ⇒ κατεβαίνουμε μέσα του· ένα κρατούμενο ⇒
 * σταματάμε· οτιδήποτε άλλο ⇒ `inert`. Έτσι ένας **ένθετος** συνοδός (η πλωτή παλέτα του DXF, που ζει μέσα στη ρίζα
 * της εφαρμογής) μένει ζωντανός ενώ τα αδέλφια του σβήνουν.
 *
 * ⚠️ Ό,τι προσαρτηθεί **μετά** (οι διάλογοι / τα μενού που ανοίγουν μέσα από την επιφάνεια, με portal στο `body`)
 * **δεν** γίνεται αδρανές — ακριβώς αυτό θέλουμε.
 * ⚠️ **Ποτέ** δεν αγγίζει στοιχείο που ήταν ήδη αδρανές από άλλον· και μετρά αναφορές, ώστε δύο επιφάνειες να μη
 * ξεκλειδώνουν η μία την άλλη.
 * ⚠️ Το **γνώρισμα** `inert` και όχι η ιδιότητα: ταυτόσημο στον browser, και το jsdom το κρατά πιστά.
 */

/** Ό,τι μένει ζωντανό δίπλα σε κάθε επιφάνεια: δηλωμένοι συνοδοί, ειδοποιήσεις, το dev overlay του Next. */
export const INERT_COMPANION_SELECTOR = '[data-fullscreen-companion], [data-sonner-toaster], nextjs-portal';

const SKIPPED_TAGS: ReadonlySet<string> = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT']);

/** Πόσες επιφάνειες έχουν κάνει αδρανές αυτό το στοιχείο — μόνο όσα έκανε αδρανή αυτό το module. */
const applied = new WeakMap<Element, number>();

function markInert(el: Element, touched: Element[]): void {
  const count = applied.get(el) ?? 0;
  if (count === 0 && el.hasAttribute('inert')) return; // αδρανές από άλλον — δεν το αγγίζουμε ποτέ
  applied.set(el, count + 1);
  if (count === 0) el.setAttribute('inert', '');
  touched.push(el);
}

function unmarkInert(el: Element): void {
  const count = applied.get(el) ?? 0;
  if (count <= 1) {
    applied.delete(el);
    el.removeAttribute('inert');
  } else {
    applied.set(el, count - 1);
  }
}

/** Κάθε κρατούμενο και κάθε πρόγονός του ως το `body` — η «διαδρομή» που δεν επιτρέπεται να σβήσει. */
function pathsOf(keep: readonly Element[]): { readonly kept: Set<Element>; readonly onPath: Set<Element> } {
  const kept = new Set(keep);
  const onPath = new Set<Element>();
  keep.forEach((el) => {
    for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) onPath.add(node);
  });
  return { kept, onPath };
}

function walk(parent: Element, kept: Set<Element>, onPath: Set<Element>, touched: Element[]): void {
  Array.from(parent.children).forEach((child) => {
    if (kept.has(child) || SKIPPED_TAGS.has(child.tagName)) return;
    if (onPath.has(child)) walk(child, kept, onPath, touched);
    else markInert(child, touched);
  });
}

/**
 * Κάνει αδρανές ό,τι βρίσκεται έξω από τα `keep` και από τους συνοδούς.
 *
 * @returns αποδέσμευση — ιδempotent· επαναφέρει **μόνο** ό,τι άγγιξε αυτή η κλήση.
 */
export function inertOutside(keep: readonly Element[], companionSelector: string = INERT_COMPANION_SELECTOR): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const companions = Array.from(document.querySelectorAll(companionSelector));
  const { kept, onPath } = pathsOf([...keep, ...companions].filter((el) => document.body.contains(el)));
  const touched: Element[] = [];
  walk(document.body, kept, onPath, touched);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    touched.forEach(unmarkInert);
  };
}
