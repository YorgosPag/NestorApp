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
  isMepWaterHeaterEntity,
  isMepUnderfloorEntity,
} from '../../types/entities';
import { getEntityConnectors } from './connector-access';
import {
  buildDefaultLightingConnector,
  buildDefaultPowerConnector,
  buildDefaultDataConnector,
  buildDefaultPanelOutgoingConnector,
  buildDefaultCommsRackOutgoingConnector,
  buildSegmentEndpointConnector,
  buildFloorDrainConnector,
  buildAirTerminalSupplyConnector,
  buildAhuSupplyAirConnector,
} from '../types/mep-connector-types';
import { isSocketKind } from '../mep-fixtures/socket-symbol-spec';
import { isDataOutletKind } from '../mep-fixtures/data-outlet-symbol-spec';
import { isAirTerminalKind, DEFAULT_AIR_TERMINAL_DUCT_DIAMETER_MM } from '../mep-fixtures/air-terminal-symbol-spec';
import { isAhuKind, DEFAULT_AHU_DUCT_DIAMETER_MM } from '../mep-fixtures/ahu-symbol-spec';
import { DEFAULT_FLOOR_DRAIN_CONNECTOR_DIAMETER_MM } from '../types/mep-fixture-types';
import { isPlumbingFixtureKind } from '../mep-fixtures/plumbing-fixture-spec';
import { buildSanitaryFixtureConnectors } from '../mep-fixtures/sanitary-fixture-connectors';
import { buildMepManifoldConnectors } from '../mep-manifolds/mep-manifold-geometry';
import { buildRadiatorConnectors } from '../mep-radiators/mep-radiator-geometry';
import { buildBoilerConnectors } from '../mep-boilers/mep-boiler-geometry';
import { buildWaterHeaterConnectors } from '../mep-water-heaters/mep-water-heater-geometry';
import { buildUnderfloorConnectors } from '../mep-underfloor/mep-underfloor-geometry';

/**
 * Materialise the host type's default connector onto a legacy entity that lacks
 * one. Pure; same reference when the entity is not a connector host or already
 * carries at least one connector (idempotent).
 */
export function seedDefaultConnectors(entity: Entity): Entity {
  // Already materialised (or a non-host — `getEntityConnectors` returns []
  // there too, and the guards below then leave it untouched). Same ref.
  if (getEntityConnectors(entity).length > 0) return entity;

  // A point-based fixture re-materialises its kind's connector set: a plumbing
  // fixture (sanitary terminal WC/basin/… OR appliance washing-machine/… — ADR-408
  // Δρόμος B) gets its drain outlet + domestic water-supply inlets (SSoT
  // `buildSanitaryFixtureConnectors`), a floor drain its single outlet, and a light
  // fixture its lighting power-in. Kind-aware so a legacy plumbing fixture re-joins
  // the water network on load (Revit family-definition; was lighting-only).
  if (isMepFixtureEntity(entity)) {
    const { kind } = entity.params;
    const sceneUnits = entity.params.sceneUnits ?? 'mm';
    const connectors = isPlumbingFixtureKind(kind)
      ? buildSanitaryFixtureConnectors(kind, sceneUnits)
      : kind === 'floor-drain'
        ? [buildFloorDrainConnector({ x: 0, y: 0, z: 0 }, DEFAULT_FLOOR_DRAIN_CONNECTOR_DIAMETER_MM)]
        // ADR-430 — a socket re-materialises a `'power'` connector (not `'lighting'`),
        // so a load-time socket re-joins its 16A circuit.
        : isSocketKind(kind)
          ? [buildDefaultPowerConnector()]
          // ADR-431 — a data outlet re-materialises a `'data'` connector, so a
          // load-time RJ45 outlet re-joins its structured-cabling channel.
          : isDataOutletKind(kind)
            ? [buildDefaultDataConnector()]
            // ADR-432 — an air terminal re-materialises its supply-air duct INLET, an
            // AHU its supply-air duct OUTLET, so a load-time HVAC component re-joins
            // (terminal) / re-sources (AHU) the supply-air duct network.
            : isAirTerminalKind(kind)
              ? [buildAirTerminalSupplyConnector({ x: 0, y: 0, z: 0 }, DEFAULT_AIR_TERMINAL_DUCT_DIAMETER_MM)]
              : isAhuKind(kind)
                ? [buildAhuSupplyAirConnector({ x: 0, y: 0, z: 0 }, DEFAULT_AHU_DUCT_DIAMETER_MM)]
                : [buildDefaultLightingConnector()];
    return { ...entity, params: { ...entity.params, connectors } };
  }
  if (isElectricalPanelEntity(entity)) {
    // ADR-431 — a comms-rack (weak-current source) re-materialises a `'data'` out
    // connector so it sources structured-cabling channels; a power panel keeps its
    // `'power'` out connector (kind-aware, Revit family-definition).
    const connector =
      entity.params.kind === 'comms-rack'
        ? buildDefaultCommsRackOutgoingConnector()
        : buildDefaultPanelOutgoingConnector();
    return { ...entity, params: { ...entity.params, connectors: [connector] } };
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
  // ADR-408 DHW — a domestic hot-water heater materialises its 2 connectors (cold
  // inlet `domestic-cold-water` + hot outlet `domestic-hot-water`) derived from
  // `width` + `connectorDiameterMm` (SSoT `buildWaterHeaterConnectors`), so a
  // load-time water heater re-sources the DHW network even if its connectors were
  // not persisted (Revit family-definition).
  if (isMepWaterHeaterEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: buildWaterHeaterConnectors(entity.params) } };
  }
  // ADR-408 Εύρος Β #3 — an underfloor loop materialises its 2 hydronic connectors
  // (supply inlet + return outlet) at the computed loop-entry points (SSoT
  // `buildUnderfloorConnectors`), so a load-time loop re-joins the supply/return
  // networks even if its connectors were not persisted.
  if (isMepUnderfloorEntity(entity)) {
    return { ...entity, params: { ...entity.params, connectors: buildUnderfloorConnectors(entity.params) } };
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
