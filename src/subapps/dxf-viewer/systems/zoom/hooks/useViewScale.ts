'use client';

/**
 * ADR-418 — `useViewScale` micro-leaf hook.
 *
 * Resolves the current viewport into a real drawing scale 1:N (Revit/AutoCAD
 * style), folding in the active scene units and screen DPI. Replaces the legacy
 * pixel-ratio percentage shown in the zoom indicators.
 *
 * ADR-040 compliance: this hook subscribes to `useCurrentZoom()` (the
 * TransformStore scale facade) and `useCurrentSceneModel()`. It must therefore
 * only ever be consumed inside LEAF components (ZoomDisplayLeaf,
 * StatusBarViewScaleLeaf, the ribbon zoom widget) — never an orchestrator —
 * so that 60fps pan/zoom does not trigger parent re-renders.
 */

import { useMemo } from 'react';
import { useCurrentZoom } from '../ZoomStore';
import { useCurrentSceneModel } from '../../../ui/text-toolbar/hooks/useCurrentSceneModel';
import { resolveSceneUnits } from '../../../utils/scene-units';
import { scaleToRatio, formatViewScale } from '../../../utils/view-scale';

export interface ViewScaleInfo {
  /** Drawing-scale denominator N (1:N) for the current zoom. */
  readonly ratioN: number;
  /** Display string, e.g. "1:69" / "2:1" (locale-independent numeric symbol). */
  readonly label: string;
}

export function useViewScale(): ViewScaleInfo {
  const scaleCss = useCurrentZoom();
  const scene = useCurrentSceneModel();

  return useMemo(() => {
    const sceneUnits = resolveSceneUnits(scene);
    const ratioN = scaleToRatio({ scaleCss, sceneUnits });
    return { ratioN, label: formatViewScale(ratioN) };
  }, [scaleCss, scene]);
}
