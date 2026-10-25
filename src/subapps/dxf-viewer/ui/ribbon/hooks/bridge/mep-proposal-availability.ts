/**
 * ADR-444 §7.6 — Accept / Reject availability of the MEP auto-design triads.
 *
 * Revit (Finish / Cancel) and Office (Accept / Reject) enable the confirm pair ONLY while
 * there is something to confirm. Each triad «Δημιουργία → Αποδοχή → Απόρριψη» owns a
 * proposal store (ADR-426…432); this module is the single owner that mirrors «is there
 * a pending proposal of MY discipline?» into `ToolAvailabilityStore` (ADR-921):
 *
 *   no proposal  → `accept` + `reject` unavailable (greyed + «why» tooltip; a click
 *                  explains via the central toast instead of silently no-op'ing)
 *   proposal     → both available
 *
 * `generate` is never gated. Electrical strong and weak share ONE store, so the gate
 * reads the review's `origin` — a weak proposal enables only the weak pair.
 *
 * Non-React on purpose: the stores mutate only on discrete Generate / Accept / Reject,
 * so plain subscriptions publish without re-rendering any shell (ADR-040 CHECK 6C).
 */

import {
  setToolUnavailability,
  type RibbonActionKey,
  type ToolUnavailability,
} from '../../../../stores/ToolAvailabilityStore';
import { waterProposalStore } from '../../../../systems/mep-design/water/water-proposal-store';
import { drainageProposalStore } from '../../../../systems/mep-design/drainage/drainage-proposal-store';
import { heatingProposalStore } from '../../../../systems/mep-design/heating/heating-proposal-store';
import { hvacProposalStore } from '../../../../systems/mep-design/hvac/hvac-proposal-store';
import { fireProposalStore } from '../../../../systems/mep-design/fire/fire-proposal-store';
import { gasProposalStore } from '../../../../systems/mep-design/gas/gas-proposal-store';
import { electricalProposalStore } from '../../../../systems/mep-design/electrical/electrical-proposal-store';
import { ELECTRICAL_AUTO_RIBBON_ACTIONS } from './electrical-auto-command-keys';
import { ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS } from './electrical-weak-auto-command-keys';
import { WATER_SUPPLY_RIBBON_ACTIONS } from './water-auto-supply-command-keys';
import { DRAINAGE_AUTO_RIBBON_ACTIONS } from './drainage-auto-command-keys';
import { HEATING_AUTO_RIBBON_ACTIONS } from './heating-auto-command-keys';
import { HVAC_AUTO_RIBBON_ACTIONS } from './hvac-auto-command-keys';
import { FIRE_AUTO_RIBBON_ACTIONS } from './fire-auto-command-keys';
import { GAS_AUTO_RIBBON_ACTIONS } from './gas-auto-command-keys';

/** One triad: the confirm pair it gates + how to observe its pending proposal. */
export interface MepProposalGate {
  readonly actions: { readonly accept: RibbonActionKey; readonly reject: RibbonActionKey };
  readonly subscribe: (listener: () => void) => () => void;
  readonly hasPending: () => boolean;
}

/** Tooltip / toast reason while nothing awaits review. */
export const NO_PENDING_PROPOSAL: ToolUnavailability = {
  reasonKey: 'ribbon.availability.noPendingProposal',
};

/** Every auto-design triad of the six MEP tabs (ADR-444) — one gate each. */
export const MEP_PROPOSAL_GATES: readonly MepProposalGate[] = [
  {
    actions: ELECTRICAL_AUTO_RIBBON_ACTIONS,
    subscribe: electricalProposalStore.subscribe,
    hasPending: () => electricalProposalStore.get()?.origin === 'strong',
  },
  {
    actions: ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS,
    subscribe: electricalProposalStore.subscribe,
    hasPending: () => electricalProposalStore.get()?.origin === 'weak',
  },
  { actions: WATER_SUPPLY_RIBBON_ACTIONS, subscribe: waterProposalStore.subscribe, hasPending: () => waterProposalStore.get() !== null },
  { actions: DRAINAGE_AUTO_RIBBON_ACTIONS, subscribe: drainageProposalStore.subscribe, hasPending: () => drainageProposalStore.get() !== null },
  { actions: HEATING_AUTO_RIBBON_ACTIONS, subscribe: heatingProposalStore.subscribe, hasPending: () => heatingProposalStore.get() !== null },
  { actions: HVAC_AUTO_RIBBON_ACTIONS, subscribe: hvacProposalStore.subscribe, hasPending: () => hvacProposalStore.get() !== null },
  { actions: FIRE_AUTO_RIBBON_ACTIONS, subscribe: fireProposalStore.subscribe, hasPending: () => fireProposalStore.get() !== null },
  { actions: GAS_AUTO_RIBBON_ACTIONS, subscribe: gasProposalStore.subscribe, hasPending: () => gasProposalStore.get() !== null },
];

function publish(gate: MepProposalGate): void {
  const unavailability = gate.hasPending() ? null : NO_PENDING_PROPOSAL;
  setToolUnavailability(gate.actions.accept, unavailability);
  setToolUnavailability(gate.actions.reject, unavailability);
}

/**
 * Publish the current state of every gate and keep it in sync. Returns the teardown
 * (unsubscribes; the last published state stays — remounting re-publishes it anyway).
 */
export function installMepProposalAvailability(
  gates: readonly MepProposalGate[] = MEP_PROPOSAL_GATES,
): () => void {
  const unsubscribers = gates.map((gate) => {
    publish(gate);
    return gate.subscribe(() => publish(gate));
  });
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
