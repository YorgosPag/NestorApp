/**
 * ADR-408 Φ-B1 — resolve the TRUE 3D elevation (mm) of an MEP connector at a
 * snapped plan point (connector-mate snap).
 *
 * When a `mep-segment` endpoint snaps to an existing MEP connector (a manifold
 * outlet / another pipe end / a fixture port), the new segment endpoint must
 * inherit that connector's FULL 3D position — including its elevation — so the run
 * physically meets the network in 3D, not just in plan (Revit "Connect To"). The
 * snap engine only carries the plan `(x, y)`; this pure resolver recovers the `z`.
 *
 * The elevation source differs per host (each stores its mounting datum in a
 * different field; `position.z` is NOT the datum — it stays 0):
 *   - **segment** → the matched endpoint's own elevation (`segmentConnectorWorldPosition`,
 *     per-endpoint z, ADR-408 Φ-A) — a sloped run reports a different z at each end.
 *   - **manifold / fixture** → `params.mountingElevationMm` + the connector's local
 *     `z` offset. `connectorWorldPosition().z` would read the (zero) `position.z`,
 *     so we add the mounting datum explicitly to match what the 3D converter renders.
 *
 * Pure: no store / Firestore / React. Returns `null` when the entity is not a
 * pipe-connectable host or no connector lies at the point.
 *
 * @see ./mep-segment-connectors.ts — segmentConnectorWorldPosition (per-endpoint z)
 * @see ../types/mep-connector-types.ts — connectorWorldPosition (point-host plan)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-B
 */

import type { Entity } from '../../types/entities';
import {
  isMepSegmentEntity,
  isMepFixtureEntity,
  isElectricalPanelEntity,
  isMepManifoldEntity,
  isMepRadiatorEntity,
  isMepBoilerEntity,
  isMepWaterHeaterEntity,
  isMepUnderfloorEntity,
} from '../../types/entities';
import { getEntityConnectors } from '../mep-systems/connector-access';
import { connectorWorldPosition } from '../types/mep-connector-types';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../types/mep-connector-types';
import { segmentConnectorWorldPosition } from './mep-segment-connectors';

/** Squared plan distance between two points. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Mounting datum (mm) for a point host whose connectors share one elevation
 * (manifold / fixture). Both store it in `mountingElevationMm`; `position.z`
 * stays 0 and is NOT the datum. Returns `null` for hosts that are not
 * pipe-connectable (e.g. an electrical panel).
 *
 * SSoT (ADR-408 Φ-B2b EXT #2): the SAME datum resolver feeds both this
 * connector-mate snap and the junction host-endpoint collector
 * (`collectHostConnectorEndpoints`), so a pipe end snaps to and coincides with a
 * host connector at the identical elevation — no spurious cap.
 */
export function pointHostMountingElevationMm(entity: Entity): number | null {
  if (isMepManifoldEntity(entity) || isMepFixtureEntity(entity)) {
    return entity.params.mountingElevationMm;
  }
  // ADR-408 Εύρος Β — a heating radiator is pipe-connectable; its supply/return
  // ports sit at its `mountingElevationMm` so connected pipes inherit that height.
  if (isMepRadiatorEntity(entity)) {
    return entity.params.mountingElevationMm;
  }
  // ADR-408 Εύρος Β #2 — a heating boiler is pipe-connectable; its supply/return
  // ports sit at its `mountingElevationMm` so connected pipes inherit that height.
  if (isMepBoilerEntity(entity)) {
    return entity.params.mountingElevationMm;
  }
  // ADR-408 DHW — a domestic hot-water heater is pipe-connectable; its cold inlet
  // + hot outlet sit at its `mountingElevationMm` so connected pipes inherit that height.
  if (isMepWaterHeaterEntity(entity)) {
    return entity.params.mountingElevationMm;
  }
  // ADR-408 Εύρος Β #3 — an underfloor loop is pipe-connectable but has NO
  // `position`/`mountingElevationMm` (identity host transform). Its supply/return
  // ports sit in the screed at `FFL + screedOffsetMm`; the connector `localPosition`
  // is already in world coords with z=0, so the screed offset IS the datum.
  if (isMepUnderfloorEntity(entity)) {
    return entity.params.screedOffsetMm ?? 0;
  }
  // Electrical panel: pipes do not connect to it — no plumbing elevation datum.
  if (isElectricalPanelEntity(entity)) return null;
  return null;
}

/**
 * Resolve the connector elevation (mm) at the snapped plan point `(x, y)` on
 * `entity`. Picks the host connector nearest the point (the snap already locked
 * onto this entity, so the nearest connector IS the snapped one). Returns `null`
 * when the host is not pipe-connectable or carries no resolvable connector.
 */
export function resolveMepConnectorElevationMmAt(
  entity: Entity,
  x: number,
  y: number,
): number | null {
  // ── Linear segment: match the nearer of the two endpoints (per-endpoint z) ──
  if (isMepSegmentEntity(entity)) {
    const start = segmentConnectorWorldPosition(SEGMENT_START_CONNECTOR_ID, entity.params);
    const end = segmentConnectorWorldPosition(SEGMENT_END_CONNECTOR_ID, entity.params);
    if (!start || !end) return null;
    const dStart = dist2(x, y, start.x, start.y);
    const dEnd = dist2(x, y, end.x, end.y);
    return (dStart <= dEnd ? start.z : end.z) ?? null;
  }

  // ── Point host (manifold / fixture): mounting datum + connector local z ─────
  const datum = pointHostMountingElevationMm(entity);
  if (datum === null) return null;

  // `datum !== null` ⟹ a manifold or fixture (see hostMountingElevationMm). Narrow
  // with the type guards rather than a broad `Extract` cast, so a future param
  // type added to the union that lacks `rotation` cannot silently match here.
  if (!isMepManifoldEntity(entity) && !isMepFixtureEntity(entity) && !isMepRadiatorEntity(entity) && !isMepBoilerEntity(entity) && !isMepWaterHeaterEntity(entity)) return datum;
  const { position } = entity.params;
  const rotation = entity.params.rotation ?? 0;
  const connectors = getEntityConnectors(entity);
  if (connectors.length === 0) return datum; // legacy host snaps at its origin

  let bestD = Infinity;
  let bestLocalZ = 0;
  for (const c of connectors) {
    const w = connectorWorldPosition(c, position, rotation);
    const d = dist2(x, y, w.x, w.y);
    if (d < bestD) {
      bestD = d;
      bestLocalZ = c.localPosition.z ?? 0;
    }
  }
  return datum + bestLocalZ;
}
