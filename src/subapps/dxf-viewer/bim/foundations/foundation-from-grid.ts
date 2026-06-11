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
import type { FoundationEntity } from '../types/foundation-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import {
  completeFoundationFromTwoClicks,
  type FoundationParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/foundation-completion';

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

/** Sorted unique offsets + παράλληλο array των αντίστοιχων guide ids. */
function uniqueSortedAxis(guides: readonly Guide[]): { offsets: number[]; ids: string[] } {
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
  const push = (
    start: Point2D,
    end: Point2D,
    bindings: readonly GuideBinding[],
  ): void => {
    const strip = buildBoundStrip(start, end, bindings, levelId, overrides, sceneUnits);
    if (strip) strips.push(strip);
    else ignoredCount++;
  };

  // X-guides (κατακόρυφες) → λωρίδες κατά μήκος του Y, ανά διαδοχικό φάτνωμα.
  for (let xi = 0; xi < xs.offsets.length; xi++) {
    const xOff = xs.offsets[xi];
    const xId = xs.ids[xi];
    for (let i = 0; i < ys.offsets.length - 1; i++) {
      push({ x: xOff, y: ys.offsets[i] }, { x: xOff, y: ys.offsets[i + 1] }, [
        { guideId: xId, slot: 'start-x' },
        { guideId: xId, slot: 'end-x' },
        { guideId: ys.ids[i], slot: 'start-y' },
        { guideId: ys.ids[i + 1], slot: 'end-y' },
      ]);
    }
  }

  // Y-guides (οριζόντιες) → λωρίδες κατά μήκος του X, ανά διαδοχικό φάτνωμα.
  for (let yi = 0; yi < ys.offsets.length; yi++) {
    const yOff = ys.offsets[yi];
    const yId = ys.ids[yi];
    for (let i = 0; i < xs.offsets.length - 1; i++) {
      push({ x: xs.offsets[i], y: yOff }, { x: xs.offsets[i + 1], y: yOff }, [
        { guideId: yId, slot: 'start-y' },
        { guideId: yId, slot: 'end-y' },
        { guideId: xs.ids[i], slot: 'start-x' },
        { guideId: xs.ids[i + 1], slot: 'end-x' },
      ]);
    }
  }

  return { ok: true, strips, ignoredCount };
}
