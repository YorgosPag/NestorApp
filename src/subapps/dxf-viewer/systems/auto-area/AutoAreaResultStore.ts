/**
 * Auto Area Result Store — module-level pub/sub (ADR-040 pattern, zero React)
 * Holds the last auto-area measurement result. Panel subscribes via useSyncExternalStore.
 */

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

let state: AutoAreaState = null;
const listeners = new Set<() => void>();

export function setAutoAreaState(next: AutoAreaState): void {
  state = next;
  listeners.forEach(fn => fn());
}

export function getAutoAreaState(): AutoAreaState {
  return state;
}

export function subscribeAutoAreaState(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearAutoAreaState(): void {
  setAutoAreaState(null);
}
