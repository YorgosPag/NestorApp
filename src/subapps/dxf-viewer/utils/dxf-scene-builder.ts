import type { SceneModel, AnySceneEntity, SceneLayer } from '../types/scene';
import type { Entity } from '../types/entities';
import { DxfEntityParser, type LayerColorMap } from './dxf-entity-parser';
import { DEFAULT_LAYER_COLOR, getLayerColor } from '../config/color-config';
import { getAciColor } from '../settings/standards/aci';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault, DXF_DEFAULT_LAYER } from '../config/layer-config';
// ADR-358 Phase 9C/9D — SceneLayer construction SSoT (auto-gens `lyr_<UUID-v4>` id).
import { createSceneLayer } from '../types/entities';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds } from '../config/geometry-constants';
// ADR-358 Phase 8 — propagate real $INSUNITS to SceneModel.units via SSoT.
// ADR-462 canonical-mm — scale source units → mm at import (mmToSceneUnits inverse).
import { insunitsCodeToSceneUnits, mmToSceneUnits, resolveImportSourceUnits, type SceneUnits } from './scene-units';
// ADR-348 SSoT — per-entity scale transform (reused for the import unit-scale pass).
import { scaleEntity } from '../systems/scale/scale-entity-transform';

export class DxfSceneBuilder {
  /**
   * ADR-462 — CANONICAL-mm: a DXF is imported in WHATEVER units it was authored,
   * but the SceneModel always stores geometry in **millimetres**. The source unit
   * (`unitsOverride` from the wizard → `$INSUNITS` → bounds heuristic) drives a
   * one-shot scale of every coordinate, so all floors of a building share ONE unit
   * and BIM entities (authored in mm) align with the underlay. After this, the whole
   * app reads `units: 'mm'` — no per-floor unit guessing downstream.
   */
  static buildScene(content: string, unitsOverride?: SceneUnits): SceneModel {

    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🏢 ENTERPRISE: Parse HEADER first for unit/scale information          ║
    // ║ This is critical for correct text/dimension rendering across DXF files║
    // ╚════════════════════════════════════════════════════════════════════════╝
    const header = DxfEntityParser.parseHeader(lines);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🏢 ENTERPRISE DIMSTYLE PARSING (2026-01-03)                            ║
    // ║                                                                        ║
    // ║ Parse DIMSTYLE table from TABLES section για ΠΡΑΓΜΑΤΙΚΑ DIMTXT values║
    // ║ Αυτό είναι ΚΡΙΣΙΜΟ για σωστό dimension text sizing!                   ║
    // ║                                                                        ║
    // ║ Χωρίς αυτό: Fallback σε 2.5mm → λάθος μεγέθη σε πολλά DXF             ║
    // ║ Με αυτό: Χρησιμοποιεί το πραγματικό DIMTXT από το style              ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    const dimStyles = DxfEntityParser.parseDimStyles(lines);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🎨 ENTERPRISE LAYER COLOR PARSING (2026-01-03)                         ║
    // ║                                                                        ║
    // ║ Parse LAYER table για ΠΡΑΓΜΑΤΙΚΑ ACI colors!                          ║
    // ║                                                                        ║
    // ║ ΠΡΙΝ: Hash-based pastel colors (muted, ξεθωριασμένα)                  ║
    // ║ ΤΩΡΑ: Real ACI colors (BRIGHT όπως στο AutoCAD!)                      ║
    // ║                                                                        ║
    // ║ Αυτό λύνει το πρόβλημα με τα διαφορετικά χρώματα viewer vs native!   ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    const layerColors = DxfEntityParser.parseLayerColors(lines);

    const entities: AnySceneEntity[] = [];
    const layers: Record<string, SceneLayer> = {};

    // Add default layer with real ACI color
    // ADR-358 Phase 9C/9D-2 — factory injects stable `lyr_<UUID-v4>` id (auto-gen via
    // enterprise-id-convenience.generateLayerId). Replaces legacy inline literal that
    // bypassed the id-gen contract.
    const defaultLayerColor = layerColors[DXF_DEFAULT_LAYER]?.color || DEFAULT_LAYER_COLOR;
    layers[DXF_DEFAULT_LAYER] = createSceneLayer({
      name: DXF_DEFAULT_LAYER,
      color: defaultLayerColor,
      visible: true,
      locked: false,
    });

    // Parse entities using state machine
    const parsedEntities = DxfEntityParser.parseEntities(lines);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🏢 ENTERPRISE DIMSTYLE SUPPORT (2026-01-03)                            ║
    // ║                                                                        ║
    // ║ Περνάμε ΤΟΣΟ το header ΟΣΟ ΚΑΙ τα dimStyles:                          ║
    // ║ - header: DIMSCALE, INSUNITS για global scaling                       ║
    // ║ - dimStyles: ΠΡΑΓΜΑΤΙΚΑ DIMTXT values από TABLES section              ║
    // ║                                                                        ║
    // ║ Αυτό εξασφαλίζει ΣΩΣΤΑ dimension text sizes σε όλα τα DXF!            ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    // Convert to scene entities with header AND dimStyles
    let byLayerColorCount = 0;
    let explicitColorCount = 0;

    parsedEntities.forEach((entityData, index) => {
      const result = DxfEntityParser.convertToSceneEntity(entityData, index, header, dimStyles);
      if (!result) return;

      // Normalize to array (DIMENSION returns multiple entities: text + lines)
      const converted = Array.isArray(result) ? result : [result];

      for (const entity of converted) {
        // ADR-358 Phase 9D-5b-i — DXF parse boundary: raw DxfEntityParser output still
        // emits `.layer` (group 8 string) at runtime; narrow cast preserves boundary read
        // since BaseEntity.layer field was dropped from SceneEntity schema in 9D-5b-i.
        // TODO Phase 9E candidate: extract formal `RawDxfEntity` type for parse boundary.
        const layerName = getLayerNameOrDefault(entity.layerId);

        // Register layer with REAL ACI colors from parsed LAYER table
        DxfSceneBuilder.registerLayer(layers, layerName, layerColors);

        // ADR-358 Phase 9D-2 — attribute stable `layerId` on entity from the
        // registered SceneLayer. Provides id-keyed routing downstream
        // (DxfRenderer/HitTester) prior to Phase 9E `SceneModel.layers` re-key.
        (entity as { layerId?: string }).layerId = layers[layerName].id;

        // ╔════════════════════════════════════════════════════════════════════════╗
        // ║ 🎨 BYLAYER COLOR RESOLUTION (2026-01-03)                               ║
        // ║                                                                        ║
        // ║ ΚΡΙΣΙΜΟ: Αν το entity δεν έχει explicit color (ByLayer),              ║
        // ║ εφάρμοσε το ΠΡΑΓΜΑΤΙΚΟ χρώμα του layer!                               ║
        // ║                                                                        ║
        // ║ Priority:                                                              ║
        // ║ 1. layerColors[layerName] - Parsed from LAYER table                   ║
        // ║ 2. COLOR_X pattern - Extract ACI from layer name (e.g. COLOR_43)      ║
        // ║ 3. getLayerColor() - Hash-based fallback                              ║
        // ╚════════════════════════════════════════════════════════════════════════╝
        const entityColor = (entity as { color?: string }).color;
        // Check if entity has NO color (undefined, null, or empty string = ByLayer)
        if (!entityColor) {
          // Try 1: Get from parsed LAYER table
          let resolvedColor = layerColors[layerName]?.color;

          // Try 2: Extract ACI from layer name pattern COLOR_X (e.g. COLOR_43 → ACI 43)
          if (!resolvedColor) {
            const colorMatch = layerName.match(/^COLOR_(\d+)$/i);
            if (colorMatch) {
              const aciIndex = parseInt(colorMatch[1], 10);
              if (aciIndex >= 1 && aciIndex <= 255) {
                resolvedColor = getAciColor(aciIndex);
              }
            }
          }

          if (resolvedColor) {
            // Mutate entity to add layer color
            (entity as { color?: string }).color = resolvedColor;
            byLayerColorCount++;
          }
        } else {
          explicitColorCount++;
        }

        entities.push(entity);
      }
    });

    // Debug: Log color assignment summary with sample colors
    const sampleLayers = Object.entries(layers).slice(0, 10).map(([name, layer]) => ({
      name,
      color: layer.color
    }));
    console.debug('🎨 COLOR ASSIGNMENT SUMMARY:', {
      totalEntities: entities.length,
      byLayerColors: byLayerColorCount,
      explicitColors: explicitColorCount,
      layersFound: Object.keys(layerColors).length,
      registeredLayers: Object.keys(layers).length,
      sampleLayers
    });

    // Calculate bounds
    const bounds = entities.length > 0 ? DxfSceneBuilder.calculateBounds(entities) : {
      min: { x: -100, y: -100 },
      max: { x: 100, y: 100 }
    };

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🔧 BACKUP COMPATIBILITY (2026-01-03)                                   ║
    // ║ Επαναφορά στην απλή προσέγγιση του backup που δούλευε σωστά.          ║
    // ║ Τα entities περνάνε απευθείας χωρίς text height normalization.        ║
    // ╚════════════════════════════════════════════════════════════════════════╝

    // ADR-462 CANONICAL-mm — resolve the SOURCE unit (what the DXF was authored in),
    // then scale every coordinate to millimetres so the stored scene is always mm.
    // Priority: explicit wizard override → $INSUNITS → bounds heuristic (ADR-368 order,
    // now applied as a SCALE instead of a render-time label).
    const fromInsunits = insunitsCodeToSceneUnits(header.insunits);
    const sourceUnits: SceneUnits = unitsOverride ?? resolveImportSourceUnits(fromInsunits, bounds);

    // mmToSceneUnits('m') = 0.001 → a value in metres × (1/0.001)=1000 becomes mm.
    const mmFactor = 1 / mmToSceneUnits(sourceUnits);

    let finalEntities = entities;
    let finalBounds = bounds;
    if (Number.isFinite(mmFactor) && mmFactor > 0 && Math.abs(mmFactor - 1) > 1e-9) {
      // Uniform scale around the origin (0,0) → reuses the ADR-348 per-entity SSoT
      // (`scaleEntity`), so every entity type (line/arc/circle/text/dimension/hatch…)
      // scales correctly without re-implementing per-type math. Coordinates, radii
      // and text heights all become mm.
      const origin = { x: 0, y: 0 };
      finalEntities = entities.map(
        (e) => ({ ...e, ...scaleEntity(e as unknown as Entity, origin, mmFactor, mmFactor) }) as AnySceneEntity,
      );
      finalBounds = DxfSceneBuilder.calculateBounds(finalEntities);
    }

    // ADR-358 Phase 9E-1: build id-keyed mirror alongside name-keyed `layers`.
    const layersById: Record<string, SceneLayer> = Object.fromEntries(
      Object.values(layers).map((l) => [l.id, l]),
    );

    return {
      entities: finalEntities,
      layersById,
      bounds: finalBounds,
      // ADR-462 — geometry is now millimetres by construction; downstream stops guessing.
      units: 'mm',
      dimStyles: Object.keys(dimStyles).length > 0 ? dimStyles : undefined,
      headerDimscale: header.dimscale, // ADR-362 R10 — annotative-style resolution in dim-style-importer
    };
  }

  /**
   * 🎨 ENTERPRISE LAYER REGISTRATION (2026-01-03)
   *
   * Καταχωρεί layer με ΠΡΑΓΜΑΤΙΚΑ ACI colors!
   *
   * Priority:
   * 1. layerColors[layerName] - Parsed from LAYER table
   * 2. COLOR_X pattern - Extract ACI from layer name (e.g. COLOR_43)
   * 3. getLayerColor(layerName) - Hash-based fallback (muted)
   *
   * @param layers - Record of registered layers
   * @param layerName - Name of layer to register
   * @param layerColors - Parsed LAYER table with real ACI colors
   */
  private static registerLayer(
    layers: Record<string, SceneLayer>,
    layerName: string,
    layerColors: LayerColorMap
  ): void {
    if (!layers[layerName]) {
      // ╔════════════════════════════════════════════════════════════════════════╗
      // ║ 🎨 REAL ACI COLOR PRIORITY                                             ║
      // ║                                                                        ║
      // ║ 1. layerColors[layerName] → Parsed from LAYER table                   ║
      // ║ 2. COLOR_X pattern → Extract ACI from name (e.g. COLOR_43 → ACI 43)   ║
      // ║ 3. getLayerColor() → Hash-based fallback                               ║
      // ╚════════════════════════════════════════════════════════════════════════╝

      // Try 1: Get from parsed LAYER table
      let resolvedColor = layerColors[layerName]?.color;
      const visible = layerColors[layerName]?.visible ?? true;

      // Try 2: Extract ACI from layer name pattern COLOR_X (e.g. COLOR_43 → ACI 43)
      if (!resolvedColor) {
        const colorMatch = layerName.match(/^COLOR_(\d+)$/i);
        if (colorMatch) {
          const aciIndex = parseInt(colorMatch[1], 10);
          if (aciIndex >= 1 && aciIndex <= 255) {
            resolvedColor = getAciColor(aciIndex);
          }
        }
      }

      // Try 3: Hash-based fallback
      if (!resolvedColor) {
        resolvedColor = getLayerColor(layerName);
      }

      // ADR-358 Phase 9C/9D-2 — factory auto-gens stable `lyr_<UUID-v4>` id.
      layers[layerName] = createSceneLayer({
        name: layerName,
        color: resolvedColor,
        visible,
        locked: false,
      });
    }
  }

  static calculateBounds(entities: AnySceneEntity[]) {
    // 🏢 ADR-158: Centralized Infinity Bounds Initialization
    const bounds = createInfinityBounds();

    entities.forEach(entity => {
      switch (entity.type) {
        case 'line':
          bounds.minX = Math.min(bounds.minX, entity.start.x, entity.end.x);
          bounds.minY = Math.min(bounds.minY, entity.start.y, entity.end.y);
          bounds.maxX = Math.max(bounds.maxX, entity.start.x, entity.end.x);
          bounds.maxY = Math.max(bounds.maxY, entity.start.y, entity.end.y);
          break;
        case 'polyline':
          entity.vertices.forEach(v => {
            bounds.minX = Math.min(bounds.minX, v.x);
            bounds.minY = Math.min(bounds.minY, v.y);
            bounds.maxX = Math.max(bounds.maxX, v.x);
            bounds.maxY = Math.max(bounds.maxY, v.y);
          });
          break;
        case 'circle':
        case 'arc':
          bounds.minX = Math.min(bounds.minX, entity.center.x - entity.radius);
          bounds.minY = Math.min(bounds.minY, entity.center.y - entity.radius);
          bounds.maxX = Math.max(bounds.maxX, entity.center.x + entity.radius);
          bounds.maxY = Math.max(bounds.maxY, entity.center.y + entity.radius);
          break;
      }
    });

    return {
      min: { x: bounds.minX, y: bounds.minY },
      max: { x: bounds.maxX, y: bounds.maxY }
    };
  }

  static validateScene(scene: SceneModel): boolean {
    // ADR-358 Phase 9E-6a: layersById guaranteed post-9E-5; layers kept for legacy compat.
    if (!scene.entities || !scene.layersById || !scene.bounds) {
      return false;
    }

    // Check bounds validity
    const { min, max } = scene.bounds;
    if (isNaN(min.x) || isNaN(min.y) || isNaN(max.x) || isNaN(max.y)) {
      return false;
    }

    // Check entities validity.
    // ADR-358 Phase 9D-5a — validate stable `layerId` (post-9D-2 attribution). Legacy `.layer`
    // name check dropped; resolution at read-time goes through `LayerStore.getLayer(id)?.name`.
    if (scene.entities.some(entity => !entity.id || !entity.type || !(entity as { layerId?: string }).layerId)) {
      return false;
    }

    return true;
  }
}
