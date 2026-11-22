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

/**
 * Γέμισμα ανά κλάση κλίσης, πιο επίπεδη πρώτη — ΙΔΙΟ πλήθος με τις κλάσεις του `LISTING_TERRAIN_SLOPE_BANDS_PCT` (+1).
 * Μαζί με **περίγραμμα ίδιου χρώματος**: δύο γειτονικές περιοχές με κοινή ακμή αφήνουν τρίχα χαρτιού ανάμεσά τους από το
 * anti-aliasing (γνωστό ελάττωμα κάθε choropleth σε SVG)· ένα λεπτό περίγραμμα στο ίδιο χρώμα την κλείνει.
 */
export const TERRAIN_SLOPE_FILL_CLASS: readonly string[] = [
  'fill-[hsl(var(--terrain-slope-1))] stroke-[hsl(var(--terrain-slope-1))]',
  'fill-[hsl(var(--terrain-slope-2))] stroke-[hsl(var(--terrain-slope-2))]',
  'fill-[hsl(var(--terrain-slope-3))] stroke-[hsl(var(--terrain-slope-3))]',
  'fill-[hsl(var(--terrain-slope-4))] stroke-[hsl(var(--terrain-slope-4))]',
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

/**
 * Πάχη γραμμών σε **css px στην οθόνη** (`vector-effect: non-scaling-stroke`, ιδίωμα `FLOOR_PLATE_STROKE_PX`): ο χάρτης
 * είναι σε μέτρα, άρα πάχος σε μονάδες SVG θα έβγαινε τρίχα σε οικόπεδο 2 στρεμμάτων και μαρκαδόρος σε 50 m². Ιεραρχία
 * USGS: κύρια ≈ 2 × δευτερεύουσα· το περίβλημα = γραμμή + ~1 px λευκό από κάθε πλευρά.
 */
export const TERRAIN_STROKE_PX = {
  contourMinor: 0.75,
  contourMajor: 1.5,
  casingMinor: 2.5,
  casingMajor: 3.5,
  extent: 1.25,
  boundary: 2,
  scaleBar: 1,
  mark: 1.5,
  markCasing: 3.5,
} as const;

/**
 * ADR-920 §14.10 — **η επιθεώρηση πάνω στον χάρτη**. Ματζέντα για τη φωτισμένη ισοϋψή, κυανό για το νερό (`globals.css`,
 * ίδια στα δύο θέματα). Όλα πάνω σε λευκό περίβλημα, όπως οι ισοϋψείς. Το σταυρόνημα, το βέλος κατηφόρας και η γραμμή
 * προφίλ είναι μελάνι: δείχνουν θέση και διεύθυνση, όχι κατηγορία. Το νερό «κυλά» μόνο με `motion-safe` (WCAG 2.3.3).
 */
export const TERRAIN_INSPECT_CLASS = {
  casing: 'fill-none stroke-white',
  contour: 'fill-none stroke-[hsl(var(--terrain-inspect-contour))]',
  contourLabel: `${SPACE_LABEL_CLASS} tabular-nums fill-[hsl(var(--terrain-inspect-contour))]`,
  ink: 'fill-none stroke-[hsl(var(--plan-ink))]',
  inkFill: 'fill-[hsl(var(--plan-ink))] stroke-white',
  pinned: 'fill-white stroke-[hsl(var(--plan-ink))]',
  profileLabel: `${SPACE_LABEL_CLASS} font-bold`,
  water: 'fill-none stroke-[hsl(var(--terrain-water))] [stroke-dasharray:6_6] motion-safe:animate-terrain-flow',
  waterDrop: 'fill-[hsl(var(--terrain-water))] stroke-white',
} as const;

/**
 * ADR-920 §14.10 Ε3 — **η υψομετρική τομή**. Κάθεται στην κάρτα της σελίδας (όχι σε χαρτί) ⇒ χρώματα ΘΕΜΑΤΟΣ για έδαφος και
 * γραμμή· η λωρίδα κλίσεων κρατά τα `--terrain-slope-*` του χάρτη (ίδια κλάση = ίδιο χρώμα σε χάρτη και τομή). Η παρεμβολή
 * είναι **διακεκομμένη** γραμμή (σχήμα, όχι απόχρωση).
 */
export const TERRAIN_PROFILE_CLASS = {
  area: 'fill-muted',
  line: 'fill-none stroke-foreground',
  sparseLine: 'fill-none stroke-muted-foreground [stroke-dasharray:4_3]',
  hover: 'fill-none stroke-foreground [stroke-dasharray:2_2]',
  hoverDot: 'fill-background stroke-foreground',
} as const;

/** Πάχος της λευκής άλω κάθε κειμένου του χάρτη, ως κλάσμα του ύψους του κειμένου (ετικέτες, κλίμακα, επιθεώρηση). */
export const TERRAIN_LABEL_HALO_RATIO = 0.28;

/** Πάχη της επιθεώρησης, css px (`non-scaling-stroke`) — η φωτισμένη ισοϋψής φαίνεται πάνω από την κύρια (1,5 px). */
export const TERRAIN_INSPECT_STROKE_PX = {
  contour: 3,
  contourCasing: 5,
  ink: 1.5,
  inkCasing: 3.5,
  water: 2.5,
  waterCasing: 4.5,
} as const;

/** Σημάνσεις της προεπισκόπησης: μελάνι πάνω σε λευκό περίβλημα· το σχήμα (σταυρός / δαχτυλίδι) λέει ποιο είναι. */
export const TERRAIN_MARK_CLASS = {
  casing: 'fill-none stroke-white',
  ink: 'fill-none stroke-[hsl(var(--plan-ink))]',
} as const;
