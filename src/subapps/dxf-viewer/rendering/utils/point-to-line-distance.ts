import type { Point2D } from '../types/Types';

const DEGENERATE_THRESHOLD = 1e-10;

export function pointToInfiniteLineDistance(p: Point2D, base: Point2D, dir: Point2D): number {
  const lenSq = dir.x * dir.x + dir.y * dir.y;
  if (lenSq < DEGENERATE_THRESHOLD * DEGENERATE_THRESHOLD) return Infinity;

  const dx = p.x - base.x;
  const dy = p.y - base.y;
  const cross = dx * dir.y - dy * dir.x;
  return Math.abs(cross) / Math.sqrt(lenSq);
}

export function pointToRayDistance(p: Point2D, base: Point2D, dir: Point2D): number {
  const lenSq = dir.x * dir.x + dir.y * dir.y;
  if (lenSq < DEGENERATE_THRESHOLD * DEGENERATE_THRESHOLD) return Infinity;

  const dx = p.x - base.x;
  const dy = p.y - base.y;
  const t = (dx * dir.x + dy * dir.y) / lenSq;

  if (t < 0) {
    return Math.sqrt(dx * dx + dy * dy);
  }

  const cross = dx * dir.y - dy * dir.x;
  return Math.abs(cross) / Math.sqrt(lenSq);
}
