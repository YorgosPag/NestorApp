import type { SceneLayer } from '../types/entities';

/** AIA-friendly name hints for construction/reference layers (case-insensitive). */
export const CONSTRUCTION_LAYER_NAME_HINTS = ['construction', 'construct', 'cons', 'aux'] as const;
type NameHint = typeof CONSTRUCTION_LAYER_NAME_HINTS[number];

/** Returns true if any layer in the set already looks like a construction layer. */
export function hasConstructionLayer(layers: ReadonlyArray<SceneLayer>): boolean {
  return layers.some(l =>
    CONSTRUCTION_LAYER_NAME_HINTS.includes(l.name.toLowerCase() as NameHint)
  );
}
