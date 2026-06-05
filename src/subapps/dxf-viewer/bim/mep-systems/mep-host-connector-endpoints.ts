/**
 * ADR-408 Φ-B2b EXT #2 — collect point-host pipe-connector endpoints (SSoT, pure).
 *
 * A pipe junction is normally derived from `mep-segment` endpoints only. But when
 * a pipe end lands on a **manifold outlet** (or, in future, a plumbing fixture
 * port) the node has just one pipe incident → it would classify as a `cap` → a
 * spurious cap is drawn where the pipe meets the equipment. In Revit the equipment
 * IS the fitting there, so no cap belongs.
 *
 * This collector yields one endpoint per pipe-domain connector of every point host
 * (manifold / fixture), in the SAME coordinate space + unit-aware elevation as a
 * segment endpoint (`zScene` = mm × `mmToScene`, ADR-408 Φ-B2b EXT #1). Fed into
 * `derivePipeJunctions`, a host endpoint coincides (xyz) with the snapped pipe end
 * and joins its node as a **host incident**, which short-circuits classification to
 * `kind: null` (`mep-fitting-classify.ts`) — no spurious cap. Host endpoints are
 * transient: they never reach geometry/persistence.
 *
 * Pure: no store / Firestore / React. Reuses the connector world-position +
 * mounting-datum SSoT, so a host's connectors track its move/rotation for free.
 *
 * @see ./mep-pipe-junctions.ts — derivePipeJunctions (consumer)
 * @see ../mep-segments/mep-connector-elevation.ts — pointHostMountingElevationMm (datum SSoT)
 * @see ../types/mep-connector-types.ts — connectorWorldPosition
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-B2b
 */

import type { Entity } from '../../types/entities';
import { isMepManifoldEntity, isMepFixtureEntity } from '../../types/entities';
import type { Point3D } from '../types/bim-base';
import { connectorWorldPosition } from '../types/mep-connector-types';
import { getEntityConnectors } from './connector-access';
import { pointHostMountingElevationMm } from '../mep-segments/mep-connector-elevation';
import { mmToSceneUnits } from '../../utils/scene-units';

/**
 * One point-host pipe connector, resolved to world plan coords + canvas-unit
 * elevation — the host counterpart of a `SegmentEndpoint` in the junction derive.
 */
export interface HostConnectorEndpoint {
  /** FK → the owning host entity (manifold / fixture). */
  readonly entityId: string;
  /** Host-local connector id (manifold outlet / inlet id). */
  readonly connectorId: string;
  /** World plan position (canvas units); `z` stays 0 — elevation lives in `zScene`. */
  readonly point: Point3D;
  /** mm. Connector elevation from project origin (mounting datum + local z). */
  readonly elevationMm: number;
  /** Elevation in CANVAS units (`elevationMm · mmToScene`) — same axis as `point`, for xyz coincidence. */
  readonly zScene: number;
  /** mm. Nominal connector diameter (0 when the host omits it). */
  readonly diameterMm: number;
}

/**
 * Collect every pipe-domain connector of every point host (manifold / fixture) as
 * a junction endpoint. Deterministic: sorted by (entityId, connectorId) so the
 * downstream junction set is stable across input order. Hosts with no pipe
 * connector — or no plumbing mounting datum (e.g. an electrical panel) — contribute
 * nothing.
 */
export function collectHostConnectorEndpoints(
  entities: readonly Entity[],
): HostConnectorEndpoint[] {
  const out: HostConnectorEndpoint[] = [];

  for (const entity of entities) {
    if (!isMepManifoldEntity(entity) && !isMepFixtureEntity(entity)) continue;
    const datum = pointHostMountingElevationMm(entity);
    if (datum === null) continue;

    const connectors = getEntityConnectors(entity);
    if (connectors.length === 0) continue;

    const { position } = entity.params;
    const rotation = entity.params.rotation ?? 0;
    const mmToScene = mmToSceneUnits(entity.params.sceneUnits ?? 'mm');

    for (const c of connectors) {
      // Only pipe-connectable connectors suppress a pipe cap (a light fixture's
      // electrical port is irrelevant to plumbing junctions).
      if (c.domain !== 'pipe') continue;
      const world = connectorWorldPosition(c, position, rotation);
      const elevationMm = datum + (c.localPosition.z ?? 0);
      out.push({
        entityId: entity.id,
        connectorId: c.connectorId,
        point: { x: world.x, y: world.y, z: 0 },
        elevationMm,
        zScene: elevationMm * mmToScene,
        diameterMm: c.pipe?.diameterMm ?? 0,
      });
    }
  }

  return out.sort((a, b) =>
    a.entityId === b.entityId
      ? a.connectorId.localeCompare(b.connectorId)
      : a.entityId.localeCompare(b.entityId),
  );
}
