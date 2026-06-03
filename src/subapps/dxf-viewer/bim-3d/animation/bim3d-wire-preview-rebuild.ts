'use client';

/**
 * bim3d-wire-preview-rebuild — ADR-408 Φ7 P2: rebuild the home-run circuit wires
 * of the dragged MEP hosts for the live 3D move preview (ADR-402 gizmo).
 *
 * Sibling of `bim3d-preview-rebuild.ts` (resize) and the wall sibling
 * `buildDependentWallPreviewObject` (ADR-401 host-move re-clip): while a fixture/
 * panel is dragged, its circuit's conduit must follow live, not jump on release.
 *
 * Reuses the routing SSoT (`computeCircuitWirePaths`) + the converter SSoT
 * (`wirePathToMesh`) unchanged — the ONLY difference from the committed
 * `syncCircuitWires` is the resolver: a dragged host's connector point is shifted
 * by the live translation (world→plan via `worldToDxfPlan`, mirror of `shiftHost`),
 * so the rebuilt tube === the committed re-sync once the move commits (ghost ===
 * commit). Only the AFFECTED circuits (a dragged host is their source or a member)
 * are rebuilt — untouched circuits keep their committed meshes.
 *
 * Self-contained (reads `Bim3DEntitiesStore` directly, like `bim3d-preview-rebuild`,
 * NOT `BimSceneLayer`): `floorElevationMm = 0` (single-floor resync convention);
 * the "Όλοι οι όροφοι" multi-floor scope falls back to commit-on-release.
 *
 * @see ./bim3d-edit-live-preview (captureWires / applyWires — the swap mechanism)
 * @see ../scene/sync-circuit-wires (the committed-path twin)
 */

import * as THREE from 'three';
import {
  computeCircuitWirePaths,
  type ResolveWireHost,
  type WireHostPoint,
} from '../../bim/mep-systems/mep-wire-routing';
import { connectorWorldPosition, type MepConnector } from '../../bim/types/mep-connector-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { wirePathToMesh } from '../converters/mep-wire-to-three';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { rotatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';

/**
 * The live gizmo transform applied to the dragged hosts this frame. `move` shifts
 * the connector points by a world translation; `rotate` orbits them about a world
 * pivot (world +Y ↔ DXF-plan CCW, 1:1 — see `Bim3DEditLivePreview.applyRotate`).
 */
export type WireDragXform =
  | { readonly kind: 'move'; readonly translation: THREE.Vector3 }
  | { readonly kind: 'rotate'; readonly pivot: THREE.Vector3; readonly angleRad: number };

/** A wire host's transform + connectors (3D resolver state). */
interface WireHost3D {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly zMm: number;
  readonly connectors: readonly MepConnector[];
}

/**
 * Apply the live gizmo transform to a dragged host's connector plan point. The
 * point is a rigid point of the entity, so orbiting it about the pivot reproduces
 * both the host orbit AND the connector-offset rotation (ghost === commit). A move
 * shifts it by the plan delta; vertical (Y) rotation leaves the elevation `zMm`.
 */
function applyDragXform(pt: WireHostPoint, xform: WireDragXform): WireHostPoint {
  if (xform.kind === 'move') {
    const d = worldToDxfPlan(xform.translation); // world (m) → plan (mm) delta (linear)
    return { x: pt.x + d.x, y: pt.y + d.y, zMm: pt.zMm + d.z };
  }
  const pivot = worldToDxfPlan(xform.pivot); // linear map → valid on a point too
  const r = rotatePoint({ x: pt.x, y: pt.y }, { x: pivot.x, y: pivot.y }, xform.angleRad);
  return { x: r.x, y: r.y, zMm: pt.zMm };
}

/**
 * Ids of the circuits whose conduit must rebuild while `draggedHostIds` move: a
 * dragged host is the circuit's panel source or one of its member fixtures.
 * Empty when nothing dragged participates in any circuit (fast path → no capture).
 */
export function affectedWireSystemIds(draggedHostIds: ReadonlySet<string>): string[] {
  if (draggedHostIds.size === 0) return [];
  const out: string[] = [];
  for (const sys of useMepSystemStore.getState().getSystems()) {
    const { sourceEntityId, members } = sys.params;
    if (draggedHostIds.has(sourceEntityId) || members.some((m) => draggedHostIds.has(m.entityId))) {
      out.push(sys.id);
    }
  }
  return out;
}

/**
 * Rebuild the conduit meshes of the circuits affected by the dragged hosts, with
 * those hosts transformed by the live gizmo `xform` (move or plan-rotate). Returns
 * the fresh tubes (tagged `mepWireSystemId`, ready to swap into the scene group),
 * or `[]` for the multi-floor scope / no affected circuit / no resolvable host.
 */
export function buildCircuitWirePreviewObjects(
  draggedHostIds: ReadonlySet<string>,
  xform: WireDragXform,
): THREE.Mesh[] {
  if (useViewMode3DStore.getState().floor3DScope === 'all') return [];
  const affected = new Set(affectedWireSystemIds(draggedHostIds));
  if (affected.size === 0) return [];

  const s = useBim3DEntitiesStore.getState();
  const hosts = new Map<string, WireHost3D>();
  let sceneToM = 1;
  let baseElevationM = 0;
  let haveScene = false;
  const addHost = (entity: MepFixtureEntity | ElectricalPanelEntity): void => {
    hosts.set(entity.id, {
      x: entity.params.position.x,
      y: entity.params.position.y,
      rotation: entity.params.rotation,
      zMm: entity.params.mountingElevationMm,
      connectors: entity.params.connectors ?? [],
    });
    if (!haveScene) {
      sceneToM = sceneUnitsToMeters(entity.params.sceneUnits ?? 'mm');
      baseElevationM = resolveEntityBuilding(entity, s.floors, s.buildings)?.baseElevation ?? 0;
      haveScene = true;
    }
  };
  for (const f of s.fixtures) addHost(f);
  for (const p of s.panels) addHost(p);
  if (!haveScene) return [];

  const resolve: ResolveWireHost = (entityId, connectorId) => {
    const host = hosts.get(entityId);
    if (!host) return null;
    const conn = host.connectors.find((c) => c.connectorId === connectorId) ?? host.connectors[0];
    const pos = conn
      ? connectorWorldPosition(conn, { x: host.x, y: host.y, z: 0 }, host.rotation)
      : { x: host.x, y: host.y, z: 0 };
    const zMm = host.zMm + (conn?.localPosition.z ?? 0);
    const point: WireHostPoint = { x: pos.x, y: pos.y, zMm };
    return draggedHostIds.has(entityId) ? applyDragXform(point, xform) : point;
  };

  const systems = useMepSystemStore.getState().getSystems().filter((sys) => affected.has(sys.id));
  const meshes: THREE.Mesh[] = [];
  for (const path of computeCircuitWirePaths(systems, resolve)) {
    const mesh = wirePathToMesh(path, sceneToM, 0, baseElevationM);
    if (mesh) meshes.push(mesh);
  }
  return meshes;
}
