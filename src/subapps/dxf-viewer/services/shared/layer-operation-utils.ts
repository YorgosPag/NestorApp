/**
 * Layer operation utilities
 * Shared patterns for layer operations
 *
 * ADR-129: Layer Entity Filtering Centralization
 * - Single source of truth for entity-layer filtering operations
 * - Null-safe layer checks
 * - Consistent visibility patterns
 */

import { SceneModel, AnySceneEntity, SceneLayer } from '../../types/scene';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName } from '../../stores/LayerStore';

/**
 * Resolve entity layer name: LayerStore id-first, then legacy `entity.layer` fallback.
 * The fallback handles test environments where LayerStore is not pre-populated and
 * transition-window entities that still carry the deprecated `layer` name field.
 * ADR-358 Phase 9D→9E: remove fallback after Phase 9E-6 drops `entity.layer`.
 */
function resolveLayerName(entity: AnySceneEntity): string | undefined {
  return resolveEntityLayerName(entity) ?? (entity as { layer?: string }).layer;
}

// ADR-358 Phase 9E-5: rebuild layersById mirror after any mutation to scene.layers.
export function rebuildLayersById(layers: Record<string, SceneLayer>): Record<string, SceneLayer> {
  return Object.fromEntries(Object.values(layers).map((l) => [l.id, l]));
}

export function withLayersById(scene: SceneModel): SceneModel {
  return { ...scene, layersById: rebuildLayersById(scene.layers) };
}

export interface LayerOperationResult {
  updatedScene: SceneModel;
  affectedEntityIds?: string[];
  success: boolean;
  message?: string;
}

/**
 * Validate layer exists and return error if not
 */
export function validateLayerExists(
  layerName: string,
  scene: SceneModel
): LayerOperationResult | null {
  if (!scene.layers[layerName]) {
    return {
      updatedScene: scene,
      success: false,
      message: `Layer "${layerName}" does not exist`
    };
  }
  return null;
}

/**
 * Update layer properties - eliminates duplicate layer update patterns
 */
export function updateLayerProperties(
  layerName: string,
  properties: Partial<{ color: string; visible: boolean; frozen: boolean }>,
  scene: SceneModel
): SceneModel {
  const updatedLayers = {
    ...scene.layers,
    [layerName]: { ...scene.layers[layerName], ...properties }
  };
  return {
    ...scene,
    layers: updatedLayers,
    layersById: rebuildLayersById(updatedLayers),
  };
}

/**
 * Update entities when layer properties change
 */
export function updateEntitiesForLayer(
  scene: SceneModel,
  layerName: string,
  entityUpdates: Partial<{ visible: boolean; color: string }>
): SceneModel {
  return {
    ...scene,
    entities: scene.entities.map(entity => {
      // ADR-358 Phase 9D-3: id-first match via LayerStore, name fallback
      if (resolveEntityLayerName(entity) === layerName) {
        return { ...entity, ...entityUpdates };
      }
      return entity;
    })
  };
}

// ============================================================================
// ADR-129: ENTITY LAYER FILTERING UTILITIES
// Centralized, null-safe entity filtering by layer(s)
// ============================================================================

/**
 * Check if entity belongs to a specific layer (null-safe)
 */
export function entityBelongsToLayer(
  entity: AnySceneEntity,
  layerName: string
): boolean {
  return resolveLayerName(entity) === layerName;
}

/**
 * Check if entity belongs to any of the specified layers (null-safe)
 */
export function entityBelongsToLayers(
  entity: AnySceneEntity,
  layerNames: string[]
): boolean {
  const name = resolveLayerName(entity);
  return name != null && layerNames.includes(name);
}

/**
 * Check if entity is visible (entity.visible !== false)
 */
export function isEntityVisible(entity: AnySceneEntity): boolean {
  return entity.visible !== false;
}

// === SINGLE LAYER OPERATIONS ===

/**
 * Get entities belonging to a specific layer
 * @param entities - Array of scene entities
 * @param layerName - Target layer name
 * @returns Entities in the specified layer
 */
export function getEntitiesByLayer(
  entities: AnySceneEntity[],
  layerName: string
): AnySceneEntity[] {
  return entities.filter(entity => entityBelongsToLayer(entity, layerName));
}

/**
 * Get entity IDs belonging to a specific layer
 * @param entities - Array of scene entities
 * @param layerName - Target layer name
 * @returns Entity IDs in the specified layer
 */
export function getEntityIdsByLayer(
  entities: AnySceneEntity[],
  layerName: string
): string[] {
  return entities
    .filter(entity => entityBelongsToLayer(entity, layerName))
    .map(entity => entity.id);
}

/**
 * Count entities in a layer
 * @param entities - Array of scene entities
 * @param layerName - Target layer name
 * @returns Number of entities in the layer
 */
export function countEntitiesInLayer(
  entities: AnySceneEntity[],
  layerName: string
): number {
  return entities.filter(entity => entityBelongsToLayer(entity, layerName)).length;
}

// === MULTI LAYER OPERATIONS ===

/**
 * Get entities belonging to any of the specified layers
 * @param entities - Array of scene entities
 * @param layerNames - Array of target layer names
 * @returns Entities in any of the specified layers
 */
export function getEntitiesByLayers(
  entities: AnySceneEntity[],
  layerNames: string[]
): AnySceneEntity[] {
  return entities.filter(entity => entityBelongsToLayers(entity, layerNames));
}

/**
 * Get entity IDs belonging to any of the specified layers
 * @param entities - Array of scene entities
 * @param layerNames - Array of target layer names
 * @returns Entity IDs in any of the specified layers
 */
export function getEntityIdsByLayers(
  entities: AnySceneEntity[],
  layerNames: string[]
): string[] {
  return entities
    .filter(entity => entityBelongsToLayers(entity, layerNames))
    .map(entity => entity.id);
}

// === WITH VISIBILITY CHECKS ===

/**
 * Get visible entities in a layer (entity.visible !== false)
 * @param entities - Array of scene entities
 * @param layerName - Target layer name
 * @returns Visible entities in the specified layer
 */
export function getVisibleEntitiesByLayer(
  entities: AnySceneEntity[],
  layerName: string
): AnySceneEntity[] {
  return entities.filter(
    entity => entityBelongsToLayer(entity, layerName) && isEntityVisible(entity)
  );
}

/**
 * Get visible entity IDs in a layer
 * @param entities - Array of scene entities
 * @param layerName - Target layer name
 * @returns Visible entity IDs in the specified layer
 */
export function getVisibleEntityIdsByLayer(
  entities: AnySceneEntity[],
  layerName: string
): string[] {
  return entities
    .filter(entity => entityBelongsToLayer(entity, layerName) && isEntityVisible(entity))
    .map(entity => entity.id);
}

/**
 * Get visible entity IDs in multiple layers
 * @param entities - Array of scene entities
 * @param layerNames - Array of target layer names
 * @returns Visible entity IDs in any of the specified layers
 */
export function getVisibleEntityIdsByLayers(
  entities: AnySceneEntity[],
  layerNames: string[]
): string[] {
  return entities
    .filter(entity => entityBelongsToLayers(entity, layerNames) && isEntityVisible(entity))
    .map(entity => entity.id);
}

/**
 * Get visible entity IDs in layers with layer visibility check
 * Checks both entity.visible and layer.visible
 * @param entities - Array of scene entities
 * @param layers - Layer definitions with visibility
 * @param layerNames - Array of target layer names
 * @returns Visible entity IDs (both entity and layer must be visible)
 */
export function getVisibleEntityIdsInLayers(
  entities: AnySceneEntity[],
  layers: Record<string, { visible?: boolean }>,
  layerNames: string[]
): string[] {
  return entities
    .filter(entity => {
      if (!entityBelongsToLayers(entity, layerNames)) return false;
      if (!isEntityVisible(entity)) return false;
      const name = resolveLayerName(entity);
      const layerVisible = name != null && layers[name]?.visible !== false;
      return layerVisible;
    })
    .map(entity => entity.id);
}

// === ENTITY EXCLUSION OPERATIONS ===

/**
 * Get entities NOT in a specific layer
 * @param entities - Array of scene entities
 * @param layerName - Layer to exclude
 * @returns Entities not in the specified layer
 */
export function getEntitiesNotInLayer(
  entities: AnySceneEntity[],
  layerName: string
): AnySceneEntity[] {
  return entities.filter(entity => resolveLayerName(entity) !== layerName);
}

/**
 * Get entities NOT in any of the specified layers
 * @param entities - Array of scene entities
 * @param layerNames - Layers to exclude
 * @returns Entities not in any of the specified layers
 */
export function getEntitiesNotInLayers(
  entities: AnySceneEntity[],
  layerNames: string[]
): AnySceneEntity[] {
  return entities.filter(entity => {
    const name = resolveLayerName(entity);
    return !name || !layerNames.includes(name);
  });
}