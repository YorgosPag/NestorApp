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

import type { Entity, PointEntity } from '../../types/entities';
import { isPointEntity } from '../../types/entities';
import type { SceneModel, SceneLayer, SceneBounds } from '../../types/scene-types';
import {
  createDefaultExportSettings,
  DXF_UNIT_VALUES,
  type DxfExportSceneRequest,
  type DxfVersion,
  type DxfUnit,
  type DxfEncoding,
} from '../../types/dxf-export.types';
import { mmToSceneUnits, resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { DEFAULT_DRAWING_SCALE } from '../../config/bim-render-settings-types';
import type { DimStyle } from '../../types/dimension';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { resolveEntityColorHex } from '../../systems/selection/select-similar-by-color';
import { resolveExportEntities } from '../core/export-entity-scope';
import { flattenSceneEntitiesForDxf } from '../core/bim-to-dxf-primitives';
import { expandAnnotationsToPrimitives } from '../core/annotation-to-primitives';
import { collectOverlayDxfEntities } from '../core/overlay-dxf-collector';
import { usedCategoryLayerDefs } from '../core/dxf-category-layers';
import { writeDxfAscii } from '../core/dxf-ascii-writer';
import { resolveLinetype } from '../../stores/LinetypeRegistry';
import { isIsoBaselineLinetype, type LinetypeDef } from '../../config/linetype-iso-catalog';
// ADR-636 Στάδιο 2 Φ2.3 — drawing extents for $EXTMIN/$EXTMAX (correct zoom-extents on open),
// computed from the exported primitives via the canonical bounds SSoT (no local bounds math).
import { calculateTightBounds, isValidBounds, type BoundsEntity } from '../../utils/bounds-utils';
import { DEFAULT_BOUNDS } from '../../config/geometry-constants';
import type { Point2D } from '../../rendering/types/Types';
import { encodingService } from '../../io/encoding-service';
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
  /**
   * ADR-583/608 — annotation-scale denominator (1:N) used to size annotative
   * symbols/scale-bars when decomposing them to DXF primitives. Passed in by the
   * export service (live `drawingScale` SSoT) so `buildDxfExportRequest` stays
   * pure (no store read). Defaults to `DEFAULT_DRAWING_SCALE`.
   */
  readonly drawingScale?: number;
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
  options: Pick<DxfExportOptions, 'entityScope' | 'version' | 'unit' | 'lineMode' | 'drawingScale'>,
): BuiltDxfRequest {
  const selected = resolveExportEntities(scene.entities, options.entityScope);
  const colored = stampRenderedColors(selected, scene.layersById);
  const { entities: flat, warnings } = flattenSceneEntitiesForDxf(colored);

  // ADR-583/608 — explode annotation symbols + scale-bars into neutral primitives
  // so they land in the `.dxf` (Tekton/AutoCAD), mirroring the vector-PDF path.
  // Annotative sizing uses the caller-provided drawing scale → stays pure (no store).
  const entities = expandAnnotationsToPrimitives(flat, {
    drawingScale: options.drawingScale ?? DEFAULT_DRAWING_SCALE,
    sceneUnits: resolveSceneUnits({ units: scene.units }),
  });

  // ADR-505 (finish/rebar + §C fill) — σοβάδες/οπλισμός/γέμισμα είναι derived overlays
  // (όχι entities) → ξεχωριστός collector παράγει extra DXF primitives, gated «what's
  // visible». Δίνουμε `colored` ώστε το body fill να κληρονομεί το resolved χρώμα.
  const overlay = collectOverlayDxfEntities(colored, { lineMode: options.lineMode });

  const allEntities = [...entities, ...overlay.entities];

  const settings = createDefaultExportSettings();
  if (options.version) settings.version = options.version;
  if (options.unit) settings.units = options.unit;
  // ADR-636 Στάδιο 2 Φ2.2 — encoding is fully AUTO-derived from the target version (zero user
  // intervention, no encoding UI): pre-Unicode releases → Windows-1253 bytes, 2007+ → UTF-8.
  settings.encoding = versionToEncoding(settings.version);

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
  // ADR-636 Στάδιο 2 Φ2.1 — full LAYER table only on the AutoCAD (POLYLINE) path. The Tekton
  // dialect (`lines`) flattens/ignores tables → keep it minimal (bare, per its parser).
  const professionalTables = lineMode !== 'lines';
  const scale = coordinateScale(request.scene.units, request.settings.units);
  // ADR-636 Στάδιο 2 Φ2.3 — drawing extents (output units) only on the AutoCAD path; Tekton stays lean.
  const extents = professionalTables ? computeScaledExtents(request.scene.entities, scale) : undefined;
  const dxf = writeDxfAscii(request.scene.entities, {
    layersById: request.scene.layersById,
    scale,
    mmScale: mmToOutputScale(request.settings.units),
    lineMode,
    // ADR-362 Round 25 — emit a DIMSTYLE table so native dimensions resolve to a
    // real style (not STANDARD). Empty for dimension-free scenes → bare envelope.
    dimStyles: collectDimStylesForExport(request.scene.entities),
    // ADR-636 Στάδιο 1 — professional HEADER: declare a Unicode-capable $ACADVER (so the
    // UTF-8 text, incl. Greek, opens correctly in AutoCAD 2007+), the real $INSUNITS (units
    // the coordinates were written in → clean round-trip), and $DWGCODEPAGE.
    acadVer: resolveUnicodeSafeAcadVer(request.settings.version, request.settings.encoding),
    insunits: DXF_UNIT_VALUES[request.settings.units],
    codepage: encodingToCodepage(request.settings.encoding),
    // ADR-636 Στάδιο 2 Φ2.1 — real LTYPE + LAYER table (colour/on-off/freeze/lock/linetype/
    // lineweight/true-colour) so AutoCAD keeps the layer definitions instead of auto-creating
    // defaults. Layers = the very set the writer already uses for name resolution.
    tableLayers: professionalTables ? Object.values(request.scene.layersById) : undefined,
    customLinetypes: professionalTables ? collectCustomLinetypesForExport(request.scene) : undefined,
    // ADR-636 Στάδιο 2 Φ2.3 — richer HEADER (AutoCAD-standard): real drawing extents +
    // metric/decimal defaults, so the file opens zoomed to the model with correct scale/units.
    extMin: extents?.min,
    extMax: extents?.max,
    measurement: professionalTables ? 1 : undefined, // 1 = metric
    ltscale: professionalTables ? 1 : undefined,
    lunits: professionalTables ? 2 : undefined,       // 2 = decimal
    // ADR-636 Φ2.4 (D.1) — POINT glyph sysvars (round-trip C.1). Gated on the AutoCAD path so the
    // bare Tekton envelope stays header-less (an empty object spreads to nothing → no HEADER trigger).
    ...(professionalTables ? resolvePointDisplayForExport(request.scene.entities, scale) : {}),
  });
  // ADR-636 Στάδιο 2 Φ2.2 — encode the final bytes to match the declared version. UTF-8 (2007+)
  // writes the JS string as-is; a pre-Unicode target (cp1253) re-encodes the WHOLE string to
  // Windows-1253 bytes (ASCII structure 1:1, Greek → single codepage bytes) so the file matches
  // its own `$DWGCODEPAGE=ANSI_1253` and opens correctly in legacy AutoCAD/Tekton.
  const bytes = request.settings.encoding === 'cp1253'
    ? encodingService.encodeWindows1253(dxf)
    : dxf;
  return new Blob([bytes], { type: 'application/dxf' });
}

/**
 * ADR-636 Στάδιο 2 Φ2.3 — the drawing extents ($EXTMIN/$EXTMAX) in OUTPUT units. Computed from
 * the exported primitives via the canonical `calculateTightBounds` SSoT (no local bounds math),
 * then scaled by the same factor as every coordinate. Returns `undefined` for a degenerate/empty
 * result → the writer omits the extents (no bogus 0,0 zoom-extents box).
 */
export function computeScaledExtents(
  entities: readonly Entity[],
  scale: number,
): { min: Point2D; max: Point2D } | undefined {
  if (entities.length === 0) return undefined;
  const b = calculateTightBounds(entities as unknown as BoundsEntity[]);
  // `calculateTightBounds` returns the DEFAULT_BOUNDS (0,0→100,100) sentinel when no entity yields
  // computable bounds — treat that as "no extents" (skip) rather than write a bogus 100×100 box.
  const isSentinel =
    b.min.x === DEFAULT_BOUNDS.min.x && b.min.y === DEFAULT_BOUNDS.min.y &&
    b.max.x === DEFAULT_BOUNDS.max.x && b.max.y === DEFAULT_BOUNDS.max.y;
  if (!isValidBounds(b) || isSentinel) return undefined;
  return {
    min: { x: b.min.x * scale, y: b.min.y * scale },
    max: { x: b.max.x * scale, y: b.max.y * scale },
  };
}

/**
 * ADR-636 Φ2.4 (D.1) — drawing-wide POINT display sysvars for the HEADER, round-tripping the C.1
 * import (which baked $PDMODE/$PDSIZE per-point). Read back off the first point that carries them
 * (drawing-wide value → every point shares it). `$PDSIZE > 0` is a drawing-unit length → pre-scaled
 * to output units (mirror of extMin/extMax); ≤ 0 is a viewport-% → passed raw. No point / no baked
 * value → `{}` (AutoCAD's own point-display defaults apply).
 */
export function resolvePointDisplayForExport(
  entities: readonly Entity[],
  scale: number,
): { pdmode?: number; pdsize?: number } {
  const point = entities.find(
    (e): e is PointEntity => isPointEntity(e) && (e.pdMode != null || e.pdSize != null),
  );
  if (!point) return {};
  const pdsize = point.pdSize != null && point.pdSize > 0 ? point.pdSize * scale : point.pdSize;
  return {
    ...(point.pdMode != null && { pdmode: point.pdMode }),
    ...(pdsize != null && { pdsize }),
  };
}

/**
 * ADR-636 Στάδιο 2 Φ2.2 — auto-derive the text encoding from the target DXF version (AutoCAD
 * «Save As» model: the release drives encoding, not a separate user toggle). Pre-Unicode
 * releases (R12–2004) use the Windows-1253 codepage (this app is Greek-first); 2007+ (AC1021+)
 * use UTF-8. Keeps encoding fully automatic — the user only ever picks a version.
 */
export function versionToEncoding(version: DxfVersion): DxfEncoding {
  return PRE_UNICODE_VERSIONS.has(version) ? 'cp1253' : 'utf-8';
}

/**
 * ADR-636 Στάδιο 2 Φ2.1 — the non-ISO linetypes referenced by the scene's layers, resolved
 * from the LinetypeRegistry SSoT (`resolveLinetype`) for the exported LTYPE table. ISO baseline
 * names are skipped (implicit in every reader — the table writer omits them too). Distinct by
 * name; unresolved names (absent from this session) are left out (AutoCAD falls back to
 * Continuous). Mirrors `collectDimStylesForExport`'s registry-read pattern.
 */
export function collectCustomLinetypesForExport(scene: SceneModel): LinetypeDef[] {
  const seen = new Set<string>();
  const out: LinetypeDef[] = [];
  for (const layer of Object.values(scene.layersById)) {
    const name = layer.linetype;
    if (!name || seen.has(name) || isIsoBaselineLinetype(name)) continue;
    seen.add(name);
    const def = resolveLinetype(name);
    if (def) out.push(def);
  }
  return out;
}

/** DXF releases that predate Unicode (R2007/AC1021). Their DXF is codepage-encoded, so UTF-8
 * text written under them is read as ANSI and garbled. */
const PRE_UNICODE_VERSIONS: ReadonlySet<DxfVersion> = new Set(['AC1009', 'AC1015', 'AC1018']);

/**
 * Reconcile the declared `$ACADVER` with the byte encoding. Since Στάδιο 2 Φ2.2 auto-derives
 * `cp1253` for pre-Unicode versions (`versionToEncoding`), those are now **honored as-is**
 * (real Windows-1253 bytes → the requested R12/2000/2004 is kept). The bump only guards the
 * defensive edge case of a pre-Unicode version still paired with `utf-8` (which no live path
 * produces): there we raise `$ACADVER` to AC1021 so the UTF-8 bytes aren't read as ANSI and
 * garbled (Greek → «ÊËÉÌÁÊÁ»).
 */
export function resolveUnicodeSafeAcadVer(version: DxfVersion, encoding: DxfEncoding): DxfVersion {
  return encoding === 'utf-8' && PRE_UNICODE_VERSIONS.has(version) ? 'AC1021' : version;
}

/** DXF `$DWGCODEPAGE` for the chosen text encoding (Greek → ANSI_1253, else ANSI_1252). For a
 * UTF-8/AC1021+ file it is informational — the version drives decoding — but AutoCAD emits it. */
export function encodingToCodepage(encoding: DxfEncoding): string {
  return encoding === 'cp1253' ? 'ANSI_1253' : 'ANSI_1252';
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
