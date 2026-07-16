/**
 * USE ARRAY POLAR TOOL — ADR-353 Phase B (Session B2)
 *
 * Activation hook for the polar Array command (ARRAYPOLAR pattern).
 *
 * Flow (pre-select sources → activate → pick center → create):
 *   1. User pre-selects N source entities → activates 'array-polar'.
 *   2. On activation the selection is validated. Empty / nested-array
 *      selection → hint + revert to 'select'.
 *   3. Otherwise the tool enters "awaiting center pick" and surfaces the
 *      `arrayTool.pickCenter` status-bar prompt. The next snap-aware
 *      canvas click lands the polar centre.
 *   4. Click → CreateArrayCommand('polar', { count:6, fillAngle:360,
 *      startAngle:0, rotateItems:true, center, radius:0 }), replace
 *      selection with the new ArrayEntity (auto-opens the polar
 *      contextual tab via DxfViewerContent's trigger lookup), revert
 *      tool to 'select'.
 *   5. ESC → exit without creating.
 *
 * Live parameter editing (count/angles/radius/rotate/grip drag) is owned
 * by `useRibbonArrayBridge` + `array-grip-handlers.ts`. This hook only
 * owns activation + initial creation (single-shot).
 *
 * Arming, hint plumbing and the command tail are shared with the rect/path
 * array tools — see `array-tool-core.ts`.
 */

'use client';

import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { useSceneManagerAdapter } from '../../systems/entity-creation/useSceneManagerAdapter';
import { validateArrayParams } from '../../systems/array/array-validation';
import type { PolarParams } from '../../systems/array/types';
import {
  ARRAY_HINT_NEEDS_SELECTION,
  commitArrayCommand,
  resolvePendingArraySources,
  showArrayHint,
  useArraySourcePick,
  type ArrayToolProps,
} from './array-tool-core';

export type UseArrayPolarToolProps = ArrayToolProps;

export interface UseArrayPolarToolReturn {
  /** True while 'array-polar' is the active tool. */
  readonly isActive: boolean;
  /** Forward a snapped world click to the polar tool. */
  readonly handleArrayPolarClick: (worldPoint: Point2D) => void;
  /** ESC handler — abort without creating. */
  readonly handleArrayPolarEscape: () => void;
}

const DEFAULT_COUNT = 6;
const DEFAULT_FILL_ANGLE = 360;
const DEFAULT_START_ANGLE = 0;
const DEFAULT_ROTATE_ITEMS = true;

export function useArrayPolarTool(props: UseArrayPolarToolProps): UseArrayPolarToolReturn {
  const { activeTool, levelManager, executeCommand, setSelectedEntityIds } = props;

  const isActive = activeTool === 'array-polar';
  const getSceneManager = useSceneManagerAdapter(levelManager);
  const pick = useArraySourcePick(props, isActive, 'arrayTool.pickCenter');

  const handleArrayPolarClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive || !pick.isAwaiting()) return;

      const ctx = resolvePendingArraySources(levelManager, pick);
      if (!ctx) return;

      const params: PolarParams = {
        kind: 'polar',
        count: DEFAULT_COUNT,
        fillAngle: DEFAULT_FILL_ANGLE,
        startAngle: DEFAULT_START_ANGLE,
        rotateItems: DEFAULT_ROTATE_ITEMS,
        center: { x: worldPoint.x, y: worldPoint.y },
        radius: 0,
      };

      const validation = validateArrayParams(params, ctx.sourceTypes);
      if (validation.severity === 'error') {
        showArrayHint(ARRAY_HINT_NEEDS_SELECTION);
        pick.exitToSelect();
        return;
      }

      const committed = commitArrayCommand(
        getSceneManager,
        ctx.sourceIds,
        'polar',
        params,
        executeCommand,
        setSelectedEntityIds,
      );
      if (!committed) return;

      pick.exitToSelect();
    },
    [isActive, pick, levelManager, executeCommand, setSelectedEntityIds, getSceneManager],
  );

  const handleArrayPolarEscape = useCallback((): void => {
    if (!isActive) return;
    pick.exitToSelect();
  }, [isActive, pick]);

  return { isActive, handleArrayPolarClick, handleArrayPolarEscape };
}
