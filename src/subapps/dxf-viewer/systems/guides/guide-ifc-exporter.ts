/**
 * @module systems/guides/guide-ifc-exporter
 * @description IFC Grid export + quantity takeoff (ADR-189 B88 + B96)
 *
 * B88: Export guides as IFC Grid elements (text-based IFC-SPF format, IFC4).
 * B96: Quantity takeoff based on grid (beam lengths, column count, slab area).
 *
 * IFC-SPF (STEP Physical File) is the standard exchange format for BIM data.
 * Generated output is valid IFC4 text that can be imported by:
 * - Autodesk Revit
 * - ArchiCAD
 * - Tekla Structures
 * - FreeCAD
 *
 * Pure functions, zero side effects. Pattern: cost-engine.ts
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ISO 16739-1:2024 (IFC4)
 * @since 2026-03-06
 */

import type { Guide } from './guide-types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

/** Structured IFC grid data (intermediate representation before SPF export) */
export interface IFCGridData {
  /** IFC schema version */
  readonly ifcVersion: 'IFC4';
  /** Grid axes */
  readonly grids: readonly IFCGridAxis[];
}

/** A single IFC grid axis */
interface IFCGridAxis {
  /** Guide ID */
  readonly id: string;
  /** Display name (label or auto-generated) */
  readonly name: string;
  /** Axis type ('X' | 'Y') */
  readonly axis: string;
  /** Position along perpendicular axis (meters) */
  readonly position: number;
}

/** Quantity takeoff result */
export interface QuantityTakeoff {
  /** Column count and total length */
  readonly columns: {
    readonly count: number;
    readonly totalLength_m: number;
  };
  /** Beam count and total length */
  readonly beams: {
    readonly count: number;
    readonly totalLength_m: number;
  };
  /** Total slab area (m²) */
  readonly slabArea_m2: number;
  /** Estimated cost (EUR) */
  readonly estimatedCost_EUR: number;
}

// ============================================================================
// DEFAULT COSTS (EUR — Central European average 2024)
// ============================================================================

interface UnitCosts {
  readonly columnPerMeter: number;
  readonly beamPerMeter: number;
  readonly slabPerM2: number;
}

const DEFAULT_UNIT_COSTS: UnitCosts = {
  columnPerMeter: 250,  // EUR/m (RC column, 400×400, including formwork)
  beamPerMeter: 180,    // EUR/m (RC beam, typical cross-section)
  slabPerM2: 85,        // EUR/m² (200mm RC slab)
};

const DEFAULT_FLOOR_HEIGHT = 3.2; // meters

// ============================================================================
// B88: IFC EXPORT
// ============================================================================

/**
 * Export guides as IFC-SPF (STEP Physical File) text.
 *
 * Generates a minimal valid IFC4 file with:
 * - FILE_DESCRIPTION + FILE_NAME + FILE_SCHEMA headers
 * - IFCPROJECT + IFCSITE + IFCBUILDING hierarchy
 * - IFCGRID with IFCGRIDAXIS entries for each X/Y guide
 *
 * Note: Diagonal (XZ) guides are excluded — IFC Grid only supports axis-aligned lines.
 *
 * @param guides - Current guide configuration
 * @returns IFC-SPF text string (ready to save as .ifc file)
 */
export function exportGuidesToIFC(guides: readonly Guide[]): string {
  const visible = guides.filter(g => g.visible && g.axis !== 'XZ');

  const xGuides = visible.filter(g => g.axis === 'X').sort((a, b) => a.offset - b.offset);
  const yGuides = visible.filter(g => g.axis === 'Y').sort((a, b) => a.offset - b.offset);

  const gridData: IFCGridData = {
    ifcVersion: 'IFC4',
    grids: [
      ...xGuides.map((g, i) => ({
        id: g.id,
        name: g.label ?? String.fromCharCode(65 + i), // A, B, C...
        axis: 'X',
        position: g.offset,
      })),
      ...yGuides.map((g, i) => ({
        id: g.id,
        name: g.label ?? String(i + 1), // 1, 2, 3...
        axis: 'Y',
        position: g.offset,
      })),
    ],
  };

  return generateIFCSPF(gridData, xGuides, yGuides);
}

/**
 * Build IFC grid data structure without generating SPF text.
 * Useful for previewing or further processing.
 */
export function buildIFCGridData(guides: readonly Guide[]): IFCGridData {
  const visible = guides.filter(g => g.visible && g.axis !== 'XZ');

  const xGuides = visible.filter(g => g.axis === 'X').sort((a, b) => a.offset - b.offset);
  const yGuides = visible.filter(g => g.axis === 'Y').sort((a, b) => a.offset - b.offset);

  return {
    ifcVersion: 'IFC4',
    grids: [
      ...xGuides.map((g, i) => ({
        id: g.id,
        name: g.label ?? String.fromCharCode(65 + i),
        axis: 'X',
        position: g.offset,
      })),
      ...yGuides.map((g, i) => ({
        id: g.id,
        name: g.label ?? String(i + 1),
        axis: 'Y',
        position: g.offset,
      })),
    ],
  };
}

function generateIFCSPF(
  data: IFCGridData,
  xGuides: readonly Guide[],
  yGuides: readonly Guide[],
): string {
  const timestamp = nowISO().slice(0, 19);
  const lines: string[] = [];

  // === HEADER ===
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('ViewDescription'),'2;1');`);
  lines.push(`FILE_NAME('grid-export.ifc','${timestamp}',('Nestor CAD'),(''),'',' ','');`);
  lines.push(`FILE_SCHEMA(('IFC4'));`);
  lines.push('ENDSEC;');
  lines.push('');

  // === DATA ===
  lines.push('DATA;');

  let entityId = 1;

  // Project
  const projectId = entityId++;
  lines.push(`#${projectId}=IFCPROJECT('${generateGuid()}',#${entityId},'Grid Export',$,$,$,$,$,$);`);

  // Owner history
  const ownerHistoryId = entityId++;
  lines.push(`#${ownerHistoryId}=IFCOWNERHISTORY(#${entityId},#${entityId + 1},$,.ADDED.,$,$,$,0);`);

  // Person + Organization (simplified)
  const personId = entityId++;
  lines.push(`#${personId}=IFCPERSON($,$,'NestorCAD',$,$,$,$,$);`);
  const orgId = entityId++;
  lines.push(`#${orgId}=IFCORGANIZATION($,'NestorCAD',$,$,$);`);
  const personOrgId = entityId++;
  lines.push(`#${personOrgId}=IFCPERSONANDORGANIZATION(#${personId},#${orgId},$);`);
  const appId = entityId++;
  lines.push(`#${appId}=IFCAPPLICATION(#${orgId},'1.0','Nestor Grid Exporter','NestorGrid');`);

  // Units
  const unitsId = entityId++;
  const lengthUnitId = entityId++;
  lines.push(`#${lengthUnitId}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
  lines.push(`#${unitsId}=IFCUNITASSIGNMENT((#${lengthUnitId}));`);

  // Geometric context
  const contextId = entityId++;
  const originId = entityId++;
  lines.push(`#${originId}=IFCCARTESIANPOINT((0.,0.,0.));`);
  lines.push(`#${contextId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${entityId},$);`);
  const axisId = entityId++;
  lines.push(`#${axisId}=IFCAXIS2PLACEMENT3D(#${originId},$,$);`);

  // Site + Building
  const siteId = entityId++;
  lines.push(`#${siteId}=IFCSITE('${generateGuid()}',#${ownerHistoryId},'Site',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);`);
  const buildingId = entityId++;
  lines.push(`#${buildingId}=IFCBUILDING('${generateGuid()}',#${ownerHistoryId},'Building',$,$,$,$,$,.ELEMENT.,$,$,$);`);

  // Grid axes
  const xAxisIds: number[] = [];
  const yAxisIds: number[] = [];

  // X axes (vertical grid lines)
  for (let i = 0; i < xGuides.length; i++) {
    const guide = xGuides[i];
    const name = guide.label ?? String.fromCharCode(65 + i);

    // Line geometry: vertical line at X = offset
    const pt1Id = entityId++;
    const pt2Id = entityId++;
    lines.push(`#${pt1Id}=IFCCARTESIANPOINT((${guide.offset.toFixed(4)},0.));`);
    lines.push(`#${pt2Id}=IFCCARTESIANPOINT((${guide.offset.toFixed(4)},1000.));`);

    const polyId = entityId++;
    lines.push(`#${polyId}=IFCPOLYLINE((#${pt1Id},#${pt2Id}));`);

    const curveId = entityId++;
    lines.push(`#${curveId}=IFCGRIDAXIS('${name}',$,#${polyId},.T.);`);
    xAxisIds.push(curveId);
  }

  // Y axes (horizontal grid lines)
  for (let i = 0; i < yGuides.length; i++) {
    const guide = yGuides[i];
    const name = guide.label ?? String(i + 1);

    const pt1Id = entityId++;
    const pt2Id = entityId++;
    lines.push(`#${pt1Id}=IFCCARTESIANPOINT((0.,${guide.offset.toFixed(4)}));`);
    lines.push(`#${pt2Id}=IFCCARTESIANPOINT((1000.,${guide.offset.toFixed(4)}));`);

    const polyId = entityId++;
    lines.push(`#${polyId}=IFCPOLYLINE((#${pt1Id},#${pt2Id}));`);

    const curveId = entityId++;
    lines.push(`#${curveId}=IFCGRIDAXIS('${name}',$,#${polyId},.T.);`);
    yAxisIds.push(curveId);
  }

  // IFCGRID
  const gridId = entityId++;
  const uAxes = xAxisIds.map(id => `#${id}`).join(',');
  const vAxes = yAxisIds.map(id => `#${id}`).join(',');
  lines.push(`#${gridId}=IFCGRID('${generateGuid()}',#${ownerHistoryId},'Structural Grid',$,$,$,$,$,(${uAxes}),(${vAxes}),$);`);

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}

/** Generate a pseudo-GUID for IFC (22-char base64-like) */
function generateGuid(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let guid = '';
  for (let i = 0; i < 22; i++) {
    guid += chars[Math.floor(Math.random() * 64)];
  }
  return guid;
}

// ============================================================================
// B96: QUANTITY TAKEOFF
// ============================================================================

/**
 * Compute quantity takeoff from guide grid.
 *
 * Assumes:
 * - One column at each grid intersection
 * - Beams along each grid line between adjacent intersections
 * - Slab covering the entire grid footprint
 *
 * @param guides - Current guide configuration
 * @param floorHeight - Floor-to-floor height (default: 3.2m)
 * @param unitCosts - Cost per unit (optional)
 */
export function computeQuantityTakeoff(
  guides: readonly Guide[],
  floorHeight: number = DEFAULT_FLOOR_HEIGHT,
  unitCosts: Partial<UnitCosts> = {},
): QuantityTakeoff {
  const costs: UnitCosts = { ...DEFAULT_UNIT_COSTS, ...unitCosts };
  const visible = guides.filter(g => g.visible);

  const xOffsets = visible.filter(g => g.axis === 'X').map(g => g.offset).sort((a, b) => a - b);
  const yOffsets = visible.filter(g => g.axis === 'Y').map(g => g.offset).sort((a, b) => a - b);

  if (xOffsets.length < 2 || yOffsets.length < 2) {
    return {
      columns: { count: 0, totalLength_m: 0 },
      beams: { count: 0, totalLength_m: 0 },
      slabArea_m2: 0,
      estimatedCost_EUR: 0,
    };
  }

  // Columns
  const columnCount = xOffsets.length * yOffsets.length;
  const columnTotalLength = columnCount * floorHeight;

  // Beams along X direction (connecting Y offsets at each X position)
  let beamCountX = 0;
  let beamLengthX = 0;
  for (let i = 0; i < yOffsets.length - 1; i++) {
    const span = yOffsets[i + 1] - yOffsets[i];
    beamCountX += xOffsets.length;
    beamLengthX += span * xOffsets.length;
  }

  // Beams along Y direction (connecting X offsets at each Y position)
  let beamCountY = 0;
  let beamLengthY = 0;
  for (let i = 0; i < xOffsets.length - 1; i++) {
    const span = xOffsets[i + 1] - xOffsets[i];
    beamCountY += yOffsets.length;
    beamLengthY += span * yOffsets.length;
  }

  const totalBeamCount = beamCountX + beamCountY;
  const totalBeamLength = beamLengthX + beamLengthY;

  // Slab
  const totalX = xOffsets[xOffsets.length - 1] - xOffsets[0];
  const totalY = yOffsets[yOffsets.length - 1] - yOffsets[0];
  const slabArea = totalX * totalY;

  // Cost
  const cost = Math.round(
    columnTotalLength * costs.columnPerMeter +
    totalBeamLength * costs.beamPerMeter +
    slabArea * costs.slabPerM2,
  );

  return {
    columns: {
      count: columnCount,
      totalLength_m: Math.round(columnTotalLength * 100) / 100,
    },
    beams: {
      count: totalBeamCount,
      totalLength_m: Math.round(totalBeamLength * 100) / 100,
    },
    slabArea_m2: Math.round(slabArea * 100) / 100,
    estimatedCost_EUR: cost,
  };
}
