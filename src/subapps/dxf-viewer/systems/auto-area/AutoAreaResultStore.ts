/**
 * Auto Area Result Store — module-level pub/sub (ADR-040 pattern, zero React)
 * Holds the last auto-area measurement result. Panel subscribes via useSyncExternalStore.
 */

import { createExternalStore } from '../../stores/createExternalStore';

export type AutoAreaSource = 'dxf-polyline' | 'overlay';

export interface AutoAreaResult {
  found: true;
  area: number;       // gross area (outer polygon)
  netArea: number;    // area minus subtracted holes
  holesCount: number;
  holesArea: number;
  perimeter: number;
  source: AutoAreaSource;
  layerName?: string;
  screenX: number;
  screenY: number;
}

export interface AutoAreaEmpty {
  found: false;
  screenX: number;
  screenY: number;
}

export type AutoAreaState = AutoAreaResult | AutoAreaEmpty | null;

// SSoT pub/sub machinery via `createExternalStore` (always-notify). Public API identical.
const store = createExternalStore<AutoAreaState>(null);

export function setAutoAreaState(next: AutoAreaState): void {
  store.set(next);
}

export function getAutoAreaState(): AutoAreaState {
  return store.get();
}

export function subscribeAutoAreaState(fn: () => void): () => void {
  return store.subscribe(fn);
}

export function clearAutoAreaState(): void {
  store.set(null);
}
