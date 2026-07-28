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
  updateEntitiesForLayer,
  // ADR-129: Centralized entity layer filtering
  getEntityIdsByLayer,
  getEntityIdsByLayers,
  getEntitiesNotInLayers
} from './shared/layer-operation-utils';
// ADR-358 Phase 8.5: SSoT-based property setters
// ADR-358 Phase 9D-3: id-first reader SSoT
import { getLayer, upsertLayer, resolveEntityLayerName } from '../stores/LayerStore';
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
  /**
   * Toggle layer visibility — **η ΜΙΑ πόρτα** για το AutoCAD `LAYON`/`LAYOFF` του layer.
   *
   * ADR-719 §4. Δύο πράγματα άλλαξαν εδώ, και τα δύο είναι σημασιολογικά, όχι καλλωπιστικά:
   *
   * **(α) Δεν γράφει ΠΟΤΕ `entity.visible`.** Πριν, το toggle έκανε επιπλέον
   * `updateEntitiesForLayer(scene, layerName, { visible })`, δηλαδή στάμπαρε το flag του
   * layer πάνω σε **κάθε** entity του. Αυτό αντιβαίνει σε ολόκληρη τη βιομηχανία: στο DXF/DWG
   * το ON/OFF ζει στο **LAYER table**, ποτέ στην οντότητα (γι' αυτό ένα σβηστό layer κρατά τα
   * αντικείμενά του επιλέξιμα — δεν τα «σβήνει»). Πρακτικά ήταν και **μη ιδεμποτικό και
   * απωλεστικό** (N.7.2 #3): κρύβεις το layer → κρύβονται τα 176 entities του· το ξανα-ανοίγεις
   * → γίνονται ΟΛΑ ορατά, συμπεριλαμβανομένων εκείνων που ο χρήστης είχε κρύψει **ατομικά** από
   * το `EntityCard`. Η ατομική απόκρυψη ήταν ανακτήσιμη μόνο με undo.
   *
   * **(β) Γράφει και στο runtime SSoT.** Το `LayerStore` είναι ο owner των layer flags κατά
   * το ADR-382 §1.2 — από εκεί διαβάζουν ο 2Δ renderer (`isEntityLayerSkipped`), ο BIM resolver
   * και ο WebGL line layer, και εκεί είναι καρφωμένη η ακύρωση του bitmap cache
   * (`useDxfCanvasCacheInvalidation`). Το document write από μόνο του φτάνει στον renderer μόνο
   * έμμεσα (μέσω του hydration effect, δηλαδή έναν κύκλο React αργότερα)· το `upsertLayer` εδώ
   * κάνει την αλλαγή ορατή **στο ίδιο tick**, όπως ένα retained-mode CAD. Το hydration παραμένει
   * ως ιδεμποτικός reconciler (§3) — γράφει το ίδιο πράγμα, άρα κάνει bail.
   *
   * Το `SceneModel` παραμένει το **document** (αυτό που περσιστάρει)· το `LayerStore` η
   * **runtime προβολή** του. Γράφουμε και στα δύο εδώ ώστε να μην υπάρχει παράθυρο απόκλισης.
   */
  public toggleLayerVisibility(
    layerName: string,
    visible: boolean,
    scene: SceneModel
  ): LayerOperationResult {
    const validationError = validateLayerExists(layerName, scene);
    if (validationError) return validationError;

    // (α) Document write — ΜΟΝΟ το layer. Καμία μετάλλαξη οντοτήτων.
    const updatedScene = updateLayerProperties(layerName, { visible }, scene);

    // (β) Runtime projection write — ίδιο tick, ώστε renderer/hit-test/UI να συμφωνούν αμέσως.
    const updatedLayer = getSceneLayerByName(updatedScene, layerName);
    if (updatedLayer) upsertLayer(updatedLayer);

    // ADR-129: Centralized entity filtering — ποιες οντότητες ΕΠΗΡΕΑΖΟΝΤΑΙ οπτικά
    // (πληροφοριακό για τους callers· καμία από αυτές ΔΕΝ μεταλλάχθηκε).
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
   * Toggle visibility for all layers in a color group
   */
  public toggleColorGroup(
    colorGroupName: string,
    layersInGroup: string[],
    visible: boolean,
    scene: SceneModel
  ): LayerOperationResult {
    // ADR-719 §4 — ίδιο συμβόλαιο με το `toggleLayerVisibility`: το flag ζει ΜΟΝΟ στα layers.
    // Η παλιά μορφή έκανε επιπλέον `entities.map(... { ...entity, visible })`, δηλαδή στάμπαρε
    // το group flag πάνω σε κάθε οντότητα των 27 layers — απωλεστικό για τις ατομικές αποκρύψεις
    // και ξένο προς το DXF μοντέλο (ON/OFF = ιδιότητα του LAYER table).
    const layerUpdates: Record<string, SceneLayer> = {};
    for (const [id, l] of Object.entries(scene.layersById)) {
      if (layersInGroup.includes(l.name)) layerUpdates[id] = { ...l, visible };
    }
    const updatedScene = {
      ...scene,
      layersById: { ...scene.layersById, ...layerUpdates },
    };

    // Runtime projection — ένα upsert ανά αλλαγμένο layer, ίδιο tick (βλ. §4β).
    for (const layer of Object.values(layerUpdates)) upsertLayer(layer);

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