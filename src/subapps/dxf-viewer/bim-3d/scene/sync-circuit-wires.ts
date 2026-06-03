/**
 * sync-circuit-wires — ADR-408 Φ7 derived home-run circuit wires (3D).
 *
 * Extracted from {@link BimSceneLayer} (Google file-size SSoT: keep the scene
 * manager ≤500 lines). Routes the panel→fixtures conduit once via the SSoT
 * `computeCircuitWirePaths`, sweeps each path to a tube via `wirePathToMesh`,
 * and adds the meshes to the scene group.
 *
 * Built from **visible** hosts only: hiding a fixture drops its wire leg; hiding
 * the panel leaves the source unresolved → the whole circuit's path is skipped.
 */

import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { wirePathToMesh } from '../converters/mep-wire-to-three';
import { computeCircuitWirePaths } from '../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts, type WireHostXform } from '../../bim/mep-systems/mep-wire-resolver';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import type { SyncContext } from './bim-scene-context';
import type { BimCategory } from '../../config/bim-object-styles';

/** Minimal slice of the host resolution `syncCircuitWires` consumes. */
export interface WireHostResolution {
  readonly baseElevation: number;
}

/** Resolves a fixture/panel host against the active floor/building, or `null` if hidden. */
export type ResolveWireHostEntity = (
  entity: MepFixtureEntity | ElectricalPanelEntity,
  category: BimCategory,
) => WireHostResolution | null;

/**
 * ADR-408 Φ7 — derived home-run circuit wires (panel→fixtures conduit). See the
 * module doc for the visibility contract. Owns no state; the caller supplies the
 * scene `group` and the per-host `resolveEntity` (floor/building/layer gate).
 */
export function syncCircuitWires(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolveEntity: ResolveWireHostEntity,
): void {
  // Category-level gate (V/G `mep-wire` + electrical discipline). Off → skip.
  if (!resolveIsEntityVisible(
    { category: 'mep-wire' },
    { objectStyles: ctx.objectStyles, disciplineVisibility: ctx.disciplineVisibility },
  )) return;

  const hosts = new Map<string, WireHostXform>();
  let sceneToM = 1;
  let baseElevationM = 0;
  let haveScene = false;
  const addHost = (entity: MepFixtureEntity | ElectricalPanelEntity, category: BimCategory): void => {
    const r = resolveEntity(entity, category);
    if (!r) return;
    hosts.set(entity.id, {
      x: entity.params.position.x,
      y: entity.params.position.y,
      rotation: entity.params.rotation,
      zMm: entity.params.mountingElevationMm,
      connectors: entity.params.connectors ?? [],
    });
    if (!haveScene) {
      sceneToM = sceneUnitsToMeters(entity.params.sceneUnits ?? 'mm');
      baseElevationM = r.baseElevation;
      haveScene = true;
    }
  };
  for (const f of entities.fixtures ?? []) addHost(f, 'light-fixture');
  for (const p of entities.panels ?? []) addHost(p, 'electrical-panel');
  if (!haveScene) return;

  const paths = computeCircuitWirePaths(useMepSystemStore.getState().getSystems(), resolverFromHosts(hosts));
  for (const path of paths) {
    // ADR-408 Φ7 — colour-by-system master toggle: OFF ⇒ default wire material.
    const mesh = wirePathToMesh(path, sceneToM, ctx.floorElevationMm, baseElevationM, ctx.colorBySystem);
    if (mesh) group.add(mesh);
  }
}
