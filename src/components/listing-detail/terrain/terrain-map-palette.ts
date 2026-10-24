/**
 * @fileoverview **ΤΑ ΧΡΩΜΑΤΑ ΤΟΥ ΧΑΡΤΗ ΕΔΑΦΟΥΣ** — κλάσεις κλίσης, ισοϋψείς, ετικέτες, σημάνσεις (ADR-920 Β4.8).
 * @related lib/terrain/publication/terrain-map-model (τι ζωγραφίζεται) · `TerrainContourMap.tsx` (ο καταναλωτής) ·
 *   spatial-tour/viewer/tour-plan-overlay-palette (ίδια αρχή: σχέδιο πάνω σε λευκό χαρτί)
 * @module components/listing-detail/terrain/terrain-map-palette
 *
 * 🎨 **Πάνω σε ΧΑΡΤΙ, όχι πάνω στο θέμα**: ο χάρτης είναι σχέδιο — λευκό χαρτί και στα **δύο** θέματα, και το ΙΔΙΟ SVG πάει
 *   στο PDF του showcase. Ένα `fill-card` θα άλλαζε με το θέμα και το PDF θα έβγαινε σκούρο. Οι τιμές ζουν στο `globals.css`
 *   (`--terrain-slope-*`, **ίδιες** στα δύο θέματα — πρότυπο `--map-seq-*` / `--plan-*`), ποτέ ωμή παλέτα Tailwind (CHECK 3.7).
 *   Εδώ είναι το **ΕΝΑ** σημείο που τις ονομάζει ως κλάσεις.
 * 🟠 **Κλάσεις κλίσης = ΔΙΑΤΑΓΜΕΝΗ κλίμακα, ΜΙΑ απόχρωση** (πορτοκαλί, ανοιχτό → σκούρο): μετρημένη με τον validator του
 *   dataviz (`--ordinal`) — όχι το μπλε του `--map-seq-*`, που σημαίνει «τιμή» σε άλλη οθόνη.
 * ✒️ **Ισοϋψείς και ετικέτες σε μελάνι** (`--plan-ink`, το ένα μελάνι κάθε σχεδίου σε χαρτί) **με λευκό περίβλημα**
 *   (casing / άλω): διαβάζονται πάνω σε **κάθε** κλάση, και στη σκουρότερη.
 * ♿ **Ποτέ μόνο χρώμα** (CHECK 3.41): το υπόμνημα ονομάζει εύρος + % εμβαδού ανά κλάση, υπάρχει πίνακας δεδομένων· η
 *   αντίφαση είναι **σταυρός**, η σύμπτωση **δαχτυλίδι** — σχήμα, όχι απόχρωση· η αραιή περιοχή είναι **διαγράμμιση**.
 */

import { PLAN_NORTH_CLASS, SPACE_LABEL_CLASS } from '@/components/spatial-tour/viewer/tour-plan-overlay-palette';

/** Γέμισμα ανά κλάση κλίσης, πιο επίπεδη πρώτη — ΙΔΙΟ πλήθος με τις κλάσεις του `LISTING_TERRAIN_SLOPE_BANDS_PCT` (+1). */
export const TERRAIN_SLOPE_FILL_CLASS: readonly string[] = [
  'fill-[hsl(var(--terrain-slope-1))]',
  'fill-[hsl(var(--terrain-slope-2))]',
  'fill-[hsl(var(--terrain-slope-3))]',
  'fill-[hsl(var(--terrain-slope-4))]',
];

/**
 * Το γέμισμα της κλάσης `classIndex`. Ένα στιγμιότυπο χτισμένο με **περισσότερες** κλάσεις από όσες ξέρει αυτή η παλέτα
 * (μελλοντική αλλαγή του config) παίρνει τη σκουρότερη — ποτέ `undefined`, που θα το έβαφε μαύρο.
 */
export function terrainSlopeFillClass(classIndex: number): string {
  return TERRAIN_SLOPE_FILL_CLASS[Math.min(Math.max(classIndex, 0), TERRAIN_SLOPE_FILL_CLASS.length - 1)];
}

/** Το χαρτί κάτω από όλα. */
export const TERRAIN_PAPER_CLASS = 'fill-white';

/** Έκταση αποτύπωσης: διακεκομμένο μελάνι — «ως εδώ μετρήθηκε», όχι όριο ιδιοκτησίας. */
export const TERRAIN_EXTENT_CLASS = 'fill-none stroke-[hsl(var(--plan-ink))] [stroke-dasharray:4_3]';

/** Όριο οικοπέδου (όταν υπάρχει): συνεχές, παχύτερο μελάνι. */
export const TERRAIN_BOUNDARY_CLASS = 'fill-none stroke-[hsl(var(--plan-ink))]';

/** Το λευκό περίβλημα κάτω από κάθε ισοϋψή — την ξεχωρίζει από το γέμισμα από κάτω. */
export const TERRAIN_CONTOUR_CASING_CLASS = 'fill-none stroke-white';

export const TERRAIN_CONTOUR_MINOR_CLASS = 'fill-none stroke-[hsl(var(--plan-ink)/0.55)]';
export const TERRAIN_CONTOUR_MAJOR_CLASS = 'fill-none stroke-[hsl(var(--plan-ink))]';

/** Ετικέτα ισοϋψούς: μελάνι με λευκή άλω (ίδια κλάση με τις ετικέτες της κάτοψης), ψηφία ίσου πλάτους. */
export const TERRAIN_CONTOUR_LABEL_CLASS = `${SPACE_LABEL_CLASS} tabular-nums`;

/** Γραμμές της διαγράμμισης «αραιή περιοχή — παρεμβολή, όχι μέτρηση». */
export const TERRAIN_SPARSE_HATCH_CLASS = 'stroke-[hsl(var(--plan-ink)/0.45)]';

/** Βέλος βορρά — το ΙΔΙΟ με την κάτοψη της αγγελίας. */
export const TERRAIN_NORTH_CLASS = PLAN_NORTH_CLASS;

/** Κλίμακα: εναλλάξ γεμάτα / κενά τμήματα (κλασική χαρτογραφική μπάρα) + αριθμοί με άλω. */
export const TERRAIN_SCALE_BAR_CLASS = {
  filled: 'fill-[hsl(var(--plan-ink))]',
  hollow: 'fill-white stroke-[hsl(var(--plan-ink))]',
  label: TERRAIN_CONTOUR_LABEL_CLASS,
} as const;

/** Σημάνσεις της προεπισκόπησης: μελάνι πάνω σε λευκό περίβλημα· το σχήμα (σταυρός / δαχτυλίδι) λέει ποιο είναι. */
export const TERRAIN_MARK_CLASS = {
  casing: 'fill-none stroke-white',
  ink: 'fill-none stroke-[hsl(var(--plan-ink))]',
} as const;
