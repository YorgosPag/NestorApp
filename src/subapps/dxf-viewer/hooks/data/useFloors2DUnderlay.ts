'use client';

/**
 * ADR-399 Phase D — 2D underlay aggregator («Όλοι οι όροφοι» σε 2Δ).
 *
 * Producer για το read-only 2Δ underlay (AutoCAD xref / Revit underlay): όσο
 * `active` (= `floor3DScope==='all'` ΚΑΙ `mode==='2d'`), επιστρέφει ένα converted
 * {@link DxfScene} ανά **μη-ενεργό** όροφο του τρέχοντος κτιρίου. Ο ενεργός όροφος
 * **εξαιρείται** — τον ζωγραφίζει ο κύριος interactive pipeline (`currentScene`).
 *
 * Cross-floor sourcing (visited/unvisited, visibility SSoT) ζει πλέον στο κοινό
 * {@link useBuildingFloorScenes} (Boy-Scout extract, N.0.2) — εδώ μένει μόνο το
 * convert. Δεύτερος consumer του ίδιου SSoT: το cross-floor «riser through»
 * overlay (ADR-408 Φ15 Task B), που χρειάζεται τα ωμά BIM entities (z/params)
 * **πριν** το convert.
 *
 * No-op εκτός `LevelsSystem` (read-only Properties pipeline, ADR-371).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md §Phase D
 */

import { useMemo } from 'react';
import { useBuildingFloorScenes } from './useBuildingFloorScenes';
import { convertSceneToDxf } from '../canvas/useDxfSceneConversion';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';

/** One non-active building floor, converted to a render-ready DxfScene. */
export interface UnderlayFloorScene {
  readonly levelId: string;
  readonly scene: DxfScene;
}

export function useFloors2DUnderlay(active: boolean): readonly UnderlayFloorScene[] {
  // Cross-floor SceneModel sourcing SSoT (shared with the riser-through overlay).
  const floors = useBuildingFloorScenes(active);

  // Convert each visible non-active floor's raw model to a render-ready DxfScene.
  return useMemo<readonly UnderlayFloorScene[]>(
    () => floors.map((f) => ({ levelId: f.levelId, scene: convertSceneToDxf(f.model) })),
    [floors],
  );
}
