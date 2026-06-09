/**
 * Heating boiler geometry + validation + connector layout (ADR-408 Εύρος Β #2).
 *
 * Pure SSoT functions — derive `MepBoilerGeometry` from `MepBoilerParams`,
 * validate params, and lay out the fixed supply + return connectors. Idempotent +
 * side-effect free. Mirrors `mep-radiator-geometry.ts`; a boiler is a centred
 * rectangular cabinet footprint at the mounting plane with an optional plan rotation.
 *
 * Footprint + connector local positions are built in canvas units (mm × `s`) so
 * they share the same coordinate space as `params.position`. Connector
 * `localPosition` is consumed directly by `connectorWorldPosition`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  MepBoilerGeometry,
  MepBoilerParams,
} from '../types/mep-boiler-types';
import {
  MIN_BOILER_DIMENSION_MM,
  DEFAULT_BOILER_CONDENSATE_DIAMETER_MM,
  defaultBoilerFlueDiameterMm,
  defaultBoilerFuelDiameterMm,
} from '../types/mep-boiler-types';
import type { MepConnector, FuelSystemClassification } from '../types/mep-connector-types';
import {
  buildBoilerSupplyConnector,
  buildBoilerReturnConnector,
  buildBoilerDhwHotOutletConnector,
  buildBoilerDhwColdInletConnector,
  buildBoilerDhwRecircInletConnector,
  buildBoilerFlueConnector,
  buildBoilerFuelConnector,
} from '../types/mep-connector-types';
import { polygonArea, polygonBbox } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `MepBoilerGeometry` from `MepBoilerParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeMepBoilerGeometry(
  params: MepBoilerParams,
): MepBoilerGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const local = buildRectangularLocal(params.width, params.length, s);
  const transformed = transformFootprint(local, params);

  const bbox = polygonBbox(transformed);
  const areaCanvas2 = polygonArea(transformed);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;

  return {
    footprint: { vertices: transformed },
    bbox,
    area: areaM2,
    height: Math.max(0, params.bodyHeightMm),
  };
}

// ─── Local footprint builder ───────────────────────────────────────────────────

function buildRectangularLocal(width: number, length: number, s: number): Point3D[] {
  const hw = (width * s) / 2;
  const hl = (length * s) / 2;
  return [
    { x: -hw, y: -hl, z: 0 },
    { x:  hw, y: -hl, z: 0 },
    { x:  hw, y:  hl, z: 0 },
    { x: -hw, y:  hl, z: 0 },
  ];
}

/**
 * Translate local-frame vertices to world coords (anchor = centre on `position`)
 * and rotate around `position`.
 */
function transformFootprint(
  local: readonly Point3D[],
  params: MepBoilerParams,
): Point3D[] {
  const { position } = params;
  const cos = Math.cos(params.rotation * DEG_TO_RAD);
  const sin = Math.sin(params.rotation * DEG_TO_RAD);
  return local.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
}

// ─── Connector layout (pure SSoT) ──────────────────────────────────────────────

/**
 * Connector id for the condensate drain outlet of a condensing boiler (αποχέτευση
 * συμπυκνωμάτων). Host-local (unique within the boiler component).
 */
export const BOILER_CONDENSATE_CONNECTOR_ID = 'boiler-condensate';

/**
 * Condensate DRAIN outlet connector of a condensing heating boiler (ADR-408 Εύρος Β #2 —
 * condensate drain, Revit "Mechanical Equipment → condensate connector", αποχέτευση
 * συμπυκνωμάτων). A condensing boiler extracts latent heat from the flue gases and
 * produces acidic CONDENSATE that drains to the sewer: the condensate LEAVES the boiler
 * (`flow:'out'`), `domain:'pipe'`, classification REUSED as `'sanitary-drainage'` (NOT a
 * new union member — exactly the recirc-reuse pattern, so a pipe snapped here joins the
 * SAME drainage network a floor drain / sanitary fixture sources, with zero new switch
 * cases). This makes the boiler a drainage PRODUCER, the mirror of its hydronic SOURCE role.
 *
 * Co-located here (boiler-owned geometry module) next to its sole consumer
 * {@link buildBoilerConnectors} rather than in `mep-connector-types.ts` with the other
 * boiler builders: a deliberate, reversible call — the connector needs no new
 * classification/schema, so this keeps the change 100% boiler-owned (the shared connector
 * file stays untouched). May be relocated alongside the siblings in a later cleanup.
 *
 * Only seeded when the boiler's `condensing` flag is set (gated in `buildBoilerConnectors`,
 * independent of `fuelType` — Revit-grade explicit property, not inferred from efficiency).
 *
 * `localPosition` is host-local (scene units, pre-rotation) — the caller places it at the
 * back-right corner, distinct from the supply/return/DHW/flue/fuel ports (see
 * `buildBoilerConnectors`).
 */
export function buildBoilerCondensateConnector(
  localPosition: Point3D,
  diameterMm: number,
): MepConnector {
  return {
    connectorId: BOILER_CONDENSATE_CONNECTOR_ID,
    domain: 'pipe',
    flow: 'out',
    localPosition,
    pipe: { systemClassification: 'sanitary-drainage', diameterMm },
  };
}

/**
 * Build the boiler's embedded connectors (supply outlet + return inlet, plus an
 * optional DHW hot outlet for a combi boiler), derived from `params`. SSoT consumed
 * by both the completion builder (creation) and `seedDefaultConnectors` (load-time
 * re-materialisation), so a `producesDhw` toggle / reload re-derives the right set.
 *
 * The supply outlet sits at the +X end (`flow:'out'` → sources the supply network)
 * and the return inlet at the −X end (`flow:'in'`), both on the body centreline
 * (host-local, scene units, pre-rotation). When `producesDhw` (combi boiler) TWO more
 * connectors complete the DHW water path at the +Y (front) corners — a hot outlet at
 * `{+hw,+hl}` (`flow:'out'`, sources the `domestic-hot-water` network) and a cold inlet
 * at `{-hw,+hl}` (`flow:'in'`, member of the `domestic-cold-water` network: the combi
 * takes cold water and heats it, NOT hot "from nowhere"). All four corners are distinct.
 * When the combi additionally has `dhwRecirculation` a FIFTH connector is appended at the
 * −X/−Y (back-left) corner — a recirculation return inlet (`flow:'in'`, REUSING
 * `domestic-hot-water`) so the cooled DHW re-joins the SAME network and is re-heated
 * (Revit "Domestic Hot Water + Recirculation"). The DHW connectors use the dedicated
 * `dhwConnectorDiameterMm` (typical DN15, smaller than the DN22 hydronic tails), falling
 * back to `connectorDiameterMm`. INDEPENDENTLY of the DHW gate, when `fuelType` is a
 * combustion source (`gas`/`oil`) a `duct`-domain flue connector (καπναγωγός) is appended
 * at the back-centre `{0,-hl}` (`flow:'out'`, classification `exhaust`, diameter
 * `flueDiameterMm ?? defaultBoilerFlueDiameterMm(fuelType)` — type-driven per fuel: gas DN100,
 * oil DN130) AND a `fuel`-domain fuel supply inlet (τροφοδοσία καυσίμου) at the front-centre
 * `{0,+hl}` (`flow:'in'`, classification `fuel-gas`/`fuel-oil` from `fuelType`, diameter
 * `fuelConnectorDiameterMm ?? defaultBoilerFuelDiameterMm(fuelType)` — gas DN20, oil DN15) —
 * an electric boiler / heat-pump has neither.
 * INDEPENDENTLY of every gate above, when `condensing` is set a `pipe`-domain condensate
 * drain (αποχέτευση συμπυκνωμάτων) is appended at the back-right `{+hw,-hl}` (`flow:'out'`,
 * REUSING the `sanitary-drainage` classification, diameter `condensateConnectorDiameterMm
 * ?? DEFAULT_BOILER_CONDENSATE_DIAMETER_MM`) — a condensing boiler drains its acidic
 * condensate to the sewer. `connectorWorldPosition` applies the host rotation/translation
 * for free.
 */
export function buildBoilerConnectors(params: MepBoilerParams): MepConnector[] {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const hw = (params.width * s) / 2;
  const hl = (params.length * s) / 2;
  const supply: Point3D = { x: hw, y: 0, z: 0 };
  const ret: Point3D = { x: -hw, y: 0, z: 0 };
  const connectors: MepConnector[] = [
    buildBoilerSupplyConnector(supply, params.connectorDiameterMm),
    buildBoilerReturnConnector(ret, params.connectorDiameterMm),
  ];
  if (params.producesDhw) {
    const dhwDiameter = params.dhwConnectorDiameterMm ?? params.connectorDiameterMm;
    // DHW hot outlet at +X/+Y, cold inlet at −X/+Y — distinct from supply/return on y=0.
    const dhwHot: Point3D = { x: hw, y: hl, z: 0 };
    const dhwCold: Point3D = { x: -hw, y: hl, z: 0 };
    connectors.push(
      buildBoilerDhwHotOutletConnector(dhwHot, dhwDiameter),
      buildBoilerDhwColdInletConnector(dhwCold, dhwDiameter),
    );
    if (params.dhwRecirculation) {
      // Recirculation return inlet at the −X/−Y (back-left) corner — distinct from all
      // four other ports. The cooled DHW returns here; reuses `domestic-hot-water` so it
      // re-joins the SAME DHW network the hot outlet sources (gated by producesDhw).
      const dhwRecirc: Point3D = { x: -hw, y: -hl, z: 0 };
      connectors.push(buildBoilerDhwRecircInletConnector(dhwRecirc, dhwDiameter));
    }
  }
  // Combustion flue (καπναγωγός) — a gas/oil boiler exhausts flue gases through a duct
  // connector. Gated by `fuelType` (combustion sources only), INDEPENDENT of the combi/DHW
  // gate: a plain gas boiler with no DHW still vents. Placed at the back-centre `{0,-hl}`,
  // free of the supply/return (y=0) and the four DHW corners. Founds the `duct` domain.
  if (params.fuelType === 'gas' || params.fuelType === 'oil') {
    const flue: Point3D = { x: 0, y: -hl, z: 0 };
    const flueDiameter = params.flueDiameterMm ?? defaultBoilerFlueDiameterMm(params.fuelType);
    connectors.push(buildBoilerFlueConnector(flue, flueDiameter));
    // Combustion fuel SUPPLY inlet (τροφοδοσία καυσίμου) — the gas/oil line FEEDS the
    // boiler. Same combustion gate as the flue (gas/oil only; electric/heat-pump take
    // electricity, not a piped fuel line). Placed at the front-centre `{0,+hl}`, free of
    // the supply/return (y=0), the four DHW corners, and the back-centre flue `{0,-hl}`.
    // `domain:'fuel'` (founds the fuel domain). Classification = the supplied medium.
    const fuel: Point3D = { x: 0, y: hl, z: 0 };
    const fuelDiameter = params.fuelConnectorDiameterMm ?? defaultBoilerFuelDiameterMm(params.fuelType);
    const fuelClassification: FuelSystemClassification =
      params.fuelType === 'oil' ? 'fuel-oil' : 'fuel-gas';
    connectors.push(buildBoilerFuelConnector(fuel, fuelDiameter, fuelClassification));
  }
  // Condensate drain (αποχέτευση συμπυκνωμάτων) — a CONDENSING boiler produces acidic
  // condensate that must drain to the sanitary system. Gated by the explicit `condensing`
  // flag (Revit-grade), INDEPENDENT of `fuelType` and of the combi/flue gates. Placed at
  // the back-right `{+hw,-hl}` corner — free of the supply/return (y=0), the four DHW
  // corners, the back-centre flue `{0,-hl}` and the front-centre fuel `{0,+hl}`. REUSES
  // the `sanitary-drainage` classification (no new union member) so it joins the same
  // drainage network a floor drain does.
  if (params.condensing) {
    const condensate: Point3D = { x: hw, y: -hl, z: 0 };
    const condensateDiameter =
      params.condensateConnectorDiameterMm ?? DEFAULT_BOILER_CONDENSATE_DIAMETER_MM;
    connectors.push(buildBoilerCondensateConnector(condensate, condensateDiameter));
  }
  return connectors;
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of a boiler validation pass — hard errors non-empty when invalid. */
export interface MepBoilerValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `MepBoilerEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepBoilerParams`. Operates purely on params — geometry re-derivable.
 * Hard errors: non-positive width / length / body height, or a footprint dimension
 * below `MIN_BOILER_DIMENSION_MM`.
 */
export function validateMepBoilerParams(
  params: MepBoilerParams,
): MepBoilerValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.width <= 0) {
    hardErrors.push('mepBoiler.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_BOILER_DIMENSION_MM) {
    hardErrors.push('mepBoiler.validation.hardErrors.dimensionTooSmall');
  }

  if (params.length <= 0) {
    hardErrors.push('mepBoiler.validation.hardErrors.nonPositiveLength');
  } else if (params.length < MIN_BOILER_DIMENSION_MM) {
    hardErrors.push('mepBoiler.validation.hardErrors.dimensionTooSmall');
  }

  if (params.bodyHeightMm <= 0) {
    hardErrors.push('mepBoiler.validation.hardErrors.nonPositiveBodyHeight');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
