'use client';

/**
 * useStructuralAutoReinforce — ADR-459 Phase 4d (auto-apply reinforcement bridge).
 *
 * Thin, decoupled shell hook (mirror του `useStructuralAutoAttach`): ακούει το
 * ribbon request `bim:auto-reinforce-requested`, διαβάζει τον ενεργό κανονισμό και
 * εκτελεί τον SSoT πυρήνα `runOrganismAutoReinforce` (scope = επιλεγμένα μέλη· κενό
 * → όλος ο οργανισμός ορόφου). Ο πυρήνας emit-άρει `bim:structural-auto-reinforced`
 * → ο `useStructuralOrganism` ξανα-υπολογίζει τα warnings.
 *
 * Ο ΙΔΙΟΣ πυρήνας τροφοδοτεί και τον proactive trigger (Φ8) → μηδέν διπλότυπο.
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoAttach`).
 *
 * @see hooks/structural-auto-reinforce-core.ts — runOrganismAutoReinforce (SSoT)
 * @see hooks/useProactiveOrganismReinforce.ts — proactive trigger (Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4d
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { runOrganismAutoReinforce, type ReinforceLevelManager } from './structural-auto-reinforce-core';

export function useStructuralAutoReinforce(props: { levelManager: ReinforceLevelManager }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('bim:auto-reinforce-requested', ({ entityIds }) => {
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      runOrganismAutoReinforce(levelManager, entityIds, provider, execute);
    });
    return () => unsub();
  }, [levelManager, execute]);
}
