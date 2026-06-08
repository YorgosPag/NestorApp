/**
 * ADR-427 — Stage 2 (pilot): resolve the drainage OUTFALL (the gravity root / sink).
 *
 * Unlike water supply (a pressurised source the network radiates FROM), drainage converges
 * INTO a **collector** — a `drainage-collector` manifold (φρεάτιο, N inlets → 1 outlet to
 * the sewer). That collector is the tree root: fixtures drain toward it, diameters grow
 * toward it, and its inlet invert is the LOWEST elevation the whole network rises from.
 *
 * We scan the scene manifolds for the `drainage-collector` kind and take its sanitary-
 * drainage outlet as the outfall connector + routing root. Auto-PLACING a collector when
 * none exists is a later slice — here a missing collector is reported as a warning (honest
 * pilot, mirroring the water source resolver).
 *
 * @see ../water/water-source-resolve.ts (pressurised counterpart)
 * @see ../../../bim/types/mep-manifold-types.ts (isDrainageCollectorKind)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import { isMepManifoldEntity } from '../../../types/entities';
import { isDrainageCollectorKind } from '../../../bim/types/mep-manifold-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveMepConnectorElevationMmAt } from '../../../bim/mep-segments/mep-connector-elevation';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';
import { DRAINAGE_CLASSIFICATION } from './drainage-design-types';

/** A resolved drainage outfall — the collector outlet that roots the gravity tree. */
export interface DrainageOutfall {
  readonly entityId: string;
  readonly connectorId: string;
  readonly point: Point2D;
  /**
   * The collector outlet's WORLD invert elevation (mm) — the lowest datum; the network's
   * per-endpoint z rises from here by `length·slope`. From the SSoT
   * `resolveMepConnectorElevationMmAt`, so units match the segment z (mm).
   */
  readonly invertElevationMm: number;
}

/**
 * The first `drainage-collector` manifold's sanitary-drainage outlet, or `null`. Returns
 * the outlet connector id + its world point (the routing root) + its invert elevation.
 */
export function resolveDrainageOutfall(entities: readonly Entity[]): DrainageOutfall | null {
  for (const entity of entities) {
    if (!isMepManifoldEntity(entity)) continue;
    if (!isDrainageCollectorKind(entity.params.kind)) continue;
    for (const c of getEntityConnectors(entity)) {
      if (c.domain !== 'pipe' || c.flow !== 'out') continue;
      if (c.pipe?.systemClassification !== DRAINAGE_CLASSIFICATION) continue;
      const point = resolveConnectorWorldPoint(entity, c.connectorId);
      if (!point) continue;
      // The connector world plan point is exactly the (x,y) the elevation resolver snaps
      // on → it returns THIS outlet's mm invert. Guard with `isFinite` (not just `??`): a
      // host missing its mounting datum would yield NaN, which must never reach a segment z.
      const resolved = resolveMepConnectorElevationMmAt(entity, point.x, point.y);
      const invertElevationMm = resolved != null && Number.isFinite(resolved) ? resolved : 0;
      return { entityId: entity.id, connectorId: c.connectorId, point, invertElevationMm };
    }
  }
  return null;
}
