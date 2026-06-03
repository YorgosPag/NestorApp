/**
 * MEP Connector Seeding — ADR-408 Φ5 (legacy back-fill, scene-only).
 *
 * A connector host (light fixture / electrical panel) placed **before** the
 * connector model landed (Φ1/Φ2) carries no `params.connectors`, so it cannot
 * join a circuit, take a derived `systemId` cache, or route a home-run wire. In
 * Revit terms its **family definition** already declares a connector — the
 * placed instance simply has not materialised it yet.
 *
 * This is the SSoT for that materialisation: re-derive the host's default
 * connector from its type via the builders in `mep-connector-types.ts` (the
 * single source of truth for the default connector shape — we never persist a
 * second copy that could drift). **Scene-only**: the seeded connector is a
 * deterministic property of the host type, re-materialised on every load, so no
 * Firestore write / migration is needed — exactly like the reconciler's
 * `systemId` cache it feeds.
 *
 * **Idempotent**: returns the same entity reference when the host already has
 * connectors (or is not a connector host at all), so the scene-pass diff stays a
 * no-op once everything is seeded.
 *
 * @see ./connector-access.ts — `getEntityConnectors` / `isMepConnectorHost`
 * @see ../types/mep-connector-types.ts — the default-connector builders (SSoT)
 * @see ../../hooks/data/useMepConnectorReconciliation.ts — the seed-then-reconcile pass
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Entity } from '../../types/entities';
import { isMepFixtureEntity, isElectricalPanelEntity } from '../../types/entities';
import { getEntityConnectors } from './connector-access';
import {
  buildDefaultLightingConnector,
  buildDefaultPanelOutgoingConnector,
} from '../types/mep-connector-types';

/**
 * Materialise the host type's default connector onto a legacy entity that lacks
 * one. Pure; same reference when the entity is not a connector host or already
 * carries at least one connector (idempotent).
 */
export function seedDefaultConnectors(entity: Entity): Entity {
  // Already materialised (or a non-host — `getEntityConnectors` returns []
  // there too, and the guards below then leave it untouched). Same ref.
  if (getEntityConnectors(entity).length > 0) return entity;

  if (isMepFixtureEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: [buildDefaultLightingConnector()] } };
  }
  if (isElectricalPanelEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: [buildDefaultPanelOutgoingConnector()] } };
  }
  return entity;
}
