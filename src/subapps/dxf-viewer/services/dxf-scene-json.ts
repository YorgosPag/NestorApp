/**
 * ADR-358 Phase 9E-6f — Pure scene-JSON (de)serialisation helpers.
 *
 * Extracted from `dxf-firestore-storage.impl.ts` to give the parser zero
 * Firebase deps so it can be unit-tested without the heavy auth/storage
 * harness. Re-exported back from the impl for call-site stability.
 *
 * Storage contract:
 *   - Persist `SceneModel.layersById` (id-keyed SSoT post-9E-6e).
 *   - Accept legacy `parsed.layers` (name-keyed, pre-9E-6e) at load-time
 *     so files written before the refactor still hydrate cleanly.
 *
 * The fallback chain `parsed.layersById ?? parsed.layers ?? {}` was added
 * to fix the post-9E-6e regression where `parseAndValidateScene` returned
 * a SceneModel without `layersById`, which `useLevelSceneLoader` rejected
 * with `"Scene not found"` → empty scene → floorplan + any drawn entity
 * vanished after every hard refresh.
 */

import type { SceneModel } from '../types/entities';

/**
 * Parse scene JSON text into a validated SceneModel.
 * Returns null if JSON is invalid or scene is empty (placeholder `{}`).
 */
export function parseAndValidateScene(text: string): SceneModel | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const entities = parsed.entities;
    if (!Array.isArray(entities) || entities.length === 0) return null;
    return {
      entities: entities as SceneModel['entities'],
      layersById: (parsed.layersById ?? parsed.layers ?? {}) as SceneModel['layersById'],
      bounds: (parsed.bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }) as SceneModel['bounds'],
      units: (parsed.units ?? 'mm') as SceneModel['units'],
    };
  } catch {
    return null;
  }
}
