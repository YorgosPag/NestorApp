/**
 * Layer operation utilities
 * Shared patterns for layer operations
 *
 * ADR-129: Layer Entity Filtering Centralization
 * - Single source of truth for entity-layer filtering operations
 * - Null-safe layer checks
 * - Consistent visibility patterns
 */

import { SceneModel, AnySceneEntity, SceneLayer, LayerId } from '../../types/scene';
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { getSceneLayerByName } from '../../utils/scene-layer-utils';

/**
 * Resolve entity layer name via stable LayerId only (ADR-358 Phase 9E-6d).
 * `entity.layer` name fallback dropped — entities must carry `layerId`.
 */
function resolveLayerName(entity: AnySceneEntity): string | undefined {
  return resolveEntityLayerName(entity);
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
  if (!getSceneLayerByName(scene, layerName)) {
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
  const layer = getSceneLayerByName(scene, layerName);
  if (!layer) return scene;
  return {
    ...scene,
    layersById: {
      ...scene.layersById,
      [layer.id]: { ...layer, ...properties },
    },
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
 * Get visible entity IDs in layers with layer visibility check.
 * Checks both entity.visible and layer.visible.
 * ADR-358 Phase 9E-6e: accepts id-keyed layersById map.
 */
export function getVisibleEntityIdsInLayers(
  entities: AnySceneEntity[],
  layersById: Record<LayerId, SceneLayer>,
  layerNames: string[]
): string[] {
  const nameToVisible: Record<string, boolean> = {};
  for (const l of Object.values(layersById)) {
    nameToVisible[l.name] = l.visible !== false;
  }
  return entities
    .filter(entity => {
      if (!entityBelongsToLayers(entity, layerNames)) return false;
      if (!isEntityVisible(entity)) return false;
      const name = resolveLayerName(entity);
      return name != null && nameToVisible[name] !== false;
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