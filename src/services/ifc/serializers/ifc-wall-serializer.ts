/**
 * IFC4 Wall Serializer (ADR-369 §Q8.4 — TASK A)
 *
 * Παράγει IfcWall / IfcWallStandardCase ανά WallEntity:
 *   - IfcLocalPlacement στο wall.start με X axis κατά τη διεύθυνση του τοίχου.
 *   - IfcRectangleProfileDef (xDim=length, yDim=thickness, centered στο L/2).
 *   - IfcExtrudedAreaSolid κατά [0,0,1] depth=height.
 *   - Storey containment καταχωρείται στο `SerializerContext.elementsByStorey`
 *     — γράφεται από το `CombinedEntitySerializer` wrapper.
 *
 * Units: όλες οι μετρήσεις του Nestor σε mm — μετατροπή σε m πριν το graph.
 * Storey elevation από `floor.elevation` (ήδη σε ΜΕΤΡΑ, ADR-369 §1).
 *
 * Height policy (ADR-369 §9 Q5):
 *   - `topBinding === 'unconnected' && unconnectedHeight` → `unconnectedHeight`
 *   - αλλιώς → `params.height`
 */

import type { WallEntity, WallCategory } from '@/subapps/dxf-viewer/bim/types/wall-types';
import { isWallEntity } from '@/subapps/dxf-viewer/types/entities';
import { computeWallTypeUValue } from '@/subapps/dxf-viewer/bim/thermal/wall-assembly-thermal';
import { generateIfcGuid } from '@/services/enterprise-id-convenience';

import {
  IfcGraph,
  enumValue,
  lbl,
  real,
  ref,
  bool,
  typed,
} from '../ifc-entity-graph';
import { MM_TO_M } from '../ifc-units';
import type { SpatialHierarchyOutput } from '../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../ifc-exporter.service';

import type { SerializerContext } from './serializer-context';
import { pushElementForStorey } from './serializer-context';
import {
  appendLocalPlacement,
  appendRectangleSweep,
  buildFloorLookup,
  readFloorElevationM,
} from './serializer-helpers';
import {
  appendPropertySingleValue,
  appendPropertySet,
  appendRelDefinesByProperties,
} from './serializer-psets';

// ─── Public entry point ─────────────────────────────────────────────────────

export function serializeWalls(
  graph: IfcGraph,
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  ctx: SerializerContext,
): void {
  if (!params.scenes) return;
  const floors = buildFloorLookup(params.floors);
  for (const [floorId, scene] of params.scenes) {
    const storeyID = spatial.storeyIDs.get(floorId);
    if (storeyID == null) continue;
    const storeyZ = readFloorElevationM(floors.byId.get(floorId));
    const includePsets = params.includePsets ?? true;
    for (const entity of scene.entities) {
      if (!isWallEntity(entity)) continue;
      writeWall(graph, entity, {
        storeyID,
        storeyZ,
        contextID: spatial.contextID,
        includePsets,
        ctx,
      });
    }
  }
}

// ─── Per-wall record emission ───────────────────────────────────────────────

interface WallWriteContext {
  readonly storeyID: number;
  readonly storeyZ: number;
  readonly contextID: number;
  readonly includePsets: boolean;
  readonly ctx: SerializerContext;
}

function writeWall(graph: IfcGraph, wall: WallEntity, w: WallWriteContext): void {
  const geom = computeWallExtrusion(wall);
  if (!geom) return;

  const placementID = appendLocalPlacement(
    graph,
    { x: geom.startXM, y: geom.startYM, z: w.storeyZ + geom.baseOffsetM },
    { x: 0, y: 0, z: 1 },
    { x: geom.dirX, y: geom.dirY, z: 0 },
  );

  const shapeID = appendRectangleSweep(graph, {
    contextID: w.contextID,
    profile: {
      xDim: geom.lengthM,
      yDim: geom.thicknessM,
      centerX: geom.lengthM / 2,
      centerY: 0,
    },
    direction: { x: 0, y: 0, z: 1 },
    depth: geom.heightM,
  });

  const wallID = graph.add(wall.ifcType.toUpperCase(), [
    lbl(wall.ifcGuid),
    null,
    wall.name ? lbl(wall.name) : null,
    null,
    null,
    ref(placementID),
    ref(shapeID),
    null,
    enumValue(mapWallPredefinedType(wall.params.category)),
  ]);

  w.ctx.wallIDs.set(wall.id, wallID);
  pushElementForStorey(w.ctx, w.storeyID, wallID);

  appendWallMaterial(graph, wallID, wall, geom.thicknessM);
  if (w.includePsets) appendWallCommonPset(graph, wallID, wall);
}

// ─── Geometry projection (mm → m) ───────────────────────────────────────────

interface WallExtrusion {
  readonly startXM: number;
  readonly startYM: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly lengthM: number;
  readonly thicknessM: number;
  readonly heightM: number;
  readonly baseOffsetM: number;
}

function computeWallExtrusion(wall: WallEntity): WallExtrusion | null {
  const { start, end, thickness, height, baseOffset, topBinding, unconnectedHeight } = wall.params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm < 1) return null;

  const effectiveHeightMm =
    topBinding === 'unconnected' && typeof unconnectedHeight === 'number'
      ? unconnectedHeight
      : height;

  return {
    startXM: start.x * MM_TO_M,
    startYM: start.y * MM_TO_M,
    dirX: dx / lengthMm,
    dirY: dy / lengthMm,
    lengthM: lengthMm * MM_TO_M,
    thicknessM: thickness * MM_TO_M,
    heightM: effectiveHeightMm * MM_TO_M,
    baseOffsetM: (baseOffset ?? 0) * MM_TO_M,
  };
}

// ─── PredefinedType mapping ─────────────────────────────────────────────────

function mapWallPredefinedType(category: WallCategory): string {
  switch (category) {
    case 'exterior':
      return 'STANDARD';
    case 'interior':
    case 'partition':
      return 'PARTITIONING';
    case 'parapet':
      return 'PARAPET';
    case 'fence':
      return 'NOTDEFINED';
    default:
      return 'NOTDEFINED';
  }
}

// ─── Material layer set (from DNA) ──────────────────────────────────────────

/**
 * Εκπέμπει `IfcMaterialLayerSet` + `IfcMaterialLayerSetUsage` + `IfcRelAssociatesMaterial`
 * για τον τοίχο. Revit-parity: στρώσεις από DNA, πάχος σε ΜΕΤΡΑ.
 * Αν δεν υπάρχει DNA (bare structural wall), παραλείπεται (no-op).
 */
function appendWallMaterial(
  graph: IfcGraph,
  wallID: number,
  wall: WallEntity,
  thicknessM: number,
): void {
  const { dna } = wall.params;
  if (!dna || dna.layers.length === 0) return;

  const matLayerIDs = dna.layers.map((layer) => {
    const materialID = graph.add('IFCMATERIAL', [lbl(layer.materialId), null, null]);
    return graph.add('IFCMATERIALLAYER', [
      ref(materialID),
      real(layer.thickness * MM_TO_M),
      null, null, null, null, null,
    ]);
  });

  const layerSetID = graph.add('IFCMATERIALLAYERSET', [
    matLayerIDs.map((id) => ref(id)),
    lbl(wall.name ?? 'Wall Assembly'),
    null,
  ]);

  const usageID = graph.add('IFCMATERIALLAYERSETUSAGE', [
    ref(layerSetID),
    enumValue('AXIS2'),
    enumValue('POSITIVE'),
    real(-thicknessM / 2),
    null,
  ]);

  graph.add('IFCRELASSOCIATESMATERIAL', [
    lbl(generateIfcGuid()),
    null, null, null,
    [ref(wallID)],
    ref(usageID),
  ]);
}

// ─── Pset_WallCommon ─────────────────────────────────────────────────────────

/**
 * Εκπέμπει `Pset_WallCommon` με `IsExternal`, `LoadBearing`,
 * `ThermalTransmittance` (U από DNA — 0 αν δεν υπάρχει DNA).
 * Πεδία/defaults SSoT: `pset-templates.ts` (ADR-369 §Q8.2).
 */
function appendWallCommonPset(
  graph: IfcGraph,
  wallID: number,
  wall: WallEntity,
): void {
  const { category, dna } = wall.params;
  const isExternal = category === 'exterior' || category === 'parapet';
  const isLoadBearing = category !== 'partition' && category !== 'fence';
  const uValue = dna ? computeWallTypeUValue(dna) : 0;

  const propIDs = [
    appendPropertySingleValue(graph, 'IsExternal', bool(isExternal)),
    appendPropertySingleValue(graph, 'LoadBearing', bool(isLoadBearing)),
    appendPropertySingleValue(
      graph,
      'ThermalTransmittance',
      typed('IfcThermalTransmittanceMeasure', real(uValue)),
    ),
  ];

  const psetID = appendPropertySet(graph, 'Pset_WallCommon', propIDs);
  appendRelDefinesByProperties(graph, [wallID], psetID);
}
