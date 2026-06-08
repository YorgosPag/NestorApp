'use client';

/**
 * ADR-422 L3 — Reactive pipe-sizing read-model (TRANSIENT, derived).
 *
 * Thin wrapper που ΚΑΤΑΝΑΛΩΝΕΙ τον L2 (`useRadiatorSizing` → shareW + regime ανά
 * σώμα), μετατρέπει το μερίδιο φορτίου κάθε τερματικού σε **μαζική παροχή** (kg/s)
 * μέσω της θερμοκρασιακής πτώσης του regime του (ΔΤ = supplyC − returnC), και τρέχει
 * τον network-walk engine (`sizePipeNetwork`) → προτεινόμενη DN ανά σωλήνα. ΚΑΝΕΝΑ
 * persist — όλα derived, re-computable στο load (mirror του L1/L2 read-model).
 *
 * @see ./useRadiatorSizing (L2 — shareW + regime)
 * @see ../../bim/thermal/sizing/pipe-network-sizing · ../../bim/thermal/sizing/pipe-sizing
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L3)
 */

import { useMemo } from 'react';
import { useRadiatorSizing } from './useRadiatorSizing';
import {
  sizePipeNetwork,
  type PipeSizingMap,
} from '../../bim/thermal/sizing/pipe-network-sizing';
import { buildTerminalContributions } from '../../bim/thermal/sizing/terminal-contributions';
import { VELOCITY_FRICTION_STANDARD } from '../../bim/thermal/sizing/velocity-friction-standard';
import type { SceneModel } from '../../types/scene';

const EMPTY_SIZING: PipeSizingMap = new Map();

export function usePipeSizing(
  scene: SceneModel | null | undefined,
  active: boolean,
): PipeSizingMap {
  const radiatorSizing = useRadiatorSizing(scene, active);

  return useMemo<PipeSizingMap>(() => {
    if (!active || !scene) return EMPTY_SIZING;

    // shareW + regime ανά σώμα → μαζική παροχή (kg/s) με το ΔΤ του regime του.
    const terminals = buildTerminalContributions(radiatorSizing);
    if (terminals.size === 0) return EMPTY_SIZING;

    return sizePipeNetwork({
      entities: scene.entities,
      terminals,
      standard: VELOCITY_FRICTION_STANDARD,
    });
  }, [active, scene, radiatorSizing]);
}
