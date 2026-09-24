/**
 * @fileoverview **«Δώσε την εστίαση στο πρώτο στοιχείο — ΧΩΡΙΣ να κουνήσεις τη σελίδα.»**
 * @related ADR-777 §8.77 · components/search-results/ListingMapPopupFrame.tsx · lib/maps/maplibre.ts
 * @module lib/a11y/focus-first
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-09-24, `/offers?selected=…`)**: η φούσκα της MapLibre εστιάζει το πρώτο
 * στοιχείο της στο άνοιγμα (`focusAfterOpen`, σωστή a11y) με σκέτο `element.focus()`. Όταν ο χάρτης ζει
 * σε **sticky** πάνελ και η σελίδα έχει κυλήσει, ο Chrome «φέρνει σε θέα» το στοιχείο με τη θέση του
 * πάνελ **χωρίς** το κόλλημα ⇒ η σελίδα **πήδηξε από το 649 στο 0** μέσα σε 11ms, ακυρώνοντας την
 * αποκάλυψη της κάρτας (και ό,τι κοίταζε ο άνθρωπος).
 *
 * 🏆 Η κοινότητα το λύνει με `focusAfterOpen: false` (MapLibre issue #338) — δηλαδή **σβήνοντας την
 * a11y**. Εδώ η εστίαση **μένει**: ίδιο στοιχείο, ίδια στιγμή, με `preventScroll: true`. Η φούσκα είναι
 * ήδη ορατή (γι' αυτό ανοίγει), άρα η κύλιση που ακυρώνεται δεν είχε τίποτα να φέρει σε θέα.
 */

/**
 * **Τι είναι εστιάσιμο** — η ίδια λίστα με το `focusQuerySelector` της `maplibre-gl` (`ui/popup.ts`),
 * ώστε η αντικατάσταση του `focusAfterOpen` να εστιάζει **ακριβώς** το στοιχείο που θα εστίαζε εκείνη.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable]:not([contenteditable='false'])",
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(', ');

/** Εστίασε το πρώτο εστιάσιμο μέσα στο `root` **χωρίς κύλιση**. Επιστρέφει ό,τι εστίασε (ή `null`). */
export function focusFirstWithin(root: ParentNode | null | undefined): HTMLElement | null {
  const target = root?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
  target?.focus({ preventScroll: true });
  return target;
}
