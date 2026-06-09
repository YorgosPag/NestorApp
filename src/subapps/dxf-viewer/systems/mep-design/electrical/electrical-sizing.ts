/**
 * ADR-430 — Stage 3 Sizing: conductor / breaker + voltage-drop check (SSoT, pluggable).
 *
 * Each formed circuit already carries its protective device + conductor from the grouping
 * rule (lighting 10A/1.5mm², sockets 16A/2.5mm² — ΕΛΟΤ HD 384). This stage adds the
 * **voltage-drop** verification (Revit "circuit voltage drop"):
 *
 *     ΔU% = (2 · ρ · L · I) / (A · U) · 100        (single-phase, go + return)
 *       I = connectedLoad / U,   L = home-run wire length to the worst load
 *
 * The wire length is the derived daisy-chain (greedy nearest-neighbour from the panel through
 * the members — the same topology `computeCircuitWirePaths` renders), so the advisory matches
 * the drawn home-run. The full current is assumed to reach the farthest point (conservative).
 * The copper resistivity + the per-service drop limits (3% lighting / 5% sockets, the HD 384 /
 * informative IEC 60364 figures) are part of the pluggable `ElectricalSizingStandard`.
 *
 * Advisory only (like the ADR-422 L6 ΚΕΝΑΚ readout): an exceeded drop is flagged, never a
 * hard block. Pure — no store / React / Date / Math.random.
 *
 * @see ./electrical-circuit-grouping.ts (Stage 2 — the formed circuits + rules)
 * @see ../../../bim/mep-systems/mep-wire-routing.ts (the home-run topology it mirrors)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ElectricalCircuitService } from './electrical-design-types';
import type { ElectricalCircuitGroup } from './electrical-circuit-grouping';
import { daisyChainLengthM } from './circuit-grouping-core';

/** A pluggable electrical sizing standard: resistivity + per-service voltage-drop limits. */
export interface ElectricalSizingStandard {
  readonly id: string;
  /** Copper resistivity (Ω·mm²/m) at the design operating temperature (~0.0225). */
  readonly copperResistivityOhmMmPerM: number;
  /** Max allowed voltage drop (%) per service (lighting tighter than sockets). */
  readonly voltageDropLimitPercent: Readonly<Record<ElectricalCircuitService, number>>;
  /** Conductor ampacity (A) for a cross-section (mm²) — for breaker-vs-ampacity transparency. */
  ampacityForMm2(mm2: number): number;
}

/** HD 384 reference ampacity (A) for common copper sizes (installation method ~C). */
const CU_AMPACITY_BY_MM2: Readonly<Record<number, number>> = {
  1.5: 17.5,
  2.5: 24,
  4: 32,
  6: 41,
  10: 57,
};

/** The pilot electrical sizing standard (copper, 3%/5% drop limits). */
export const HD384_SIZING_STANDARD: ElectricalSizingStandard = {
  id: 'HD384/voltage-drop',
  copperResistivityOhmMmPerM: 0.0225,
  voltageDropLimitPercent: { lighting: 3, power: 5 },
  ampacityForMm2(mm2: number): number {
    return CU_AMPACITY_BY_MM2[mm2] ?? 0;
  },
};

/** The result of sizing one circuit (the drop check appended to its grouped breaker/conductor). */
export interface CircuitSizing {
  readonly breakerAmp: number;
  readonly conductorMm2: number;
  readonly voltageDropPercent: number;
  readonly voltageDropExceeded: boolean;
}

// `daisyChainLengthM` is the shared home-run length helper (circuit-grouping-core); it
// is re-exported here so existing strong imports (index barrel, tests) stay unchanged.
export { daisyChainLengthM };

/**
 * Size one circuit: breaker + conductor come from its grouping rule; the voltage drop is
 * computed from the connected load, the nominal voltage and the home-run length, then checked
 * against the service's limit.
 */
export function sizeCircuit(
  group: ElectricalCircuitGroup,
  source: Point2D,
  sceneToM: number,
  nominalVoltage: number,
  standard: ElectricalSizingStandard,
): CircuitSizing {
  const lengthM = daisyChainLengthM(source, group.points, sceneToM);
  const current = nominalVoltage > 0 ? group.connectedLoad / nominalVoltage : 0;
  const drop =
    nominalVoltage > 0 && group.rule.conductorMm2 > 0
      ? (2 * standard.copperResistivityOhmMmPerM * lengthM * current) /
        (group.rule.conductorMm2 * nominalVoltage) *
        100
      : 0;
  const limit = standard.voltageDropLimitPercent[group.service];
  return {
    breakerAmp: group.rule.breakerAmp,
    conductorMm2: group.rule.conductorMm2,
    voltageDropPercent: drop,
    voltageDropExceeded: drop > limit,
  };
}
