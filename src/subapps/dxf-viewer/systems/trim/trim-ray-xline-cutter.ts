/**
 * TRIM CUT — RAY / XLINE — ADR-350
 *
 * Pure cut functions for infinite-extent line entities (RAY = semi-infinite,
 * XLINE = infinite both directions). Both promote to LINE or RAY depending
 * on which sub-piece survives the trim.
 *
 * @see trim-entity-cutter.ts for the dispatcher.
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  type Entity,
  type LineEntity,
  type RayEntity,
  type XLineEntity,
} from '../../types/entities';
import type { TrimResult } from './trim-types';
import {
  deleteOp,
  EMPTY_RESULT,
  promoteOp,
  shortenOp,
  splitOp,
} from './trim-cut-shared';
import type { CutContext } from './trim-line-arc-cutter';

// ── RAY ───────────────────────────────────────────────────────────────────────

export function cutRay(ray: RayEntity, ctx: CutContext): TrimResult {
  const { ux, uy, proj } = projector(ray.basePoint, ray.direction);
  const ts = ctx.intersections.map(proj).filter((t) => t > 0).sort((a, b) => a - b);
  const pickT = proj(ctx.pickPoint);

  if (ts.length === 0) return ctx.mode === 'quick' ? { operations: [deleteOp(ray)] } : EMPTY_RESULT;

  if (ts.length === 1) return cutRaySingle(ray, ts[0], pickT, ux, uy);

  const bounds = [0, ...ts, Infinity];
  const idx = findIntervalIndex(bounds, pickT);
  if (idx < 0) return EMPTY_RESULT;
  const remaining = pairwiseRemaining(bounds, idx);
  const replacements: Entity[] = remaining.map((r) => rayPieceToEntity(ray, ux, uy, r, ctx.newId));
  if (replacements.length === 1) return { operations: [shortenOp(ray, replacements[0])] };
  return { operations: [splitOp(ray, replacements)] };
}

function cutRaySingle(ray: RayEntity, cut: number, pickT: number, ux: number, uy: number): TrimResult {
  const cutPt: Point2D = { x: ray.basePoint.x + cut * ux, y: ray.basePoint.y + cut * uy };
  if (pickT < cut) {
    // Pick on base-side → keep ray from cut onwards.
    return { operations: [shortenOp(ray, { ...ray, basePoint: cutPt })] };
  }
  // Pick on infinite side → result is finite LINE from base to cut.
  const line: LineEntity = {
    id: ray.id,
    type: 'line',
    start: ray.basePoint,
    end: cutPt,
    layer: ray.layer,
    visible: ray.visible,
  };
  return { operations: [promoteOp(ray, line, 'line')] };
}

function rayPieceToEntity(
  ray: RayEntity,
  ux: number,
  uy: number,
  [t0, t1]: [number, number],
  newId: () => string,
): Entity {
  const p0: Point2D = { x: ray.basePoint.x + t0 * ux, y: ray.basePoint.y + t0 * uy };
  if (t1 === Infinity) return { ...ray, id: newId(), basePoint: p0 };
  const p1: Point2D = { x: ray.basePoint.x + t1 * ux, y: ray.basePoint.y + t1 * uy };
  return {
    id: newId(),
    type: 'line',
    start: p0,
    end: p1,
    layer: ray.layer,
    visible: ray.visible,
  } as LineEntity;
}

// ── XLINE ─────────────────────────────────────────────────────────────────────

export function cutXLine(xl: XLineEntity, ctx: CutContext): TrimResult {
  const { ux, uy, proj } = projector(xl.basePoint, xl.direction);
  const ts = ctx.intersections.map(proj).sort((a, b) => a - b);
  const pickT = proj(ctx.pickPoint);

  if (ts.length === 0) return ctx.mode === 'quick' ? { operations: [deleteOp(xl)] } : EMPTY_RESULT;

  const bounds = [-Infinity, ...ts, Infinity];
  const idx = findIntervalIndex(bounds, pickT);
  if (idx < 0) return EMPTY_RESULT;
  const remaining = pairwiseRemaining(bounds, idx);
  const replacements: Entity[] = remaining.map((r) => xlPieceToEntity(xl, ux, uy, r, ctx.newId));
  if (replacements.length === 1) return { operations: [promoteOp(xl, replacements[0], replacements[0].type)] };
  return { operations: [splitOp(xl, replacements)] };
}

function xlPieceToEntity(
  xl: XLineEntity,
  ux: number,
  uy: number,
  [t0, t1]: [number, number],
  newId: () => string,
): Entity {
  if (t0 === -Infinity && t1 === Infinity) return { ...xl, id: newId() };
  if (t0 === -Infinity) {
    const p1: Point2D = { x: xl.basePoint.x + t1 * ux, y: xl.basePoint.y + t1 * uy };
    return {
      id: newId(),
      type: 'ray',
      basePoint: p1,
      direction: { x: -ux, y: -uy },
      layer: xl.layer,
      visible: xl.visible,
    } as RayEntity;
  }
  if (t1 === Infinity) {
    const p0: Point2D = { x: xl.basePoint.x + t0 * ux, y: xl.basePoint.y + t0 * uy };
    return {
      id: newId(),
      type: 'ray',
      basePoint: p0,
      direction: { x: ux, y: uy },
      layer: xl.layer,
      visible: xl.visible,
    } as RayEntity;
  }
  const p0: Point2D = { x: xl.basePoint.x + t0 * ux, y: xl.basePoint.y + t0 * uy };
  const p1: Point2D = { x: xl.basePoint.x + t1 * ux, y: xl.basePoint.y + t1 * uy };
  return {
    id: newId(),
    type: 'line',
    start: p0,
    end: p1,
    layer: xl.layer,
    visible: xl.visible,
  } as LineEntity;
}

// ── Shared ────────────────────────────────────────────────────────────────────

function projector(base: Point2D, dir: Point2D): { ux: number; uy: number; proj: (p: Point2D) => number } {
  const dlen = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / dlen;
  const uy = dir.y / dlen;
  const proj = (p: Point2D): number => (p.x - base.x) * ux + (p.y - base.y) * uy;
  return { ux, uy, proj };
}

function findIntervalIndex(bounds: ReadonlyArray<number>, t: number): number {
  for (let i = 0; i < bounds.length - 1; i++) {
    if (t >= bounds[i] && t < bounds[i + 1]) return i;
  }
  return -1;
}

function pairwiseRemaining(bounds: ReadonlyArray<number>, skipIdx: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    if (i !== skipIdx) out.push([bounds[i], bounds[i + 1]]);
  }
  return out;
}
