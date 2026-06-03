/**
 * MEP wire host resolver — ADR-408 Φ7 (SSoT glue).
 *
 * The shared `(entityId, connectorId) → world plan point` resolution that turns a
 * geometry-less circuit into routable host points. Each caller iterates its own
 * scene source (the 2D overlay reads the `DxfScene` + applies the live grip
 * preview; the waypoint interaction reads the `SceneModel`), but the
 * connector→world math is ONE place here, wrapping the `connectorWorldPosition`
 * SSoT — so the routed points never diverge between consumers.
 *
 * Pure — no store / React / Date / Math.random.
 *
 * @see ./mep-wire-routing.ts (ResolveWireHost)
 * @see ../types/mep-connector-types.ts (connectorWorldPosition)
 */

import { connectorWorldPosition, type MepConnector } from '../types/mep-connector-types';
import type { ResolveWireHost } from './mep-wire-routing';

/** A host's plan transform + its connectors, as collected from a scene. */
export interface WireHostXform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  /**
   * Host mounting elevation (mm above FFL) — the conduit run height. Optional:
   * the 2D overlay omits it (the 2D space ignores `zMm`); the 3D consumers supply
   * `params.mountingElevationMm` so the conduit + handles sit at the right height.
   */
  readonly zMm?: number;
  readonly connectors: readonly MepConnector[];
}

/**
 * Build a {@link ResolveWireHost} from an already-collected host map. The map's
 * key is the host `entityId`; each caller populates it from its own scene source
 * (optionally applying a live drag preview). The resolved `zMm` = the host's
 * mounting elevation + the connector's local Z (0 for 2D hosts that omit `zMm`),
 * so this is the SINGLE resolver glue shared by the 2D overlay, the 3D conduit
 * sync, and the 3D waypoint editor.
 */
export function resolverFromHosts(hosts: ReadonlyMap<string, WireHostXform>): ResolveWireHost {
  return (entityId, connectorId) => {
    const host = hosts.get(entityId);
    if (!host) return null;
    const conn = host.connectors.find((c) => c.connectorId === connectorId) ?? host.connectors[0];
    const pos = conn
      ? connectorWorldPosition(conn, { x: host.x, y: host.y, z: 0 }, host.rotation)
      : { x: host.x, y: host.y, z: 0 };
    return { x: pos.x, y: pos.y, zMm: (host.zMm ?? 0) + (conn?.localPosition.z ?? 0) };
  };
}
