'use client';

/**
 * ADR-422 L4 — Reactive hydraulic-balancing read-model (TRANSIENT, derived).
 *
 * Thin wrapper που ΚΑΤΑΝΑΛΩΝΕΙ τον L3 (`usePipeSizing` → DN/R/v ανά σωλήνα) + τον L2
 * (`useRadiatorSizing` → παροχή ανά σώμα μέσω `buildTerminalContributions`) και τρέχει
 * τον L4 engine (`balanceNetwork`) → ΔP κυκλώματος + index circuit + απαιτ. kv
 * balancing valve ανά σώμα + μανομετρικό κυκλοφορητή. ΚΑΝΕΝΑ persist — όλα derived,
 * re-computable στο load (mirror του L1/L2/L3 read-model).
 *
 * @see ./usePipeSizing (L3 — sizing) · ./useRadiatorSizing (L2 — παροχή)
 * @see ../../bim/thermal/balancing/circuit-balancing
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L4)
 */

import { useMemo } from 'react';
import { useRadiatorSizing } from './useRadiatorSizing';
import { usePipeSizing } from './usePipeSizing';
import { buildTerminalContributions } from '../../bim/thermal/sizing/terminal-contributions';
import {
  balanceNetwork,
  type HydraulicBalancingResult,
} from '../../bim/thermal/balancing/circuit-balancing';
import type { SceneModel } from '../../types/scene';

const EMPTY_BALANCING: HydraulicBalancingResult = {
  terminals: new Map(),
  indexTerminalId: null,
  pumpHeadPa: 0,
  segmentDropPa: new Map(),
};

export function useHydraulicBalancing(
  scene: SceneModel | null | undefined,
  active: boolean,
): HydraulicBalancingResult {
  const radiatorSizing = useRadiatorSizing(scene, active);
  const sizing = usePipeSizing(scene, active);

  return useMemo<HydraulicBalancingResult>(() => {
    if (!active || !scene || sizing.size === 0) return EMPTY_BALANCING;

    const terminals = buildTerminalContributions(radiatorSizing);
    if (terminals.size === 0) return EMPTY_BALANCING;

    return balanceNetwork({ entities: scene.entities, sizing, terminals });
  }, [active, scene, sizing, radiatorSizing]);
}
