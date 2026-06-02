/**
 * BIM MEP Component — shared params mixin (ADR-408 Φ1).
 *
 * `MepConnectorHostParams` is the seam that lets ANY MEP component carry typed
 * connectors uniformly. It is composed into the concrete params interface (NOT
 * the entity, unlike `IfcEntityMixin`) because connectors participate in the
 * params-is-SSoT contract: they are audited as param changes and round-trip
 * through `Update<X>ParamsCommand`, exactly like every other parametric field.
 *
 * Applied to:
 *   - `MepFixtureParams` (ADR-406 light fixture — retrofit, additive/optional).
 *   - `ElectricalPanelParams` (ADR-408 Φ3, the circuit source) — future.
 *
 * The field is OPTIONAL → adding it is non-breaking and needs no data migration
 * (existing fixture docs simply have no `connectors`).
 *
 * The entity-level accessor `getEntityConnectors(entity)` lives in
 * `bim/mep-systems/connector-access.ts` (it must import the `Entity` union and
 * type guards; keeping it out of this low-level type file avoids an import
 * cycle through `types/entities.ts`).
 *
 * @see ./mep-connector-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepConnector } from './mep-connector-types';

/** Any MEP component params that can carry connectors. */
export interface MepConnectorHostParams {
  /** Typed connection points, host-local. Absent/empty = no MEP connectivity yet. */
  readonly connectors?: readonly MepConnector[];
}
