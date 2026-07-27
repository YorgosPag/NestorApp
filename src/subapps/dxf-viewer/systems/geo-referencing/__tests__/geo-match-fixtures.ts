/**
 * ADR-650 §M10e — shared fixtures for the auto-match tests.
 *
 * Every generator here is SEEDED (`createPrng`, ADR-353 — the app's only PRNG). A registration
 * test whose fixture is `Math.random` passes and fails for reasons nobody can reproduce, and
 * this whole feature's promise is that the same files always give the same answer.
 *
 * Coordinates are canonical mm throughout, at realistic ΕΓΣΑ'87 magnitudes (~4.5e9 mm), because
 * float64 precision is a genuine failure mode at that scale and a fixture centred on the origin
 * would never exercise it.
 */

import { createPrng } from '../../../utils/seeded-prng';
import type { Entity, PointEntity, TextEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { TopoPoint } from '../../topography/topo-types';
import { createSceneLayer, type SceneLayer } from '../../../types/scene-types';

/** A plausible ΕΓΣΑ'87 origin in canonical mm — the real reference file's own offset. */
export const EGSA_ORIGIN: Point2D = { x: 407_700_000, y: 4_502_400_000 };

export const LAYER_ID = 'lyr_test_survey';
export const LAYER_NAME = 'VT_POINT';

/** Built through the `SceneLayer` SSoT factory (ADR-358 §5.1) — never a hand-rolled literal. */
export const LAYERS: Readonly<Record<string, SceneLayer>> = {
  [LAYER_ID]: createSceneLayer({ id: LAYER_ID, name: LAYER_NAME }),
  lyr_other: createSceneLayer({ id: 'lyr_other', name: 'Defpoints' }),
};

/** `count` points scattered over a `spanMm` square, deterministic for a given `seed`. */
export function scatter(count: number, spanMm: number, seed: number, origin: Point2D = { x: 0, y: 0 }): Point2D[] {
  const rng = createPrng(seed);
  const out: Point2D[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: origin.x + rng() * spanMm, y: origin.y + rng() * spanMm });
  }
  return out;
}

/** Rotate `p` by `deg` about the origin, then translate — the ground truth the matcher must recover. */
export function place(p: Point2D, deg: number, translate: Point2D): Point2D {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s + translate.x, y: p.x * s + p.y * c + translate.y };
}

/** Add deterministic symmetric noise of up to `amplitudeMm` to every point. */
export function jitter(points: readonly Point2D[], amplitudeMm: number, seed: number): Point2D[] {
  const rng = createPrng(seed);
  return points.map((p) => ({
    x: p.x + (rng() * 2 - 1) * amplitudeMm,
    y: p.y + (rng() * 2 - 1) * amplitudeMm,
  }));
}

/**
 * `points` with its bounding box pinned to exactly `[0, spanMm]²`.
 *
 * A scatter of n samples spans slightly less than `spanMm` by an amount that depends on the
 * seed, so a test that needs an EXACT extent ratio (the unit-mismatch fallback is judged
 * within half a percent) cannot rely on the scatter alone. Two corner points make the extent
 * arithmetic exact and seed-independent, which is what turns «it happened to pass» into a
 * statement about the code.
 */
export function pinnedToSquare(points: readonly Point2D[], spanMm: number): Point2D[] {
  return [...points, { x: 0, y: 0 }, { x: spanMm, y: spanMm }];
}

/**
 * A small square of four points at `origin` — a legend, a detail or geometry pasted from
 * another drawing, i.e. a SECOND coordinate frame. Four (not two) so it survives the
 * three-point minimum of `splitByCoordinateFrame` and is genuinely tried as a frame.
 */
export function insetFrame(origin: Point2D, sizeMm: number): Point2D[] {
  return [
    { x: origin.x, y: origin.y },
    { x: origin.x + sizeMm, y: origin.y },
    { x: origin.x, y: origin.y + sizeMm },
    { x: origin.x + sizeMm, y: origin.y + sizeMm },
  ];
}

/** A DXF POINT entity at `p`, on `layerId`. */
export function pointEntity(p: Point2D, i: number, layerId = LAYER_ID): PointEntity {
  return { id: `pt_${layerId}_${i}`, type: 'point', layerId, position: { x: p.x, y: p.y } };
}

/** A DXF TEXT entity carrying `text`, offset from `p` by `offsetMm` (labels never sit on their point). */
export function labelEntity(p: Point2D, text: string, i: number, offsetMm = 1_200): TextEntity {
  return {
    id: `tx_${i}`,
    type: 'text',
    layerId: LAYER_ID,
    position: { x: p.x + offsetMm, y: p.y + offsetMm },
    text,
  };
}

export function pointEntities(points: readonly Point2D[], layerId = LAYER_ID): Entity[] {
  return points.map((p, i) => pointEntity(p, i, layerId));
}

/** Survey points in WORLD mm, optionally numbered `1..n` the way a CSV column would be. */
export function surveyPoints(points: readonly Point2D[], numbered = false): TopoPoint[] {
  return points.map((p, i) => ({
    x: p.x,
    y: p.y,
    z: 0,
    ...(numbered ? { pointNumber: String(i + 1) } : {}),
  }));
}
