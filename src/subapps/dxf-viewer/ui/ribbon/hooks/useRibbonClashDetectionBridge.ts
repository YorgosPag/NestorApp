'use client';

/**
 * ADR-435 Slice 1 — Bridge between the «Έλεγχος Συγκρούσεων» ribbon actions and the
 * clash-detection engine (Slice 0) + the transient report store.
 *
 * Revit/Navisworks "Run → review" (read-only — NO accept/commit):
 *   - **detect**: read the active storey's entities + MepSystems → `detectClashes`
 *     → push the {@link ClashReport} into the low-frequency report store, which the
 *     canvas overlay leaf renders (markers + count). A fresh run supersedes the old.
 *   - **clear**: reset the store (no scene / Firestore change).
 *
 * No-ops for action keys it does not own, so it composes with the other ribbon
 * bridges in `useRibbonCommands`.
 *
 * @see ../../../systems/coordination/detect-clashes.ts (engine)
 * @see ../../../systems/coordination/clash-report-store.ts (transient store)
 * @see ./useRibbonWaterAutoSupplyBridge.ts (action-bridge template)
 * @see docs/centralized-systems/reference/adrs/ADR-435-clash-detection.md
 */

import { useCallback, useMemo } from 'react';

import { resolveSceneUnits } from '../../../utils/scene-units';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { detectClashes } from '../../../systems/coordination/detect-clashes';
import { clashReportStore } from '../../../systems/coordination/clash-report-store';
import { CLASH_DETECTION_RIBBON_ACTIONS } from './bridge/clash-detection-command-keys';
import type { useLevels } from '../../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseRibbonClashDetectionBridgeProps {
  readonly levelManager: LevelManagerLike;
}

export interface RibbonClashDetectionBridge {
  readonly onAction: (action: string) => void;
}

export function useRibbonClashDetectionBridge(
  props: UseRibbonClashDetectionBridgeProps,
): RibbonClashDetectionBridge {
  const { levelManager } = props;

  // Detect — scan the storey's entities + systems → report overlay.
  const handleDetect = useCallback((): void => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) return;
    const sceneUnits = resolveSceneUnits(scene);
    const systems = useMepSystemStore.getState().getSystems();
    const report = detectClashes({ entities: scene.entities, systems, sceneUnits });
    clashReportStore.set({ report, sceneUnits });
  }, [levelManager]);

  const handleClear = useCallback((): void => {
    clashReportStore.reset();
  }, []);

  const onAction = useCallback(
    (action: string): void => {
      if (action === CLASH_DETECTION_RIBBON_ACTIONS.detect) return handleDetect();
      if (action === CLASH_DETECTION_RIBBON_ACTIONS.clear) return handleClear();
    },
    [handleDetect, handleClear],
  );

  return useMemo(() => ({ onAction }), [onAction]);
}
