/**
 * ADR-650 §M10e — CANDIDATE POINTS: the drawing's stable feature points, in local mm.
 *
 * The matcher compares a drawing against a survey CSV. The CSV holds SURVEYED NODES — the
 * points an instrument actually occupied. So the drawing side must contribute the same kind
 * of thing: positions a surveyor would recognise as a measured point, not samples of a curve.
 *
 * ## Why `entityToPolylines` (ADR-652 M4) is NOT reused here — deliberate, measured
 * That module is the SSoT for «this entity's SHAPE as points», and it is the wrong question:
 *   1. It returns `[]` for `point` — the single most important source we have (562 POINT
 *      entities in the reference file, all 93 CSV points among them).
 *   2. It TESSELLATES arcs / circles / ellipses / splines. A 12°-per-segment circle would
 *      contribute 30 synthetic positions that correspond to nothing in the survey, that move
 *      when `arcSegmentDeg` changes, and that dilute the inlier ratio the acceptance gate
 *      divides by. A matcher fed samples of a curve is measuring its own tessellation.
 * Same entity, different question, different answer — so this is not the sibling clone that
 * N.18 forbids. A circle here yields its CENTRE (a surveyor's nail is drawn as a circle),
 * never its outline.
 *
 * ## Coordinate frame
 * Everything returned is LOCAL canonical mm — exactly the frame the scene entities live in,
 * i.e. the frame `GeoReference.localToWorld` consumes. No normalisation, no re-centring.
 *
 * Pure module — zero React/DOM/store deps, fully deterministic.
 *
 * @see ./geo-point-clusters.ts — splits these into coordinate frames
 * @see ./geo-congruent-match.ts — the search that consumes the basis sample
 * @see ../../rendering/entities/shared/entity-polylines.ts — the shape SSoT, and why not it
 */

import type { Entity } from '../../types/entities';
import type { SceneLayer } from '../../types/scene-types';

/**
 * What kind of drawing feature produced a candidate. The order of this union is the
 * PRIORITY order used when a huge drawing must be capped — see {@link selectBasisSample}.
 */
export type CandidateKind = 'node' | 'insert' | 'vertex' | 'centre';

/** One drawing feature point, LOCAL canonical mm, tagged with its origin. */
export interface LocalCandidatePoint {
  readonly x: number;
  readonly y: number;
  /** `BaseEntity.layerId` (`lyr_<UUID>`) of the entity it came from. */
  readonly layerId: string;
  readonly kind: CandidateKind;
}

export interface CandidatePointOptions {
  /**
   * Hard ceiling on the returned set. Reached only by drawings with tens of thousands of
   * polyline vertices; the reference survey produces ~1.5k and never trims. Default 20 000.
   */
  readonly maxPoints?: number;
  /** Include polyline/line vertices, not just nodes. Default `true` — plot corners ARE survey points. */
  readonly includeVertices?: boolean;
}

const DEFAULT_MAX_POINTS = 20_000;

/** Priority when capping: the more «surveyed» a kind is, the later it is dropped. */
const KIND_PRIORITY: Readonly<Record<CandidateKind, number>> = {
  node: 0,
  insert: 1,
  vertex: 2,
  centre: 3,
};

function push(out: LocalCandidatePoint[], x: number, y: number, layerId: string, kind: CandidateKind): void {
  // A non-finite coordinate would poison every distance and every grid cell downstream.
  if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y, layerId, kind });
}

/**
 * The feature points of ONE entity. Anything without a surveyed-node interpretation
 * (text, dimensions, hatches, BIM composites) contributes nothing — silence is the correct
 * answer, not an invented position.
 */
function collectFromEntity(entity: Entity, out: LocalCandidatePoint[], includeVertices: boolean): void {
  const layerId = entity.layerId;

  switch (entity.type) {
    case 'point':
      push(out, entity.position.x, entity.position.y, layerId, 'node');
      return;

    // A block INSERT marks a surveyed feature at its INSERTION point (tree, manhole, benchmark).
    // Its expanded geometry is symbol draughting — the insertion point is the measurement.
    case 'block':
      push(out, entity.position.x, entity.position.y, layerId, 'insert');
      return;

    case 'circle':
    case 'arc':
      push(out, entity.center.x, entity.center.y, layerId, 'centre');
      return;

    case 'line':
      if (!includeVertices) return;
      push(out, entity.start.x, entity.start.y, layerId, 'vertex');
      push(out, entity.end.x, entity.end.y, layerId, 'vertex');
      return;

    case 'polyline':
    case 'lwpolyline':
      if (!includeVertices) return;
      // RAW vertices only. A bulged segment's arc is draughting between two surveyed corners;
      // the corners are the measurements, the arc's interior is not.
      for (const v of entity.vertices) push(out, v.x, v.y, layerId, 'vertex');
      return;

    default:
      return;
  }
}

/**
 * Keep every `stride`-th element so a capped set still spans the whole drawing.
 *
 * Deterministic by construction — no PRNG, seeded or otherwise (a matcher that answers
 * differently on a second click is not a tool, it is a rumour). Truncation was rejected: DXF
 * entity order is authoring order, so «the first N» is typically one corner of the site.
 *
 * Exported because the orchestrator caps the SURVEY side too (a 2 M-point cloud cannot go
 * into a pairwise table); a second copy of these four lines is exactly the sibling clone
 * N.18 exists to prevent.
 */
export function strideSample<T>(items: readonly T[], keep: number): T[] {
  if (items.length <= keep) return [...items];
  const stride = items.length / keep;
  const out: T[] = [];
  for (let i = 0; out.length < keep && Math.floor(i) < items.length; i += stride) {
    out.push(items[Math.floor(i)]!);
  }
  return out;
}

/**
 * Every stable feature point of `entities`, LOCAL canonical mm.
 *
 * When the drawing exceeds `maxPoints` the least survey-like kinds are dropped FIRST
 * (vertices and circle centres before nodes and inserts), and only the kind that straddles
 * the ceiling is stride-sampled. A 50 000-vertex site plan therefore still contributes all
 * of its POINT entities — which is where a survey CSV's twins actually live.
 */
export function collectCandidatePoints(
  entities: readonly Entity[],
  options: CandidatePointOptions = {},
): readonly LocalCandidatePoint[] {
  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS;
  const includeVertices = options.includeVertices ?? true;

  const all: LocalCandidatePoint[] = [];
  for (const entity of entities) collectFromEntity(entity, all, includeVertices);
  if (all.length <= maxPoints) return all;

  return capByKindPriority(all, maxPoints);
}

/** Fill the budget kind by kind in priority order; stride-sample only the kind that overflows. */
function capByKindPriority(all: readonly LocalCandidatePoint[], budget: number): LocalCandidatePoint[] {
  const byKind = new Map<CandidateKind, LocalCandidatePoint[]>();
  for (const p of all) {
    const bucket = byKind.get(p.kind);
    if (bucket) bucket.push(p);
    else byKind.set(p.kind, [p]);
  }

  const kinds = [...byKind.keys()].sort((a, b) => KIND_PRIORITY[a] - KIND_PRIORITY[b]);
  const out: LocalCandidatePoint[] = [];
  for (const kind of kinds) {
    const remaining = budget - out.length;
    if (remaining <= 0) break;
    out.push(...strideSample(byKind.get(kind)!, remaining));
  }
  return out;
}

/**
 * The subset used to ENUMERATE bases in the geometric search — a much tighter budget than
 * the scoring set, because the search cost grows with the SQUARE of this size while the
 * scoring cost grows only linearly.
 *
 * The split matters: search over the most survey-like points, but always VERIFY over
 * everything ({@link collectCandidatePoints}'s full output). A hypothesis found from 562
 * nodes is still scored against all 1 500 candidates, so the reported inlier count is honest.
 */
export function selectBasisSample(
  points: readonly LocalCandidatePoint[],
  cap: number,
): readonly LocalCandidatePoint[] {
  return points.length <= cap ? points : capByKindPriority(points, cap);
}

/**
 * Display name of the layer that contributed most of `points` — what the proof card names
 * («ταυτίστηκε στο layer VT_POINT»). `null` when the set is empty or the layer is unknown.
 *
 * Uses the CURRENT name rather than `SceneLayer.sourceName`: this string is shown to a human
 * who is looking at the layer panel, where the current name is what they see.
 */
export function dominantLayerName(
  points: readonly LocalCandidatePoint[],
  layersById: Readonly<Record<string, SceneLayer>>,
): string | null {
  const tally = new Map<string, number>();
  for (const p of points) tally.set(p.layerId, (tally.get(p.layerId) ?? 0) + 1);

  let bestId: string | null = null;
  let bestCount = 0;
  // Ascending insertion order with a strict `>` keeps ties resolving to the first-seen layer.
  for (const [layerId, count] of tally) {
    if (count > bestCount) {
      bestCount = count;
      bestId = layerId;
    }
  }
  return bestId ? (layersById[bestId]?.name ?? null) : null;
}
