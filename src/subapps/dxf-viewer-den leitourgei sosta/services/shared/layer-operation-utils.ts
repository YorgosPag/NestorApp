/**
 * Layer operation utilities
 * Shared patterns for layer operations
 */

import { SceneModel } from '../../types/scene';

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
  return {
    ...scene,
    layers: {
      ...scene.layers,
      [layerName]: {
        ...scene.layers[layerName],
        ...properties
      }
    }
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
      if (entity.layer === layerName) {
        return { ...entity, ...entityUpdates };
      }
      return entity;
    })
  };
}