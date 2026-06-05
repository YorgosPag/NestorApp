/**
 * MEP Connector Seeding — ADR-408 Φ5 (legacy back-fill, scene-only).
 *
 * A connector host (light fixture / electrical panel / duct-pipe segment) placed
 * **before** the connector model landed (Φ1/Φ2/Φ9) carries no `params.connectors`,
 * so it cannot join a circuit/network, take a derived `systemId` cache, or route a
 * home-run wire. In Revit terms its **family definition** already declares its
 * connector(s) — the placed instance simply has not materialised them yet.
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
import {
  isMepFixtureEntity,
  isElectricalPanelEntity,
  isMepSegmentEntity,
  isMepManifoldEntity,
  isMepRadiatorEntity,
  isMepBoilerEntity,
} from '../../types/entities';
import { getEntityConnectors } from './connector-access';
import {
  buildDefaultLightingConnector,
  buildDefaultPanelOutgoingConnector,
  buildSegmentEndpointConnector,
} from '../types/mep-connector-types';
import { buildMepManifoldConnectors } from '../mep-manifolds/mep-manifold-geometry';
import { buildRadiatorConnectors } from '../mep-radiators/mep-radiator-geometry';
import { buildBoilerConnectors } from '../mep-boilers/mep-boiler-geometry';

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
  // A plumbing manifold (Φ12) materialises 1 inlet + N outlet pipe connectors,
  // derived from its `outletCount` + diameters (SSoT `buildMepManifoldConnectors`).
  if (isMepManifoldEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: buildMepManifoldConnectors(entity.params) } };
  }
  // A heating radiator (Εύρος Β) materialises its 2 hydronic connectors (supply
  // inlet + return outlet) derived from `width` + `connectorDiameterMm` (SSoT
  // `buildRadiatorConnectors`), so a load-time entity re-joins the supply/return
  // networks even if its connectors were not persisted (Revit family-definition).
  if (isMepRadiatorEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: buildRadiatorConnectors(entity.params) } };
  }
  // A heating boiler (Εύρος Β #2) materialises its 2 hydronic connectors (supply
  // outlet + return inlet) derived from `width` + `connectorDiameterMm` (SSoT
  // `buildBoilerConnectors`), so a load-time boiler re-sources the supply network
  // even if its connectors were not persisted (Revit family-definition).
  if (isMepBoilerEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: buildBoilerConnectors(entity.params) } };
  }
  // A linear duct/pipe segment carries TWO endpoint connectors (start + end) so
  // it can join a pipe/duct network (Φ9). Its connector domain mirrors the
  // segment's own `domain` ('duct' | 'pipe').
  if (isMepSegmentEntity(entity)) {
    const { domain } = entity.params;
    return {
      ...entity,
      params: {
        ...entity.params,
        connectors: [
          buildSegmentEndpointConnector('start', domain),
          buildSegmentEndpointConnector('end', domain),
        ],
      },
    };
  }
  return entity;
}
