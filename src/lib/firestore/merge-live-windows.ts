/**
 * =============================================================================
 * ΣΥΓΧΩΝΕΥΣΗ ΖΩΝΤΑΝΩΝ ΠΑΡΑΘΥΡΩΝ — μία λίστα από Ν ταξινομημένες ζωντανές αναγνώσεις (ADR-923 §5.10.4 Β2)
 * =============================================================================
 *
 * Η Firestore δεν κάνει ερώτημα **σε δύο συλλογές**. Η ενιαία λίστα του καταλόγου (μοντέλα **και** απλά SKU, Akeneo
 * Serenity) διαβάζει δύο ζωντανά παράθυρα με **την ίδια** ταξινόμηση και `limit` — και τα ενώνει εδώ.
 *
 * 🔑 **Το μέτωπο.** Ένα παράθυρο που ήρθε **γεμάτο** (`complete === false`) μπορεί να έχει κι άλλα στοιχεία αμέσως
 * μετά το τελευταίο του. Άρα ό,τι από τα **άλλα** παράθυρα πέφτει **μετά** από αυτό το σημείο δεν είναι ακόμη ασφαλές
 * να φανεί: θα εμφανιζόταν **πριν** από στοιχεία που δεν φορτώθηκαν (λάθος σειρά), και η «σελίδα 2» θα τα έβαζε
 * **ανάμεσα** σε ορατά (η λίστα θα «πηδούσε»). Ορατό = ό,τι συγκρίνεται ≤ με το **αυστηρότερο** μέτωπο.
 * Ποτέ λάθος σειρά, ποτέ κενό· το «περισσότερα» απλώς προχωρά το μέτωπο.
 *
 * @module lib/firestore/merge-live-windows
 */

export interface LiveWindow<T> {
  /** Ήδη ταξινομημένα με τον **ίδιο** συγκριτή. */
  readonly items: readonly T[];
  /** `true` ⇒ η ανάγνωση γύρισε λιγότερα από το όριο: δεν υπάρχει τίποτα μετά. */
  readonly complete: boolean;
}

export interface MergedWindows<T> {
  readonly items: readonly T[];
  /** Υπάρχουν (ή μπορεί να υπάρχουν) κι άλλα — το «περισσότερα» έχει νόημα. */
  readonly hasMore: boolean;
  /** Στοιχεία που φορτώθηκαν αλλά κρατήθηκαν πίσω από το μέτωπο. */
  readonly heldBack: number;
}

/**
 * Ένωση Ν ταξινομημένων παραθύρων. `compare` = η σειρά του ερωτήματος **με** σπάσιμο ισοπαλίας (π.χ. id) — αλλιώς
 * δύο στοιχεία με το ίδιο κλειδί θα μπορούσαν να εναλλάσσονται ανάμεσα σε στιγμιότυπα.
 */
export function mergeLiveWindows<T>(windows: readonly LiveWindow<T>[], compare: (a: T, b: T) => number): MergedWindows<T> {
  // Μέτωπο = το **μέγιστο κατά τον συγκριτή** κάθε ανοιχτού παραθύρου — όχι «το τελευταίο που ήρθε»: αν η έμμεση
  // ισοπαλία της Firestore (`__name__`) διέφερε από τον συγκριτή, το τελευταίο δεν θα ήταν το όριο (μετρήθηκε σε test).
  const maxOf = (items: readonly T[]) => items.reduce((max, item) => (compare(item, max) > 0 ? item : max));
  const frontiers = windows
    .filter((window) => !window.complete && window.items.length > 0)
    .map((window) => maxOf(window.items));
  const frontier = frontiers.reduce<T | undefined>((min, item) => (min === undefined || compare(item, min) < 0 ? item : min), undefined);
  const all = windows.flatMap((window) => window.items).sort(compare);
  const items = frontier === undefined ? all : all.filter((item) => compare(item, frontier) <= 0);
  const emptyButOpen = windows.some((window) => !window.complete && window.items.length === 0);
  return { items, hasMore: frontier !== undefined || emptyButOpen, heldBack: all.length - items.length };
}
