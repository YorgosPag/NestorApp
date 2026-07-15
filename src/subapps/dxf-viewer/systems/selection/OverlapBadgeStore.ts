/**
 * OverlapBadgeStore — ADR-659 D4 (AutoCAD Selection Cycling badge).
 *
 * Zero-React single-value store (SSoT `createExternalStore`). Holds the count of entities
 * stacked under the cursor + the client anchor for the «⧉ N» badge. Written ONLY from the
 * hover seam (throttled, and only when the top-1 hit-test already found an entity), consumed
 * by the `OverlapCountBadge` micro-leaf (ADR-040).
 *
 * The `equals` guard makes both bail-outs free: counts <2 normalize to the single HIDDEN
 * snapshot (hovering empty space or a lone entity costs zero re-renders), and repeated writes
 * of the same count+anchor are suppressed. A stable snapshot is returned so
 * `useSyncExternalStore` never loops.
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

export interface OverlapBadgeState {
  /** Number of entities under the cursor. <2 → badge hidden. */
  readonly count: number;
  /** Page-level client anchor for the badge. */
  readonly clientX: number;
  readonly clientY: number;
}

const HIDDEN: OverlapBadgeState = { count: 0, clientX: 0, clientY: 0 };

const store = createExternalStore<OverlapBadgeState>(HIDDEN, {
  equals: (a, b) => a.count === b.count && a.clientX === b.clientX && a.clientY === b.clientY,
});

/**
 * Publish the overlap count + anchor. Counts <2 normalize to the shared HIDDEN snapshot,
 * so the `equals` guard collapses repeated hides/idempotent writes to zero re-renders.
 */
export function setOverlapBadge(count: number, clientX: number, clientY: number): void {
  store.set(count < 2 ? HIDDEN : { count, clientX, clientY });
}

export function clearOverlapBadge(): void {
  store.set(HIDDEN);
}

export const getOverlapBadgeSnapshot = store.get;
export const subscribeOverlapBadge = store.subscribe;
