/**
 * MEP heating + underfloor + DHW grip-kind discriminator unions — extracted from
 * `grip-kinds.ts` (SRP / Google file-size standard N.7.1).
 *
 * Contains the ADR-408 Εύρος Β + DHW grip kinds:
 *   - `MepRadiatorGripKind`    — heating radiator (terminal unit)
 *   - `MepBoilerGripKind`      — heating boiler (heat source)
 *   - `MepUnderfloorGripKind`  — underfloor heating loop (area entity)
 *   - `MepWaterHeaterGripKind` — domestic hot water heater (DHW source)
 *
 * Re-exported from `grip-kinds.ts` for backward compatibility.
 */

/**
 * ADR-408 Εύρος Β #1 — Heating radiator grip kind (parametric grip type). Routes
 * commit through `applyMepRadiatorGripDrag()` + `UpdateMepRadiatorParamsCommand`.
 * Full wall-parity mirror of the plumbing manifold (rectangular-only → no diameter).
 */
export type MepRadiatorGripKind =
  | 'mep-radiator-move'
  | 'mep-radiator-rotation'
  | 'mep-radiator-corner-ne'
  | 'mep-radiator-corner-nw'
  | 'mep-radiator-corner-sw'
  | 'mep-radiator-corner-se';

/**
 * ADR-408 Εύρος Β #2 — Heating boiler grip kind (parametric grip type). Routes
 * commit through `applyMepBoilerGripDrag()` + `UpdateMepBoilerParamsCommand`.
 * Full wall-parity mirror of the heating radiator (rectangular-only → no diameter).
 */
export type MepBoilerGripKind =
  | 'mep-boiler-move'
  | 'mep-boiler-rotation'
  | 'mep-boiler-corner-ne'
  | 'mep-boiler-corner-nw'
  | 'mep-boiler-corner-sw'
  | 'mep-boiler-corner-se';

/**
 * ADR-408 DHW — Domestic hot water heater grip kind (parametric grip type). Routes
 * commit through `applyMepWaterHeaterGripDrag()` + `UpdateMepWaterHeaterParamsCommand`.
 * Full wall-parity mirror of the heating boiler (rectangular-only → no diameter).
 */
export type MepWaterHeaterGripKind =
  | 'mep-water-heater-move'
  | 'mep-water-heater-rotation'
  | 'mep-water-heater-corner-ne'
  | 'mep-water-heater-corner-nw'
  | 'mep-water-heater-corner-sw'
  | 'mep-water-heater-corner-se';

/**
 * ADR-408 Εύρος Β #3 — Underfloor heating loop grip kind (parametric grip type).
 * Routes commit through `applyMepUnderfloorGripDrag()` +
 * `UpdateMepUnderfloorParamsCommand` instead of the standard
 * `StretchEntityCommand` vertex path.
 *
 * Two grip families exposed by `MepUnderfloorEntity`:
 *   - `mep-underfloor-vertex-N`        → translate footprint outline vertex N.
 *   - `mep-underfloor-edge-midpoint-N` → insert new vertex at edge N midpoint.
 *
 * After each drag, `buildUnderfloorConnectors` re-derives the two connectors
 * so the loop-entry stays coincident with the edited polygon boundary.
 */
export type MepUnderfloorGripKind =
  | `mep-underfloor-vertex-${number}`
  | `mep-underfloor-edge-midpoint-${number}`;
