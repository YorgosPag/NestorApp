/**
 * ADR-363 §5.6 — Ορθογώνια διατομή: αναλογία πλευρών → ταξινόμηση κολόνα/τοιχίο.
 *
 * Pure SSoT για τον κανόνα «aspect = μεγάλη/μικρή πλευρά, στρογγυλοποίηση σε 1dp,
 * ΑΥΣΤΗΡΑ > SHEAR_WALL_MIN_ASPECT_RATIO (4) → τοιχίο (shear-wall)» (Eurocode 2
 * §9.6.1 / Eurocode 8 §5.4.2.4· ακριβώς 4 = κολόνα). Πριν από αυτό το module ο
 * κανόνας ήταν inline-διπλασιασμένος (`Math.round(long/short*10)/10` + σύγκριση
 * `> 4`) σε `rectAspectKind` + `perimeterAspectRatio` (`column-from-faces.ts`) —
 * τώρα ΜΙΑ πηγή αλήθειας.
 *
 * Στρογγυλοποίηση σε 1 δεκαδικό ΠΡΙΝ τη σύγκριση: ενδιάμεσοι γεωμετρικοί
 * υπολογισμοί (union/clip) μπορούν να δώσουν 4.0000…001 από αληθινό 4:1 →
 * η στρογγυλοποίηση κρατά «όσο εμφανίζεται 4.0 → κολόνα».
 *
 * @see ./column-from-faces.ts — δημιουργία «από περίγραμμα» (reuse)
 * @see ./column-becomes-wall-confirm-store.ts — edit-time warn store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import { SHEAR_WALL_MIN_ASPECT_RATIO, type ColumnParams } from '../types/column-types';

/**
 * aspect = μεγάλη/μικρή πλευρά, στρογγυλοποιημένο σε 1 δεκαδικό. Order-agnostic
 * (max/min → δεν πειράζει ποια πλευρά είναι width/depth). 0 αν εκφυλισμένο
 * (μικρή πλευρά ≤ 0).
 */
export function roundedRectAspect(sideAmm: number, sideBmm: number): number {
  const long = Math.max(sideAmm, sideBmm);
  const short = Math.min(sideAmm, sideBmm);
  if (short <= 0) return 0;
  return Math.round((long / short) * 10) / 10;
}

/**
 * Στρογγυλεμένο aspect > SHEAR_WALL_MIN_ASPECT_RATIO (4) → τοιχίο (shear-wall).
 * ΑΥΣΤΗΡΑ >· ακριβώς 4.0 = κολόνα (EC2 §9.6.1).
 */
export function isShearWallAspect(roundedAspect: number): boolean {
  return roundedAspect > SHEAR_WALL_MIN_ASPECT_RATIO;
}

/** aspect (rounded 1dp) ενός ορθογώνιου ColumnParams από width/depth. */
export function rectParamsAspect(params: Pick<ColumnParams, 'width' | 'depth'>): number {
  return roundedRectAspect(params.width, params.depth);
}

/** Πληροφορία της αλλαγής που περνά το κατώφλι κολόνα→τοιχίο (για το warn μήνυμα). */
export interface RectBecomesWall {
  /** Στρογγυλεμένο aspect της ΝΕΑΣ διατομής (> 4). */
  readonly aspect: number;
  /** Μεγάλη πλευρά (mm) της νέας διατομής. */
  readonly longSideMm: number;
  /** Μικρή πλευρά (mm) της νέας διατομής. */
  readonly shortSideMm: number;
}

/**
 * ADR-363 §5.6/§5.6c — Πληροφορία «η διατομή έγινε πολύ επιμήκης (aspect > 4) → σαν τοιχίο», για
 * ΟΠΟΙΟΝΔΗΠΟΤΕ τύπο. `canReclassify` = true ΜΟΝΟ για ορθογώνιο (μόνο αυτό μετατρέπεται σε shear-wall
 * διατηρώντας το αποτύπωμα)· Γ/Τ/Π/Ι/σύνθετη → advisory-only (κρατούν το σχήμα τους).
 */
export interface ColumnBecomesWall extends RectBecomesWall {
  readonly canReclassify: boolean;
}

/**
 * Edit-time φύλακας (ΓΕΝΙΚΟΣ, όλοι οι τύποι εκτός symmetric/ήδη-τοιχίο): επιστρέφει non-null ΜΟΝΟ
 * όταν η διατομή περνά για ΠΡΩΤΗ φορά το κατώφλι επιμήκυνσης (bounding-box rounded aspect > 4 →
 * «συμπεριφέρεται ως τοιχίο»). Το aspect μετριέται από το ΣΥΝΟΛΙΚΟ bounding box (width/depth) → καλύπτει
 * κάθε πλευρά/λαβή που τραβιέται (flange/web/βάθος), ανεξάρτητα από ΠΟΙΑ λαβή άλλαξε.
 *   - scope OUT: `circular`/`polygon` (συμμετρικά, width≈depth — ποτέ wall-like) + `shear-wall`
 *     (ΗΔΗ τοιχίο· τα ασυνήθιστα extents τα καλύπτει §5.6b).
 *   - crossing-only: `null` αν το prev ήταν ήδη επιμήκες (μηδέν re-nag).
 *   - `canReclassify` = ορθογώνιο prev→next (μόνο τότε προσφέρεται «Μετατροπή σε τοιχίο»).
 */
export function detectColumnBecomesWall(
  prev: ColumnParams,
  next: ColumnParams,
): ColumnBecomesWall | null {
  if (next.kind === 'circular' || next.kind === 'polygon' || next.kind === 'shear-wall') return null;
  const nextAspect = rectParamsAspect(next);
  if (!isShearWallAspect(nextAspect)) return null;
  // Ήδη επιμήκης πριν την αλλαγή → μη νοχλείς ξανά (guard μόνο στη μετάβαση).
  if (isShearWallAspect(rectParamsAspect(prev))) return null;
  return {
    aspect: nextAspect,
    longSideMm: Math.max(next.width, next.depth),
    shortSideMm: Math.min(next.width, next.depth),
    canReclassify: prev.kind === 'rectangular' && next.kind === 'rectangular',
  };
}

/**
 * Edit-time φύλακας ΜΟΝΟ για ορθογώνια κολόνα (κληρονομιά §5.6): delegate στο γενικό
 * `detectColumnBecomesWall`, φιλτραρισμένο σε ορθογώνιο prev→next. ΕΝΑ σημείο αλήθειας για την
 * crossing λογική (μηδέν διπλότυπο).
 */
export function detectRectColumnBecomesWall(
  prev: ColumnParams,
  next: ColumnParams,
): RectBecomesWall | null {
  if (prev.kind !== 'rectangular' || next.kind !== 'rectangular') return null;
  const g = detectColumnBecomesWall(prev, next);
  return g && { aspect: g.aspect, longSideMm: g.longSideMm, shortSideMm: g.shortSideMm };
}

/**
 * Μετατροπή ορθογώνιας διατομής σε `shear-wall` ΔΙΑΤΗΡΩΝΤΑΣ ΑΚΡΙΒΩΣ το ίχνος
 * (footprint). EC σύμβαση τοιχίου: `width` = μήκος (μεγάλη πλευρά) ≥ `depth` =
 * πάχος (μικρή πλευρά) — ώστε ο validator (`validateShearWallParams`, aspect =
 * width/depth) να μη σημαδεύει ψευδώς. Αν το ορθογώνιο είναι «όρθιο» (width <
 * depth) εναλλάσσουμε width↔depth και προσθέτουμε 90° στη γωνία (ίδιο αποτύπωμα).
 */
export function reclassifyRectToShearWall(params: ColumnParams): ColumnParams {
  if (params.width >= params.depth) return { ...params, kind: 'shear-wall' };
  return {
    ...params,
    kind: 'shear-wall',
    width: params.depth,
    depth: params.width,
    rotation: params.rotation + 90,
  };
}
