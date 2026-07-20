import type { SceneModel, AnySceneEntity, SceneLayer } from '../types/scene';
import { DxfEntityParser, type LayerColorMap } from './dxf-entity-parser';
// ADR-635 Φ C.4 — LTYPE table pre-pass: register the DXF's custom linetypes into the
// runtime registry BEFORE entities convert, so per-entity linetype names (group 6) that
// reference custom `.lin` patterns resolve at render instead of falling back to solid.
import { parseLinetypeTable } from './dxf-linetype-table-parser';
import { registerLinetypes } from '../stores/LinetypeRegistry';
// ADR-635 Φ C.5 — STYLE table pre-pass: map each text-style name → its font family so
// TEXT/MTEXT (group 7) resolve to the real font. Reuses the ADR-344 STYLE parser SSoT.
import { buildStyleFontMap, buildStyleHandleFontMap } from '../text-engine/parser';
// ADR-635 Φ C.7 — MLINESTYLE (OBJECTS section) pre-pass: map style name/handle → N line
// elements so an MLINE draws its real parallel lines instead of a single reference path.
import { buildMlineStyleMap } from './dxf-mline-style-parser';
// ADR-635 Φ2 — INSERT/BLOCK expansion (block-definition map + placement transform).
import { parseBlockDefinitions } from './dxf-block-parser';
import { instantiateInsert, transformInsertHatch, DEFAULT_SCENE_ENTITY_BUDGET, type ExpandContext } from './dxf-block-expander';
// ADR-640 — a NAMED single INSERT is preserved as a first-class BlockEntity (not flattened).
import { createBlockInstance } from '../systems/block/block-instance';
// ADR-640 M3 — SSoT gate for WHICH block names preserve vs flatten (named + real-anonymous *U/*A/*E
// preserve; *X hatch / *D dimension decorations flatten). Fixes furniture *U# breaking to loose lines.
import { shouldPreserveBlockName } from './dxf-anonymous-block';
import { isBlockEntity, type BlockEntity } from '../types/entities';
// ADR-640 Φ7 — block-aware bounds (expands blocks to members before the primitive bounds pass).
import { calculateBoundsWithBlocks } from './dxf-block-aware-bounds';
// ADR-635 Φ C.6 — R12 associative-hatch INSERT (ACAD/HATCH XDATA) → single HATCH entity.
import { tryConvertInsertHatch } from './dxf-hatch-xdata-converter';
// ADR-635 Φ3 — fault-tolerant import: skipped/failed entities are RECORDED, not fatal.
import {
  createImportDiagnostics,
  recordParsed,
  recordSkipped,
  recordError,
  type ImportDiagnostics,
} from './dxf-import-diagnostics';
import { DEFAULT_LAYER_COLOR, getLayerColor } from '../config/color-config';
import { getAciColor } from '../settings/standards/aci';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault, DXF_DEFAULT_LAYER } from '../config/layer-config';
// ADR-358 Phase 9C/9D — SceneLayer construction SSoT (auto-gens `lyr_<UUID-v4>` id).
import { createSceneLayer } from '../types/entities';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
// ADR-635 ΦC.13 / N.18 — extracted pure entity-array bounds SSoT (keeps this file lean).
import { computeEntityArrayBounds } from './dxf-entity-array-bounds';
// ADR-358 Phase 8 — propagate real $INSUNITS to SceneModel.units via SSoT.
import type { SceneUnits } from './scene-units';
// ADR-462 canonical-mm — source-unit resolution + one-shot scale-to-mm pass (extracted SSoT).
import { applyCanonicalMmScale } from './dxf-canonical-mm-scale';
// ADR-462 Round 21 — drop far-flung off-drawing junk (origin ASHADE blocks) that would
// anchor the scene bbox to the geo-referenced magnitude and make the viewport un-frameable.
import { dropOutOfExtentsEntities } from './dxf-out-of-extents-filter';
// ADR-510 Φ2H — per-scene base LTSCALE resolver (fit dash density so mm-convention patterns
// stay visible on meter-scale drawings; ADR-462 bakes geometry to mm). SSoT lives with the
// autoscale helpers so the scene-builder stays lean.
import { resolveSceneLinetypeScale } from '../rendering/linetype-autoscale';

/**
 * Resolve a layer's real color from the two authoritative sources (SSoT, shared by layer
 * registration and per-entity BYLAYER resolution): the parsed LAYER table, else the
 * `COLOR_<n>` layer-name → ACI convention. Returns undefined when neither applies (callers
 * decide the final fallback: hash color for layers, leave-uncolored for entities).
 */
function resolveLayerColor(layerName: string, layerColors: LayerColorMap): string | undefined {
  const fromTable = layerColors[layerName]?.color;
  if (fromTable) return fromTable;

  const colorMatch = layerName.match(/^COLOR_(\d+)$/i);
  if (colorMatch) {
    const aciIndex = parseInt(colorMatch[1], 10);
    if (aciIndex >= 1 && aciIndex <= 255) return getAciColor(aciIndex);
  }
  return undefined;
}

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
    return DxfSceneBuilder.buildSceneWithDiagnostics(content, unitsOverride).scene;
  }

  /**
   * ADR-635 Φ3 — the fault-tolerant core. Same scene construction as {@link buildScene}, but
   * returns the accumulated {@link ImportDiagnostics} alongside the scene so callers (server
   * route, client import, worker) can surface a Revit-style "Import Warnings" report. A single
   * malformed entity is recorded and skipped — it never aborts the whole import.
   */
  static buildSceneWithDiagnostics(
    content: string,
    unitsOverride?: SceneUnits,
  ): { scene: SceneModel; diagnostics: ImportDiagnostics } {
    const diagnostics = createImportDiagnostics();

    // ⚠️ DO NOT filter empty lines. DXF is a strict (code\nvalue) stream and AutoCAD writes
    // EMPTY string values (empty TEXT/handle/name codes). Dropping blank lines shifts the
    // fixed 2-line stride in parseEntities/parseHeader/table-parsers → alignment corrupts and
    // ~90% of entities are silently lost (real R12 sample: 4483 → 467). Trim strips \r/spaces;
    // empty values survive as '' so every (code,value) pair stays aligned.
    const lines = content.split('\n').map(line => line.trim());

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

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🏢 ADR-635 Φ C.4 — CUSTOM LINETYPE PRE-PASS                            ║
    // ║                                                                        ║
    // ║ Register the DXF's LTYPE table (custom `.lin` dash patterns) into the  ║
    // ║ runtime LinetypeRegistry BEFORE any entity converts, so a per-entity   ║
    // ║ linetype name (group 6) that references a custom pattern resolves via  ║
    // ║ `resolveLinetypePatternMm` instead of falling back to a solid line.    ║
    // ║ Idempotent (registry dedupes by name); server-safe (dxf-import origin  ║
    // ║ ⇒ no localStorage write). $LTSCALE (header.ltscale) is intentionally   ║
    // ║ NOT applied here — see DxfHeaderData.ltscale.                          ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    // ADR-642 Φ2-B — resolve embedded-text `340` STYLE handles → font family so an imported
    // AutoCAD complex linetype (`──GAS──`) carries a full `complex` def and renders its text.
    const styleHandleFonts = buildStyleHandleFontMap(content);
    const { linetypes: customLinetypes } = parseLinetypeTable(lines, styleHandleFonts);
    if (customLinetypes.length > 0) registerLinetypes(customLinetypes);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🏢 ADR-635 Φ C.5 — TEXT STYLE (FONT) PRE-PASS                          ║
    // ║                                                                        ║
    // ║ Parse the STYLE table (raw `content` — parseStyleTable is line-based    ║
    // ║ internally) into a { styleName → fontFamily } map, threaded to the      ║
    // ║ TEXT/MTEXT converters so an entity's text-style name (group 7) renders  ║
    // ║ with the drawing's real font (romans → Liberation Sans via the render   ║
    // ║ font-resolver's SHX substitution) instead of the '' default. Per-drawing║
    // ║ (like dimStyles), NOT a global store — no per-drawing prop mutates a     ║
    // ║ shared registry (mirror of the DIMSTYLE map, not LinetypeRegistry).     ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    const styleFonts = buildStyleFontMap(content);

    // ADR-635 Φ C.7 — MLINESTYLE pre-pass (OBJECTS section, line-based). Per-drawing map
    // (like dimStyles/styleFonts), threaded to convertMline so an MLINE expands to its N
    // parallel element polylines. Absent OBJECTS/MLINESTYLE ⇒ empty map ⇒ STANDARD default.
    const mlineStyles = buildMlineStyleMap(lines);

    const entities: AnySceneEntity[] = [];
    const layers: Record<string, SceneLayer> = {};

    // Add default layer with real ACI color
    // ADR-358 Phase 9C/9D-2 — factory injects stable `lyr_<UUID-v4>` id (auto-gen via
    // enterprise-id-convenience.generateLayerId). Replaces legacy inline literal that
    // bypassed the id-gen contract.
    const defaultLayerColor = layerColors[DXF_DEFAULT_LAYER]?.color || DEFAULT_LAYER_COLOR;
    layers[DXF_DEFAULT_LAYER] = createSceneLayer({
      name: DXF_DEFAULT_LAYER,
      // ADR-635 Φ C.17 — βλ. registerLayer· το «0» είναι το ΣΗΜΑΝΤΙΚΟΤΕΡΟ match, γιατί
      // κάθε νέο BIM entity καρφώνεται στο id του (useSceneState.onEntityCreated).
      sourceName: DXF_DEFAULT_LAYER,
      color: defaultLayerColor,
      visible: true,
      locked: false,
    });

    // ADR-635 Φ2 — parse BLOCK definitions, then parse ONLY the ENTITIES section so block-
    // definition geometry is not emitted standalone (it is placed via INSERT expansion below).
    // ADR-635 Φ3 follow-up — the SAME diagnostics collector is threaded into the parser so
    // genuinely-unsupported entity TYPES (REGION/3DSOLID/MESH/…), dropped BEFORE this loop, are
    // recorded as skipped instead of vanishing silently. One SSoT collector, no twin.
    const blockDefs = parseBlockDefinitions(lines, diagnostics);
    const entitiesRange = DxfEntityParser.findSectionRange(lines, 'ENTITIES') ?? undefined;
    const parsedEntities = DxfEntityParser.parseEntities(lines, entitiesRange, diagnostics);

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

    // Per-entity post-processing (layer registration + BYLAYER color resolution). Shared by
    // directly-converted entities AND block-expanded ones (ADR-635 Φ2) so both resolve layers
    // and colors through the SAME code — no twin. ADR-358 Phase 9D boundary casts preserved.
    // Layer registration + BYLAYER color resolution for ONE entity (mutates layerId/color in place).
    // Split out of processSceneEntity so BLOCK members — which live inside the container and never
    // enter the live `entities` list — can be resolved with the SAME code (ADR-640).
    const resolveEntityLayerAndColor = (entity: AnySceneEntity): void => {
      const layerName = getLayerNameOrDefault(entity.layerId);

      // Register layer with REAL ACI colors from parsed LAYER table
      DxfSceneBuilder.registerLayer(layers, layerName, layerColors);

      // Attribute stable `layerId` from the registered SceneLayer (id-keyed routing downstream).
      (entity as { layerId?: string }).layerId = layers[layerName].id;

      // 🎨 BYLAYER color: if the entity has no explicit color, apply the layer's real color.
      // Priority: parsed LAYER table → COLOR_X name pattern (ACI) → (registerLayer hash fallback).
      const entityColor = (entity as { color?: string }).color;
      if (!entityColor) {
        const resolvedColor = resolveLayerColor(layerName, layerColors);
        if (resolvedColor) {
          (entity as { color?: string }).color = resolvedColor;
          byLayerColorCount++;
        }
      } else {
        explicitColorCount++;
      }
    };

    const processSceneEntity = (entity: AnySceneEntity): void => {
      resolveEntityLayerAndColor(entity);
      entities.push(entity);
    };

    // ADR-640 — a BlockEntity keeps its members OUT of the live scene, so they never pass through
    // processSceneEntity. Resolve their registered layer id + BYLAYER colour here (recursively for
    // nested blocks) so expandBlockInstance renders them exactly like top-level entities.
    const resolveBlockMemberLayers = (block: BlockEntity): void => {
      for (const m of block.entities) {
        resolveEntityLayerAndColor(m as AnySceneEntity);
        if (isBlockEntity(m)) resolveBlockMemberLayers(m);
      }
    };

    // ADR-635 Φ2 — INSERT expands the referenced block's geometry with its placement transform;
    // every other entity converts directly. Both funnel through processSceneEntity.
    // ADR-635 Φ3 — diagnostics + a shared entity budget bound pathological block explosions.
    const expandCtx: ExpandContext = {
      header,
      dimStyles,
      styleFonts,
      mlineStyles,
      idSeq: { n: 0 },
      diagnostics,
      budget: { max: DEFAULT_SCENE_ENTITY_BUDGET, used: 0 },
    };

    // Fault-tolerant loop: one bad entity is recorded and skipped — the import continues
    // (Revit/Figma behaviour), never a whole-file abort.
    parsedEntities.forEach((entityData, index) => {
      const type = entityData.type || 'UNKNOWN';
      try {
        if (entityData.type === 'INSERT') {
          // ADR-635 Φ C.6 — R12/AC1009 has no HATCH entity: a hatch is an anonymous block
          // (`*X#`) of exploded pattern lines, INSERTed with ACAD/HATCH XDATA. Reconstruct it
          // as a SINGLE hatch entity (modern-AutoCAD behaviour) so it is «perceived as a hatch»
          // instead of thousands of loose lines. Only when the XDATA yields a usable line-edge
          // boundary; otherwise fall through to normal block explosion (safe degradation).
          const insertHatch = tryConvertInsertHatch(entityData, index);
          if (insertHatch) {
            // ADR-635 Φ C.11 — the XDATA boundary cache is in the `*X#` block's LOCAL space;
            // place it with the SAME INSERT transform the block explosion uses so the hatch
            // lands at the drawing origin, not raw geo-referenced coords (~2.8e6 → off-screen
            // + Home over-zoom). Byte-identical to where the exploded pattern lines would sit.
            processSceneEntity(transformInsertHatch(insertHatch, entityData, blockDefs));
            recordParsed(diagnostics, 'HATCH');
            return;
          }
          // ADR-640 Phase-0 gate — a single (non-MINSERT) INSERT whose block name is preservable
          // is kept as a first-class BlockEntity (selectable/movable/explodable, round-trips to
          // INSERT). ADR-640 M3: preservable = named OR real-anonymous (`*U#` dynamic/anonymous,
          // `*A#` array, `*E#`); the `*X#` (R12 hatch, handled above) and `*D#` (dimension) anon
          // decorations still flatten via the SSoT `shouldPreserveBlockName`. MINSERT arrays
          // (cols×rows > 1) keep the legacy flatten (a future phase may wrap arrays as ArrayEntity).
          const blockName = entityData.data['2'];
          const cols = Math.max(1, parseInt(entityData.data['70'] ?? '1', 10) || 1);
          const rows = Math.max(1, parseInt(entityData.data['71'] ?? '1', 10) || 1);
          if (blockName && shouldPreserveBlockName(blockName) && cols === 1 && rows === 1) {
            const def = blockDefs.get(blockName);
            const block = def ? createBlockInstance(blockName, def, entityData, blockDefs, expandCtx) : null;
            if (block) {
              resolveBlockMemberLayers(block);
              processSceneEntity(block);
              recordParsed(diagnostics, 'INSERT');
              return;
            }
          }
          for (const e of instantiateInsert(entityData, blockDefs, expandCtx)) processSceneEntity(e);
          recordParsed(diagnostics, 'INSERT');
          return;
        }
        const result = DxfEntityParser.convertToSceneEntity(entityData, index, header, dimStyles, styleFonts, mlineStyles);
        if (!result) {
          // Unsupported entity type (e.g. SOLID/POINT/3DFACE) — was silently dropped; now counted.
          recordSkipped(diagnostics, type);
          return;
        }
        // Normalize to array (DIMENSION returns multiple entities: text + lines)
        const converted = Array.isArray(result) ? result : [result];
        for (const entity of converted) processSceneEntity(entity);
        recordParsed(diagnostics, type);
      } catch (err) {
        recordError(diagnostics, {
          kind: type,
          reason: err instanceof Error ? err.message : String(err),
          at: `#${index}`,
        });
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

    // ADR-462 Round 21 — drop far-flung off-drawing junk (legacy ASHADE blocks / orphan
    // ATTRIBs parked at the origin while the drawing is geo-referenced far away). Left in,
    // they anchor the scene bbox from 0 to the geo magnitude → the viewport frames a giant
    // empty box → the real drawing is a sub-pixel speck ("empty canvas"). AutoCAD/Revit
    // exclude them from $EXTMIN/$EXTMAX + Zoom-Extents; we do the same. No-op when extents
    // are absent or nothing lies entirely outside them (normal drawings untouched).
    const { kept: drawingEntities, dropped: offDrawingCount } = dropOutOfExtentsEntities(
      entities, header.extmin, header.extmax,
    );
    if (offDrawingCount > 0) {
      console.debug(`🧹 Dropped ${offDrawingCount} off-drawing entities (outside $EXTMIN/$EXTMAX)`);
    }

    // Calculate bounds (ADR-640 Φ7 — block-aware: expands any BlockEntity to its members first).
    const bounds = calculateBoundsWithBlocks(drawingEntities, DxfSceneBuilder.calculateBounds);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🔧 BACKUP COMPATIBILITY (2026-01-03)                                   ║
    // ║ Επαναφορά στην απλή προσέγγιση του backup που δούλευε σωστά.          ║
    // ║ Τα entities περνάνε απευθείας χωρίς text height normalization.        ║
    // ╚════════════════════════════════════════════════════════════════════════╝

    // ADR-462 CANONICAL-mm — resolve the SOURCE unit (what the DXF was authored in), then
    // scale every coordinate to millimetres so the stored scene is always mm. Extracted to
    // `dxf-canonical-mm-scale` (N.7.1 file-size split) — the resolution priority and the
    // per-entity scale loop live there as ONE testable SSoT.
    const { entities: finalEntities, bounds: finalBounds } = applyCanonicalMmScale({
      entities: drawingEntities,
      bounds,
      header,
      unitsOverride,
      diagnostics,
      recomputeBounds: (list) => calculateBoundsWithBlocks(list, DxfSceneBuilder.calculateBounds),
    });

    // ADR-358 Phase 9E-1: build id-keyed mirror alongside name-keyed `layers`.
    const layersById: Record<string, SceneLayer> = Object.fromEntries(
      Object.values(layers).map((l) => [l.id, l]),
    );

    // ADR-510 Φ2H — resolve the per-scene base LTSCALE (dash density). The file's own
    // $LTSCALE wins when non-default; otherwise auto-fit so mm-convention dash patterns
    // land at a visible density on this (possibly meter-scale) drawing. Only computed
    // when non-solid linetypes are actually used — else left undefined (neutral).
    const linetypeScale = resolveSceneLinetypeScale(
      finalEntities, layers, finalBounds, header.ltscale,
    );

    const scene: SceneModel = {
      entities: finalEntities,
      layersById,
      bounds: finalBounds,
      // ADR-462 — geometry is now millimetres by construction; downstream stops guessing.
      units: 'mm',
      dimStyles: Object.keys(dimStyles).length > 0 ? dimStyles : undefined,
      headerDimscale: header.dimscale, // ADR-362 R10 — annotative-style resolution in dim-style-importer
      ...(linetypeScale !== undefined && { linetypeScale }),
    };

    return { scene, diagnostics };
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

      // Try 1+2: LAYER table → COLOR_X name (shared SSoT). Try 3: hash-based fallback.
      const visible = layerColors[layerName]?.visible ?? true;
      const resolvedColor = resolveLayerColor(layerName, layerColors) ?? getLayerColor(layerName);

      // ADR-358 Phase 9C/9D-2 — factory auto-gens stable `lyr_<UUID-v4>` id.
      // ADR-635 Φ C.17 — `sourceName` = το όνομα ΤΟΥ ΑΡΧΕΙΟΥ, immutable. Επιτρέπει στο
      // `reconcileSceneLayerIdentity` να ξαναβρεί αυτό το layer σε επόμενο import ΑΚΟΜΑ
      // ΚΑΙ αν ο χρήστης το έχει μετονομάσει στο μεταξύ.
      layers[layerName] = createSceneLayer({
        name: layerName,
        sourceName: layerName,
        color: resolvedColor,
        visible,
        locked: false,
      });
    }
  }

  // ADR-635 ΦC.13 / N.18 — delegates to the extracted pure SSoT (keeps this class lean;
  // the static entry point stays for `calculateBoundsWithBlocks` + the hatch-bounds test).
  static calculateBounds(entities: AnySceneEntity[]) {
    return computeEntityArrayBounds(entities);
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
