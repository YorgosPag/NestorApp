'use client';

/**
 * ADR-422 L5 — Reactive thermal-study report read-model (TRANSIENT, derived).
 *
 * Thin wrapper που ΚΑΤΑΝΑΛΩΝΕΙ τα 4 read-models θέρμανσης (L1 `useSpaceHeatLoads` · L2
 * `useRadiatorSizing` · L3 `usePipeSizing` · L4 `useHydraulicBalancing`) και τρέχει τον pure
 * builder (`buildThermalStudyReport`) → εκτυπώσιμο report (σύνοψη + 4 πίνακες). ΚΑΝΕΝΑ persist
 * — όλα derived, re-computable (mirror του `useHydraulicBalancing` που συνθέτει L2+L3).
 *
 * Ο caller (widget) παρέχει `lookups` (i18n SSoT μένει στο React layer) + ελέγχει το `active`
 * (arm-on-demand) ώστε τα read-models να μην τρέχουν σε idle.
 *
 * @see ../../bim/thermal/report/thermal-study-report (pure builder)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L5)
 */

import { useMemo } from 'react';
import { useSpaceHeatLoads } from './useSpaceHeatLoads';
import { useRadiatorSizing } from './useRadiatorSizing';
import { usePipeSizing } from './usePipeSizing';
import { useHydraulicBalancing } from './useHydraulicBalancing';
import {
  buildThermalStudyReport,
  type ThermalStudyLookups,
} from '../../bim/thermal/report/thermal-study-report';
import type { ThermalStudyReport } from '../../bim/thermal/report/thermal-study-report-types';
import type { SceneModel } from '../../types/scene';

export function useThermalStudyReport(
  scene: SceneModel | null | undefined,
  active: boolean,
  lookups: ThermalStudyLookups,
): ThermalStudyReport {
  const spaceLoads = useSpaceHeatLoads(scene, active);
  const radiatorSizing = useRadiatorSizing(scene, active);
  const pipeSizing = usePipeSizing(scene, active);
  const balancing = useHydraulicBalancing(scene, active);

  return useMemo<ThermalStudyReport>(
    () =>
      buildThermalStudyReport({
        spaceLoads,
        radiatorSizing,
        pipeSizing,
        balancing,
        climateZone: spaceLoads?.climateZone ?? null,
        lookups,
      }),
    [spaceLoads, radiatorSizing, pipeSizing, balancing, lookups],
  );
}
