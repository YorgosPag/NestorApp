/**
 * ADR-431 — Stage 1 Demand (weak): ports per structured-cabling terminal (SSoT, pluggable).
 *
 * Each recognized weak-current terminal (data outlet / controls device) is assigned a
 * port demand and a channel service derived from its connector classification:
 *   - `data`     classification → a structured-cabling link (default 1 port / outlet),
 *   - `controls` classification → a BMS/security drop (default 1 port).
 *
 * The "load" of the shared grouping core is, for weak, the **port count** (one RJ45 link
 * per outlet); the bin-pack budget is the switch's port count (24/48). The defaults are
 * part of the pluggable `WeakDemandStandard`, so a twin-port faceplate is a new standard,
 * never an engine change. Power/lighting connectors (strong current) are skipped.
 *
 * @see ./electrical-weak-discipline.ts (selects the standard)
 * @see ./electrical-demand.ts (the strong VA-demand counterpart / template)
 */

import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import type { ElectricalSystemClassification } from '../../../bim/types/mep-connector-types';
import type { TerminalDemand } from './circuit-grouping-core';
import type { WeakCircuitService } from './electrical-weak-design-types';

/** A pluggable weak demand standard: ports/outlet by service. */
export interface WeakDemandStandard {
  readonly id: string;
  /** Design port count per outlet, by service (one RJ45 link by default). */
  readonly portsPerPoint: Readonly<Record<WeakCircuitService, number>>;
}

/** The pilot weak demand standard (ISO/IEC 11801: 1 port per outlet). */
export const ISO11801_DEMAND_STANDARD: WeakDemandStandard = {
  id: 'ISO11801/ports-per-outlet',
  portsPerPoint: {
    data: 1,
    controls: 1,
  },
};

/** Map a connector's electrical classification to a weak channel service, or `null` (strong current). */
function serviceForClassification(
  classification: ElectricalSystemClassification,
): WeakCircuitService | null {
  if (classification === 'data') return 'data';
  if (classification === 'controls') return 'controls';
  // power / lighting = strong current (ADR-430) — skipped here.
  return null;
}

/** All per-terminal weak demands for a storey. */
export interface WeakDemandModel {
  readonly demands: readonly TerminalDemand<WeakCircuitService>[];
}

/**
 * Build the per-terminal weak demand model from the Stage 0 recognition model. Each
 * recognized terminal with a data/controls connector becomes one demand; power/lighting
 * terminals are skipped (strong current, ADR-430 scope).
 */
export function buildWeakDemandModel(
  model: RecognitionModel,
  standard: WeakDemandStandard,
): WeakDemandModel {
  const demands: TerminalDemand<WeakCircuitService>[] = [];
  for (const el of model.elements) {
    if (!isRecognizedTerminal(el)) continue;
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
      load: standard.portsPerPoint[service],
      point: el.position,
      ...(el.spaceId ? { spaceId: el.spaceId } : {}),
    });
  }
  return { demands };
}
