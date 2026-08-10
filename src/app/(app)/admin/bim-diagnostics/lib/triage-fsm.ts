/**
 * Triage FSM — ADR-366 §C.7.Q2
 *
 * Pure state machine for super-admin triage transitions of
 * `performance_diagnostics` records. Forward-only progression plus
 * `wontfix` escape hatch from any non-terminal state.
 *
 * Transitions:
 *   new           → triaged | wontfix
 *   triaged       → investigating | wontfix | resolved
 *   investigating → resolved | wontfix
 *   resolved      → (terminal)
 *   wontfix       → (terminal)
 *
 * @module admin/bim-diagnostics/lib/triage-fsm
 */

import type { TriageStatus } from '@/types/performance-diagnostic';

const ALLOWED_TRANSITIONS: Record<TriageStatus, ReadonlyArray<TriageStatus>> = {
  new: ['triaged', 'wontfix'],
  triaged: ['investigating', 'resolved', 'wontfix'],
  investigating: ['resolved', 'wontfix'],
  resolved: [],
  wontfix: [],
};

/** True iff `from → to` is a valid transition. */
export function canTransition(from: TriageStatus, to: TriageStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** All allowed next states from the given current state. */
export function nextStates(from: TriageStatus): ReadonlyArray<TriageStatus> {
  return ALLOWED_TRANSITIONS[from];
}

/** True iff the state is terminal (no further transitions). */
export function isTerminal(state: TriageStatus): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}

/** Ordered list of all triage states for UI rendering. */
export const TRIAGE_STATUSES: ReadonlyArray<TriageStatus> = [
  'new',
  'triaged',
  'investigating',
  'resolved',
  'wontfix',
];
