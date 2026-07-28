/**
 * Layer Operations Service — handles layer CRUD, visibility, color, merging.
 */
import { SceneModel, SceneLayer } from '../types/scene';
import { mergeColorGroups } from '../ui/components/layers/utils/scene-merge';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../config/layer-config';
import {
  validateLayerExists,
  updateLayerProperties,
  // ADR-129: Centralized entity layer filtering
  getEntityIdsByLayers,
  getEntitiesNotInLayers
} from './shared/layer-operation-utils';
// ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName } from '../stores/LayerStore';
// ADR-721 §7 — η ΜΙΑ πόρτα για μόνιμες ιδιότητες layer (έγγραφο + runtime προβολή).
import { setLayerFlags } from './layer-flags-writer';
import {
  isConcreteLineweight,
  parseDxfCode370,
  LINEWEIGHT_SPECIAL,
  LINEWEIGHT_SPECIAL_VALUES,
} from '../config/lineweight-iso-catalog';
import { resolveLinetypeDef } from '../rendering/linetype-dash-resolver';
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
    const renamedLayer = Object.values(scene.layersById).find(l => l.name === oldName);
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

    // ADR-358 Phase 9D-5a — rename mutates SceneLayer.name only; layerId stays stable.
    const updatedScene = {
      ...scene,
      layersById: {
        ...scene.layersById,
        [renamedLayer.id]: { ...renamedLayer, name: newName },
      },
    };
    return {
      updatedScene,
      success: true,
      message: `Layer renamed from "${oldName}" to "${newName}"`
    };
  }
  // ADR-721 §7 — Τα `toggleLayerVisibility` / `toggleColorGroup` ΑΦΑΙΡΕΘΗΚΑΝ από εδώ.
  //
  // Ήταν functional API (`(…, scene) => updatedScene`) που ο caller έπρεπε ΜΕΤΑ να γράψει με
  // `setLevelScene`. Δύο βήματα για μία πράξη, με παράθυρο απόκλισης ανάμεσα (η runtime
  // προβολή είχε ήδη ενημερωθεί όταν το δεύτερο βήμα δεν εκτελούνταν). Η ορατότητα layer
  // περνά πλέον από τη ΜΙΑ πόρτα `services/layer-flags-writer` (`setLayerFlags` /
  // `setLayerFlagsBatch`), που γράφει έγγραφο + προβολή **ατομικά** και δουλεύει και εκτός
  // React (εντολές, υπηρεσίες) μέσω της `active-document-gateway`.
  //
  // Οι υπόλοιπες μέθοδοι εδώ (rename/merge/delete/color) μένουν functional: μεταλλάσσουν
  // ΟΝΤΟΤΗΤΕΣ μαζί με layers, οπότε ανήκουν στη ροή σκηνής του caller.

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

    const layerToDelete = Object.values(scene.layersById).find(l => l.name === layerName);
    if (!layerToDelete) {
      return {
        updatedScene: scene,
        success: false,
        message: `Layer "${layerName}" does not exist`
      };
    }

    // ADR-358 Phase 9E-6d/6e: id-first entity purge.
    const dlId = layerToDelete.id;
    const { [dlId]: _removed, ...remainingById } = scene.layersById;
    const deletedEntityIds = scene.entities.filter(e => (e as { layerId?: string }).layerId === dlId).map(e => e.id);
    const remainingEntities = scene.entities.filter(e => (e as { layerId?: string }).layerId !== dlId);

    const updatedScene = {
      ...scene,
      layersById: remainingById,
      entities: remainingEntities,
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
      layersById: { ...scene.layersById, [newLayer.id]: newLayer },
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
    const targetLayer = Object.values(scene.layersById).find(l => l.name === targetLayerName);
    if (!targetLayer) {
      return {
        updatedScene: scene,
        success: false,
        message: `Target layer "${targetLayerName}" does not exist`
      };
    }

    // ADR-358 Phase 9D-5a/9E-6e: re-key via stable layerId.
    const targetLayerId = targetLayer.id;
    const updatedEntities = scene.entities.map(entity => {
      const name = resolveEntityLayerName(entity);
      return name && sourceLayerNames.includes(name)
        ? { ...entity, layerId: targetLayerId }
        : entity;
    });

    const remainingById = Object.fromEntries(
      Object.entries(scene.layersById).filter(([_, l]) => !sourceLayerNames.includes(l.name))
    );

    const updatedScene = {
      ...scene,
      layersById: remainingById,
      entities: updatedEntities,
    };
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

    const updatedScene = mergeColorGroups(scene, targetColorGroup, sourceColorGroups);
    return {
      updatedScene,
      success: true,
      message: `Merged ${sourceColorGroups.length} color groups into "${targetColorGroup}"`
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

    const remainingById = Object.fromEntries(
      Object.entries(scene.layersById).filter(([_, l]) => !layersInGroup.includes(l.name))
    );

    const deletedEntityIds = getEntityIdsByLayers(scene.entities, layersInGroup);
    const remainingEntities = getEntitiesNotInLayers(scene.entities, layersInGroup);

    const updatedScene = {
      ...scene,
      layersById: remainingById,
      entities: remainingEntities,
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

    const colorUpdates: Record<string, SceneLayer> = {};
    for (const [id, l] of Object.entries(scene.layersById)) {
      if (layersInGroup.includes(l.name)) colorUpdates[id] = { ...l, color };
    }
    const updatedScene = {
      ...scene,
      layersById: { ...scene.layersById, ...colorUpdates },
      entities: scene.entities.map(entity => {
        const resolvedName = resolveEntityLayerName(entity);
        return resolvedName && layersInGroup.includes(resolvedName) ? { ...entity, color } : entity;
      }),
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

  // ─── ADR-358 Phase 8.5 property setters — ADR-721 §7: γράφουν έγγραφο + προβολή ────
  //
  // Πριν, και οι πέντε έκαναν σκέτο `upsertLayer(...)`: η αλλαγή φαινόταν αμέσως αλλά ΔΕΝ
  // αποθηκευόταν, και σβηνόταν στο επόμενο hydration από το έγγραφο. Ο χρήστης έβλεπε το
  // πάχος/τύπο γραμμής να «επιστρέφει μόνο του». Τώρα περνούν από τη μία πόρτα
  // (`setLayerFlags`), που γράφει και στα δύο και κάνει από μόνη της τον έλεγχο no-op —
  // γι' αυτό έφυγαν και οι χειροκίνητοι φρουροί ισότητας από κάθε setter.

  public setLineweight(layerId: string, lineweight: LineweightMm): void {
    setLayerFlags(layerId, { lineweight: this.validateLineweight(lineweight) });
  }
  public setLinetype(layerId: string, linetypeName: string): void {
    setLayerFlags(layerId, { linetype: this.validateLinetype(linetypeName) });
  }
  public setTransparency(layerId: string, value: number): void {
    setLayerFlags(layerId, { transparency: Math.max(0, Math.min(90, value)) });
  }
  public setPlottable(layerId: string, value: boolean): void {
    setLayerFlags(layerId, { plottable: value });
  }
  public setFrozen(layerId: string, value: boolean): void {
    setLayerFlags(layerId, { frozen: value });
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
    // item B: catalog∪registry union — so ISO density variants (Dashed2/DotX2/…)
    // assigned to a layer validate instead of being rejected → Continuous.
    if (resolveLinetypeDef(name)) return name;
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
    const layers = Object.values(scene.layersById);
    const visibleLayers = layers.filter(l => l.visible).length;
    const hiddenLayers = layers.filter(l => !l.visible).length;
    const entitiesByLayer: Record<string, number> = {};
    scene.entities.forEach(entity => {
      // ADR-130 + ADR-358 Phase 9D-3: id-first name via LayerStore, fallback to legacy
      const layerName = getLayerNameOrDefault(resolveEntityLayerName(entity));
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