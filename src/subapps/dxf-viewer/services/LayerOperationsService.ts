/**
 * Layer Operations Service
 * Handles all layer-related operations including CRUD, visibility, color changes, and merging
 */

import { SceneModel } from '../types/scene';
import { mergeColorGroups } from '../ui/components/layers/utils/scene-merge';
import { 
  validateLayerExists, 
  updateLayerProperties, 
  updateEntitiesForLayer,
  LayerOperationResult as ImportedLayerOperationResult
} from './shared/layer-operation-utils';

export interface LayerOperationResult {
  updatedScene: SceneModel;
  affectedEntityIds?: string[];
  success: boolean;
  message?: string;
}

export interface LayerCreateOptions {
  name: string;
  color: string;
  visible?: boolean;
  frozen?: boolean;
}

export class LayerOperationsService {
  /**
   * Change layer color
   */
  public changeLayerColor(
    layerName: string,
    color: string,
    scene: SceneModel
  ): LayerOperationResult {
    const validationError = validateLayerExists(layerName, scene);
    if (validationError) return validationError;
    
    const updatedScene = updateLayerProperties(layerName, { color }, scene);
    
    return {
      updatedScene,
      success: true,
      message: `Layer color updated to ${color}`
    };
  }
  
  /**
   * Rename a layer
   */
  public renameLayer(
    oldName: string,
    newName: string,
    scene: SceneModel
  ): LayerOperationResult {
    if (oldName === newName) {
      return {
        updatedScene: scene,
        success: true,
        message: 'Layer name unchanged'
      };
    }
    
    if (scene.layers[newName]) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${newName}" already exists`
      };
    }
    
    const { [oldName]: renamedLayer, ...otherLayers } = scene.layers;
    
    if (!renamedLayer) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${oldName}" does not exist`
      };
    }
    
    const updatedLayers = {
      ...otherLayers,
      [newName]: {
        ...renamedLayer,
        name: newName
      }
    };
    
    const updatedEntities = scene.entities.map(entity =>
      entity.layer === oldName
        ? { ...entity, layer: newName }
        : entity
    );
    
    const updatedScene = {
      ...scene,
      layers: updatedLayers,
      entities: updatedEntities
    };
    
    return {
      updatedScene,
      success: true,
      message: `Layer renamed from "${oldName}" to "${newName}"`
    };
  }
  
  /**
   * Toggle layer visibility
   */
  public toggleLayerVisibility(
    layerName: string,
    visible: boolean,
    scene: SceneModel
  ): LayerOperationResult {
    const validationError = validateLayerExists(layerName, scene);
    if (validationError) return validationError;
    
    let updatedScene = updateLayerProperties(layerName, { visible }, scene);
    updatedScene = updateEntitiesForLayer(updatedScene, layerName, { visible });
    
    const affectedEntityIds = scene.entities
      .filter(entity => entity.layer === layerName)
      .map(entity => entity.id);
    
    return {
      updatedScene,
      affectedEntityIds,
      success: true,
      message: `Layer visibility set to ${visible}`
    };
  }
  
  /**
   * Delete a layer and all its entities
   */
  public deleteLayer(
    layerName: string,
    scene: SceneModel
  ): LayerOperationResult {
    if (!scene.layers[layerName]) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${layerName}" does not exist`
      };
    }
    
    const { [layerName]: deletedLayer, ...remainingLayers } = scene.layers;
    const deletedEntityIds = scene.entities
      .filter(entity => entity.layer === layerName)
      .map(entity => entity.id);
    
    const remainingEntities = scene.entities.filter(
      entity => entity.layer !== layerName
    );
    
    const updatedScene = {
      ...scene,
      layers: remainingLayers,
      entities: remainingEntities
    };
    
    return {
      updatedScene,
      affectedEntityIds: deletedEntityIds,
      success: true,
      message: `Layer "${layerName}" deleted with ${deletedEntityIds.length} entities`
    };
  }
  
  /**
   * Create a new layer
   */
  public createLayer(
    options: LayerCreateOptions,
    scene: SceneModel
  ): LayerOperationResult {
    const { name, color, visible = true, frozen = false } = options;
    
    if (scene.layers && scene.layers[name]) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${name}" already exists`
      };
    }
    
    // ✅ ENTERPRISE FIX: Added missing 'locked' property to match SceneLayer interface
    const newLayer = {
      name: name,
      visible: visible,
      color: color,
      frozen: frozen,
      locked: false // Default value for new layers
    };
    
    const updatedScene = {
      ...scene,
      layers: {
        ...scene.layers,
        [name]: newLayer
      }
    };
    
    return {
      updatedScene,
      success: true,
      message: `Layer "${name}" created`
    };
  }
  
  /**
   * Merge multiple layers into one
   */
  public mergeLayers(
    targetLayerName: string,
    sourceLayerNames: string[],
    scene: SceneModel
  ): LayerOperationResult {

    // Validate target layer exists
    if (!scene.layers[targetLayerName]) {
      return {
        updatedScene: scene,
        success: false,
        message: `Target layer "${targetLayerName}" does not exist`
      };
    }
    
    // Move all entities from source layers to target layer
    const updatedEntities = scene.entities.map(entity =>
      entity.layer && sourceLayerNames.includes(entity.layer)
        ? { ...entity, layer: targetLayerName }
        : entity
    );
    
    // Delete source layers
    const updatedLayers = Object.fromEntries(
      Object.entries(scene.layers).filter(
        ([layerName]) => !sourceLayerNames.includes(layerName)
      )
    );
    
    const updatedScene = {
      ...scene,
      layers: updatedLayers,
      entities: updatedEntities
    };
    
    const affectedEntityIds = scene.entities
      .filter(entity => entity.layer && sourceLayerNames.includes(entity.layer))
      .map(entity => entity.id);

    return {
      updatedScene,
      affectedEntityIds,
      success: true,
      message: `Merged ${sourceLayerNames.length} layers into "${targetLayerName}"`
    };
  }
  
  /**
   * Merge color groups hierarchically (without deleting layers)
   */
  public mergeColorGroups(
    targetColorGroup: string,
    sourceColorGroups: string[],
    scene: SceneModel
  ): LayerOperationResult {

    // Use the hierarchical logic that doesn't delete layers
    const updatedScene = mergeColorGroups(scene, targetColorGroup, sourceColorGroups);

    return {
      updatedScene,
      success: true,
      message: `Merged ${sourceColorGroups.length} color groups into "${targetColorGroup}"`
    };
  }
  
  /**
   * Toggle visibility for all layers in a color group
   */
  public toggleColorGroup(
    colorGroupName: string,
    layersInGroup: string[],
    visible: boolean,
    scene: SceneModel
  ): LayerOperationResult {
    const updatedScene = {
      ...scene,
      layers: {
        ...scene.layers,
        ...Object.fromEntries(
          layersInGroup.map(layerName => [
            layerName,
            { ...scene.layers[layerName], visible }
          ])
        )
      },
      entities: scene.entities.map(entity =>
        entity.layer && layersInGroup.includes(entity.layer)
          ? { ...entity, visible }
          : entity
      )
    };

    const affectedEntityIds = scene.entities
      .filter(entity => entity.layer && layersInGroup.includes(entity.layer))
      .map(entity => entity.id);

    return {
      updatedScene,
      affectedEntityIds,
      success: true,
      message: `Color group visibility set to ${visible}`
    };
  }
  
  /**
   * Delete all layers in a color group
   */
  public deleteColorGroup(
    colorGroupName: string,
    layersInGroup: string[],
    scene: SceneModel
  ): LayerOperationResult {

    // Remove layers and their entities
    const remainingLayers = Object.fromEntries(
      Object.entries(scene.layers).filter(
        ([layerName]) => !layersInGroup.includes(layerName)
      )
    );
    
    const deletedEntityIds = scene.entities
      .filter(entity => entity.layer && layersInGroup.includes(entity.layer))
      .map(entity => entity.id);
    
    const remainingEntities = scene.entities.filter(
      entity => !entity.layer || !layersInGroup.includes(entity.layer)
    );
    
    const updatedScene = {
      ...scene,
      layers: remainingLayers,
      entities: remainingEntities
    };
    
    return {
      updatedScene,
      affectedEntityIds: deletedEntityIds,
      success: true,
      message: `Deleted color group "${colorGroupName}" with ${layersInGroup.length} layers and ${deletedEntityIds.length} entities`
    };
  }
  
  /**
   * Change color for all layers in a color group
   */
  public changeColorGroupColor(
    colorGroupName: string,
    layersInGroup: string[],
    color: string,
    scene: SceneModel
  ): LayerOperationResult {

    const updatedScene = {
      ...scene,
      layers: {
        ...scene.layers,
        ...Object.fromEntries(
          layersInGroup.map(layerName => [
            layerName,
            { ...scene.layers[layerName], color }
          ])
        )
      },
      entities: scene.entities.map(entity =>
        entity.layer && layersInGroup.includes(entity.layer)
          ? { ...entity, color }
          : entity
      )
    };
    
    const affectedEntityIds = scene.entities
      .filter(entity => entity.layer && layersInGroup.includes(entity.layer))
      .map(entity => entity.id);

    return {
      updatedScene,
      affectedEntityIds,
      success: true,
      message: `Changed color group "${colorGroupName}" to ${color}`
    };
  }
  
  /**
   * Get statistics about layers
   */
  public getLayerStatistics(scene: SceneModel): {
    totalLayers: number;
    visibleLayers: number;
    hiddenLayers: number;
    totalEntities: number;
    entitiesByLayer: Record<string, number>;
  } {
    const layers = Object.values(scene.layers);
    const visibleLayers = layers.filter(l => l.visible).length;
    const hiddenLayers = layers.filter(l => !l.visible).length;
    
    const entitiesByLayer: Record<string, number> = {};
    scene.entities.forEach(entity => {
      const layerName = entity.layer || 'default';
      entitiesByLayer[layerName] = (entitiesByLayer[layerName] || 0) + 1;
    });
    
    return {
      totalLayers: layers.length,
      visibleLayers,
      hiddenLayers,
      totalEntities: scene.entities.length,
      entitiesByLayer
    };
  }
}