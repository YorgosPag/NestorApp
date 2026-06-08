/**
 * Pipe-network SOURCE SSoT (ADR-408 Εύρος Β #2 — FULL SSOT generalization).
 *
 * The ONE canonical answer to "which entities can SOURCE a plumbing pipe network".
 * Historically this was hard-coded as `entity.type === 'mep-manifold'` in two places
 * (the from-selection resolver + the contextual-trigger logic). Adding the boiler
 * (a hydronic heat SOURCE) as a second source would have meant duplicating that
 * literal — so instead both call sites now route through this single guard.
 *
 * A pipe-network source is a point-based equipment that owns a `systemClassification`
 * and carries an outgoing (`flow:'out'`) pipe connector that the network originates
 * from:
 *   - `mep-manifold`     (συλλέκτης / φρεάτιο) — ADR-408 Φ12/Φ14.
 *   - `mep-boiler`       (λέβητας)              — ADR-408 Εύρος Β #2.
 *   - `mep-water-heater` (θερμοσίφωνας DHW)     — ADR-408 DHW.
 *
 * Future point sources (heat-pump, buffer tank, …) append to the union here only.
 *
 * @see ./mep-pipe-network-from-selection.ts
 * @see ../../app/ribbon-contextual-config.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Entity } from '../../types/entities';
import { isMepManifoldEntity, isMepBoilerEntity, isMepWaterHeaterEntity } from '../../types/entities';
import type { MepManifoldEntity } from '../types/mep-manifold-types';
import type { MepBoilerEntity } from '../types/mep-boiler-types';
import type { MepWaterHeaterEntity } from '../types/mep-water-heater-types';
import { MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX } from '../types/mep-connector-types';
import { getEntityConnectors } from './connector-access';

/** Any entity that can source a plumbing pipe network (Revit "source equipment"). */
export type PipeNetworkSourceEntity = MepManifoldEntity | MepBoilerEntity | MepWaterHeaterEntity;

/**
 * Canonical guard — the SINGLE source of truth for "is this a pipe-network source".
 * Used by the from-selection resolver and the contextual-trigger logic so a new
 * source type is registered in exactly one place.
 */
export function isPipeNetworkSourceEntity(entity: Entity): entity is PipeNetworkSourceEntity {
  return isMepManifoldEntity(entity) || isMepBoilerEntity(entity) || isMepWaterHeaterEntity(entity);
}

/** The canonical first outlet id of a manifold (`m-out-0`) — the default fallback. */
const DEFAULT_SOURCE_CONNECTOR_ID = `${MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX}0`;

/**
 * The source's outgoing connector id: its first `flow:'out'` connector (the manifold
 * outlet, the boiler supply-out, or the water-heater hot-outlet `domestic-hot-water`),
 * else any connector, else the canonical fallback. A source placed before the connector
 * seed carries none — it is still a valid source, so we fall back rather than refuse.
 *
 * For a `mep-water-heater` the SOURCE connector is its HOT OUTLET (`domestic-hot-water`,
 * `flow:'out'`, +X end) — NOT the cold inlet. `buildWaterHeaterConnectors` places the
 * cold inlet first (`flow:'in'`) and the hot outlet second (`flow:'out'`), so the
 * `flow === 'out'` search picks the correct connector automatically.
 */
export function findPipeNetworkSourceConnectorId(source: PipeNetworkSourceEntity): string {
  const conns = getEntityConnectors(source);
  return (
    conns.find((c) => c.flow === 'out')?.connectorId
    ?? conns[0]?.connectorId
    ?? DEFAULT_SOURCE_CONNECTOR_ID
  );
}
