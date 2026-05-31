'use client';

/**
 * useDxfViewerRibbon — ribbon command assembly extracted from DxfViewerContent.
 * ADR-065 SRP split: owns the ribbon contextual config + all the contextual
 * bridges (text editor, array, line/xline tools, BIM stair/wall/opening/slab/
 * column/beam) and folds them into the single `RibbonCommandsApi` consumed by
 * DxfViewerTopBar.
 *
 * Growth sink: new ribbon bridges land here, NOT in DxfViewerContent, so the
 * orchestrator stays under the 500-line Google SRP limit (N.7.1 / CHECK 4).
 *
 * ADR refs: ADR-345 (ribbon) / ADR-353 (contextual tabs) / ADR-358 Phase 7a /
 * ADR-363 (BIM bridges).
 *
 * Related files:
 * - DxfViewerContent.tsx (main orchestrator)
 * - DxfViewerTopBar.tsx (consumer — renders RibbonRoot with these commands)
 */

import { useLevels } from '../systems/levels';
import type { SceneModel } from '../types/scene';
import type { ToolType } from '../ui/toolbar/types';
import type { RibbonCommandsApi } from '../ui/ribbon/context/RibbonCommandContext';
import type { RibbonTab } from '../ui/ribbon/types/ribbon-types';
import type { UniversalSelectionHook } from '../systems/selection/SelectionSystem';
import type { DxfViewerCallbacksReturn } from './useDxfViewerCallbacks';
// 📐 ADR-345/353: contextual tabs config + trigger resolver (SSoT)
import { RIBBON_CONTEXTUAL_TABS, useActiveContextualTrigger } from './ribbon-contextual-config';
import { useRibbonArrayBridge } from '../ui/ribbon/hooks/useRibbonArrayBridge';
import { useArrayRibbonActions } from '../ui/ribbon/hooks/useArrayRibbonActions';
// 📐 ADR-358 Phase 7a / ADR-363: BIM contextual bridges aggregated
import { useDxfBimBridges } from './useDxfBimBridges';
import { useRibbonLineToolBridge } from '../ui/ribbon/hooks/useRibbonLineToolBridge';
import { useRibbonXlineModeBridge } from '../ui/ribbon/hooks/useRibbonXlineModeBridge';
// 📐 ADR-345 Fase 5.5: bridge text-engine ↔ ribbon contextual tab (toggles + comboboxes)
import { useRibbonTextEditorBridge } from '../ui/ribbon/hooks/useRibbonTextEditorBridge';
import { useRibbonCommands } from '../ui/ribbon/hooks/useRibbonCommands';

type LevelManager = ReturnType<typeof useLevels>;

/** Params for useDxfViewerRibbon. */
export interface DxfViewerRibbonParams {
  readonly levelManager: LevelManager;
  readonly universalSelection: UniversalSelectionHook;
  readonly activeTool: ToolType;
  readonly handleToolChange: (tool: ToolType) => void;
  readonly handleRibbonComingSoon: (label: string) => void;
  readonly wrappedHandleAction: DxfViewerCallbacksReturn['wrappedHandleAction'];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly primarySelectedId: string | null;
  readonly selectedEntityIds: string[];
  readonly currentScene: SceneModel | null;
}

/** Bundle returned by useDxfViewerRibbon. */
export interface DxfViewerRibbonReturn {
  readonly ribbonCommands: RibbonCommandsApi;
  readonly ribbonContextualTabs: readonly RibbonTab[];
  readonly activeContextualTrigger: string | null;
}

/**
 * Assembles the ribbon command API + contextual tab state for the DXF viewer.
 * All sub-bridges run here (same render scope as before the extraction), so
 * subscription topology is unchanged — zero high-frequency store subscriptions
 * added to the orchestrator (CHECK 6B/6C safe).
 */
export function useDxfViewerRibbon(params: DxfViewerRibbonParams): DxfViewerRibbonReturn {
  const {
    levelManager, universalSelection, activeTool,
    handleToolChange, handleRibbonComingSoon, wrappedHandleAction,
    canUndo, canRedo, primarySelectedId, selectedEntityIds, currentScene,
  } = params;

  // ADR-345 Fase 5B + ADR-353 Phase A — contextual tab list.
  const ribbonContextualTabs = RIBBON_CONTEXTUAL_TABS;
  const activeContextualTrigger = useActiveContextualTrigger({
    primarySelectedId, selectedEntityIds, currentScene, activeTool,
  });

  // ADR-345 Fase 5.5 — text editor bridge (toggle/combobox state + handlers).
  const textEditorBridge = useRibbonTextEditorBridge();

  // ADR-353 Phase A — Array contextual bridge + action interception.
  const arrayBridge = useRibbonArrayBridge({ levelManager, universalSelection });
  const arrayActionInterceptor = useArrayRibbonActions({
    levelManager, universalSelection,
    handleToolChange, fallback: wrappedHandleAction,
  });

  // ADR-358 Phase 7a / ADR-363 — BIM contextual bridges.
  const { stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, slabOpeningBridge } =
    useDxfBimBridges({ levelManager, universalSelection });
  const lineToolBridge = useRibbonLineToolBridge();
  const xlineModeBridge = useRibbonXlineModeBridge();

  const ribbonCommands = useRibbonCommands({
    activeTool, handleToolChange, handleRibbonComingSoon,
    wrappedHandleAction: arrayActionInterceptor,
    canUndo, canRedo,
    textEditorBridge, arrayBridge, stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge,
    slabOpeningBridge, lineToolBridge, xlineModeBridge,
  });

  return { ribbonCommands, ribbonContextualTabs, activeContextualTrigger };
}
