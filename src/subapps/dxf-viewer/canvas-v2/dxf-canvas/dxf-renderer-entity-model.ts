import type { DxfEntityUnion, DxfText, DxfOpening } from './dxf-types';
import type { Entity } from '../../types/entities';
// ADR-557 — the single TEXT_RENDER_FIELDS passthrough SSoT (anti-drift; see text-render-fields.ts).
import { pickTextRenderFields } from '../../bim/text/text-render-fields';

function mapDxfLineTypeToEnterprise(
  dxfLineType: string | undefined,
): 'solid' | 'dashed' | 'dotted' | 'dashdot' {
  const mapping: Record<string, 'solid' | 'dashed' | 'dotted' | 'dashdot'> = {
    'solid': 'solid',
    'dashed': 'dashed',
    'dotted': 'dotted',
    'dashdot': 'dashdot',
    'dash-dot': 'dashdot',
    'dash-dot-dot': 'dashdot',
  };
  const key = dxfLineType || 'solid';
  return mapping[key] || 'solid';
}

export function buildEntityModelFromDxf(
  entity: DxfEntityUnion,
  isSelected: boolean,
  resolved: { colorHex: string; lineWidthPx: number; alpha: number; dashMm?: ReadonlyArray<number> },
): Entity {
  const entityWithLineType = entity as typeof entity & { lineType?: string };
  const entityWithMeasurement = entity as typeof entity & {
    measurement?: boolean;
    showEdgeDistances?: boolean;
  };
  const base = {
    id: entity.id,
    visible: entity.visible,
    selected: isSelected,
    layerId: entity.layerId ?? '',
    color: resolved.colorHex,
    lineType: mapDxfLineTypeToEnterprise(entityWithLineType.lineType),
    lineweight: resolved.lineWidthPx,
    // ADR-510 Φ2 — resolved metric dash pattern; BaseEntityRenderer.setupStyle
    // converts mm → px at stroke time. Absent/[] ⇒ solid (zero regression).
    ...(resolved.dashMm && resolved.dashMm.length > 0 && { dashMm: resolved.dashMm }),
    // ADR-510 Φ2E #2 — per-object linetype scale (CELTSCALE «Βήμα»). The stroke-time
    // dash sizer (`applyEntityLinetypeDash`) reads `entity.ltscale` off THIS EntityModel;
    // without carrying it here the ribbon «Βήμα» edit was silently dropped (always 1)
    // on every dashed-line render path (the LINE solid-batch fast path excludes dashed
    // linetypes, so this per-entity model is the ONLY path a dash can reach). Absent/1
    // ⇒ omitted (zero regression). Mirror of the `dashMm` spread above.
    ...(((entity as typeof entity & { ltscale?: number }).ltscale ?? 1) !== 1 && {
      ltscale: (entity as typeof entity & { ltscale?: number }).ltscale,
    }),
    ...(entityWithMeasurement.measurement !== undefined && { measurement: entityWithMeasurement.measurement }),
    ...(entityWithMeasurement.showEdgeDistances !== undefined && { showEdgeDistances: entityWithMeasurement.showEdgeDistances }),
  };

  switch (entity.type) {
    case 'line':
      return { ...base, type: 'line', start: entity.start, end: entity.end };
    case 'circle':
      return { ...base, type: 'circle', center: entity.center, radius: entity.radius };
    case 'polyline':
      // ADR-510 Φ3b/Φ3c — carry the per-segment arc/width parallel arrays into the
      // EntityModel so PolylineRenderer renders arcs (bulge) and the hit-test sees
      // them. Without this the renderer always saw straight segments. Absent ⇒ straight.
      return {
        ...base, type: 'polyline', vertices: entity.vertices, closed: entity.closed,
        ...(entity.bulges && { bulges: entity.bulges }),
        ...(entity.startWidths && { startWidths: entity.startWidths }),
        ...(entity.endWidths && { endWidths: entity.endWidths }),
      };
    case 'arc':
      return {
        ...base,
        type: 'arc',
        center: entity.center,
        radius: entity.radius,
        startAngle: entity.startAngle,
        endAngle: entity.endAngle,
        counterclockwise: entity.counterclockwise,
      };
    case 'text': {
      const te = entity as DxfText;
      // ADR-557 (Giorgio 2026-07-08) — copy EVERY flat text render field through the single
      // `TEXT_RENDER_FIELDS` list instead of hand-enumerating position/text/height/rotation/
      // textStyle/widthFactor/width/lineSpacing here. Previously this was a third hand-written
      // list that had to be kept in sync with the scene→DxfText converter + `DxfText` type; a
      // forgotten field (widthFactor, lineSpacing…) meant the ribbon wrote it but the renderer
      // never saw it. The contract test locks render ≡ scene projection.
      return {
        ...base,
        type: 'text',
        ...pickTextRenderFields(te),
      } as unknown as Entity;
    }
    case 'angle-measurement':
      return {
        ...base,
        type: 'angle-measurement',
        vertex: entity.vertex,
        point1: entity.point1,
        point2: entity.point2,
        angle: entity.angle,
      };
    case 'stair': {
      const s = entity.stairEntity;
      return {
        ...base,
        type: 'stair',
        kind: s.kind,
        params: s.params,
        geometry: s.geometry,
        validation: s.validation,
      } as unknown as Entity;
    }
    case 'dimension':
      return { ...base, ...entity.dimensionEntity } as unknown as Entity;
    case 'slab': {
      const s = entity.slabEntity;
      return { ...base, type: 'slab', kind: s.kind, params: s.params, geometry: s.geometry, validation: s.validation } as unknown as Entity;
    }
    case 'slab-opening': {
      const so = entity.slabOpeningEntity;
      return { ...base, type: 'slab-opening', kind: so.kind, params: so.params, geometry: so.geometry, validation: so.validation } as unknown as Entity;
    }
    case 'opening': {
      const o = (entity as DxfOpening).openingEntity;
      return { ...base, type: 'opening', kind: o.kind, params: o.params, geometry: o.geometry, validation: o.validation } as unknown as Entity;
    }
    case 'wall':
      return { ...base, type: 'wall', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'beam':
      return { ...base, type: 'beam', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'column':
      return { ...base, type: 'column', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'foundation':
      // ADR-436 Slice 1 — direct entity (same pattern as column/beam). FoundationRenderer
      // reads geometry.footprint + kind + params at top level.
      return { ...base, type: 'foundation', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'mep-fixture':
      return { ...base, type: 'mep-fixture', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'electrical-panel':
      return { ...base, type: 'electrical-panel', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'railing':
      return { ...base, type: 'railing', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'furniture':
      return { ...base, type: 'furniture', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'roof':
      // ADR-417 — direct entity (same pattern as slab/furniture). RoofRenderer
      // reads geometry.faces + ridges + footprint at top level.
      return { ...base, type: 'roof', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'floor-finish':
      // ADR-419 — direct entity (same pattern as roof/slab). FloorFinishRenderer
      // reads geometry.bbox + params.footprint + params.materialId at top level.
      return { ...base, type: 'floor-finish', kind: entity.kind, params: entity.params, geometry: entity.geometry } as unknown as Entity;
    case 'thermal-space':
      // ADR-422 — direct entity (same pattern as floor-finish). ThermalSpaceRenderer
      // reads geometry.bbox + params.footprint + params.useType at top level.
      return { ...base, type: 'thermal-space', kind: entity.kind, params: entity.params, geometry: entity.geometry } as unknown as Entity;
    case 'wall-covering':
      // ADR-511 — direct entity (same pattern as floor-finish). WallCoveringRenderer
      // computes the live face strip from the host wall (per-frame setWallsById).
      return { ...base, type: 'wall-covering', kind: entity.kind, params: entity.params, geometry: entity.geometry } as unknown as Entity;
    case 'space-separator':
      // ADR-437 — direct entity (same pattern as thermal-space). SpaceSeparatorRenderer
      // reads geometry.bbox + params.start/end at top level.
      return { ...base, type: 'space-separator', kind: entity.kind, params: entity.params, geometry: entity.geometry } as unknown as Entity;
    case 'mep-segment':
      return { ...base, type: 'mep-segment', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'mep-fitting':
      return { ...base, type: 'mep-fitting', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'floorplan-symbol':
      return { ...base, type: 'floorplan-symbol', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'annotation-symbol':
      // ADR-583 — lightweight non-BIM annotation (North arrow). Flat fields carried
      // to the EntityModel; AnnotationSymbolRenderer reads position/symbolId/sizeMm/
      // rotation + the catalog glyph. The exhaustive `never` guard below forces this
      // case whenever the DxfEntityUnion gains the variant.
      return {
        ...base, type: 'annotation-symbol',
        position: entity.position, kind: entity.kind, symbolId: entity.symbolId,
        sizeMm: entity.sizeMm, rotation: entity.rotation,
      } as unknown as Entity;
    case 'mep-manifold':
      return { ...base, type: 'mep-manifold', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'mep-radiator':
      return { ...base, type: 'mep-radiator', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'mep-boiler':
      return { ...base, type: 'mep-boiler', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'mep-water-heater':
      // ADR-408 DHW — direct entity (same pattern as mep-boiler). MepWaterHeaterRenderer
      // reads geometry.footprint + kind + params at top level.
      return { ...base, type: 'mep-water-heater', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'mep-underfloor':
      // ADR-408 Εύρος Β #3 — area-based underfloor loop (mirror mep-boiler passthrough).
      return { ...base, type: 'mep-underfloor', kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    case 'xline':
      return { ...base, type: 'xline', basePoint: entity.xlineEntity.basePoint, direction: entity.xlineEntity.direction } as unknown as Entity;
    case 'ray':
      return { ...base, type: 'ray', basePoint: entity.rayEntity.basePoint, direction: entity.rayEntity.direction } as unknown as Entity;
    case 'hatch':
      // ADR-507 S2 — direct entity· HatchRenderer reads boundaryPaths + fill/pattern
      // fields at top level (μέσω isHatchEntity cast).
      return {
        ...base,
        type: 'hatch',
        boundaryPaths: entity.boundaryPaths,
        fillType: entity.fillType,
        fillColor: entity.fillColor,
        patternType: entity.patternType,
        patternName: entity.patternName,
        patternScale: entity.patternScale,
        patternAngle: entity.patternAngle,
        patternOrigin: entity.patternOrigin,
        lineAngle: entity.lineAngle,
        lineSpacing: entity.lineSpacing,
        doubleCrossHatch: entity.doubleCrossHatch,
        islandStyle: entity.islandStyle,
        // ADR-507 Φ5 — gradient γέμισμα (αλλιώς ο HatchRenderer πέφτει σε solid).
        gradient: entity.gradient,
        // ADR-507 Φ2 — AutoCAD LWT πάχος γραμμών hatch. Το `base` εδώ προωθεί μόνο
        // `lineweight` (resolved px)· χωρίς αυτό το passthrough ο HatchRenderer βλέπει
        // lineweightMm:undefined και πέφτει στο DEFAULT_HATCH_LINE_WIDTH_PX.
        lineweightMm: entity.lineweightMm,
        drawOrder: entity.drawOrder,
      } as unknown as Entity;
    default: {
      const exhaustiveCheck: never = entity;
      return exhaustiveCheck;
    }
  }
}

/**
 * ADR-587 Φ5 (TIER-2 introspectable seam — coverage-only Μηχανισμός 2). Runtime mirror of
 * the `DxfEntityUnion` discriminant set that {@link buildEntityModelFromDxf} accepts. The
 * switch's `never` guard above already guarantees a case per variant; this manifest lifts
 * that compile-time fact to a runtime value so `__tests__/build-entity-model-coverage.test.ts`
 * can bind it to the descriptor domain (`RENDERABLE_ENTITY_TYPES`) — a new renderable type
 * with no DxfEntityUnion variant + case surfaces there instead of silently never modelling.
 *
 * Kept coverage-only (no switch→Record conversion) precisely because the `never` exhaustiveness
 * is a strictly stronger guarantee than `Object.keys(Record)` — converting would LOSE it.
 */
export const TO_ENTITY_MODEL_SUPPORTED_TYPES = [
  'line', 'circle', 'polyline', 'arc', 'text', 'angle-measurement', 'stair', 'dimension',
  'slab', 'slab-opening', 'opening', 'wall', 'beam', 'column', 'foundation', 'mep-fixture',
  'electrical-panel', 'railing', 'furniture', 'roof', 'floor-finish', 'thermal-space',
  'wall-covering', 'space-separator', 'mep-segment', 'mep-fitting', 'floorplan-symbol',
  'annotation-symbol', 'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater',
  'mep-underfloor', 'xline', 'ray', 'hatch',
] as const;

// Bridge 1 — every listed token IS a real `DxfEntityUnion` discriminant (typo/stale ⇒ tsc breaks).
const _listedAreUnionTypes: readonly DxfEntityUnion['type'][] = TO_ENTITY_MODEL_SUPPORTED_TYPES;
void _listedAreUnionTypes;
// Bridge 2 — every `DxfEntityUnion` discriminant is listed (a new variant left out ⇒ tsc breaks,
// mirroring the switch's `never`): if the manifest is complete `_MissingUnionType` is `never`.
type _MissingUnionType = Exclude<DxfEntityUnion['type'], (typeof TO_ENTITY_MODEL_SUPPORTED_TYPES)[number]>;
const _assertManifestComplete = (missing: _MissingUnionType): never => missing;
void _assertManifestComplete;
