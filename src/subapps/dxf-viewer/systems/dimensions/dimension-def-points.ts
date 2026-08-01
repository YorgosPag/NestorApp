/**
 * ADR-746 — 🔴 SSoT: **ο ΕΝΑΣ αναγνώστης των σημείων ορισμού μιας διάστασης.**
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ζωντανό crash 2026-08-01):
 * `TypeError: dim.defPoints is not iterable` στο `DxfBitmapCache.rebuild` → μία και μόνη
 * κακοσχηματισμένη διάσταση **ακύρωνε ολόκληρο το raster όλου του σχεδίου**: το throw έπεφτε
 * μέσα στο `try` του rebuild → `cacheKey = null` → **κάθε καρέ** ξαναέχτιζε και ξαναπετούσε.
 *
 * Η ρίζα ΔΕΝ ήταν το ένα call site. Ήταν ότι **~40 σημεία ρωτούν «ποια είναι τα defPoints;»
 * με 5 ασύμβατες πολιτικές**, χωρίς καμία αρχή να απαντά:
 *   · `[...(dim.defPoints ?? [])]`            → `bounds-primitives.calculateDimensionBounds`
 *   · `dimEntity?.defPoints ? … : null`       → `entity-bounds-ssot.dimensionBounds`
 *   · `entity.defPoints[i] ?? ORIGIN` (×18)   → `dxf-dimension-writer`
 *   · `if (!pts || pts.length === 0)`         → `dimension-renderer-support`
 *   · **σκέτο `[...dim.defPoints]` / `const [a,b,c] = entity.defPoints`** → ΘΑΝΑΤΗΦΟΡΟ
 * Οι τρεις πρώτες είναι η υπογραφή του «λύσε το δείγμα, όχι την κλάση»: κάποιος **ήδη**
 * συνάντησε το κενό `defPoints` και θωράκισε **τον δικό του** call site — αφήνοντας τον
 * διπλανό καταναλωτή της ΙΔΙΑΣ συνάρτησης (`getDimensionWorldBounds`) εκτεθειμένο.
 *
 * 🏛️ ΑΡΧΗ (Alexis King, «Parse, don't validate»): ο έλεγχος γίνεται **μία φορά, στο σύνορο**,
 * και παράγει έναν **πιο περιορισμένο τύπο** — δεν επαναλαμβάνεται σε κάθε αναγνώστη. Ο τύπος
 * `DimensionEntity.defPoints` είναι `readonly Point2D[]` (υποχρεωτικό) αλλά **κανένα runtime
 * σύνορο δεν το επιβάλλει**: ο type guard είναι `entity.type === 'dimension'` και τίποτε άλλο,
 * και δεν υπάρχει καμία migration/hydration για τα @deprecated `startPoint`/`endPoint` κάτοπτρα
 * της Phase A1. Οπότε το σύνορο το φτιάχνουμε **εδώ**.
 *
 * 🏛️ ΑΡΧΗ (Revit «Audit on open» — και ένα βήμα πιο πέρα): ο Revit **διαγράφει** το corrupt
 * element σε recovery file. Εμείς **το επισκευάζουμε**, γιατί σε αυτό το μοντέλο η πληροφορία
 * ΔΕΝ έχει χαθεί: τα @deprecated `startPoint`/`endPoint`/`textPosition` κάτοπτρα κουβαλούν την
 * ίδια γεωμετρία. Μια διάσταση της Phase A1 είναι **πλήρως ανακατασκευάσιμη** → `repaired-legacy`
 * αντί για σιωπηλή απώλεια. Ανώτερο από drop: ο χρήστης βλέπει τη διάστασή του.
 *
 * 🏛️ ΑΡΧΗ (aggregate poisoning, ADR-510 Φ5): ένα `NaN`/`Infinity` σημείο είναι **χειρότερο**
 * από ένα crash — δεν πετάει, δηλητηριάζει το AABB (`Math.min/max` με NaN → NaN), το culling
 * απαντά σιωπηλά λάθος και η διάσταση εξαφανίζεται χωρίς κανένα σήμα. Φιλτράρονται εδώ, μέσω
 * του υπάρχοντος `isFinitePoint` SSoT — δεν γράφεται δεύτερος έλεγχος πεπερασμένου.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ: δεν ξετυλίγει το `DxfDimension` wrapper — αυτό το ερώτημα έχει ήδη τη δική του
 * αρχή (`unwrapDxfSubEntity`, dxf-types.ts). Ένα ερώτημα, μία αρχή· δύο αρχές που ξέρουν και
 * τα δύο είναι η επόμενη σιωπηλή απόκλιση.
 *
 * @see ADR-746 §2 — ο πίνακας των 5 πολιτικών και ποιος τις έγραψε
 * @see ADR-362 — DimensionEntity + σημασιολογία defPoints ανά variant
 * @see ADR-040 Phase IX — viewport culling (ο καταναλωτής που έσκασε)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
// SSoT πεπερασμένου σημείου (NaN + Infinity) — ADR-510 Φ5. ΜΗΝ γράψεις δεύτερο.
//
// ⚠️ ΓΙΑΤΙ ΑΠΟ ΤΟ `config/geometry-constants` ΚΑΙ ΟΧΙ ΑΠΟ ΤΟ `entity-validation-utils`
// (`isValidPointStrict`, που είναι σημασιολογικά ο πιο φυσικός υποψήφιος):
// το `entity-validation-utils` κάνει **runtime** import (`isLineEntity`, `isCircleEntity`, …)
// από το `types/entities` — module που ζει μέσα σε **υπάρχοντα κύκλο** εισαγωγών
// (types/entities → types/entity-bounds → entity-bounds-ssot → GeometryUtils → … → guides,
// επιβεβαιωμένος σε worktree στο 15579c97: το `guide-commands-ssot.test.ts` έσπαγε **ήδη** με
// `Cannot access 'BatchRotateGuidesCommand' before initialization` πριν από κάθε αλλαγή του
// ADR-746 — **προϋπάρχον, όχι δικό μας**).
// Επειδή όμως αυτός ο αναγνώστης εισάγεται πλέον από ~20 αρχεία, θα **μετέδιδε** εκείνη τη
// βαριά ακμή σε όλο το δέντρο διαστάσεων χωρίς κανένα όφελος.
// Το `config/geometry-constants` έχει **μόνο type import** ⇒ μηδενικό runtime βάρος.
// 🔴 ΜΗΝ το γυρίσεις πίσω στο `isValidPointStrict` «για καθαρότητα»: ο έλεγχος είναι ο ίδιος
// (`Number.isFinite` και στα δύο), το βάρος όχι.
import { isFinitePoint } from '../../config/geometry-constants';

/**
 * Από πού προέκυψαν τα σημεία — το **διαγνωστικό** που κάνει τη ρίζα ορατή αντί για μαντεψιά.
 *
 * · `canonical`       — το `defPoints` ήταν έγκυρος πίνακας (η συντριπτική πλειοψηφία).
 * · `repaired-legacy` — ανακατασκευή από τα Phase-A1 κάτοπτρα· **δείχνει δεδομένα προ-ADR-362**.
 * · `degenerate`      — δεν υπήρχε τίποτα χρησιμοποιήσιμο· ο καλών εφαρμόζει το fallback του.
 */
export type DimDefPointsSource = 'canonical' | 'repaired-legacy' | 'degenerate';

export interface ResolvedDimDefPoints {
  /** Τα σημεία ορισμού — **πάντα** πίνακας, **πάντα** με πεπερασμένες συντεταγμένες. */
  readonly points: readonly Point2D[];
  readonly source: DimDefPointsSource;
  /** Πόσα σημεία απορρίφθηκαν ως μη-πεπερασμένα/κακοσχηματισμένα (0 στην κανονική ροή). */
  readonly dropped: number;
}

/** Το μοναδικό «τίποτα» — μοιραζόμενο instance, ώστε ο έλεγχος ταυτότητας να είναι φθηνός. */
const DEGENERATE: ResolvedDimDefPoints = Object.freeze({
  points: Object.freeze([]) as readonly Point2D[],
  source: 'degenerate',
  dropped: 0,
});

/**
 * Τα @deprecated κάτοπτρα της Phase A1 (types/dimension.ts §«Legacy back-compat»).
 * Διαβάζονται ως `unknown` επειδή ακριβώς **δεν** εμπιστευόμαστε το σχήμα σε αυτό το σημείο.
 */
interface LegacyDimMirrors {
  readonly startPoint?: unknown;
  readonly endPoint?: unknown;
  readonly textPosition?: unknown;
  readonly textMidpoint?: unknown;
}

/**
 * Είναι έγκυρο, **πεπερασμένο** σημείο; Type guard πάνω από `unknown`.
 *
 * Δεν διπλασιάζει τα μαθηματικά: ο έλεγχος πεπερασμένου παραμένει το `isFinitePoint` SSoT —
 * εδώ προστίθεται μόνο το narrowing (null/object), που το SSoT δεν κάνει επειδή δέχεται ήδη
 * τυποποιημένο `Point2D`. Το `Number.isFinite` **δεν κάνει coercion**, οπότε `{x:'a'}` πέφτει
 * σωστά χωρίς χωριστό έλεγχο `typeof === 'number'`.
 *
 * Εξάγεται ώστε οι υπολογιστές ορίων διάστασης να ρωτούν **εδώ** αντί να εισάγουν το βαρύ
 * `entity-validation-utils` (βλ. το σχόλιο του import πιο πάνω — μεταδίδει κύκλο).
 */
export function isFiniteDimPoint(p: unknown): p is Point2D {
  return !!p && typeof p === 'object' && isFinitePoint(p as Point2D);
}

/**
 * 🚀 Είναι ο πίνακας **ήδη άρτιος** (μη-κενός, κάθε σημείο πεπερασμένο);
 *
 * ⚠️ ΓΙΑΤΙ ΕΙΝΑΙ ΚΡΙΣΙΜΟ ΚΑΙ ΟΧΙ ΑΠΛΗ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ: χωρίς αυτόν τον έλεγχο ο αναγνώστης
 * επιστρέφει **νέο πίνακα σε κάθε κλήση**, και καλείται σε ~40 σημεία — ανάμεσά τους:
 *   · **hot path**: viewport culling, **ανά οντότητα, ανά καρέ** (~3.000×60/δευτ.) ⇒ σκουπίδια GC·
 *   · **React memo deps** (`useDimensionGrips`) ⇒ νέα αναφορά = «άλλαξε» σε κάθε render.
 * Είναι ακριβώς η κλάση «selector `?? []` ⇒ νέος πίνακας ⇒ ατέρμονος βρόγχος» (ADR-040/366) —
 * θα αντικαθιστούσα ένα crash με μια σιωπηλή διαρροή επιδόσεων. **Το βρήκε test ταυτότητας
 * αναφοράς** (`useDimensionGrips-diff`), όχι review.
 *
 * Στην κανονική διαδρομή: **μηδέν αλλοκάτωση**, O(n) με n ≤ 5.
 */
function isPristineDefPoints(raw: readonly unknown[]): boolean {
  if (raw.length === 0) return false;
  for (const p of raw) if (!isFiniteDimPoint(p)) return false;
  return true;
}

/** Κρατά μόνο τα σημεία με πεπερασμένες συντεταγμένες· αναφέρει πόσα έπεσαν. */
function keepFinitePoints(raw: readonly unknown[]): { points: Point2D[]; dropped: number } {
  const points: Point2D[] = [];
  let dropped = 0;
  for (const candidate of raw) {
    if (isFiniteDimPoint(candidate)) points.push(candidate);
    else dropped++;
  }
  return { points, dropped };
}

/**
 * Ανακατασκευή από τα Phase-A1 κάτοπτρα.
 *
 * Σειρά = η κανονική σημασιολογία linear/aligned: `[extOrigin1, extOrigin2, dimLineRef]`.
 * Το τρίτο σημείο έρχεται από το `textMidpoint`/`textPosition` και είναι **γεωμετρικά έγκυρο**,
 * όχι μπάλωμα: κατά ISO-129 το κείμενο κάθεται **πάνω στη γραμμή διάστασης**, οπότε το μέσο του
 * κειμένου ΕΙΝΑΙ σημείο αναφοράς της γραμμής διάστασης. Χωρίς αυτό ο `computeDimHitGeometry`
 * (απαιτεί ≥3 σημεία) θα γύριζε `null` και η διάσταση θα έπεφτε στο συντηρητικό ±1e6 κουτί.
 */
function repairFromLegacyMirrors(dim: LegacyDimMirrors): Point2D[] {
  const { points } = keepFinitePoints([dim.startPoint, dim.endPoint]);
  // ⚠️ Ένα ΜΟΝΟ άκρο δεν είναι μισή διάσταση — είναι **χειρότερο από τίποτα**: παράγει εκφυλισμένο
  // (μηδενικού εμβαδού) AABB, οπότε το culling κόβει τη διάσταση σχεδόν πάντα → **σιωπηλή
  // εξαφάνιση**. Το `degenerate` οδηγεί στο συντηρητικό «πάντα ορατό» κουτί, που είναι η σωστή
  // απάντηση στο «δεν ξέρω». Ημι-πληροφορία ⇒ καμία πληροφορία.
  if (points.length < 2) return [];
  const { points: ref } = keepFinitePoints([dim.textMidpoint ?? dim.textPosition]);
  return ref.length === 1 ? [...points, ref[0]] : points;
}

/**
 * 🔴 Η ΜΟΝΗ αρχή για τα σημεία ορισμού μιας διάστασης. **Ποτέ δεν πετάει.**
 *
 * Δέχεται `unknown`-ish είσοδο επίτηδες: οι καλούντες είναι hot paths (culling, bounds, hit-test)
 * που δέχονται οντότητες από persistence / DXF import / clipboard / undo patches — δηλαδή από
 * σύνορα όπου ο TypeScript τύπος είναι **υπόσχεση, όχι εγγύηση**.
 *
 * @param dim - Η **flat** `DimensionEntity` (ξετύλιξε πρώτα με `unwrapDxfSubEntity` αν έχεις wrapper).
 */
export function resolveDimDefPoints(
  dim: DimensionEntity | null | undefined,
): ResolvedDimDefPoints {
  if (!dim || typeof dim !== 'object') return DEGENERATE;

  const raw: unknown = (dim as { defPoints?: unknown }).defPoints;
  if (Array.isArray(raw)) {
    // 🚀 FAST PATH — βλ. {@link isPristineDefPoints}: επιστρέφει την **ΙΔΙΑ αναφορά**.
    if (isPristineDefPoints(raw)) {
      return { points: raw as readonly Point2D[], source: 'canonical', dropped: 0 };
    }
    const { points, dropped } = keepFinitePoints(raw);
    if (points.length > 0) return { points, source: 'canonical', dropped };
    // Πίνακας που υπάρχει αλλά δεν έδωσε ούτε ένα χρησιμοποιήσιμο σημείο → δοκίμασε επισκευή.
  }

  const repaired = repairFromLegacyMirrors(dim as LegacyDimMirrors);
  if (repaired.length > 0) return { points: repaired, source: 'repaired-legacy', dropped: 0 };

  return DEGENERATE;
}

/**
 * Συντομογραφία για τους αναγνώστες που θέλουν **μόνο** τα σημεία και έχουν ήδη δικό τους
 * fallback για το κενό (π.χ. υπολογισμοί AABB). Ίδια εγγύηση: πάντα πίνακας, ποτέ throw.
 */
export function dimDefPoints(dim: DimensionEntity | null | undefined): readonly Point2D[] {
  // Ο fast path παρακάμπτει ΚΑΙ το wrapper αντικείμενο `{points, source, dropped}` — στην
  // κανονική διαδρομή αυτή η συνάρτηση δεν αλλοκατώνει **τίποτα** και επιστρέφει την ίδια
  // αναφορά που της δόθηκε. Βλ. {@link isPristineDefPoints} για το γιατί έχει σημασία.
  const raw: unknown = dim ? (dim as { defPoints?: unknown }).defPoints : undefined;
  if (Array.isArray(raw) && isPristineDefPoints(raw)) return raw as readonly Point2D[];
  return resolveDimDefPoints(dim).points;
}
