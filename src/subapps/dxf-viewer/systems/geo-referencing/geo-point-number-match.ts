/**
 * ADR-650 §M10e — THE NUMBERING CHANNEL: the surveyor already told us the correspondences.
 *
 * Every other branch of the auto-match GUESSES which drawing point is which survey point,
 * then proves the guess. This one does not have to guess: a survey drawing labels its points
 * with the very numbers the CSV carries in its own point-number column. In the reference file
 * 52 TEXT entities hold exactly the id of the CSV point they sit beside. That is a KNOWN
 * correspondence set, and a known correspondence set is a least-squares problem, not a search.
 *
 * This is therefore the FIRST geometric branch the orchestrator tries and the one it prefers:
 * it is deterministic, it needs no thresholds to find its answer, it cannot be fooled by a
 * symmetric grid, and it degrades to «no labels ⇒ no answer» instead of to a wrong answer.
 * It is also what a surveyor means by matching two files — Civil 3D / 12d / Leica all key on
 * the point number, because the number IS the identity of the measurement.
 *
 * ## Why the label's own position is NOT the coordinate
 * A point number is DRAUGHTING: it is offset from its point so it can be read (in the
 * reference file, within 2 m). Fitting to label positions would bake that offset into the
 * geo-reference as a systematic ~1 m error, uniformly, invisibly — the RMS would even look
 * respectable because every label is offset by a similar amount. So each label is SNAPPED to
 * the nearest drawing node, and that node's coordinate is what enters the fit.
 *
 * ## Fail-closed, everywhere
 * A duplicated number on either side, or two labels claiming one node, is discarded rather
 * than resolved by a tie-break. An ambiguous identity is not a weak correspondence, it is an
 * absence of one, and this branch is only worth preferring because it never invents.
 *
 * Pure module — zero React/DOM/store deps, fully deterministic.
 *
 * @see ../topography/topo-types.ts — `TopoPoint.pointNumber` (ADR-656 M10), the CSV side
 * @see ./geo-similarity-solve.ts — the least-squares fit over the correspondences
 */

import type { Entity } from '../../types/entities';
import type { TopoPoint } from '../topography/topo-types';
import { PointHashGrid, NO_POINT } from '../../core/spatial/PointHashGrid';
import { median, mad } from '../../utils/statistics';
import { localToWorld } from './geo-transform';
import { solveRigid2D, type PointPair, type SimilaritySolution } from './geo-similarity-solve';
import type { LocalCandidatePoint } from './geo-ref-candidate-points';

export interface PointNumberMatchOptions {
  /**
   * How far a label may sit from the node it names, in canonical mm. Default 3 000 (3 m):
   * comfortably above the 2 m measured in the reference file, far below the spacing at which
   * a label could plausibly belong to a different point.
   */
  readonly labelRadiusMm?: number;
}

const DEFAULT_LABEL_RADIUS_MM = 3_000;

/** Multiple of the residual MAD beyond which a correspondence is a blunder, not noise. */
const BLUNDER_MAD_FACTOR = 4;
/**
 * Residual below which nothing is ever rejected, however tight the rest of the fit. Without a
 * floor a PERFECT fit (median ≈ 0, MAD ≈ 0) would have a threshold of zero and would throw
 * away correspondences for a micron of float noise.
 */
const BLUNDER_FLOOR_MM = 250;
/** Below this many correspondences a robust spread is meaningless — reject nothing. */
const MIN_PAIRS_FOR_BLUNDER_TEST = 5;
/** Rejection passes. Two is enough: the first removes the blunders that hid the second's. */
const BLUNDER_PASSES = 2;

/** The outcome of the numbering channel — the fit plus the counts the proof card shows. */
export interface PointNumberMatch {
  readonly solution: SimilaritySolution;
  /** The correspondences the fit used. */
  readonly pairs: readonly PointPair[];
  /** Labels whose text matched a survey point number (before snapping). */
  readonly labelled: number;
  /** Correspondences discarded as ambiguous — duplicate numbers, or two labels on one node. */
  readonly ambiguous: number;
  /** Correspondences dropped as blunders by the robust refit — see {@link refitWithoutBlunders}. */
  readonly rejected: number;
}

/**
 * Canonical form of a point number, for comparing a DXF label against a CSV column.
 *
 * Trimmed and upper-cased, and — only when the whole string is digits — stripped of leading
 * zeros, so the drawing's `049` matches the CSV's `49`. Nothing else is normalised: matching
 * is EXACT after this, with no fuzzy distance, because a survey number is an identifier and
 * `S12` is not a near-miss of `S13`. Returns `null` for anything empty.
 */
function normalisePointLabel(raw: string | undefined): string | null {
  const trimmed = (raw ?? '').trim().toUpperCase();
  if (trimmed === '') return null;
  return /^[0-9]+$/.test(trimmed) ? String(Number(trimmed)) : trimmed;
}

/**
 * Survey point number → the point, with every duplicated number REMOVED.
 *
 * A CSV that numbers two points `17` cannot say which one a drawing's `17` means, so both
 * are dropped. Keeping the first would silently pick by file order.
 */
function buildSurveyNumberIndex(points: readonly TopoPoint[]): Map<string, TopoPoint> {
  const index = new Map<string, TopoPoint>();
  const duplicated = new Set<string>();

  for (const point of points) {
    const key = normalisePointLabel(point.pointNumber);
    if (key === null) continue;
    if (index.has(key)) duplicated.add(key);
    else index.set(key, point);
  }

  for (const key of duplicated) index.delete(key);
  return index;
}

/** A label that named a known survey point, with the label's own (draughting) position. */
interface LabelHit {
  readonly key: string;
  readonly survey: TopoPoint;
  readonly x: number;
  readonly y: number;
}

/**
 * Every label whose text is the number of a survey point, in scene order.
 *
 * Reads the REQUIRED `text` field rather than the optional `textNode` AST: `text` is always
 * populated (by the importer and by every create command), while flattening the AST would
 * mean importing the editor's bridge from `ui/` into `systems/` — an inverted dependency for
 * a case that cannot arise here, since a point number is a single unstyled run.
 */
function collectLabelHits(entities: readonly Entity[], surveyByNumber: Map<string, TopoPoint>): LabelHit[] {
  const hits: LabelHit[] = [];
  for (const entity of entities) {
    // Narrowed here rather than in a helper so `position` stays typed without a cast.
    if (entity.type !== 'text' && entity.type !== 'mtext') continue;

    const key = normalisePointLabel(entity.text);
    if (key === null) continue;
    const survey = surveyByNumber.get(key);
    if (!survey) continue;

    const { x, y } = entity.position;
    if (Number.isFinite(x) && Number.isFinite(y)) hits.push({ key, survey, x, y });
  }
  return hits;
}

/** Snap each label to its nearest unclaimed drawing node; a contested node discards both claims. */
function snapLabelsToNodes(
  hits: readonly LabelHit[],
  nodes: readonly LocalCandidatePoint[],
  radiusMm: number,
): { pairs: PointPair[]; ambiguous: number } {
  const grid = new PointHashGrid(nodes, radiusMm);
  const claimedBy = new Map<number, PointPair | null>();
  let ambiguous = 0;

  for (const hit of hits) {
    const node = grid.nearestWithin(hit.x, hit.y, radiusMm);
    if (node === NO_POINT) continue;

    if (claimedBy.has(node)) {
      // A second label on the same node: the node's identity is now unknown, so the FIRST
      // claim is retracted too rather than being kept on the strength of scene order.
      if (claimedBy.get(node) !== null) ambiguous++;
      claimedBy.set(node, null);
      ambiguous++;
      continue;
    }

    const local = nodes[node]!;
    claimedBy.set(node, { local: { x: local.x, y: local.y }, world: { x: hit.survey.x, y: hit.survey.y } });
  }

  const pairs: PointPair[] = [];
  for (const pair of claimedBy.values()) if (pair !== null) pairs.push(pair);
  return { pairs, ambiguous };
}

/** Residual of each correspondence under `solution`, measured through the SSoT projection. */
function residualsOf(pairs: readonly PointPair[], geo: SimilaritySolution['geo']): number[] {
  return pairs.map(({ local, world }) => {
    const projected = localToWorld(local, geo);
    return Math.hypot(projected.x - world.x, projected.y - world.y);
  });
}

/**
 * Re-fit after discarding correspondences that cannot be explained by the rest.
 *
 * A label is DRAUGHTING: it sits beside its point, and where two survey points are closer
 * together than a label is to its own, the nearest-node snap can pick the neighbour. One such
 * blunder is enough to drag a least-squares fit off by hundreds of millimetres — least
 * squares has no defence against a gross error, it distributes it over every correspondence.
 *
 * So the fit is used to police its own inputs: residuals far outside `median + k·MAD` are
 * removed and the fit is repeated. MAD rather than σ because a blunder inflates σ and thereby
 * hides inside it — the same reasoning as every other robust gate in this app (see
 * `utils/statistics.ts`). Two passes, because removing the worst blunder tightens the spread
 * enough to expose a second one.
 *
 * This is standard survey adjustment practice (blunder detection before the final network
 * solution), not a fudge: the discarded pairs are REPORTED, and a fit that loses most of its
 * correspondences will fail the acceptance gates on count anyway.
 */
function refitWithoutBlunders(pairs: readonly PointPair[], initial: SimilaritySolution): {
  solution: SimilaritySolution;
  pairs: readonly PointPair[];
} {
  let solution = initial;
  let kept: readonly PointPair[] = pairs;

  for (let pass = 0; pass < BLUNDER_PASSES; pass++) {
    if (kept.length < MIN_PAIRS_FOR_BLUNDER_TEST) break;

    const residuals = residualsOf(kept, solution.geo);
    const centre = median(residuals);
    const threshold = Math.max(BLUNDER_FLOOR_MM, centre + BLUNDER_MAD_FACTOR * mad(residuals, centre));

    const survivors = kept.filter((_, i) => residuals[i]! <= threshold);
    if (survivors.length === kept.length) break;
    if (survivors.length < MIN_PAIRS_FOR_BLUNDER_TEST) break;

    const refitted = solveRigid2D(survivors);
    if (!refitted) break;
    solution = refitted;
    kept = survivors;
  }

  return { solution, pairs: kept };
}

/**
 * Fit the drawing to the survey using the surveyor's own point numbers.
 *
 * `null` when the channel does not apply — no numbered survey points, no matching labels, or
 * fewer than two unambiguous correspondences (two is the minimum that can evidence a
 * rotation; the orchestrator's gate demands far more before it will offer the result).
 *
 * @param entities    the scene's entities (the label side), LOCAL canonical mm
 * @param nodes       drawing feature points to snap labels onto, LOCAL canonical mm
 * @param surveyPoints the imported survey, WORLD ΕΓΣΑ canonical mm
 */
export function matchByPointNumber(
  entities: readonly Entity[],
  nodes: readonly LocalCandidatePoint[],
  surveyPoints: readonly TopoPoint[],
  options: PointNumberMatchOptions = {},
): PointNumberMatch | null {
  if (nodes.length === 0) return null;

  const surveyByNumber = buildSurveyNumberIndex(surveyPoints);
  if (surveyByNumber.size === 0) return null;

  const hits = collectLabelHits(entities, surveyByNumber);
  if (hits.length === 0) return null;

  const { pairs, ambiguous } = snapLabelsToNodes(hits, nodes, options.labelRadiusMm ?? DEFAULT_LABEL_RADIUS_MM);
  const initial = solveRigid2D(pairs);
  if (!initial) return null;

  const robust = refitWithoutBlunders(pairs, initial);
  return {
    solution: robust.solution,
    pairs: robust.pairs,
    labelled: hits.length,
    ambiguous,
    rejected: pairs.length - robust.pairs.length,
  };
}
