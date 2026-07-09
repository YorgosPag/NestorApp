/**
 * ============================================================================
 * DXF EXPORT ADAPTER — scene → ezdxf request → artifact
 * ============================================================================
 *
 * Bridges the unified export core to the client-side DXF writer:
 *   1. filter by content scope (`resolveExportEntities`),
 *   2. decompose BIM composites → DXF primitives (`flattenSceneEntitiesForDxf`),
 *   3. build a `DxfExportSceneRequest`,
 *   4. render to a `.dxf` Blob via `writeDxfAscii` (fully offline — no backend).
 *
 * Pure request building (`buildDxfExportRequest`) is split from the Blob render
 * (`renderDxfBlob`) so the mapping is unit-testable.
 *
 * ADR-505 §B.
 */

import type { Entity } from '../../types/entities';
import type { SceneModel, SceneLayer, SceneBounds } from '../../types/scene-types';
import {
  createDefaultExportSettings,
  type DxfExportSceneRequest,
  type DxfVersion,
  type DxfUnit,
} from '../../types/dxf-export.types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { DimStyle } from '../../types/dimension';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { resolveEntityColorHex } from '../../systems/selection/select-similar-by-color';
import { resolveExportEntities } from '../core/export-entity-scope';
import { flattenSceneEntitiesForDxf } from '../core/bim-to-dxf-primitives';
import { collectOverlayDxfEntities } from '../core/overlay-dxf-collector';
import { usedCategoryLayerDefs } from '../core/dxf-category-layers';
import { writeDxfAscii } from '../core/dxf-ascii-writer';
import type { ResolvedExportFloor } from '../core/export-floor-scope';
import type { ExportArtifact, ExportEntityScope, DxfLineMode } from '../types';

/**
 * Stamp each entity's *rendered* colour onto `.color` BEFORE decomposition, so
 * BIM category colours (ADR-445) and ByLayer/ACI cascades survive into the DXF.
 * Decomposition turns a BIM entity into primitives and loses its category, so
 * the colour must be resolved here, on the original. Reuses the renderer's SSoT
 * (`resolveEntityColorHex`) — exported lines match what the canvas paints.
 */
export function stampRenderedColors(
  entities: readonly Entity[],
  layersById: Record<string, SceneLayer>,
): Entity[] {
  return entities.map((e) => {
    let hex: string | null = null;
    try {
      hex = resolveEntityColorHex(e, layersById);
    } catch {
      hex = null;
    }
    return hex ? { ...e, color: hex } : e;
  });
}

/** DXF unit string → drawing SceneUnits (for coordinate scaling). */
const DXF_UNIT_TO_SCENE: Partial<Record<DxfUnit, SceneUnits>> = {
  millimeters: 'mm',
  centimeters: 'cm',
  meters: 'm',
  inches: 'in',
  feet: 'ft',
};

export interface DxfExportOptions {
  readonly entityScope: ExportEntityScope;
  readonly version?: DxfVersion;
  readonly unit?: DxfUnit;
  /** Geometry mode — POLYLINE (AutoCAD) vs exploded LINEs (Tekton). */
  readonly lineMode?: DxfLineMode;
  /** Base name for the generated file (project name). */
  readonly baseName: string;
}

export interface BuiltDxfRequest {
  readonly request: DxfExportSceneRequest;
  readonly warnings: string[];
}

/**
 * Pure: build the ezdxf request for one scene + scope. Filters by content
 * scope, decomposes BIM → primitives, and assembles the request body.
 */
export function buildDxfExportRequest(
  scene: SceneModel,
  options: Pick<DxfExportOptions, 'entityScope' | 'version' | 'unit' | 'lineMode'>,
): BuiltDxfRequest {
  const selected = resolveExportEntities(scene.entities, options.entityScope);
  const colored = stampRenderedColors(selected, scene.layersById);
  const { entities, warnings } = flattenSceneEntitiesForDxf(colored);

  // ADR-505 (finish/rebar + §C fill) — σοβάδες/οπλισμός/γέμισμα είναι derived overlays
  // (όχι entities) → ξεχωριστός collector παράγει extra DXF primitives, gated «what's
  // visible». Δίνουμε `colored` ώστε το body fill να κληρονομεί το resolved χρώμα.
  const overlay = collectOverlayDxfEntities(colored, { lineMode: options.lineMode });

  const allEntities = [...entities, ...overlay.entities];

  const settings = createDefaultExportSettings();
  if (options.version) settings.version = options.version;
  if (options.unit) settings.units = options.unit;

  const request: DxfExportSceneRequest = {
    scene: {
      ...scene,
      entities: allEntities,
      // ADR-505 §C — register ΜΟΝΟ τους per-category layers που όντως χρησιμοποιήθηκαν
      // (re-layered bodies)· ο writer δεν βγάζει LAYER table → χρειάζεται name resolution.
      layersById: { ...scene.layersById, ...usedCategoryLayerDefs(allEntities), ...overlay.layers },
    },
    settings,
    entityIds: null,
    layerNames: null,
  };

  return { request, warnings };
}

/**
 * Resolve the DIMSTYLE definitions the exported dimensions reference, from the
 * dim-style registry SSoT (ADR-362 Round 25). Unique `styleId`s → `DimStyle`s;
 * unknown ids (custom styles absent from this session) are skipped — AutoCAD then
 * falls back to STANDARD for those, which is the safe default. Returns `[]` when
 * the scene has no dimensions (→ writer keeps the bare, table-less envelope).
 */
export function collectDimStylesForExport(entities: readonly Entity[]): DimStyle[] {
  const registry = getDimStyleRegistry();
  const seen = new Set<string>();
  const styles: DimStyle[] = [];
  for (const e of entities) {
    if (e.type !== 'dimension') continue;
    const styleId = (e as unknown as { styleId?: string }).styleId;
    if (!styleId || seen.has(styleId)) continue;
    seen.add(styleId);
    const style = registry.getStyle(styleId);
    if (style) styles.push(style);
  }
  return styles;
}

/**
 * Render a built DXF request to a `.dxf` Blob, fully client-side (no backend).
 * Coordinates are scaled from the scene's drawing units to the chosen DXF unit
 * (e.g. scene metres → DXF metres = ×1; scene mm → DXF metres = ×0.001), so the
 * file is dimensionally correct in Tekton/AutoCAD.
 */
export function renderDxfBlob(request: DxfExportSceneRequest, lineMode?: DxfLineMode): Blob {
  const dxf = writeDxfAscii(request.scene.entities, {
    layersById: request.scene.layersById,
    scale: coordinateScale(request.scene.units, request.settings.units),
    mmScale: mmToOutputScale(request.settings.units),
    lineMode,
    // ADR-362 Round 25 — emit a DIMSTYLE table so native dimensions resolve to a
    // real style (not STANDARD). Empty for dimension-free scenes → bare envelope.
    dimStyles: collectDimStylesForExport(request.scene.entities),
  });
  return new Blob([dxf], { type: 'application/dxf' });
}

/** Factor to convert scene-unit coordinates into the target DXF unit. */
export function coordinateScale(sceneUnits: SceneUnits, dxfUnit: DxfUnit): number {
  const target = DXF_UNIT_TO_SCENE[dxfUnit];
  if (!target) return 1; // exotic unit → leave coordinates as-is.
  return mmToSceneUnits(target) / mmToSceneUnits(sceneUnits);
}

/** Factor to convert a millimetre value (e.g. element height) into the DXF unit. */
export function mmToOutputScale(dxfUnit: DxfUnit): number {
  const target = DXF_UNIT_TO_SCENE[dxfUnit];
  return target ? mmToSceneUnits(target) : 1;
}

/**
 * Export a single resolved floor to a DXF artifact (one `.dxf` blob).
 * The filename is floor-aware so multi-floor zip packaging stays unambiguous.
 */
export function exportFloorToDxf(
  floor: ResolvedExportFloor,
  options: DxfExportOptions,
): { artifact: ExportArtifact; warnings: string[] } {
  const { request, warnings } = buildDxfExportRequest(floor.scene, options);
  const filename = buildFloorFilename(options.baseName, floor.level.name, 'dxf');
  return {
    artifact: { filename, blob: renderDxfBlob(request, options.lineMode) },
    warnings,
  };
}

/**
 * Merge every floor into ONE scene for `all-single` export: each floor's
 * entities + layers are namespaced with its `FLnn_` prefix so a single DXF
 * keeps each storey on its own layers (no overlap ambiguity). Pure.
 */
export function mergeFloorsToSingleDxfScene(
  floors: readonly ResolvedExportFloor[],
  entityScope: ExportEntityScope,
  lineMode?: DxfLineMode,
): { scene: SceneModel; warnings: string[] } {
  const entities: Entity[] = [];
  const layersById: Record<string, SceneLayer> = {};
  const warnings: string[] = [];
  let bounds: SceneBounds | null = null;
  let units: SceneModel['units'] = 'mm';

  for (const floor of floors) {
    const selected = resolveExportEntities(floor.scene.entities, entityScope);
    const colored = stampRenderedColors(selected, floor.scene.layersById);
    const flat = flattenSceneEntitiesForDxf(colored);
    warnings.push(...flat.warnings);

    // ADR-505 (finish/rebar + §C fill) — overlays ανά όροφο, με το ΙΔΙΟ FLnn_ namespacing.
    const overlay = collectOverlayDxfEntities(colored, { lineMode });

    const floorEntities = [...flat.entities, ...overlay.entities];
    const prefix = floor.layerPrefix;
    for (const e of floorEntities) {
      entities.push(prefix ? { ...e, layerId: `${prefix}${e.layerId}` } : e);
    }
    // ADR-505 §C — register χρησιμοποιημένους per-category layers (re-layered bodies)
    // δίπλα στα αρχικά + overlay layers, ΠΡΙΝ το FLnn_ prefix.
    const floorLayers = {
      ...floor.scene.layersById,
      ...usedCategoryLayerDefs(floorEntities),
      ...overlay.layers,
    };
    for (const [id, layer] of Object.entries(floorLayers)) {
      const newId = prefix ? `${prefix}${id}` : id;
      layersById[newId] = prefix
        ? { ...layer, id: newId, name: `${prefix}${layer.name}` }
        : layer;
    }

    bounds = bounds ? unionBounds(bounds, floor.scene.bounds) : floor.scene.bounds;
    units = floor.scene.units;
  }

  return {
    scene: {
      entities,
      layersById,
      bounds: bounds ?? { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      units,
    },
    warnings,
  };
}

function unionBounds(a: SceneBounds, b: SceneBounds): SceneBounds {
  return {
    min: { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y) },
    max: { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y) },
  };
}

/** `Project_Floor.dxf`, filesystem-safe. */
export function buildFloorFilename(baseName: string, floorName: string, ext: string): string {
  const safe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '');
  const base = safe(baseName) || 'export';
  const floor = safe(floorName);
  return floor ? `${base}_${floor}.${ext}` : `${base}.${ext}`;
}
