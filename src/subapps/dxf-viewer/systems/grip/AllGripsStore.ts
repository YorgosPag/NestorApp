/**
 * ADR-532 B4 — All-grips SSoT (module singleton).
 *
 * Holds the full unified grip set (DXF + overlay) of the current selection. The
 * `GripRegistryPublisher` micro-leaf computes it via `useGripRegistry` (subscribed
 * to the selection set) and WRITES it here; the grip interaction hook
 * (`useUnifiedGripInteraction`) READS it at event time (mouse down/move/up
 * hit-testing) via a plain getter.
 *
 * Why a store and not a hook memo? So the grip registry can be selection-driven at
 * a LEAF (publisher) while the orchestrator (CanvasSection) — which hosts the
 * interaction hook — stays inert on selection (ADR-040 dual-access invariant, B4).
 * Mirrors the established `systems/grip/*Store.ts` pattern (ArmableGripsStore,
 * GripBasePointStore, …): React WRITES, event handlers READ via getter. No React
 * subscription here (hit-testing is event-time, never a 60fps subscription).
 *
 * @see components/dxf-layout/GripRegistryPublisher.tsx — the sole writer
 * @see hooks/grips/useUnifiedGripInteraction.ts — event-time reader
 */

import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';

const EMPTY: UnifiedGripInfo[] = [];

class AllGripsStoreImpl {
  // Consumers only read (filter/find/iterate) — never mutate — so returning the
  // stored reference (matching the former `allGrips` memo) is safe.
  private grips: UnifiedGripInfo[] = EMPTY;

  /** Publish the current unified grip set (called by GripRegistryPublisher). */
  set(grips: UnifiedGripInfo[]): void {
    this.grips = grips.length === 0 ? EMPTY : grips;
  }

  /** Read the grips at event time (grip hit-testing). */
  get(): UnifiedGripInfo[] {
    return this.grips;
  }

  /** Clear (publisher unmount). */
  clear(): void {
    this.grips = EMPTY;
  }
}

export const AllGripsStore = new AllGripsStoreImpl();
