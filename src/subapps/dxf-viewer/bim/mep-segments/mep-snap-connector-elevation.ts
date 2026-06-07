/**
 * ADR-408 Φ-B1 (SSoT) — map a snapped connector to its inherited elevation.
 *
 * When a pipe/duct draw click snaps to an MEP connector, the new endpoint must
 * inherit the connector's TRUE 3D elevation (Revit "Connect To"). The snap engine
 * only carries plan `(x, y)` + the host `entityId`; this helper turns a connector
 * snap candidate into the elevation (mm) via `resolveMepConnectorElevationMmAt`.
 *
 * SSoT: the SAME helper feeds BOTH the 2D cursor pipeline (`mouse-handler-up`) and
 * the 3D in-viewport placement hook (`use-bim3d-mep-segment-placement`), so the
 * "is this a connector snap → what z does it inherit" decision lives in ONE place.
 * Callers differ only in how they look up the host entity by id (2D: scene model;
 * 3D: the `Bim3DEntities` store) — injected as `findHostById`.
 *
 * Returns `null` when the candidate is not a connector snap, has no `entityId`, the
 * host is not found, or the host is not pipe-connectable — the caller then falls
 * back to a free-point elevation (the centreline default).
 *
 * @see ./mep-connector-elevation.ts — per-host elevation resolver
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-B
 */

import type { Entity } from '../../types/entities';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { resolveMepConnectorElevationMmAt } from './mep-connector-elevation';

/** Minimal snap-candidate shape needed for connector-mate elevation. */
export interface ConnectorSnapCandidate {
  readonly type: ExtendedSnapType;
  readonly entityId?: string;
}

/**
 * Resolve the connector elevation (mm) for a snap candidate at plan `(x, y)`, or
 * `null` for a non-connector snap / missing host.
 */
export function resolveSnapConnectorElevationMm(
  candidate: ConnectorSnapCandidate | null | undefined,
  planX: number,
  planY: number,
  findHostById: (id: string) => Entity | undefined,
): number | null {
  if (!candidate || candidate.type !== ExtendedSnapType.BIM_MEP_CONNECTOR || !candidate.entityId) {
    return null;
  }
  const host = findHostById(candidate.entityId);
  if (!host) return null;
  return resolveMepConnectorElevationMmAt(host, planX, planY);
}
