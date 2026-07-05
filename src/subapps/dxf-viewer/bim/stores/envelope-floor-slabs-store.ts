/**
 * envelope-floor-slabs-store — non-React SSoT for the cross-floor slab data the
 * ETICS thermal envelope needs to tell an **atrium** (open to sky) apart from an
 * **interior room** (covered by a slab above).
 *
 * ADR-396 v2 Phase 5C. Plain module store (mirror of {@link ../../bim-3d/scene/multi-floor-3d-source}
 * / {@link envelope-spec-store}): zero React state so non-React subscribers
 * (`use-bim3d-vg-resync` → `resyncBimScene`) and event-time readers (3D
 * `BimSceneLayer`, BOQ sync) can read the current snapshot synchronously, while
 * the 2D micro-leaf `EnvelopeOverlay` consumes it via `useSyncExternalStore`
 * (ADR-040 compliant — only leaves subscribe).
 *
 * The producer is {@link ../../hooks/data/useEnvelopeFloorSlabs} (gathers every
 * floor's slabs of the active building, mirror of `useFloors3DAggregator`); the
 * consumers resolve "slabs above the current floor" via
 * `resolveSlabsAboveForLevel(snap.slabs, snap.floors, snap.activeFloorId)` so all
 * paths share EXACTLY one definition of "slab above" → guaranteed 2D⟷3D parity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1.5
 */

import type { StoreyRef } from '../utils/bim-floor-utils';
import type { SlabForRegionCoverage } from '../geometry/footprint-region-classifier';
import { createExternalStore } from '../../stores/createExternalStore';

/** Snapshot of the active building's floors + their slabs (canvas-unit outlines). */
export interface EnvelopeFloorSlabs {
  /** Every floor of the active building (id + elevation in METRES, ADR-369). */
  readonly floors: readonly StoreyRef[];
  /** Slabs of ALL floors (with `params.outline` + storey FK for elevation). */
  readonly slabs: readonly SlabForRegionCoverage[];
  /** Floor id of the currently edited level (the shell being built), or null. */
  readonly activeFloorId: string | null;
}

const EMPTY: EnvelopeFloorSlabs = { floors: [], slabs: [], activeFloorId: null };

// Identity-guarded store (`equals: Object.is` = το παλιό `if (next === snapshot) return`).
const store = createExternalStore<EnvelopeFloorSlabs>(EMPTY, { equals: Object.is });

/** Current cross-floor slab snapshot (stable ref until the next set). */
export function getEnvelopeFloorSlabs(): EnvelopeFloorSlabs {
  return store.get();
}

/** Replace the snapshot and notify subscribers (idempotent on identity). */
export function setEnvelopeFloorSlabs(next: EnvelopeFloorSlabs): void {
  store.set(next);
}

/** Subscribe to snapshot replacements. Returns an unsubscribe fn. */
export function subscribeEnvelopeFloorSlabs(fn: () => void): () => void {
  return store.subscribe(fn);
}

/** Test-only reset (silent state reset + drop subscribers). */
export function __resetEnvelopeFloorSlabsStore(): void {
  store.reset(EMPTY);
}
