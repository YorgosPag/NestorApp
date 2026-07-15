/**
 * IFC4 Opening Serializer (ADR-369 §Q8.4 — TASK E)
 *
 * Παράγει IfcOpeningElement + IfcDoor / IfcWindow ανά OpeningEntity:
 *
 *   1. IfcOpeningElement — voiding solid extruded κάθετα στον host wall axis,
 *      κεντραρισμένο γύρω από wall.thickness ώστε να κόβει και τις δύο όψεις.
 *      Linked στο host wall μέσω `IfcRelVoidsElement` (IFC4 §8.7.3.4).
 *   2. IfcDoor / IfcWindow — panel solid (τυπικό πάχος 40mm), κεντραρισμένο
 *      στο wall thickness. Linked στο opening μέσω `IfcRelFillsElement`.
 *   3. Door/Window σε `SerializerContext.elementsByStorey` για containment.
 *      (Το opening δεν συμμετέχει στο containment — voids the host wall.)
 *
 * Lookup του host wall: scan όλων των scenes (όχι μόνο της opening's floor)
 * γιατί `opening.params.wallId` αναφέρεται σε wall.id (μη-φλωρ-όριο).
 *
 * Units: mm → m πριν το graph. Wall storey elevation από spatial.storeyIDs +
 * floor lookup.
 */

import {
  isWallHostedOpening,
  type OpeningEntity,
  type OpeningKind,
} from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import { isOpeningEntity, isWallEntity } from '@/subapps/dxf-viewer/types/entities';
import { generateIfcGuid } from '@/services/enterprise-id-convenience';

import {
  IfcGraph,
  enumValue,
  lbl,
  real,
  ref,
} from '../ifc-entity-graph';
import { MM_TO_M } from '../ifc-units';
import type { SpatialHierarchyOutput } from '../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../ifc-exporter.service';

import type { SerializerContext } from './serializer-context';
import { pushElementForStorey } from './serializer-context';
import {
  appendLocalPlacement,
  appendRectangleSweepOffset,
  buildFloorLookup,
  readFloorElevationM,
  type Vec3,
} from './serializer-helpers';

// ─── Public entry point ─────────────────────────────────────────────────────

export function serializeOpenings(
  graph: IfcGraph,
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  ctx: SerializerContext,
): void {
  if (!params.scenes) return;
  const walls = indexWallsById(params);
  const floors = buildFloorLookup(params.floors);

  for (const [floorId, scene] of params.scenes) {
    const storeyID = spatial.storeyIDs.get(floorId);
    if (storeyID == null) continue;
    const storeyZ = readFloorElevationM(floors.byId.get(floorId));
    for (const entity of scene.entities) {
      if (!isOpeningEntity(entity)) continue;
      // ADR-615 — a self-hosted opening voids no wall, so there is no
      // IfcRelVoidsElement to write for it.
      if (!isWallHostedOpening(entity)) continue;
      const wall = walls.get(entity.params.wallId);
      if (!wall) continue;
      writeOpening(graph, entity, wall, {
        storeyID,
        storeyZ,
        contextID: spatial.contextID,
        ctx,
      });
    }
  }
}

// ─── Per-opening emission ───────────────────────────────────────────────────

interface OpeningWriteContext {
  readonly storeyID: number;
  readonly storeyZ: number;
  readonly contextID: number;
  readonly ctx: SerializerContext;
}

function writeOpening(
  graph: IfcGraph,
  opening: OpeningEntity,
  wall: WallEntity,
  w: OpeningWriteContext,
): void {
  const placement = projectOpeningPlacement(opening, wall, w.storeyZ);
  if (!placement) return;

  const wallIfcID = w.ctx.wallIDs.get(wall.id);
  // Wall must already be serialized — order of CombinedEntitySerializer ensures.
  if (wallIfcID == null) return;

  const widthM = opening.params.width * MM_TO_M;
  const heightM = opening.params.height * MM_TO_M;
  const wallThicknessM = wall.params.thickness * MM_TO_M;
  const voidDepthM = wallThicknessM * 1.5;
  const panelDepthM = 0.04;

  // ─ 1. IfcOpeningElement (the void) ────────────────────────────────────────
  const voidPlacementID = appendLocalPlacement(
    graph,
    placement.origin,
    placement.zAxis,
    placement.refDirection,
  );
  const voidShapeID = appendRectangleSweepOffset(graph, {
    contextID: w.contextID,
    profile: { xDim: widthM, yDim: heightM },
    direction: { x: 0, y: 0, z: 1 },
    depth: voidDepthM,
    localZOffset: -voidDepthM / 2,
  });
  const openingID = graph.add('IFCOPENINGELEMENT', [
    lbl(opening.ifcGuid),
    null,
    opening.name ? lbl(opening.name) : null,
    null,
    null,
    ref(voidPlacementID),
    ref(voidShapeID),
    null,
    enumValue('OPENING'),
  ]);
  w.ctx.openingIDs.set(opening.id, openingID);

  // ─ 2. IfcRelVoidsElement (host_wall ⇨ opening) ────────────────────────────
  graph.add('IFCRELVOIDSELEMENT', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    ref(wallIfcID),
    ref(openingID),
  ]);

  // ─ 3. IfcDoor / IfcWindow (the panel) ─────────────────────────────────────
  const panelPlacementID = appendLocalPlacement(
    graph,
    placement.origin,
    placement.zAxis,
    placement.refDirection,
  );
  const panelShapeID = appendRectangleSweepOffset(graph, {
    contextID: w.contextID,
    profile: { xDim: widthM, yDim: heightM },
    direction: { x: 0, y: 0, z: 1 },
    depth: panelDepthM,
    localZOffset: -panelDepthM / 2,
  });
  // IFC4 IfcDoor / IfcWindow share the same 13-arg layout. Trailing
  // operation/partitioning attributes left null (caller did not classify).
  const panelID = graph.add(opening.ifcType.toUpperCase(), [
    lbl(generateIfcGuid()),
    null,
    opening.name ? lbl(opening.name) : null,
    null,
    null,
    ref(panelPlacementID),
    ref(panelShapeID),
    null,
    real(heightM),
    real(widthM),
    enumValue(mapPanelPredefinedType(opening.params.kind, opening.ifcType)),
    null,
    null,
  ]);

  // ─ 4. IfcRelFillsElement (opening ⇨ panel) ────────────────────────────────
  graph.add('IFCRELFILLSELEMENT', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    ref(openingID),
    ref(panelID),
  ]);

  pushElementForStorey(w.ctx, w.storeyID, panelID);
}

// ─── Placement projection ───────────────────────────────────────────────────

interface OpeningPlacement {
  readonly origin: Vec3;
  readonly zAxis: Vec3;
  readonly refDirection: Vec3;
}

function projectOpeningPlacement(
  opening: OpeningEntity,
  wall: WallEntity,
  storeyZm: number,
): OpeningPlacement | null {
  const dx = wall.params.end.x - wall.params.start.x;
  const dy = wall.params.end.y - wall.params.start.y;
  const lengthMm = Math.hypot(dx, dy);
  if (lengthMm < 1) return null;
  const dirX = dx / lengthMm;
  const dirY = dy / lengthMm;

  const offsetCenterMm = opening.params.offsetFromStart + opening.params.width / 2;
  const verticalCenterMm =
    (wall.params.baseOffset ?? 0) + opening.params.sillHeight + opening.params.height / 2;

  const xWorldM = (wall.params.start.x + offsetCenterMm * dirX) * MM_TO_M;
  const yWorldM = (wall.params.start.y + offsetCenterMm * dirY) * MM_TO_M;
  const zWorldM = storeyZm + verticalCenterMm * MM_TO_M;

  return {
    origin: { x: xWorldM, y: yWorldM, z: zWorldM },
    zAxis: { x: dirY, y: -dirX, z: 0 },
    refDirection: { x: dirX, y: dirY, z: 0 },
  };
}

// ─── Wall lookup index ──────────────────────────────────────────────────────

function indexWallsById(params: IfcExportParams): Map<string, WallEntity> {
  const out = new Map<string, WallEntity>();
  if (!params.scenes) return out;
  for (const scene of params.scenes.values()) {
    for (const entity of scene.entities) {
      if (isWallEntity(entity)) {
        out.set(entity.id, entity);
      }
    }
  }
  return out;
}

// ─── Panel PredefinedType ───────────────────────────────────────────────────

function mapPanelPredefinedType(kind: OpeningKind, ifcType: 'IfcDoor' | 'IfcWindow'): string {
  if (ifcType === 'IfcWindow') {
    return 'WINDOW';
  }
  // IfcDoor variants — IfcDoorTypeEnum PredefinedType. Sectional/roll-up garage
  // doors map to GATE (Revit-grade); all other door families → DOOR.
  if (kind === 'overhead-door') return 'GATE';
  return 'DOOR';
}
