import type { DxfEntityUnion, DxfText, DxfOpening } from './dxf-types';
import type { Entity } from '../../types/entities';

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
    ...(entityWithMeasurement.measurement !== undefined && { measurement: entityWithMeasurement.measurement }),
    ...(entityWithMeasurement.showEdgeDistances !== undefined && { showEdgeDistances: entityWithMeasurement.showEdgeDistances }),
  };

  switch (entity.type) {
    case 'line':
      return { ...base, type: 'line', start: entity.start, end: entity.end };
    case 'circle':
      return { ...base, type: 'circle', center: entity.center, radius: entity.radius };
    case 'polyline':
      return { ...base, type: 'polyline', vertices: entity.vertices, closed: entity.closed };
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
      return {
        ...base,
        type: 'text',
        position: te.position,
        text: te.text,
        height: te.height,
        rotation: te.rotation,
        ...(te.textStyle && { textStyle: te.textStyle }),
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
        drawOrder: entity.drawOrder,
      } as unknown as Entity;
    default: {
      const exhaustiveCheck: never = entity;
      return exhaustiveCheck;
    }
  }
}
