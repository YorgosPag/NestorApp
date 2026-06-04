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
 * stays 0 and is NOT the datum.
 */
function hostMountingElevationMm(entity: Entity): number | null {
  if (isMepManifoldEntity(entity) || isMepFixtureEntity(entity)) {
    return entity.params.mountingElevationMm;
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
  const datum = hostMountingElevationMm(entity);
  if (datum === null) return null;

  const host = entity as Extract<Entity, { params: { position: { x: number; y: number; z?: number }; rotation?: number } }>;
  const { position } = host.params;
  const rotation = host.params.rotation ?? 0;
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
