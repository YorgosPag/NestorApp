/**
 * ADR-431 — Stage 2 Grouping: the electrical-WEAK rules (ISO/IEC 11801 / EN 50173).
 *
 * Reuses the discipline-agnostic bin-packer in `circuit-grouping-core.ts` verbatim (the
 * same brain as electrical-strong); this module is only the WEAK parameterisation: the
 * per-service channel rule (a structured-cabling switch's port budget + cable category)
 * and the pluggable `WeakGroupingStandard`. There is **no phase balancing** (weak is a
 * star topology homed at the rack, not a 3-phase panel) — `phases` is empty, so
 * `balancePhases` is never invoked.
 *
 * @see ./circuit-grouping-core.ts (the shared bin-packer)
 * @see ./electrical-circuit-grouping.ts (the strong rules / template)
 */

import type { CircuitCap, CircuitGroup, GroupingStandard } from './circuit-grouping-core';
import type { WeakCableType, WeakCircuitService } from './electrical-weak-design-types';

/** Per-service weak channel rule (cable category + the port-budget cap). */
export interface WeakChannelRule extends CircuitCap {
  /** Structured-cabling cable category (Cat6 / Cat6A). */
  readonly cableType: WeakCableType;
  /** Max ports per channel — the switch port budget (24 / 48). */
  readonly maxLoad: number;
  /** Max outlets per channel (mirror of the port budget — one link per outlet). */
  readonly maxPoints: number;
}

/** A pluggable WEAK channel-grouping standard: per-service port budgets (no phases). */
export type WeakGroupingStandard = GroupingStandard<WeakCircuitService, WeakChannelRule>;

/** A weak channel group BEFORE sizing (the core group narrowed to the weak rule). */
export type WeakCircuitGroup = CircuitGroup<WeakCircuitService, WeakChannelRule>;

/**
 * The pilot weak grouping standard (ISO/IEC 11801). A 24-port switch budget per channel,
 * Cat6 permanent links, both data and controls. No phases (star topology at the rack).
 */
export const ISO11801_GROUPING_STANDARD: WeakGroupingStandard = {
  id: 'ISO11801/port-budget',
  rules: {
    data: { cableType: 'Cat6', maxLoad: 24, maxPoints: 24 },
    controls: { cableType: 'Cat6', maxLoad: 24, maxPoints: 24 },
  },
  phases: [],
};
