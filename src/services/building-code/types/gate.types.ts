/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Types for the ΝΟΚ gate checking system.
 * Gates produce structured PASS/WARN/FAIL results consumed by GatePanel.
 */

/** Outcome of a single ΝΟΚ check or an entire gate. */
export type GateStatus = 'pass' | 'warn' | 'fail' | 'na';

/**
 * A single atomic check within a gate (e.g. "area ≥ minimum").
 * labelKey and noteKey are i18n keys from the 'gates' namespace.
 */
export interface GateCheck {
  readonly id: string;
  readonly labelKey: string;
  readonly status: GateStatus;
  /** Formatted current value for display (e.g. "223.65 m²"). */
  readonly value?: string;
  /** Formatted threshold for display (e.g. "≥ 200 m²"). */
  readonly threshold?: string;
  /** Optional explanatory i18n key shown beneath the check row. */
  readonly noteKey?: string;
}

/**
 * Result of running one complete gate.
 * status = aggregate worst-case of all contained checks.
 */
export interface GateResult {
  readonly gateId: string;
  readonly labelKey: string;
  readonly status: GateStatus;
  readonly checks: readonly GateCheck[];
}
