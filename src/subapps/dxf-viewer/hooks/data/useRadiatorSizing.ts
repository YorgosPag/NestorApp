'use client';

/**
 * ADR-422 L2 — Reactive per-radiator sizing read-model (TRANSIENT, derived).
 *
 * Thin wrapper που ΚΑΤΑΝΑΛΩΝΕΙ τον L1 (`useSpaceHeatLoads` → Φ_room ανά χώρο), τον
 * αντιστοιχίζει στα θερμαντικά σώματα του ορόφου (`assignRadiatorsToSpaces`) και
 * τρέχει τον EN 442 engine (`computeRequiredRadiatorOutput`) → απαιτούμενη
 * ονομαστική ισχύς ανά σώμα. ΚΑΝΕΝΑ persist — όλα derived, re-computable στο load
 * (mirror του L1 overlay read-model). Memoized στα φορτία + scene.
 *
 * @see ./useSpaceHeatLoads (L1 — Φ_room)
 * @see ../../bim/thermal/sizing/space-radiator-assignment · ../../bim/thermal/sizing/radiator-sizing
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L2)
 */

import { useMemo } from 'react';
import { useSpaceHeatLoads } from './useSpaceHeatLoads';
import { isMepRadiatorEntity } from '../../types/entities';
import { resolveThermalSpaceSetpointC } from '../../bim/thermal/thermal-space-use-catalog';
import {
  assignRadiatorsToSpaces,
} from '../../bim/thermal/sizing/space-radiator-assignment';
import { computeRequiredRadiatorOutput } from '../../bim/thermal/sizing/radiator-sizing';
import {
  DEFAULT_RADIATOR_EXPONENT,
  resolveSystemRegime,
  type SystemRegimePreset,
} from '../../bim/thermal/sizing/radiator-sizing-config';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import type { SceneModel } from '../../types/scene';

/** Πλήρες αποτέλεσμα διαστασιολόγησης ενός σώματος (για readout). */
export interface RadiatorSizingViewResult {
  readonly radiatorId: string;
  readonly spaceId: string;
  /** W — συνολικό φορτίο του χώρου (Φ_room). */
  readonly roomLoadW: number;
  /** W — μερίδιο φορτίου του σώματος (Φ_room / πλήθος σωμάτων). */
  readonly shareW: number;
  /** Πλήθος σωμάτων στον χώρο. */
  readonly siblingCount: number;
  /** Καθεστώς θερμοκρασιών δικτύου που εφαρμόστηκε. */
  readonly regime: SystemRegimePreset;
  /** K — θερμοκρασιακή υπεροχή (AMTD). */
  readonly deltaTActualK: number;
  /** Παράγοντας διόρθωσης EN 442. */
  readonly correctionFactor: number;
  /** W — απαιτούμενη ονομαστική ισχύς @ΔΤ50K. */
  readonly requiredNominalW: number;
  /** W — ισχύς καταλόγου (αν έχει οριστεί) ή null. */
  readonly catalogueW: number | null;
  /** Επάρκεια: κατάλογος ≥ απαιτούμενη· null αν κατάλογος unset. */
  readonly adequate: boolean | null;
}

/** radiatorId → αποτέλεσμα διαστασιολόγησης (μόνο σώματα μέσα σε θερμικό χώρο). */
export type RadiatorSizingMap = ReadonlyMap<string, RadiatorSizingViewResult>;

function gatherRadiators(scene: SceneModel | null | undefined): MepRadiatorEntity[] {
  if (!scene) return [];
  return scene.entities.filter(isMepRadiatorEntity);
}

export function useRadiatorSizing(
  scene: SceneModel | null | undefined,
  active: boolean,
): RadiatorSizingMap {
  const heatLoads = useSpaceHeatLoads(scene, active);

  return useMemo<RadiatorSizingMap>(() => {
    const out = new Map<string, RadiatorSizingViewResult>();
    if (!active || !heatLoads) return out;

    const radiators = gatherRadiators(scene);
    const { byRadiator } = assignRadiatorsToSpaces(radiators, heatLoads.spaces);

    for (const radiator of radiators) {
      const link = byRadiator.get(radiator.id);
      if (!link) continue;
      const space = heatLoads.spaces.find((s) => s.id === link.spaceId);
      const load = heatLoads.results.get(link.spaceId);
      if (!space || !load) continue;

      const shareW = link.siblingCount > 0 ? load.totalW / link.siblingCount : load.totalW;
      const regime = resolveSystemRegime(radiator.params.systemRegimePreset);
      const sizing = computeRequiredRadiatorOutput({
        roomLoadW: shareW,
        supplyC: regime.supplyC,
        returnC: regime.returnC,
        indoorC: resolveThermalSpaceSetpointC(space.params),
        exponent: DEFAULT_RADIATOR_EXPONENT,
      });

      const catalogueW =
        typeof radiator.params.thermalOutputW === 'number'
          ? radiator.params.thermalOutputW
          : null;

      out.set(radiator.id, {
        radiatorId: radiator.id,
        spaceId: link.spaceId,
        roomLoadW: load.totalW,
        shareW,
        siblingCount: link.siblingCount,
        regime,
        deltaTActualK: sizing.deltaTActualK,
        correctionFactor: sizing.correctionFactor,
        requiredNominalW: sizing.requiredNominalW,
        catalogueW,
        adequate: catalogueW === null ? null : catalogueW >= sizing.requiredNominalW,
      });
    }
    return out;
  }, [active, heatLoads, scene]);
}
