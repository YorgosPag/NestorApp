/**
 * TRIM CUT — SHARED HELPERS — ADR-350
 *
 * Re-usable primitives shared by every per-entity cutter:
 *   - sub-segment enumeration around parameter cuts
 *   - de-dup / sort
 *   - {@link TrimOperation} builders for shorten / split / promote / delete
 *
 * @see trim-entity-cutter.ts
 */

import type { Entity } from '../../types/entities';
import type { TrimOperation, TrimResult } from './trim-types';

export const EMPTY_RESULT: TrimResult = { operations: [] };
export const PARAM_EPSILON = 1e-6;

export function buildSegments(start: number, end: number, cuts: ReadonlyArray<number>): Array<[number, number]> {
  const bounds = [start, ...cuts, end];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < bounds.length - 1; i++) out.push([bounds[i], bounds[i + 1]]);
  return out;
}

export function findSegmentContaining(segs: ReadonlyArray<[number, number]>, t: number): number {
  for (let i = 0; i < segs.length; i++) {
    if (t >= segs[i][0] - PARAM_EPSILON && t <= segs[i][1] + PARAM_EPSILON) return i;
  }
  return -1;
}

export function dedupeSorted(arr: ReadonlyArray<number>): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(out[out.length - 1] - v) > PARAM_EPSILON) out.push(v);
  }
  return out;
}

export function deleteIfNoIntersections(
  entity: Entity,
  ts: ReadonlyArray<number>,
  mode: 'quick' | 'standard',
): TrimResult | null {
  if (ts.length > 0) return null;
  if (mode === 'quick') return { operations: [deleteOp(entity)] };
  return EMPTY_RESULT;
}

export function shortenOp(orig: Entity, newGeom: Entity): TrimOperation {
  return { kind: 'shorten', entityId: orig.id, originalGeom: orig, newGeom };
}

export function splitOp(orig: Entity, replacements: ReadonlyArray<Entity>): TrimOperation {
  return { kind: 'split', entityId: orig.id, originalGeom: orig, replacements };
}

export function promoteOp(orig: Entity, newGeom: Entity, newType: Entity['type']): TrimOperation {
  return {
    kind: 'promote',
    entityId: orig.id,
    originalType: orig.type,
    originalGeom: orig,
    newType,
    newGeom,
  };
}

export function deleteOp(orig: Entity): TrimOperation {
  return { kind: 'delete', entityId: orig.id, originalGeom: orig };
}
