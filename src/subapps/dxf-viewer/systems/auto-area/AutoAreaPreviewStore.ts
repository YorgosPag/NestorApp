/**
 * Module-level pub/sub store for auto-area hover preview polygon.
 * Same pattern as HoverStore, ImmediatePositionStore (ADR-040).
 */

import type { Point2D } from '../../rendering/types/Types';

export interface AutoAreaPreview {
  polygon: Point2D[];
  holes: Point2D[][];
}

let state: AutoAreaPreview | null = null;
const listeners = new Set<() => void>();

export function setAutoAreaPreview(next: AutoAreaPreview | null): void {
  state = next;
  listeners.forEach(fn => fn());
}

export function getAutoAreaPreview(): AutoAreaPreview | null {
  return state;
}

export function subscribeAutoAreaPreview(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearAutoAreaPreview(): void {
  setAutoAreaPreview(null);
}
