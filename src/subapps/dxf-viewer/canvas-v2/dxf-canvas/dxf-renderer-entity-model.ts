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
    // ─── BIM direct-passthrough · quartet {kind, params, geometry, validation} (ADR-587 Φ5 seam · TIER-C dup audit) ───
    // Table-driven fall-through: every BIM variant carrying the standard flat quartet routes
    // through ONE return, replacing 17 byte-identical cases (the TIER-C duplicate audit target).
    // The switch (NOT a Record) is retained on purpose — the `default: never` guard is a strictly
    // stronger exhaustiveness guarantee than `Object.keys(Record)` (ADR-587 Φ5). A new BIM type
    // still MUST land a case here or tsc's `never` breaks. Per-renderer geometry contracts are
    // unchanged: foundation ADR-436 (footprint) · roof ADR-417 (faces+ridges) · mep-water-heater
    // ADR-408 DHW (footprint) · mep-underfloor ADR-408 Εύρος Β (area loop).
    case 'wall':
    case 'beam':
    case 'column':
    case 'foundation':
    case 'mep-fixture':
    case 'electrical-panel':
    case 'railing':
    case 'furniture':
    case 'roof':
    case 'mep-segment':
    case 'mep-fitting':
    case 'floorplan-symbol':
    case 'mep-manifold':
    case 'mep-radiator':
    case 'mep-boiler':
    case 'mep-water-heater':
    case 'mep-underfloor':
      return { ...base, type: entity.type, kind: entity.kind, params: entity.params, geometry: entity.geometry, validation: entity.validation } as unknown as Entity;
    // ─── BIM direct-passthrough WITHOUT validation · finishes & spaces ───────────────────────
    // Genuinely divergent from the quartet above: these carry NO `validation` field. No-God-shell —
    // kept a separate fall-through branch, NOT force-merged (adding `validation: undefined` would be
    // a behavioral change). floor-finish ADR-419 · thermal-space ADR-422 · wall-covering ADR-511
    // (live face strip per-frame) · space-separator ADR-437.
    case 'floor-finish':
    case 'thermal-space':
    case 'wall-covering':
    case 'space-separator':
      return { ...base, type: entity.type, kind: entity.kind, params: entity.params, geometry: entity.geometry } as unknown as Entity;
    case 'annotation-symbol':
      // ADR-583 — lightweight non-BIM annotation (North arrow). Divergent flat-field shape (position/
      // symbolId/sizeMm/rotation — NOT the BIM quartet); AnnotationSymbolRenderer reads them + the
      // catalog glyph. The exhaustive `never` guard below forces this case whenever the union grows.
      return {
        ...base, type: 'annotation-symbol',
        position: entity.position, kind: entity.kind, symbolId: entity.symbolId,
        sizeMm: entity.sizeMm, rotation: entity.rotation,
      } as unknown as Entity;
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
