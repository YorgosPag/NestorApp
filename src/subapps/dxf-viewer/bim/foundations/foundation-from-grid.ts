/**
 * ADR-441 Slice 2 — «Εσχάρα πεδιλοδοκών από κάναβο» (strip-footing grid from guides).
 *
 * Pure builder: διαβάζει τους ορατούς άξονες του κανάβου (guides, ADR-189) και
 * παράγει **διακριτές** `FoundationEntity` (kind='strip') στις γραμμές του grid,
 * **born-hosted** με slot-based `guideBindings` (ADR-441 Slice 0) ώστε στο Slice 3
 * (follow-on-move) να ακολουθούν αυτόματα όταν μετακινηθεί ένας άξονας.
 *
 * ΜΗΔΕΝ αναπαραγωγή geometry/builder math — κάθε segment περνά από το ΥΠΑΡΧΟΝ SSoT
 * `completeFoundationFromTwoClicks` (foundation-completion.ts). Intersection-to-
 * intersection segments → zero-overlap join στις διασταυρώσεις (κάθε λωρίδα
 * σταματά στους κόμβους, δεν διπλώνεται με τις κάθετες).
 *
 * Άξονες (ADR-189 semantics): 'X' = κατακόρυφη γραμμή σε x = offset· 'Y' =
 * οριζόντια γραμμή σε y = offset. Διαγώνιοι 'XZ' αγνοούνται (v1).
 *
 * @see hooks/drawing/foundation-completion.ts — foundation builder SSoT
 * @see bim/hosting/guide-binding-types.ts — slot-based hosting model
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Guide } from '../../systems/guides/guide-types';
import type { FoundationEntity, StripJustification } from '../types/foundation-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import {
  completeFoundationFromTwoClicks,
  type FoundationParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/foundation-completion';
import { gridStripJustification } from './foundation-grid-justification';

/**
 * Tolerance (scene units) κάτω από την οποία δύο offsets θεωρούνται ταυτόσημοι →
 * dedup, αποφυγή zero-length strips. Ο guide-store ήδη απορρίπτει duplicates
 * (`GUIDE_LIMITS.MIN_OFFSET_DELTA`)· αυτό είναι floating-point safety net. Ο
 * foundation validator παραμένει το τελικό backstop για degenerate bands.
 */
const GRID_DEDUP_TOL = 1;

/** Ελάχιστη read-surface του guide-store — testable χωρίς full singleton. */
export interface AxisGuideReader {
  getGuidesByAxis(axis: Guide['axis']): readonly Guide[];
}

export interface BuildStripGridResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: γιατί δεν παρήχθη εσχάρα. */
  readonly reason?: 'insufficient-guides';
  readonly strips: readonly FoundationEntity[];
  /** Πλήθος segments που απορρίφθηκαν από τον validator (degenerate). */
  readonly ignoredCount: number;
}

/** Sorted unique offsets + παράλληλο array των αντίστοιχων guide ids ενός άξονα. */
interface AxisData {
  readonly offsets: number[];
  readonly ids: string[];
}

/** Προδιαγραφή ΕΝΟΣ grid segment (intersection-to-intersection) πριν χτιστεί entity/geometry. */
export interface GridStripSpec {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly bindings: readonly GuideBinding[];
  readonly justification: StripJustification;
}

/** Sorted+dedup άξονες X & Y (≥2 ανά διεύθυνση), έτοιμοι για enumeration. */
export interface GridAxes {
  readonly xs: AxisData;
  readonly ys: AxisData;
}

/** Push callback — emit ΕΝΑ segment spec. */
type PushStrip = (spec: GridStripSpec) => void;

/** Sorted unique offsets + παράλληλο array των αντίστοιχων guide ids. */
function uniqueSortedAxis(guides: readonly Guide[]): AxisData {
  const sorted = [...guides].sort((a, b) => a.offset - b.offset);
  const offsets: number[] = [];
  const ids: string[] = [];
  for (const g of sorted) {
    const prev = offsets[offsets.length - 1];
    if (prev !== undefined && Math.abs(g.offset - prev) < GRID_DEDUP_TOL) continue;
    offsets.push(g.offset);
    ids.push(g.id);
  }
  return { offsets, ids };
}

/**
 * Build ΕΝΑ strip segment + tag του με guideBindings. null αν ο validator το απορρίψει.
 * Το `justification` (ADR-441 5a-grid) γράφεται στα params ΜΟΝΟ όταν ≠ center (Firestore-safe
 * default· center → καμία αλλαγή). Ο μηχανικός το υπερισχύει αργότερα μέσω 5a-control.
 */
function buildBoundStrip(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  bindings: readonly GuideBinding[],
  justification: StripJustification,
  levelId: string,
  overrides: FoundationParamOverrides,
  sceneUnits: SceneUnits,
): FoundationEntity | null {
  const merged = justification === 'center' ? overrides : { ...overrides, justification };
  const result = completeFoundationFromTwoClicks(start, end, levelId, 'strip', merged, sceneUnits);
  if (!result.ok) return null;
  return { ...result.entity, guideBindings: bindings };
}

/**
 * X-guides (κατακόρυφες) → λωρίδες κατά μήκος του Y, ανά διαδοχικό φάτνωμα.
 *
 * Auto-justification (ADR-441 Slice 5a-grid): οι ΠΕΡΙΜΕΤΡΙΚΕΣ κατακόρυφες (πρώτος/
 * τελευταίος X-άξονας) αναπτύσσονται **προς τα μέσα** (εξωτερική παρειά ΠΑΝΩ στον άξονα,
 * μηδέν overhang) → η γωνία κλείνει φυσικά, αντικαθιστά το παλιό corner-fill. Εσωτερικές
 * = center. Τα start/end είναι καθαρά axis offsets (μηδέν coord extend).
 */
function emitVerticalStrips(xs: AxisData, ys: AxisData, push: PushStrip): void {
  const lastY = ys.offsets.length - 1;
  for (let xi = 0; xi < xs.offsets.length; xi++) {
    const justification = gridStripJustification('V', xi, xs.offsets.length);
    for (let i = 0; i < lastY; i++) {
      push({
        start: { x: xs.offsets[xi], y: ys.offsets[i] },
        end: { x: xs.offsets[xi], y: ys.offsets[i + 1] },
        bindings: [
          { guideId: xs.ids[xi], slot: 'start-x' },
          { guideId: xs.ids[xi], slot: 'end-x' },
          { guideId: ys.ids[i], slot: 'start-y' },
          { guideId: ys.ids[i + 1], slot: 'end-y' },
        ],
        justification,
      });
    }
  }
}

/** Y-guides (οριζόντιες) → λωρίδες κατά μήκος του X. Auto-justification mirror του vertical. */
function emitHorizontalStrips(xs: AxisData, ys: AxisData, push: PushStrip): void {
  const lastX = xs.offsets.length - 1;
  for (let yi = 0; yi < ys.offsets.length; yi++) {
    const justification = gridStripJustification('H', yi, ys.offsets.length);
    for (let i = 0; i < lastX; i++) {
      push({
        start: { x: xs.offsets[i], y: ys.offsets[yi] },
        end: { x: xs.offsets[i + 1], y: ys.offsets[yi] },
        bindings: [
          { guideId: ys.ids[yi], slot: 'start-y' },
          { guideId: ys.ids[yi], slot: 'end-y' },
          { guideId: xs.ids[i], slot: 'start-x' },
          { guideId: xs.ids[i + 1], slot: 'end-x' },
        ],
        justification,
      });
    }
  }
}

/**
 * SSoT enumeration των grid segments (vertical + horizontal) με τα bindings &
 * justification τους. Χρησιμοποιείται ΚΑΙ από τον entity builder
 * (`buildStripGridFromGuides`) ΚΑΙ από τον live ghost deriver (ADR-441 Slice 7) —
 * μηδέν duplication των loops/justification math.
 */
export function enumerateGridStrips(axes: GridAxes, cb: PushStrip): void {
  emitVerticalStrips(axes.xs, axes.ys, cb);
  emitHorizontalStrips(axes.xs, axes.ys, cb);
}

/**
 * Sorted+dedup ορατοί άξονες X & Y από τον reader. `null` αν λείπουν άξονες
 * (<2 ανά διεύθυνση) → δεν παράγεται εσχάρα. SSoT input και για builder και ghost.
 */
export function gridAxesFromReader(reader: AxisGuideReader): GridAxes | null {
  const xs = uniqueSortedAxis(reader.getGuidesByAxis('X').filter((g) => g.visible));
  const ys = uniqueSortedAxis(reader.getGuidesByAxis('Y').filter((g) => g.visible));
  if (xs.offsets.length < 2 || ys.offsets.length < 2) return null;
  return { xs, ys };
}

/**
 * Παράγει την εσχάρα πεδιλοδοκών από τους ορατούς άξονες του κανάβου.
 * Σύνολο = nX·(nY-1) + nY·(nX-1) λωρίδες (π.χ. 3×3 → 12).
 */
export function buildStripGridFromGuides(
  reader: AxisGuideReader,
  overrides: FoundationParamOverrides,
  levelId: string,
  sceneUnits: SceneUnits,
): BuildStripGridResult {
  const axes = gridAxesFromReader(reader);
  if (!axes) {
    return { ok: false, reason: 'insufficient-guides', strips: [], ignoredCount: 0 };
  }

  const strips: FoundationEntity[] = [];
  let ignoredCount = 0;
  enumerateGridStrips(axes, ({ start, end, bindings, justification }) => {
    const strip = buildBoundStrip(start, end, bindings, justification, levelId, overrides, sceneUnits);
    if (strip) strips.push(strip);
    else ignoredCount++;
  });

  return { ok: true, strips, ignoredCount };
}
