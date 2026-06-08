'use client';

/**
 * ADR-422 L1 — Reactive per-space heat-load results για το analytical overlay.
 *
 * Thin wrapper: `useHeatLoadInputs` (συλλογή active-floor δεδομένων) +
 * `deriveSpaceHeatLoads` (καθαρή αριθμητική). Memoized στα inputs — recompute
 * ΜΟΝΟ όταν αλλάζει το scene/κτίριο/όροφος, ΟΧΙ σε pan/zoom (το transform δεν
 * περνά από εδώ). Επιστρέφει τα φορτία + εύρος + τους χώρους (για centroid/draw).
 *
 * @see ./useHeatLoadInputs · ../../bim/thermal/heat-load/derive-space-heat-loads
 * @see ../../components/dxf-layout/HeatLoadOverlay (consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import { useMemo } from 'react';
import { useHeatLoadInputs } from './useHeatLoadInputs';
import {
  deriveSpaceHeatLoads,
  type SpaceHeatLoadDeriveResult,
} from '../../bim/thermal/heat-load/derive-space-heat-loads';
import type { ClimateZone } from '../../bim/thermal/kenak-thermal-config';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import type { SceneModel } from '../../types/scene';

export interface SpaceHeatLoads extends SpaceHeatLoadDeriveResult {
  /** Οι χώροι του ορόφου (για centroid/footprint κατά το draw). */
  readonly spaces: readonly ThermalSpaceEntity[];
  /** Κλιματική ζώνη ορόφου (για ΚΕΝΑΚ έλεγχο κελύφους L6). */
  readonly climateZone: ClimateZone;
}

export function useSpaceHeatLoads(
  scene: SceneModel | null | undefined,
  active: boolean,
): SpaceHeatLoads | null {
  const inputs = useHeatLoadInputs(scene, active);
  return useMemo<SpaceHeatLoads | null>(() => {
    if (!inputs) return null;
    return {
      ...deriveSpaceHeatLoads(inputs.spaces, inputs),
      spaces: inputs.spaces,
      climateZone: inputs.climateZone,
    };
  }, [inputs]);
}
