import type { SceneModel, AnySceneEntity, SceneLayer } from '../types/scene';
import { DxfEntityParser, type DxfHeaderData, type LayerColorMap } from './dxf-entity-parser';
import { DEFAULT_LAYER_COLOR, getLayerColor } from '../config/color-config';
import { getAciColor } from '../settings/standards/aci';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault, DXF_DEFAULT_LAYER } from '../config/layer-config';
// ADR-358 Phase 9C/9D — SceneLayer construction SSoT (auto-gens `lyr_<UUID-v4>` id).
import { createSceneLayer } from '../types/entities';
// 🏢 ADR-142: Centralized Default Font Size
import { TEXT_SIZE_LIMITS } from '../config/text-rendering-config';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds } from '../config/geometry-constants';
// 🏢 ADR-163: Centralized Vector Magnitude (replaces inline Math.sqrt patterns)
import { vectorMagnitude } from '../rendering/entities/shared/geometry-rendering-utils';

export class DxfSceneBuilder {
  static buildScene(content: string): SceneModel {

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
        // ADR-130: Centralized default layer
        const layerName = getLayerNameOrDefault(entity.layer as string);

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

    return {
      entities,
      layers,
      bounds,
      units: 'mm'
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

  /**
   * 🔧 TEXT HEIGHT NORMALIZATION (Enterprise-Grade)
   *
   * Κανονικοποιεί text/mtext entities που έχουν δυσανάλογα μεγάλο fontSize
   * σε σχέση με το μέγεθος της κάτοψης.
   *
   * Πρόβλημα: Διαφορετικά DXF αρχεία χρησιμοποιούν:
   * - Διαφορετικά INSUNITS (mm, cm, m, inches)
   * - Annotation scaling ενσωματωμένο στο text height
   * - DIMSCALE factors
   *
   * Λύση: Συνδυασμός 3 στρατηγικών:
   * 1. Εφαρμογή INSUNITS scaling
   * 2. Sanity clamp βάσει διαγωνίου κάτοψης
   * 3. Ανίχνευση annotation scale patterns
   *
   * @param entities - Τα entities προς έλεγχο
   * @param bounds - Τα bounds της κάτοψης
   * @param header - Parsed HEADER data (INSUNITS, DIMSCALE)
   * @returns Entities με κανονικοποιημένα text heights
   */
  private static normalizeTextHeights(
    entities: AnySceneEntity[],
    bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
    header: DxfHeaderData
  ): AnySceneEntity[] {
    // Υπολογισμός διαγωνίου κάτοψης
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    // 🏢 ADR-163: Centralized vectorMagnitude (replaces inline Math.sqrt)
    const diagonal = vectorMagnitude({ x: width, y: height });

    // Guard: Αν η διαγώνιος είναι πολύ μικρή, μην κάνεις τίποτα
    if (diagonal < 1) {
      return entities;
    }

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🏢 ENTERPRISE: Text height normalization strategy                      ║
    // ╚════════════════════════════════════════════════════════════════════════╝

    // ╔═══════════════════════════════════════════════════════════════════════╗
    // ║ 🔴 CRITICAL FIX: Detect METERS without HEADER                         ║
    // ║ Πολλά αρχεία DXF είναι σε METERS αλλά χωρίς HEADER/$INSUNITS.        ║
    // ║ Αν η διαγώνιος είναι 10-100 units και τα text heights είναι <1,      ║
    // ║ είναι πιθανότατα σε meters. Τα κείμενα πρέπει να κλιμακωθούν.       ║
    // ╚═══════════════════════════════════════════════════════════════════════╝
    const isLikelyMeters =
      header.insunits === 0 && // Unitless (no HEADER)
      diagonal >= 10 &&         // Diagonal suggests meters (10m+)
      diagonal <= 500;          // But not too large (under 500m = reasonable building)

    if (isLikelyMeters) {
      console.warn('⚠️ DXF UNIT DETECTION: File appears to be in METERS without HEADER!', {
        diagonal: diagonal.toFixed(2),
        hint: 'Text heights will be scaled for better visibility'
      });
    }

    // Strategy 1: INSUNITS-based detection
    // Αν INSUNITS = 6 (meters), τα text heights είναι πιθανώς σε m
    // οπότε πρέπει να τα μετατρέψουμε σε mm
    const unitScale = DxfEntityParser.getUnitScale(header.insunits);

    // Strategy 2: Annotation scale detection
    // Κοινά annotation scales: 1, 10, 25, 50, 100
    const commonAnnoScales = [1, 10, 20, 25, 50, 100, 200, 500];

    // Strategy 3: Sanity clamp based on bounds
    // Αν fontSize > 5% της διαγωνίου → θεωρείται "τεράστιο"
    const MAX_TEXT_HEIGHT_RATIO = 0.05; // 5% of diagonal
    const TARGET_TEXT_HEIGHT_RATIO = 0.008; // 0.8% of diagonal (τυπικό readable μέγεθος)

    const maxAllowedHeight = diagonal * MAX_TEXT_HEIGHT_RATIO;
    const targetHeight = diagonal * TARGET_TEXT_HEIGHT_RATIO;

    // Statistics για logging
    let normalizedCount = 0;
    let unitScaledCount = 0;
    let annoScaleDetectedCount = 0;

    const result = entities.map(entity => {
      // Μόνο για text entities
      if (entity.type !== 'text') {
        return entity;
      }

      // Type guard για fontSize
      const textEntity = entity as typeof entity & { fontSize?: number; height?: number };
      // 🏢 ADR-142: Use centralized DEFAULT_FONT_SIZE for fallback
      let currentHeight = textEntity.fontSize || textEntity.height || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
      let appliedFix = '';

      // ╔═══════════════════════════════════════════════════════════════════════╗
      // ║ FIX 1: METERS WITHOUT HEADER - Critical scaling fix                  ║
      // ║                                                                       ║
      // ║ Πρόβλημα: Αρχεία σε meters χωρίς HEADER έχουν text heights 0.1-0.5m ║
      // ║ που είναι ~26x μεγαλύτερα σε ratio από κανονικά αρχεία σε mm.       ║
      // ║ Όταν γίνει zoom, τα κείμενα διαστάσεων εμφανίζονται ΤΕΡΑΣΤΙΑ.       ║
      // ║                                                                       ║
      // ║ Λύση: ΜΕΙΩΣΗ text heights κατά factor ~20x για να έχουν σωστό ratio ║
      // ║ Κανονικά αρχεία (mm): text/diagonal ≈ 0.01%                          ║
      // ║ Αρχεία σε meters: text/diagonal ≈ 0.26% → πρέπει να γίνει 0.01%     ║
      // ╚═══════════════════════════════════════════════════════════════════════╝
      if (isLikelyMeters && currentHeight > 0.01 && currentHeight < 2) {
        // Text heights 0.01-2 σε αρχείο meters → ΜΕΙΩΣΗ για σωστό ratio
        const originalHeight = currentHeight;
        // Διαίρεση με 20 για να φέρουμε το ratio από 0.26% σε ~0.013%
        const METERS_SCALE_FACTOR = 20;
        currentHeight = currentHeight / METERS_SCALE_FACTOR;
        unitScaledCount++;
        appliedFix = `METERS÷${METERS_SCALE_FACTOR} (${originalHeight.toFixed(3)} → ${currentHeight.toFixed(4)})`;
      }

      // Standard INSUNITS=6 (explicit meters) handling - same logic
      if (header.insunits === 6 && currentHeight < 10 && currentHeight > 0.001 && !appliedFix) {
        const originalHeight = currentHeight;
        const METERS_SCALE_FACTOR = 20;
        currentHeight = currentHeight / METERS_SCALE_FACTOR;
        unitScaledCount++;
        appliedFix = `INSUNITS=6÷${METERS_SCALE_FACTOR} (${originalHeight.toFixed(3)} → ${currentHeight.toFixed(4)})`;
      }

      // ╔═══════════════════════════════════════════════════════════════════════╗
      // ║ FIX 2: Annotation scale detection                                    ║
      // ║ Αν το height είναι ακριβές πολλαπλάσιο ενός common annotation scale  ║
      // ║ και το αποτέλεσμα θα ήταν reasonable, εφάρμοσε το scale              ║
      // ╚═══════════════════════════════════════════════════════════════════════╝
      if (currentHeight > maxAllowedHeight) {
        for (const scale of commonAnnoScales) {
          const normalized = currentHeight / scale;
          // Αν το normalized είναι reasonable (1-50 units), χρησιμοποίησέ το
          if (normalized >= 1 && normalized <= 50 && normalized < maxAllowedHeight) {
            currentHeight = normalized;
            annoScaleDetectedCount++;
            appliedFix = `AnnoScale (÷${scale})`;
            break;
          }
        }
      }

      // ╔═══════════════════════════════════════════════════════════════════════╗
      // ║ FIX 3: Sanity clamp (fallback)                                       ║
      // ║ Αν μετά από όλα τα fixes το height είναι ακόμα τεράστιο, clamp it   ║
      // ╚═══════════════════════════════════════════════════════════════════════╝
      if (currentHeight > maxAllowedHeight) {
        normalizedCount++;
        const originalHeight = currentHeight;
        currentHeight = targetHeight;
        appliedFix = appliedFix ? `${appliedFix} + Clamp` : 'Clamp';

        return {
          ...entity,
          fontSize: currentHeight,
          height: currentHeight,
          _originalFontSize: originalHeight,
          _normalizationFix: appliedFix
        };
      }

      // Αν εφαρμόστηκε fix χωρίς clamp
      if (appliedFix) {
        return {
          ...entity,
          fontSize: currentHeight,
          height: currentHeight,
          _normalizationFix: appliedFix
        };
      }

      return entity;
    });

    // Log για debugging
    const totalFixed = normalizedCount + unitScaledCount + annoScaleDetectedCount;
    if (totalFixed > 0) {
      console.debug(`📏 TEXT NORMALIZATION COMPLETE:`, {
        totalFixed,
        unitScaled: unitScaledCount,
        annoScaleDetected: annoScaleDetectedCount,
        clamped: normalizedCount,
        diagonal: diagonal.toFixed(2),
        maxAllowed: maxAllowedHeight.toFixed(2),
        targetHeight: targetHeight.toFixed(2),
        insunits: DxfEntityParser.getUnitsName(header.insunits)
      });
    }

    return result;
  }

  static validateScene(scene: SceneModel): boolean {
    // Basic validation
    if (!scene.entities || !scene.layers || !scene.bounds) {
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
