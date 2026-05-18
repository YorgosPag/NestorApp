/**
 * ADR-363 Phase 1D — Immutable WallDna mutation helpers.
 *
 * Pure functions producing new `WallDna` snapshots from layer-level edits.
 * All helpers preserve the SSoT invariant `dna.totalThickness === sum(layers)`.
 *
 * Side-effect free, testable independently of React. The DNA editor section
 * (`WallDnaSection`) composes these into `dispatchPatch({ dna, thickness })`
 * calls — the panel never mutates DNA directly.
 */

import {
  computeTotalThickness,
  type WallDna,
  type WallDnaLayer,
  type WallLayerSide,
} from '../types/wall-dna-types';

let layerIdCounter = 0;

/** Unique synthetic layer ID for ad-hoc additions (local counter, not a Firestore enterprise ID). */
export function makeDnaLayerId(): string {
  layerIdCounter += 1;
  return `layer-${Date.now().toString(36)}-${layerIdCounter}`;
}

export interface NewLayerInput {
  readonly name?: string;
  readonly thickness?: number;
  readonly materialId?: string;
  readonly side?: WallLayerSide;
}

/**
 * Re-assemble DNA from a layer array. Recomputes `totalThickness` so the
 * SSoT invariant holds regardless of how the caller produced the layers.
 */
export function fromLayers(layers: readonly WallDnaLayer[]): WallDna {
  return { layers, totalThickness: computeTotalThickness(layers) };
}

export function addLayer(dna: WallDna, input: NewLayerInput = {}): WallDna {
  const layer: WallDnaLayer = {
    id: makeDnaLayerId(),
    name: input.name ?? 'Νέα στρώση',
    thickness: input.thickness ?? 10,
    materialId: input.materialId ?? 'mat-plaster-int',
    side: input.side ?? 'core',
  };
  return fromLayers([...dna.layers, layer]);
}

export function removeLayer(dna: WallDna, layerId: string): WallDna {
  const next = dna.layers.filter((l) => l.id !== layerId);
  if (next.length === dna.layers.length) return dna;
  return fromLayers(next);
}

export function updateLayer(
  dna: WallDna,
  layerId: string,
  patch: Partial<Omit<WallDnaLayer, 'id'>>,
): WallDna {
  const next = dna.layers.map((l) =>
    l.id === layerId ? { ...l, ...patch } : l,
  );
  return fromLayers(next);
}

/** Move layer at `index` up (-1) or down (+1). No-op at boundaries. */
export function reorderLayer(dna: WallDna, index: number, delta: -1 | 1): WallDna {
  const target = index + delta;
  if (index < 0 || index >= dna.layers.length) return dna;
  if (target < 0 || target >= dna.layers.length) return dna;
  const next = [...dna.layers];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return fromLayers(next);
}
