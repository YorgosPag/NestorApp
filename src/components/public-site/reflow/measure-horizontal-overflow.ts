/**
 * **Ποιο στοιχείο ξεπερνά την οθόνη;** — η μέτρηση του CHECK 3.94 (ADR-797 §Φ.Ρ).
 *
 * ⚠️ **ΤΡΕΧΕΙ ΜΕΣΑ ΣΤΟΝ BROWSER** (`page.evaluate`): καμία εισαγωγή, κανένα κλείσιμο πάνω σε
 * εξωτερικές μεταβλητές — ό,τι χρειάζεται έρχεται ως όρισμα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ `scrollWidth > clientWidth` — ΑΥΤΟ ΗΤΑΝ Ο ΔΕΙΚΤΗΣ ΠΟΥ ΕΛΕΓΕ ΨΕΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-25 στα 390 px: `document.documentElement.scrollWidth` = **390** — «καμία
 * υπερχείλιση» — ενώ **πέντε** μπλοκ έφταναν ως τα **436 px** και κόβονταν. Ο καθολικός κανόνας
 * `:where(header, main, section, .flex, .grid) { overflow-x: clip }` του `globals.css` ψαλιδίζει
 * ό,τι περισσεύει **χωρίς** να γεννά κύλιση. Άρα ο δείκτης της κύλισης είναι δομικά τυφλός εδώ·
 * αυτή η μέτρηση ρωτά **κάθε στοιχείο** για το ορθογώνιό του.
 *
 * ⛔ **ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΕΞΑΙΡΕΙΤΑΙ ό,τι ψαλιδίζεται από πρόγονο με `clip`/`hidden`.** Αυτή η
 * εξαίρεση θα ήταν ακριβώς το κάλυμμα που έκρυψε το ελάττωμα. Εξαιρούνται **ΜΟΝΟ**:
 *   (α) απόγονοι **δηλωμένης** κύλισης (`overflow-x: auto | scroll`) — εκεί το «πέρα από την
 *       άκρη» είναι σχεδιασμός, και ο χρήστης το φτάνει σύροντας (λωρίδα καρτελών, πίνακες)·
 *   (β) απόγονοι ενός **κλειστού** συνόλου επιφανειών που τοποθετούν παιδιά έξω από το πλαίσιο
 *       **εκ κατασκευής** (χάρτες) — δηλωμένο στο spec με λόγο, ποτέ μαντεμένο εδώ.
 * Ο ίδιος ο κυλιόμενος/χάρτης **ΜΕΤΡΑΕΙ**: αν η λωρίδα είναι φαρδύτερη από την οθόνη, είναι βλάβη.
 */

export interface OverflowOffender {
  readonly tag: string;
  /** Ό,τι ταυτοποιεί το στοιχείο χωρίς ονόματα κλάσεων: ρόλος · aria-label · id · κείμενο. */
  readonly label: string;
  readonly left: number;
  readonly right: number;
}

/**
 * @param allowedSurfaces Επιλογείς CSS των επιφανειών (β) — έρχονται από το spec, με λόγο.
 * @returns Μόνο οι **ανώτατοι** παραβάτες: ένα φαρδύ μπλοκ δεν αναφέρεται μαζί με τα 40 παιδιά του.
 */
export function collectHorizontalOverflow(allowedSurfaces: readonly string[]): OverflowOffender[] {
  // `clientWidth`, όχι `innerWidth`: αφαιρεί την κάθετη μπάρα κύλισης όπου υπάρχει.
  const viewport = document.documentElement.clientWidth;
  const TOLERANCE = 0.5;

  const scrollsX = (el: Element): boolean => {
    const overflowX = getComputedStyle(el).overflowX;
    return overflowX === 'auto' || overflowX === 'scroll';
  };
  const exempt = (el: Element): boolean => {
    for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
      if (scrollsX(p)) return true;
      if (allowedSurfaces.some((selector) => p.matches(selector))) return true;
    }
    return false;
  };
  const invisible = (el: Element, rect: DOMRect): boolean => {
    if (rect.width === 0 || rect.height === 0) return true;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'contents') return true;
    // Το `sr-only` (clip 1×1) δεν είναι διάταξη που βλέπει άνθρωπος.
    return rect.width <= 1 && rect.height <= 1;
  };
  const labelOf = (el: Element): string => {
    const aria = el.getAttribute('aria-label');
    const role = el.getAttribute('role');
    const id = el.id ? `#${el.id}` : '';
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return [role && `role=${role}`, aria && `aria-label=${aria}`, id, text && `«${text}»`]
      .filter(Boolean)
      .join(' ');
  };

  const offending = new Set<Element>();
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const rect = el.getBoundingClientRect();
    if (invisible(el, rect)) continue;
    if (rect.right <= viewport + TOLERANCE && rect.left >= -TOLERANCE) continue;
    if (exempt(el)) continue;
    offending.add(el);
  }

  return Array.from(offending)
    .filter((el) => el.parentElement === null || !offending.has(el.parentElement))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: labelOf(el),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    });
}
