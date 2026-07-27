/**
 * ADR-650 §M10e — THE ORCHESTRATOR: «κούμπωσε το σχέδιο στο τοπογραφικό», one entry point.
 *
 * Four independent ways of answering the same question, tried cheapest-and-most-certain
 * first, all measured by the SAME verifier and judged by the SAME gates. The ordering is the
 * design: each branch is strictly more assumption-laden than the one before it, so the answer
 * the user gets is always the most defensible one available for their file.
 *
 *   1. `identity-restore`  — the import RECORDED the offset it subtracted (`sourceOrigin`).
 *                            Analytic, exact, zero thresholds. Nothing can beat knowing.
 *   2. `already-aligned`   — the drawing is already in ΕΓΣΑ. Also analytic: we simply check.
 *   3. `point-number`      — the surveyor's own numbering gives KNOWN correspondences.
 *                            Deterministic; a least-squares fit, not a search.
 *   4. `congruent-pairs`   — blind geometric registration. The only branch that guesses, and
 *                            therefore the only one that has to defend itself.
 *
 * Then the two ways of NOT answering, which are results in their own right:
 *   - `unit-mismatch` — the files fit, but at a scale. Reported with `geo === null`, because
 *     a scaled geo-reference would silently resize the building and every quantity from it.
 *   - `needs-manual`  — nothing passed. The correct outcome for unrelated files, and the one
 *     the false-positive test pins down.
 *
 * 🔴 NEVER AUTO-APPLIES. This function returns a proposal. The engineer presses «Εφαρμογή».
 * The whole value of the proof card is that a human sees the evidence before the project's
 * base point changes.
 *
 * Pure module — zero React/DOM/store deps, zero randomness. Same inputs, same answer, always.
 *
 * @see ./geo-match-gates.ts — the acceptance contract (do not soften it here)
 * @see ./geo-point-index.ts — the single verifier every branch is measured by
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneLayer } from '../../types/scene-types';
import type { TopoPoint } from '../topography/topo-types';
import { fromOnePointPair, IDENTITY_GEO_REFERENCE, type GeoReference } from './geo-transform';
import { buildWorldPointIndex, scoreGeoReference, type GeoMatchScore, type WorldPointIndex } from './geo-point-index';
import {
  collectCandidatePoints, dominantLayerName, selectBasisSample, strideSample,
  type LocalCandidatePoint,
} from './geo-ref-candidate-points';
import { splitByCoordinateFrame, type PointCluster } from './geo-point-clusters';
import { boundsOfPoints } from '../../services/clip/clip-geometry';
import { matchByPointNumber } from './geo-point-number-match';
import { matchByCongruentPairs } from './geo-congruent-match';
import { MAX_PAIR_TABLE_POINTS } from './geo-pair-table';
import {
  applyAcceptanceGates, isUnitMismatch, matchableTotal, suggestUnitScale,
  type GateFailure, type GateVerdict,
} from './geo-match-gates';

/** How the reference was arrived at — or why there is none. */
export type GeoMatchMethod =
  | 'identity-restore'
  | 'already-aligned'
  | 'point-number'
  | 'congruent-pairs'
  | 'unit-mismatch'
  | 'needs-manual';

export interface AutoMatchInput {
  /** Scene entities, LOCAL canonical mm. */
  readonly entities: readonly Entity[];
  /** The scene's layer table — only used to name the layer in the proof card. */
  readonly layersById: Readonly<Record<string, SceneLayer>>;
  /** `SceneModel.sourceOrigin` (ADR-650 M10e Σκέλος Α). Absent on pre-M10e scenes. */
  readonly sourceOrigin?: Point2D;
  /** The imported survey, WORLD ΕΓΣΑ canonical mm. */
  readonly surveyPoints: readonly TopoPoint[];
  /** Point acceptance radius, canonical mm. Default 50 — a surveyed centimetre-grade point. */
  readonly toleranceMm?: number;
}

/** Everything the proof card shows, plus the reference itself. `geo === null` ⇒ nothing to apply. */
export interface GeoMatchResult {
  readonly method: GeoMatchMethod;
  readonly geo: GeoReference | null;
  readonly inliers: number;
  /** The achievable maximum the inlier count is judged against. */
  readonly matchable: number;
  /** Inliers this candidate had to reach. */
  readonly required: number;
  readonly rmsMm: number;
  readonly rotationDeg: number;
  /** DIAGNOSTIC — never applied. Far from 1 ⇒ `unit-mismatch`. */
  readonly scaleEstimate: number;
  /** Suggested canonical-mm-per-unit ratio for the existing `unitsOverride` escape hatch. */
  readonly suggestedUnitScale: number | null;
  /** Layer that contributed most of the matched frame — `null` when not applicable. */
  readonly layerName: string | null;
  /** Hypotheses scored by the blind branch (0 for the analytic ones) — work done, for the card. */
  readonly hypotheses: number;
  /** Which gate refused, when nothing was accepted. */
  readonly failure: GateFailure | null;
}

const DEFAULT_TOLERANCE_MM = 50;
/**
 * Ceiling on the drawing points fed to the pairwise table. Well under
 * {@link MAX_PAIR_TABLE_POINTS} because the table is quadratic: 1 500 points is ~1.1 M rows,
 * which builds and scans in milliseconds, while 3 000 is 4.5 M and starts to be felt.
 */
const BASIS_SAMPLE_CAP = 1_500;
/** Ceiling on the survey points bases are drawn from — a decimated point cloud can be huge. */
const WORLD_BASIS_CAP = Math.min(MAX_PAIR_TABLE_POINTS, 1_500);

function toPoint2D(p: LocalCandidatePoint | TopoPoint): Point2D {
  return { x: p.x, y: p.y };
}

/** A result carrying no reference — the shape both refusals share. */
function noMatch(method: 'unit-mismatch' | 'needs-manual', partial: Partial<GeoMatchResult>): GeoMatchResult {
  return {
    method, geo: null, inliers: 0, matchable: 0, required: 0, rmsMm: 0, rotationDeg: 0,
    scaleEstimate: 1, suggestedUnitScale: null, layerName: null, hypotheses: 0, failure: null,
    ...partial,
  };
}

/** Shared assembly of an ACCEPTED result, so every branch reports the same fields the same way. */
function accepted(
  method: GeoMatchMethod,
  geo: GeoReference,
  score: GeoMatchScore,
  extra: { matchable: number; required: number; scaleEstimate: number; layerName: string | null; hypotheses: number },
): GeoMatchResult {
  return {
    method,
    geo,
    inliers: score.inliers,
    matchable: extra.matchable,
    required: extra.required,
    rmsMm: score.rmsMm,
    rotationDeg: geo.rotationDeg,
    scaleEstimate: extra.scaleEstimate,
    suggestedUnitScale: null,
    layerName: extra.layerName,
    hypotheses: extra.hypotheses,
    failure: null,
  };
}

/** Everything the branches share, computed once. */
interface MatchContext {
  readonly all: readonly LocalCandidatePoint[];
  readonly allXY: readonly Point2D[];
  readonly index: WorldPointIndex;
  readonly worldXY: readonly Point2D[];
  readonly matchable: number;
  readonly toleranceMm: number;
  readonly layersById: Readonly<Record<string, SceneLayer>>;
  /** Collects WHY the branches refused, so «needs-manual» can say something useful. */
  readonly failures: FailureLog;
}

/**
 * The most informative refusal seen while the branches ran.
 *
 * «Nothing matched» is a useless thing to tell an engineer — it names no next action. «12
 * points of the 28 required» tells them the drawing and the survey barely overlap; «ambiguous»
 * tells them the geometry is symmetric and no algorithm can decide for them.
 *
 * Only refusals of candidates that actually LANDED something are recorded. A branch that
 * scored zero inliers did not fail a gate in any meaningful sense — it simply does not apply
 * (the identity transform on a drawing 4 500 km away), and reporting its verdict would be
 * noise dressed as diagnosis. First meaningful refusal wins: branches run in descending order
 * of certainty and frames in descending order of size, so the first is the most relevant.
 */
class FailureLog {
  private recorded: Partial<GeoMatchResult> | null = null;

  record(verdict: GateVerdict, score: { inliers: number; rmsMm: number }): void {
    if (this.recorded !== null || verdict.accepted || score.inliers === 0) return;
    this.recorded = {
      failure: verdict.reason,
      inliers: score.inliers,
      required: verdict.required,
      rmsMm: score.rmsMm,
    };
  }

  /** The recorded refusal as result fields, or an empty patch when nothing meaningful failed. */
  get asResultFields(): Partial<GeoMatchResult> {
    return this.recorded ?? {};
  }
}

/**
 * The shared tail of every NON-SEARCHING branch: score the candidate, run the gates, and either
 * accept it or log why it was refused. The three such branches differ only in what they attach to
 * an acceptance (layer, scale estimate) — never in how they judge, so judging lives here once.
 *
 * `secondBestInliers: 0` is correct rather than lenient: none of these branches search, so there
 * IS no rival hypothesis. The uniqueness gate exists to catch a search that could not decide, and
 * an offset the importer wrote down did not have to decide anything.
 */
function scoreAndAccept(
  method: GeoMatchMethod,
  geo: GeoReference,
  ctx: MatchContext,
  extra: { scaleEstimate: number; layerName: string | null },
): GeoMatchResult | null {
  const score = scoreGeoReference(ctx.allXY, ctx.index, geo);
  const verdict = applyAcceptanceGates({
    inliers: score.inliers, matchable: ctx.matchable, rmsMm: score.rmsMm, secondBestInliers: 0,
  });
  if (!verdict.accepted) {
    ctx.failures.record(verdict, score);
    return null;
  }

  return accepted(method, geo, score, {
    matchable: ctx.matchable, required: verdict.required,
    scaleEstimate: extra.scaleEstimate, layerName: extra.layerName, hypotheses: 0,
  });
}

/** Branches 1 and 2 — an analytic candidate: no search, no layer, unit scale by construction. */
function tryAnalytic(method: 'identity-restore' | 'already-aligned', geo: GeoReference, ctx: MatchContext): GeoMatchResult | null {
  return scoreAndAccept(method, geo, ctx, { scaleEstimate: 1, layerName: null });
}

/**
 * Branch 4 — blind registration over one coordinate frame.
 *
 * Frames are tried largest first and the FIRST acceptance wins; a smaller frame is never
 * allowed to outrank a larger one it could only have matched by coincidence.
 */
function tryCongruent(frame: readonly LocalCandidatePoint[], ctx: MatchContext): GeoMatchResult | null {
  const searchXY = selectBasisSample(frame, BASIS_SAMPLE_CAP).map(toPoint2D);
  const worldBasis = strideSample(ctx.worldXY, WORLD_BASIS_CAP);
  const frameXY = frame.map(toPoint2D);

  const match = matchByCongruentPairs(frameXY, searchXY, worldBasis, ctx.index, { toleranceMm: ctx.toleranceMm });
  if (!match) return null;

  if (isUnitMismatch(match.scaleEstimate)) {
    return noMatch('unit-mismatch', {
      scaleEstimate: match.scaleEstimate,
      suggestedUnitScale: suggestUnitScale(match.scaleEstimate),
      hypotheses: match.hypotheses,
    });
  }

  const matchable = matchableTotal(frame.length, ctx.worldXY.length);
  const verdict = applyAcceptanceGates({
    inliers: match.score.inliers, matchable, rmsMm: match.score.rmsMm,
    secondBestInliers: match.secondBestInliers,
  });
  if (!verdict.accepted) {
    ctx.failures.record(verdict, match.score);
    return null;
  }

  return accepted('congruent-pairs', match.geo, match.score, {
    matchable, required: verdict.required, scaleEstimate: match.scaleEstimate,
    layerName: dominantLayerName(frame, ctx.layersById), hypotheses: match.hypotheses,
  });
}

/**
 * Propose a geo-reference that seats `entities` on `surveyPoints`, or explain why none can be.
 *
 * The result is a PROPOSAL — see the header. Nothing here writes to a store, persists a
 * project field, or moves an entity.
 */
export function autoMatchToSurvey(input: AutoMatchInput): GeoMatchResult {
  const toleranceMm = input.toleranceMm ?? DEFAULT_TOLERANCE_MM;
  const all = collectCandidatePoints(input.entities);
  const worldXY = input.surveyPoints.map(toPoint2D);

  if (all.length === 0 || worldXY.length === 0) return noMatch('needs-manual', {});

  const ctx: MatchContext = {
    all,
    allXY: all.map(toPoint2D),
    index: buildWorldPointIndex(worldXY, toleranceMm),
    worldXY,
    matchable: matchableTotal(all.length, worldXY.length),
    toleranceMm,
    layersById: input.layersById,
    failures: new FailureLog(),
  };

  return runBranches(input, ctx);
}

/** The ordered cascade. Split out so {@link autoMatchToSurvey} stays a readable setup step. */
function runBranches(input: AutoMatchInput, ctx: MatchContext): GeoMatchResult {
  if (input.sourceOrigin) {
    const restored = tryAnalytic('identity-restore', fromOnePointPair({ x: 0, y: 0 }, input.sourceOrigin), ctx);
    if (restored) return restored;
  }

  const aligned = tryAnalytic('already-aligned', IDENTITY_GEO_REFERENCE, ctx);
  if (aligned) return aligned;

  const numbered = runPointNumberBranch(input, ctx);
  if (numbered) return numbered;

  // Split ONCE and hand the same frames to both consumers. A second split would be a second
  // opinion about what the drawing is, and the fallback must judge exactly the geometry the
  // search was given — otherwise the explanation describes a drawing nobody tried to match.
  const frames = splitByCoordinateFrame(ctx.all);
  for (const frame of frames) {
    const found = tryCongruent(frame.points, ctx);
    // A unit mismatch is a FINDING, not a failed frame: the files do correspond, at a scale.
    // Reporting it beats trying the next frame and ending on the vaguer «needs-manual».
    if (found) return found;
  }

  return explainAsUnitMismatch(ctx, frames)
    ?? noMatch('needs-manual', { matchable: ctx.matchable, ...ctx.failures.asResultFields });
}

/**
 * Diagonal of a point set's bounding box — its size, independent of where it sits.
 *
 * The box itself comes from the SSoT (`boundsOfPoints`); a local `minX = Infinity` loop here
 * would be the sibling clone N.18 exists to stop.
 */
function extentOf(points: readonly Point2D[]): number {
  if (points.length === 0) return 0;
  const b = boundsOfPoints(points);
  return Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
}

/**
 * LAST RESORT — explain a total failure as a unit problem, when the sizes say so.
 *
 * 🔴 This exists because the blind search is STRUCTURALLY BLIND to a large unit mismatch, and
 * that is worth stating plainly: `congruent-pairs` matches on distance invariance, so at 1000×
 * no drawing segment has a survey counterpart of the same length, no hypothesis is ever
 * formed, and `scaleEstimate` is never computed. The scale check inside the search can only
 * catch SMALL errors (a fit that came out at 1.003). Without this fallback a drawing authored
 * in metres and read as millimetres produced «no match found» — technically true, and useless:
 * it names no action, while «your units are off by 1000» names exactly one.
 *
 * The numbering channel does not need this — it matches by IDENTITY, so it measures the scale
 * directly however large it is. This only covers the unlabelled case.
 *
 * Deliberately conservative, in three ways: it runs ONLY after everything else has failed, so
 * it can never override a real match; it fires only when the ratio is recognisably one of the
 * known unit ratios (within 0.5 %), not merely «large»; and it produces a MESSAGE, never a
 * transform. A drawing that is genuinely a small detail inside a large survey has an extent
 * ratio too, but it will not land within half a percent of exactly 1000.
 *
 * ## 🔴 Measured over ONE frame, not the whole drawing
 * A DXF routinely carries a legend, a detail or pasted geometry a kilometre or more from the
 * site. Across all of them the bounding box is dominated by the EMPTY SPACE between frames,
 * which is the size of nothing. That reading breaks the fallback in both directions, and both
 * are pinned by tests:
 *   - it goes SILENT on a genuine mismatch (drawing in mm, survey imported without the
 *     metre→millimetre conversion: the honest 1/1000 reads as 1e-4, which is no unit at all);
 *   - and — worse — it SPEAKS on files that merely fail to match, when the inter-frame gap
 *     happens to put the ratio within half a percent of a real unit. An inset 1.35 km away is
 *     enough to have it announce «your units are off by ten» about two unrelated files. A
 *     confident wrong answer is the one failure mode this whole feature is built to avoid.
 *
 * So the drawing is the LARGEST frame — the same one, in the same order, the search itself
 * tried first. Only that one: testing every frame would multiply the chances of landing inside
 * a 0.5 % window by luck, and this is the branch that speaks when everything else is silent.
 * No frame survived the three-point minimum ⇒ no defensible notion of «the drawing's size»,
 * and the honest answer is `needs-manual` rather than a guess drawn from two points.
 */
function explainAsUnitMismatch(ctx: MatchContext, frames: readonly PointCluster[]): GeoMatchResult | null {
  const drawing = frames[0];
  if (!drawing) return null;

  const localExtent = extentOf(drawing.points);
  if (localExtent <= 0) return null;

  const ratio = extentOf(ctx.worldXY) / localExtent;
  const suggested = suggestUnitScale(ratio);
  if (suggested === null || !isUnitMismatch(ratio)) return null;

  return noMatch('unit-mismatch', {
    matchable: ctx.matchable,
    scaleEstimate: ratio,
    suggestedUnitScale: suggested,
  });
}

/** Branch 3 — known correspondences from the surveyor's point numbers. */
function runPointNumberBranch(input: AutoMatchInput, ctx: MatchContext): GeoMatchResult | null {
  const nodes = ctx.all.filter((p) => p.kind === 'node' || p.kind === 'insert');
  const match = matchByPointNumber(input.entities, nodes, input.surveyPoints);
  if (!match) return null;

  if (isUnitMismatch(match.solution.scaleEstimate)) {
    return noMatch('unit-mismatch', {
      scaleEstimate: match.solution.scaleEstimate,
      suggestedUnitScale: suggestUnitScale(match.solution.scaleEstimate),
    });
  }

  return scoreAndAccept('point-number', match.solution.geo, ctx, {
    scaleEstimate: match.solution.scaleEstimate,
    layerName: dominantLayerName(nodes, ctx.layersById),
  });
}
