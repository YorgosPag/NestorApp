/**
 * Layer Operations Service — handles layer CRUD, visibility, color, merging.
 */
import { SceneModel } from '../types/scene';
import { mergeColorGroups } from '../ui/components/layers/utils/scene-merge';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../config/layer-config';
import {
  validateLayerExists,
  updateLayerProperties,
  updateEntitiesForLayer,
  // ADR-129: Centralized entity layer filtering
  getEntityIdsByLayer,
  getEntityIdsByLayers,
  getEntitiesNotInLayer,
  getEntitiesNotInLayers
} from './shared/layer-operation-utils';
// ADR-358 Phase 8.5: SSoT-based property setters
import { getLayer, upsertLayer } from '../stores/LayerStore';
import {
  isConcreteLineweight,
  parseDxfCode370,
  LINEWEIGHT_SPECIAL,
  LINEWEIGHT_SPECIAL_VALUES,
} from '../config/lineweight-iso-catalog';
import { resolveLinetype } from '../stores/LinetypeRegistry';
import { DEFAULT_LINETYPE_NAME } from '../config/linetype-iso-catalog';
import { createSceneLayer, type LineweightMm } from '../types/entities';
// ADR-358 Phase 9B: server-side naming trust boundary
import { guardLayerName } from './shared/layer-naming-guard';
import type { LayerNameValidationError } from './layer-name-validator';

export interface LayerOperationResult {
  updatedScene: SceneModel;
  affectedEntityIds?: string[];
  success: boolean;
  message?: string;
  /** ADR-358 §5.6 Q9 — populated when failure originates from name validation. */
  validationError?: LayerNameValidationError;
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

    const { [oldName]: renamedLayer, ...otherLayers } = scene.layers;

    if (!renamedLayer) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${oldName}" does not exist`
      };
    }

    const guard = guardLayerName({
      name: newName,
      scene,
      excludeId: renamedLayer.id,
    });
    if (guard) return guard;
    
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

    // ADR-129: Centralized entity filtering
    const affectedEntityIds = getEntityIdsByLayer(scene.entities, layerName);
    
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
    // ADR-358 §5.6 line 1000-1005 — Layer "0" system-reserved.
    if (layerName === '0') {
      return {
        updatedScene: scene,
        success: false,
        message: 'Layer "0" is system-reserved and cannot be deleted',
        validationError: 'RESERVED',
      };
    }

    if (!scene.layers[layerName]) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${layerName}" does not exist`
      };
    }
    
    const { [layerName]: deletedLayer, ...remainingLayers } = scene.layers;

    // ADR-129: Centralized entity filtering
    const deletedEntityIds = getEntityIdsByLayer(scene.entities, layerName);
    const remainingEntities = getEntitiesNotInLayer(scene.entities, layerName);
    
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

    const guard = guardLayerName({ name, scene });
    if (guard) return guard;

    // 🏢 ADR-358 Phase 9C: SceneLayer.id REQUIRED — factory auto-gen via enterprise-id (`lyr_<ULID>`)
    const newLayer = createSceneLayer({
      name,
      color,
      visible,
      frozen,
      locked: false,
    });
    
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

    // ADR-129: Centralized entity filtering
    const affectedEntityIds = getEntityIdsByLayers(scene.entities, sourceLayerNames);

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

    // ADR-129: Centralized entity filtering
    const affectedEntityIds = getEntityIdsByLayers(scene.entities, layersInGroup);

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

    // ADR-129: Centralized entity filtering
    const deletedEntityIds = getEntityIdsByLayers(scene.entities, layersInGroup);
    const remainingEntities = getEntitiesNotInLayers(scene.entities, layersInGroup);
    
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

    // ADR-129: Centralized entity filtering
    const affectedEntityIds = getEntityIdsByLayers(scene.entities, layersInGroup);

    return {
      updatedScene,
      affectedEntityIds,
      success: true,
      message: `Changed color group "${colorGroupName}" to ${color}`
    };
  }

  // ─── ADR-358 Phase 8.5 — SSoT-based property setters (LayerStore.upsertLayer) ─

  public setLineweight(layerId: string, lineweight: LineweightMm): void {
    const target = getLayer(layerId);
    if (!target) return;
    const validated = this.validateLineweight(lineweight);
    if (target.lineweight === validated) return;
    upsertLayer({ ...target, lineweight: validated });
  }
  public setLinetype(layerId: string, linetypeName: string): void {
    const target = getLayer(layerId);
    if (!target) return;
    const validated = this.validateLinetype(linetypeName);
    if (target.linetype === validated) return;
    upsertLayer({ ...target, linetype: validated });
  }
  public setTransparency(layerId: string, value: number): void {
    const target = getLayer(layerId);
    if (!target) return;
    const clamped = Math.max(0, Math.min(90, value));
    if (target.transparency === clamped) return;
    upsertLayer({ ...target, transparency: clamped });
  }
  public setPlottable(layerId: string, value: boolean): void {
    const target = getLayer(layerId);
    if (!target) return;
    if (target.plottable === value) return;
    upsertLayer({ ...target, plottable: value });
  }
  public setFrozen(layerId: string, value: boolean): void {
    const target = getLayer(layerId);
    if (!target) return;
    if ((target.frozen ?? false) === value) return;
    upsertLayer({ ...target, frozen: value });
  }
  private validateLineweight(lw: LineweightMm): LineweightMm {
    if ((LINEWEIGHT_SPECIAL_VALUES as ReadonlyArray<number>).includes(lw)) return lw;
    if (!isConcreteLineweight(lw)) return LINEWEIGHT_SPECIAL.DEFAULT;
    const snapped = parseDxfCode370(Math.round(Number(lw) * 100));
    if (snapped !== lw) {
      console.warn(
        `[LayerOperationsService] Non-ISO lineweight ${lw}mm — snapped to ${snapped}`,
      );
    }
    return snapped;
  }

  private validateLinetype(name: string): string {
    if (resolveLinetype(name)) return name;
    console.warn(
      `[LayerOperationsService] Unknown linetype "${name}" — fallback ${DEFAULT_LINETYPE_NAME}`,
    );
    return DEFAULT_LINETYPE_NAME;
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
      // ADR-130: Centralized default layer
      const layerName = getLayerNameOrDefault(entity.layer);
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