/**
 * ADR-430 — Stage 2 Grouping: the electrical-STRONG rules (ΕΛΟΤ HD 384 / IEC 60364).
 *
 * The bin-packing engine itself (split-by-service · group-by-zone · bin-pack · phase
 * balance) now lives discipline-agnostic in `circuit-grouping-core.ts` (ADR-431
 * Boy-Scout), shared verbatim with the weak-current discipline. This module is the
 * STRONG parameterisation of that core: the per-service circuit rules (10A lighting /
 * 16A socket branches) and the pluggable `ElectricalGroupingStandard`. A different
 * installation policy (more poles, different caps) is a new standard, never an engine
 * change.
 *
 * @see ./circuit-grouping-core.ts (the shared bin-packer + phase balance)
 * @see ./electrical-sizing.ts (Stage 3 — conductor/breaker/voltage drop per circuit)
 */

import type { ElectricalCircuitService } from './electrical-design-types';
import {
  groupIntoCircuits,
  balancePhases,
  type CircuitCap,
  type CircuitGroup,
  type GroupingStandard,
} from './circuit-grouping-core';

/** Per-service circuit rule (protective device + conductor + the two grouping caps). */
export interface ElectricalCircuitRule extends CircuitCap {
  /** Protective device rating (A). */
  readonly breakerAmp: number;
  /** Conductor cross-section (mm²). */
  readonly conductorMm2: number;
  /** Max connected load (VA) before a new circuit opens (≈ breaker·V·utilisation). */
  readonly maxLoad: number;
  /** Max points (devices) per circuit. */
  readonly maxPoints: number;
}

/** A pluggable STRONG circuit-grouping standard: per-service limits + the panel's phase set. */
export type ElectricalGroupingStandard = GroupingStandard<ElectricalCircuitService, ElectricalCircuitRule>;

/** A strong circuit group BEFORE sizing/phase (the core group narrowed to the strong rule). */
export type ElectricalCircuitGroup = CircuitGroup<ElectricalCircuitService, ElectricalCircuitRule>;

/**
 * The pilot strong grouping standard (Greek residential, ΕΛΟΤ HD 384). Lighting on a
 * 10A/1.5mm² branch (≤ ~1840 VA = 10A·230V·0.8, ≤ 12 points); sockets on a 16A/2.5mm²
 * branch (≤ ~2944 VA = 16A·230V·0.8, ≤ 8 points). 3-phase panel (L1/L2/L3) for balancing.
 */
export const HD384_GROUPING_STANDARD: ElectricalGroupingStandard = {
  id: 'HD384/circuit-limits',
  rules: {
    lighting: { breakerAmp: 10, conductorMm2: 1.5, maxLoad: 1840, maxPoints: 12 },
    power: { breakerAmp: 16, conductorMm2: 2.5, maxLoad: 2944, maxPoints: 8 },
  },
  phases: ['L1', 'L2', 'L3'],
};

// Re-export the shared bin-packer + phase balance + the group type so existing strong
// imports (index barrel, tests) keep working unchanged after the core extraction.
export { groupIntoCircuits, balancePhases };
export type { CircuitGroup };
