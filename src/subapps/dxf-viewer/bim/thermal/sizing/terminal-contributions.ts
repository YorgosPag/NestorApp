/**
 * ADR-422 L3/L4 — Terminal flow contributions — PURE SSoT (shared).
 *
 * Μετατρέπει τον L2 read-model (`RadiatorSizingMap` — μερίδιο φορτίου + regime ανά
 * σώμα) σε `Map<radiatorId, TerminalFlowContribution>` (μαζική παροχή kg/s + φορτίο
 * W), που ΚΑΤΑΝΑΛΩΝΟΥΝ **και** το L3 sizing (`usePipeSizing`) **και** το L4 balancing
 * (`useHydraulicBalancing`). Μία υλοποίηση — κανένα fork (SSoT, N.0.2).
 *
 * Η μαζική παροχή κάθε σώματος προκύπτει από το ΔΤ του δικού του regime
 * (supplyC − returnC) μέσω `computePipeMassFlow`. Pure/idempotent.
 *
 * @see ./pipe-sizing (computePipeMassFlow) · ./pipe-network-sizing (TerminalFlowContribution)
 * @see ../../../hooks/data/useRadiatorSizing (RadiatorSizingMap — η είσοδος)
 */

import { computePipeMassFlow } from './pipe-sizing';
import type { TerminalFlowContribution } from './pipe-network-sizing';
import type { RadiatorSizingMap } from '../../../hooks/data/useRadiatorSizing';

/**
 * radiatorId → μαζική παροχή + φορτίο. Σώματα με μη-θετικό ΔΤ ή φορτίο δίνουν
 * 0 kg/s (ο consumer το ερμηνεύει ως ελάχιστο DN / μηδενική συνεισφορά κυκλώματος).
 */
export function buildTerminalContributions(
  radiatorSizing: RadiatorSizingMap,
): Map<string, TerminalFlowContribution> {
  const terminals = new Map<string, TerminalFlowContribution>();
  for (const result of radiatorSizing.values()) {
    const deltaTK = result.regime.supplyC - result.regime.returnC;
    const massFlowKgS = computePipeMassFlow({ loadW: result.shareW, deltaTK });
    terminals.set(result.radiatorId, { massFlowKgS, loadW: result.shareW });
  }
  return terminals;
}
