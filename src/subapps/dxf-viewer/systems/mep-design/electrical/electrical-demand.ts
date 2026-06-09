/**
 * ADR-430 — Stage 1 Demand: apparent power (VA) per electrical terminal (SSoT, pluggable).
 *
 * Each recognized electrical terminal (luminaire / socket) is assigned a design apparent
 * power and a circuit service derived from its connector classification:
 *   - `lighting` classification → a lighting load (default ~100 VA / point),
 *   - `power` classification    → a general socket load (default ~200 VA / point).
 *
 * Greek residential practice (and Revit's "load classification" defaults): a luminaire point
 * is taken at ~100 VA and a general-purpose socket at ~200 VA when the device carries no
 * explicit connected load. Both defaults + the nominal voltage are part of the pluggable
 * `ElectricalDemandStandard`, so a different convention (e.g. 1.5×16A diversified socket
 * outlets) is a new standard, never an engine change. Connector classifications other than
 * `lighting`/`power` (data/controls — weak current) are skipped at v1.
 *
 * @see ./electrical-strong-discipline.ts (selects the standard)
 * @see ../heating/heating-flow.ts (the hydronic demand counterpart)
 */

import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import type { ElectricalSystemClassification } from '../../../bim/types/mep-connector-types';
import type {
  ElectricalCircuitService,
  ElectricalDemandModel,
  TerminalElectricalDemand,
} from './electrical-design-types';

/** A pluggable electrical demand standard: a terminal's service → its design VA. */
export interface ElectricalDemandStandard {
  readonly id: string;
  /** Nominal phase voltage (V) — Greek/EU single-phase = 230. */
  readonly nominalVoltage: number;
  /** Design apparent power (VA) per point, by service. */
  readonly vaPerPoint: Readonly<Record<ElectricalCircuitService, number>>;
}

/** The pilot electrical demand standard (Greek residential VA-per-point defaults, 230V). */
export const HD384_DEMAND_STANDARD: ElectricalDemandStandard = {
  id: 'HD384/VA-per-point',
  nominalVoltage: 230,
  vaPerPoint: {
    lighting: 100,
    power: 200,
  },
};

/** Map a connector's electrical classification to a v1 circuit service, or `null` (weak current). */
function serviceForClassification(
  classification: ElectricalSystemClassification,
): ElectricalCircuitService | null {
  if (classification === 'lighting') return 'lighting';
  if (classification === 'power') return 'power';
  // data / controls = weak-current (ADR-430 §2 reserved — 6th discipline).
  return null;
}

/**
 * Build the per-terminal electrical demand model from the Stage 0 recognition model. Each
 * recognized terminal with a lighting/power electrical connector becomes one demand; data /
 * controls terminals are skipped (weak current, out of v1 scope).
 */
export function buildElectricalDemandModel(
  model: RecognitionModel,
  standard: ElectricalDemandStandard,
): ElectricalDemandModel {
  const demands: TerminalElectricalDemand[] = [];
  for (const el of model.elements) {
    if (!isRecognizedTerminal(el)) continue;
    // The first lighting/power electrical connector decides the terminal's service.
    const ref = el.connectorRefs.find(
      (r) => serviceForClassification(r.systemClassification as ElectricalSystemClassification) !== null,
    );
    if (!ref) continue;
    const service = serviceForClassification(ref.systemClassification as ElectricalSystemClassification);
    if (!service) continue;
    demands.push({
      terminalId: el.elementId,
      entityId: ref.entityId,
      connectorId: ref.connectorId,
      terminalKind: el.terminalKind,
      service,
      load: standard.vaPerPoint[service],
      point: el.position,
      ...(el.spaceId ? { spaceId: el.spaceId } : {}),
    });
  }
  return { demands };
}
