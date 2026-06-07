/**
 * sync-mep-elements — ADR-408 Φ8/Φ11 linear MEP segments + auto pipe fittings (3D).
 *
 * Extracted from {@link BimSceneLayer} (Google file-size SSoT: keep the scene
 * manager ≤500 lines). Mirrors the `sync-circuit-wires` precedent: owns no
 * state, the caller supplies the scene `group` and the per-entity
 * `resolveEntity` (floor / building / layer / discipline gate).
 *
 * Both element families gate visibility via their domain-derived `BimCategory`
 * ('duct' | 'pipe'), so a fitting follows the same discipline / visibility
 * gates as the pipes it joins. Each converter is units-safe.
 */

import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { mepSegmentToMesh } from '../converters/mep-segment-to-mesh';
import { mepFittingToMesh } from '../converters/mep-fitting-to-mesh';
import { resolveFittingSystemColor } from '../../bim/mep-systems/mep-system-color';
import { incidentEntityId, resolveFittingBimCategory } from '../../bim/types/mep-fitting-types';
import { resolveSegmentBimCategory } from '../../bim/types/mep-segment-types';
import type { SyncContext } from './bim-scene-context';
import type { BimCategory } from '../../config/bim-object-styles';
import type { Discipline } from '../../bim/discipline/bim-discipline';

/** Minimal slice of the host resolution the MEP element syncs consume. */
export interface MepElementResolution {
  readonly baseElevation: number;
  readonly buildingId: string;
}

/** Resolves a segment/fitting against the active floor/building, or `null` if hidden. */
export type ResolveMepElementEntity = (
  entity: { layerId?: string; discipline?: Discipline },
  category: BimCategory,
) => MepElementResolution | null;

/**
 * ADR-408 Φ8 — linear MEP segments (duct + pipe swept solids).
 *
 * Visibility is gated via the domain-derived BimCategory ('duct' | 'pipe').
 * Colour-by-system: segment id is the colour-index key (network members carry
 * `entityId === segment.id`); the index is empty when the per-view
 * `colorBySystem` toggle is OFF ⇒ default domain material.
 *
 * Defensive: legacy floor-stack entries predating ADR-408 Φ8 carry no
 * `mepSegments` array — never crash the whole floor sync over a missing slice.
 */
export function syncMepSegments(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolveEntity: ResolveMepElementEntity,
): void {
  for (const segment of entities.mepSegments ?? []) {
    // ADR-408 Φ14 — a drainage pipe maps to its own 'drain-pipe' V/G category.
    const category = resolveSegmentBimCategory(segment.params);
    const r = resolveEntity(segment, category);
    if (!r) continue;
    const mesh = mepSegmentToMesh(
      segment, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation,
      ctx.systemColorIndex.get(segment.id),
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}

/**
 * ADR-408 Φ11 — auto pipe fittings (elbow / tee / cross / coupling / reducer /
 * cap). Mirror of {@link syncMepSegments}: per-entity resolve → cascade
 * visibility → units-safe `mepFittingToMesh`. The BimCategory comes from
 * `resolveFittingBimCategory` (ADR-408 Φ14: drainage → 'drain-pipe', else the
 * `domain`), so a fitting follows the same discipline / visibility gates — and the
 * same V/G toggle — as the pipes it joins.
 *
 * Colour-by-system (Φ11): a fitting is NOT a system member (it is auto-derived),
 * so it inherits the colour of the pipes it joins — resolved from its incident
 * segment ids against the same `systemColorIndex` the pipes use (Revit). The index
 * is empty when the per-view `colorBySystem` toggle is OFF ⇒ default material.
 *
 * Defensive: legacy floor-stack entries predating Φ11 carry no `mepFittings`
 * array — never crash the whole floor sync over a missing slice.
 */
export function syncFittings(
  group: THREE.Group,
  entities: Bim3DEntities,
  ctx: SyncContext,
  resolveEntity: ResolveMepElementEntity,
): void {
  for (const fitting of entities.mepFittings ?? []) {
    // ADR-408 Φ14 — a drainage fitting maps to its own 'drain-pipe' V/G category
    // (mirror of syncMepSegments), so it hides together with the drainage pipes.
    const category = resolveFittingBimCategory(fitting.params);
    const r = resolveEntity(fitting, category);
    if (!r) continue;
    const systemColor = resolveFittingSystemColor(
      fitting.params.incidents.filter((inc) => !inc.host).map(incidentEntityId),
      ctx.systemColorIndex,
    );
    const mesh = mepFittingToMesh(
      fitting, ctx.floorElevationMm, ctx.activeLevelId, r.baseElevation,
      systemColor ?? undefined,
    );
    if (mesh) { mesh.userData['buildingId'] = r.buildingId; group.add(mesh); }
  }
}
