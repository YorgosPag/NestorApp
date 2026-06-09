/**
 * ADR-430/431 — Stage 2: resolve the source that feeds the electrical circuits.
 *
 * Unlike the pipe disciplines (which root a network at a boiler/manifold tapping with a
 * world elevation), the electrical source is purely logical: a circuit references the
 * source's out connector as its `(sourceEntityId, sourceConnectorId)`, and the home-run
 * wire is derived from there. So we only need the source's outgoing connector id + its
 * world plan point (the latter for the home-run length). At the pilot we use the FIRST
 * recognized source of the right kind; multi-source / per-zone selection is a later slice.
 *
 * The resolver is **classification-aware** (ADR-431): the electrical-panel entity hosts
 * BOTH the power panel (out connector `'power'`) and the comms-rack (out connector
 * `'data'`), so each discipline asks for its own out classifications — strong → `power`,
 * weak → `data`/`controls`. This keeps a power panel from sourcing data channels and vice
 * versa. A missing source is a warning, not an error (honest pilot, mirroring the pipes).
 *
 * @see ../../../bim/mep-systems/mep-circuit-from-selection.ts (the manual-circuit source rule)
 * @see ./design-electrical-strong.ts · ./design-electrical-weak.ts (consumers)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import { isElectricalPanelEntity } from '../../../types/entities';
import type { ElectricalSystemClassification } from '../../../bim/types/mep-connector-types';
import { PANEL_OUT_CONNECTOR_ID } from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** The resolved circuit source — the entity + its out connector + world plan point. */
export interface ElectricalPanelSource {
  readonly entityId: string;
  readonly connectorId: string;
  readonly point: Point2D;
}

/** The out connector whose classification is accepted, or `null` (no matching out connector). */
function findAcceptedOutConnectorId(
  entity: Entity,
  accept: ReadonlySet<ElectricalSystemClassification>,
): string | null {
  const conns = getEntityConnectors(entity);
  const out = conns.find(
    (c) =>
      c.flow === 'out' &&
      c.electrical !== undefined &&
      accept.has(c.electrical.systemClassification),
  );
  return out?.connectorId ?? null;
}

/**
 * The first recognized electrical-panel whose out connector carries one of `accept`'s
 * classifications, as the circuit source — or `null` if none exists. Generic over the
 * accepted out classifications so strong (`power`) and weak (`data`/`controls`) share it.
 */
export function resolveElectricalSource(
  entities: readonly Entity[],
  accept: readonly ElectricalSystemClassification[],
): ElectricalPanelSource | null {
  const acceptSet = new Set(accept);
  for (const entity of entities) {
    if (!isElectricalPanelEntity(entity)) continue;
    const connectorId = findAcceptedOutConnectorId(entity, acceptSet);
    if (connectorId === null) continue;
    const point = resolveConnectorWorldPoint(entity, connectorId)
      ?? { x: entity.params.position.x, y: entity.params.position.y };
    return { entityId: entity.id, connectorId, point };
  }
  return null;
}

/**
 * The electrical-STRONG circuit source: the first power-classified panel (back-compat
 * thin wrapper over {@link resolveElectricalSource}). Falls back to the canonical out
 * connector id if a power panel exists but its connector was not retrofitted.
 */
export function resolveElectricalPanelSource(
  entities: readonly Entity[],
): ElectricalPanelSource | null {
  const source = resolveElectricalSource(entities, ['power']);
  if (source) return source;
  // Legacy fallback: a panel placed before the connector retrofit (no classified out
  // connector) still sources a strong circuit via its canonical out connector id.
  for (const entity of entities) {
    if (!isElectricalPanelEntity(entity)) continue;
    if (entity.params.kind === 'comms-rack') continue;
    const point = resolveConnectorWorldPoint(entity, PANEL_OUT_CONNECTOR_ID)
      ?? { x: entity.params.position.x, y: entity.params.position.y };
    return { entityId: entity.id, connectorId: PANEL_OUT_CONNECTOR_ID, point };
  }
  return null;
}
