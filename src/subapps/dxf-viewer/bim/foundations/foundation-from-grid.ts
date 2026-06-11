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
import { DEFAULT_STRIP_WIDTH_MM, type FoundationEntity } from '../types/foundation-types';
import type { GuideBinding, GuideBindingSlot } from '../hosting/guide-binding-types';
import {
  completeFoundationFromTwoClicks,
  type FoundationParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/foundation-completion';
import { mmToSceneUnits } from '../../utils/scene-units';

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

/** Push callback (ορισμένο από `buildStripGridFromGuides`) — emit ΕΝΑ segment. */
type PushStrip = (
  start: Point2D,
  end: Point2D,
  bindings: readonly GuideBinding[],
) => void;

/** Binding με optional `extend` (mm, signed). Παραλείπει το πεδίο όταν undefined. */
function makeBinding(
  guideId: string,
  slot: GuideBindingSlot,
  extendMm?: number,
): GuideBinding {
  return extendMm !== undefined ? { guideId, slot, extend: extendMm } : { guideId, slot };
}

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

/** Build ΕΝΑ strip segment + tag του με guideBindings. null αν ο validator το απορρίψει. */
function buildBoundStrip(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  bindings: readonly GuideBinding[],
  levelId: string,
  overrides: FoundationParamOverrides,
  sceneUnits: SceneUnits,
): FoundationEntity | null {
  const result = completeFoundationFromTwoClicks(start, end, levelId, 'strip', overrides, sceneUnits);
  if (!result.ok) return null;
  return { ...result.entity, guideBindings: bindings };
}

/**
 * X-guides (κατακόρυφες) → λωρίδες κατά μήκος του Y, ανά διαδοχικό φάτνωμα.
 *
 * Corner-fill (ADR-441 Slice JOIN): ΜΟΝΟ στις 4 εξωτερικές γωνίες προεκτείνεται
 * το άκρο κατά ±width/2 προς τα έξω → κλείνει το ακάλυπτο τεταρτημόριο. Γωνία =
 * extreme parallel-axis (πρώτος/τελευταίος X) × extreme perpendicular (κάτω/πάνω Y).
 */
function emitVerticalStrips(
  xs: AxisData,
  ys: AxisData,
  halfMm: number,
  scale: number,
  push: PushStrip,
): void {
  const lastY = ys.offsets.length - 1;
  for (let xi = 0; xi < xs.offsets.length; xi++) {
    const xExtreme = xi === 0 || xi === xs.offsets.length - 1;
    for (let i = 0; i < lastY; i++) {
      const startExt = xExtreme && i === 0 ? -halfMm : undefined;
      const endExt = xExtreme && i === lastY - 1 ? halfMm : undefined;
      push(
        { x: xs.offsets[xi], y: ys.offsets[i] + (startExt ?? 0) * scale },
        { x: xs.offsets[xi], y: ys.offsets[i + 1] + (endExt ?? 0) * scale },
        [
          makeBinding(xs.ids[xi], 'start-x'),
          makeBinding(xs.ids[xi], 'end-x'),
          makeBinding(ys.ids[i], 'start-y', startExt),
          makeBinding(ys.ids[i + 1], 'end-y', endExt),
        ],
      );
    }
  }
}

/** Y-guides (οριζόντιες) → λωρίδες κατά μήκος του X. Corner-fill mirror του vertical. */
function emitHorizontalStrips(
  xs: AxisData,
  ys: AxisData,
  halfMm: number,
  scale: number,
  push: PushStrip,
): void {
  const lastX = xs.offsets.length - 1;
  for (let yi = 0; yi < ys.offsets.length; yi++) {
    const yExtreme = yi === 0 || yi === ys.offsets.length - 1;
    for (let i = 0; i < lastX; i++) {
      const startExt = yExtreme && i === 0 ? -halfMm : undefined;
      const endExt = yExtreme && i === lastX - 1 ? halfMm : undefined;
      push(
        { x: xs.offsets[i] + (startExt ?? 0) * scale, y: ys.offsets[yi] },
        { x: xs.offsets[i + 1] + (endExt ?? 0) * scale, y: ys.offsets[yi] },
        [
          makeBinding(ys.ids[yi], 'start-y'),
          makeBinding(ys.ids[yi], 'end-y'),
          makeBinding(xs.ids[i], 'start-x', startExt),
          makeBinding(xs.ids[i + 1], 'end-x', endExt),
        ],
      );
    }
  }
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
  const xs = uniqueSortedAxis(reader.getGuidesByAxis('X').filter((g) => g.visible));
  const ys = uniqueSortedAxis(reader.getGuidesByAxis('Y').filter((g) => g.visible));
  if (xs.offsets.length < 2 || ys.offsets.length < 2) {
    return { ok: false, reason: 'insufficient-guides', strips: [], ignoredCount: 0 };
  }

  const strips: FoundationEntity[] = [];
  let ignoredCount = 0;
  const push: PushStrip = (start, end, bindings) => {
    const strip = buildBoundStrip(start, end, bindings, levelId, overrides, sceneUnits);
    if (strip) strips.push(strip);
    else ignoredCount++;
  };

  const halfMm = (overrides.width ?? DEFAULT_STRIP_WIDTH_MM) / 2;
  const scale = mmToSceneUnits(sceneUnits);
  emitVerticalStrips(xs, ys, halfMm, scale, push);
  emitHorizontalStrips(xs, ys, halfMm, scale, push);

  return { ok: true, strips, ignoredCount };
}
