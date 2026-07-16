/**
 * USE ARRAY TOOL — ADR-353 Phase A (Session A4)
 *
 * Activation hook for the rectangular Array command. Pattern: ARRAYRECT
 * in AutoCAD — pre-select source entities → trigger command → an
 * associative ArrayEntity is created with industry defaults (3×4,
 * spacing = bbox × 1.5, angle 0°) → ribbon contextual tab opens for
 * live parameter adjustment.
 *
 * Flow (Q4 — both selection orders supported):
 *   1. User pre-selects N source entities → activates 'array-rect'.
 *   2. On activation the selection is validated. If empty, a tool hint asks
 *      for sources and the tool reverts to 'select' immediately.
 *   3. Otherwise CreateArrayCommand is issued, the tool switches back to
 *      'select', and the selection is replaced with the new ArrayEntity id
 *      so the ribbon contextual tab auto-opens (DxfViewerContent watches
 *      `primarySelectedId` to flip `activeContextualTrigger`).
 *
 * Unlike the polar/path siblings this tool is SINGLE-SHOT: it creates on the
 * activation edge and never waits for a pick. Shared guards + command tail
 * live in `array-tool-core.ts`.
 *
 * Live parameter editing (rows/cols/spacing/angle/grip drag) is owned
 * by `useRibbonArrayBridge` + `array-grip-handlers.ts`. This hook only
 * owns activation + initial creation.
 */

'use client';

import { useSceneManagerAdapter } from '../../systems/entity-creation/useSceneManagerAdapter';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';
import { computeSourceGroupBbox, defaultRectSpacing } from '../../systems/array/array-bbox';
import { validateArrayParams } from '../../systems/array/array-validation';
import type { RectParams } from '../../systems/array/types';
import {
  ARRAY_HINT_NEEDS_SELECTION,
  clearArrayHint,
  collectArraySources,
  commitArrayCommand,
  resolveArrayScene,
  showArrayHint,
  type ArrayToolProps,
} from './array-tool-core';

export type UseArrayToolProps = ArrayToolProps;

export interface UseArrayToolReturn {
  /** True while 'array-rect' is the active tool. */
  readonly isActive: boolean;
}

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 4;

export function useArrayTool(props: UseArrayToolProps): UseArrayToolReturn {
  const { activeTool, selectedEntityIds, levelManager, executeCommand, setSelectedEntityIds, onToolChange } = props;

  const isActive = activeTool === 'array-rect';
  const getSceneManager = useSceneManagerAdapter(levelManager);

  function tryCreateFromSelection(): void {
    const scene = resolveArrayScene(levelManager);
    if (!scene) return;

    // Phase A handoff to 'select' — even on early exit we never linger on
    // 'array-rect' (it is a single-shot activation, not a stateful tool).
    const exitToSelect = () => onToolChange?.('select');

    const result = collectArraySources(scene, selectedEntityIds);
    if (!result.ok) {
      showArrayHint(result.hintKey);
      exitToSelect();
      return;
    }

    const bbox = computeSourceGroupBbox(result.sources);
    const { rowSpacing, colSpacing } = defaultRectSpacing(bbox);
    const params: RectParams = {
      kind: 'rect',
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      rowSpacing,
      colSpacing,
      angle: 0,
    };

    // Surface the generic "needs selection" hint — validation errors at
    // creation time mean the user picked unsupported entities. The full
    // i18n hint catalog for each validation.messageKey lives under
    // `dxf-viewer-shell:array.validation.*` (used by future toast wiring).
    const validation = validateArrayParams(params, result.sourceTypes);
    if (validation.severity === 'error') {
      showArrayHint(ARRAY_HINT_NEEDS_SELECTION);
      exitToSelect();
      return;
    }

    const committed = commitArrayCommand(
      getSceneManager,
      selectedEntityIds.slice(),
      'rect',
      params,
      executeCommand,
      setSelectedEntityIds,
    );
    if (committed) clearArrayHint();
    exitToSelect();
  }

  // Activation / deactivation lifecycle (ADR-589 edge-triggered SSoT)
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      // Activation edge — try to create the array from the current selection.
      tryCreateFromSelection();
    },
    () => {
      clearArrayHint();
    },
  );

  return { isActive };
}
