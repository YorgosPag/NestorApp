/**
 * Module-level pub/sub store for auto-area hover preview polygon.
 * Same pattern as HoverStore, ImmediatePositionStore (ADR-040).
 */

import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

export interface AutoAreaPreview {
  polygon: Point2D[];
  holes: Point2D[][];
}

// SSoT pub/sub machinery via `createExternalStore` (always-notify — no equality guard,
// matching the previous hand-rolled behaviour). Public API kept identical.
const store = createExternalStore<AutoAreaPreview | null>(null);

export function setAutoAreaPreview(next: AutoAreaPreview | null): void {
  store.set(next);
}

export function getAutoAreaPreview(): AutoAreaPreview | null {
  return store.get();
}

export function subscribeAutoAreaPreview(fn: () => void): () => void {
  return store.subscribe(fn);
}

export function clearAutoAreaPreview(): void {
  store.set(null);
}
