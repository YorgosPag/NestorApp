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
import type { FoundationEntity, FoundationKind, StripJustification } from '../types/foundation-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import {
  completeFoundationFromTwoClicks,
  type FoundationParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/foundation-completion';
import {
  gridStripJustification,
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from './foundation-grid-justification';

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

/**
 * Προδιαγραφή ΕΝΟΣ grid **φατνώματος** (2D cell, ADR-441 Slice GEN-SLAB) πριν χτιστεί
 * πλάκα. Σε αντίθεση με το `GridStripSpec` (1D ακμή για δοκάρια/τοίχους), το φάτνωμα
 * δένει σε **4 άξονες** (αριστερά/δεξιά X + κάτω/πάνω Y) ώστε η πλάκα να ακολουθεί ως
 * επιφάνεια όταν κουνηθεί οποιοσδήποτε από τους 4.
 */
export interface GridBaySpec {
  /** 4 κορυφές του ορθογωνίου φατνώματος (CCW): (x0,y0)→(x1,y0)→(x1,y1)→(x0,y1). */
  readonly corners: readonly Point2D[];
  /** 4 bindings: start-x=αριστερός X, end-x=δεξιός X, start-y=κάτω Y, end-y=πάνω Y. */
  readonly bindings: readonly GuideBinding[];
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
  kind: FoundationKind,
): FoundationEntity | null {
  const merged = justification === 'center' ? overrides : { ...overrides, justification };
  const result = completeFoundationFromTwoClicks(start, end, levelId, kind, merged, sceneUnits);
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
function emitVerticalStrips(xs: AxisData, ys: AxisData, push: PushStrip, mode: GridPerimeterMode): void {
  const lastY = ys.offsets.length - 1;
  for (let xi = 0; xi < xs.offsets.length; xi++) {
    const justification = gridStripJustification('V', xi, xs.offsets.length, mode);
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
function emitHorizontalStrips(xs: AxisData, ys: AxisData, push: PushStrip, mode: GridPerimeterMode): void {
  const lastX = xs.offsets.length - 1;
  for (let yi = 0; yi < ys.offsets.length; yi++) {
    const justification = gridStripJustification('H', yi, ys.offsets.length, mode);
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
export function enumerateGridStrips(
  axes: GridAxes,
  cb: PushStrip,
  mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE,
): void {
  emitVerticalStrips(axes.xs, axes.ys, cb, mode);
  emitHorizontalStrips(axes.xs, axes.ys, cb, mode);
}

/**
 * SSoT enumeration των grid **φατνωμάτων** (2D cells) με τα 4-axis bindings τους.
 * Για κάθε ζεύγος διαδοχικών X-αξόνων × διαδοχικών Y-αξόνων εκπέμπει ΕΝΑ ορθογώνιο
 * φάτνωμα. Σύνολο = (nX-1)·(nY-1) φατνώματα (π.χ. 3×3 → 4). Χρησιμοποιείται από τον
 * slab bay builder (`buildSlabBaysFromGuides`, ADR-441 Slice GEN-SLAB) — ίδιο πρότυπο
 * με τον `enumerateGridStrips` αλλά για επιφάνειες αντί ακμών.
 */
export function enumerateGridBays(
  axes: GridAxes,
  cb: (spec: GridBaySpec) => void,
): void {
  const { xs, ys } = axes;
  for (let xi = 0; xi < xs.offsets.length - 1; xi++) {
    for (let yi = 0; yi < ys.offsets.length - 1; yi++) {
      const x0 = xs.offsets[xi];
      const x1 = xs.offsets[xi + 1];
      const y0 = ys.offsets[yi];
      const y1 = ys.offsets[yi + 1];
      cb({
        corners: [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ],
        bindings: [
          { guideId: xs.ids[xi], slot: 'start-x' },
          { guideId: xs.ids[xi + 1], slot: 'end-x' },
          { guideId: ys.ids[yi], slot: 'start-y' },
          { guideId: ys.ids[yi + 1], slot: 'end-y' },
        ],
      });
    }
  }
}

/**
 * Sorted+dedup ορατοί άξονες X & Y από τον reader. `null` αν λείπουν άξονες
 * (κάτω από `minPerAxis` ανά διεύθυνση) → δεν παράγεται εσχάρα. SSoT input και για
 * builder και ghost.
 *
 * `minPerAxis` (default 2): η εσχάρα/τοίχοι χρειάζονται **≥2** άξονες ανά διεύθυνση για
 * να ορίσουν segment (intersection-to-intersection). Οι κολώνες (ADR-441 Slice GEN-COL,
 * «στις τομές») χρειάζονται **≥1** ανά διεύθυνση — μία τομή = μία κολώνα.
 */
export function gridAxesFromReader(reader: AxisGuideReader, minPerAxis = 2): GridAxes | null {
  const xs = uniqueSortedAxis(reader.getGuidesByAxis('X').filter((g) => g.visible));
  const ys = uniqueSortedAxis(reader.getGuidesByAxis('Y').filter((g) => g.visible));
  if (xs.offsets.length < minPerAxis || ys.offsets.length < minPerAxis) return null;
  return { xs, ys };
}

/**
 * Παράγει την εσχάρα γραμμικών θεμελιώσεων από τους ορατούς άξονες του κανάβου.
 * Σύνολο = nX·(nY-1) + nY·(nX-1) λωρίδες (π.χ. 3×3 → 12).
 *
 * `kind` (default `'strip'`): πεδιλοδοκοί. Με `'tie-beam'` (ADR-441 Slice GEN-TIE)
 * παράγει **συνδετήριες δοκούς** στα ίδια segments — ίδιος enumerator/bindings, μόνο
 * τα kind-defaults (πλάτος/βάθος) αλλάζουν στο `completeFoundationFromTwoClicks`. Οι
 * συνδετήριες καλούνται με `mode='center'` (κεντραρισμένες στον άξονα, χωρίς overhang).
 */
export function buildStripGridFromGuides(
  reader: AxisGuideReader,
  overrides: FoundationParamOverrides,
  levelId: string,
  sceneUnits: SceneUnits,
  mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE,
  kind: FoundationKind = 'strip',
): BuildStripGridResult {
  const axes = gridAxesFromReader(reader);
  if (!axes) {
    return { ok: false, reason: 'insufficient-guides', strips: [], ignoredCount: 0 };
  }

  const strips: FoundationEntity[] = [];
  let ignoredCount = 0;
  enumerateGridStrips(axes, ({ start, end, bindings, justification }) => {
    const strip = buildBoundStrip(start, end, bindings, justification, levelId, overrides, sceneUnits, kind);
    if (strip) strips.push(strip);
    else ignoredCount++;
  }, mode);

  return { ok: true, strips, ignoredCount };
}
