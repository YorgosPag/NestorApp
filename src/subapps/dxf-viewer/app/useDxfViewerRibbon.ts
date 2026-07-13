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

import { useCallback } from 'react';
import { useLevels } from '../systems/levels';
import type { ToolType } from '../ui/toolbar/types';
import type { RibbonCommandsApi } from '../ui/ribbon/context/RibbonCommandContext';
import type { RibbonTab } from '../ui/ribbon/types/ribbon-types';
import type { UniversalSelectionHook } from '../systems/selection/SelectionSystem';
import type { DxfViewerCallbacksReturn } from './useDxfViewerCallbacks';
// 📐 ADR-345/353: contextual tabs config (SSoT). The active trigger is computed
// in `RibbonContextualTabScope` (ADR-532 Stage 2), NOT here, so the ribbon
// command assembly stays decoupled from the selection reference.
import { RIBBON_CONTEXTUAL_TABS } from './ribbon-contextual-config';
import { useRibbonArrayBridge } from '../ui/ribbon/hooks/useRibbonArrayBridge';
import { useArrayRibbonActions } from '../ui/ribbon/hooks/useArrayRibbonActions';
// ADR-510 Φ5 — generic EXPLODE action interceptor (polyline/rectangle → primitives).
import { useExplodeRibbonAction } from '../ui/ribbon/hooks/useExplodeRibbonAction';
// ADR-186 — generic JOIN «Ένωση» action interceptor (inverse of EXPLODE).
import { useJoinRibbonAction } from '../ui/ribbon/hooks/useJoinRibbonAction';
// ADR-575 — GROUP «Ομαδοποίηση» / UNGROUP «Κατάργηση» action interceptor.
import { useGroupRibbonAction } from '../ui/ribbon/hooks/useGroupRibbonAction';
// ADR-641 — «Επεξεργασία Μπλοκ» (BEDIT) action interceptor for the contextual block tab.
import { useBlockEditRibbonAction } from '../ui/ribbon/hooks/useBlockEditRibbonAction';
// 📐 ADR-358 Phase 7a / ADR-363: BIM contextual bridges aggregated
import { useDxfBimBridges } from './useDxfBimBridges';
import { useRibbonLineToolBridge } from '../ui/ribbon/hooks/useRibbonLineToolBridge';
import { useRibbonDimBridge } from '../ui/ribbon/hooks/useRibbonDimBridge';
import { useRibbonXlineModeBridge } from '../ui/ribbon/hooks/useRibbonXlineModeBridge';
import { useRibbonScaleToolBridge } from '../ui/ribbon/hooks/useRibbonScaleToolBridge';
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
}

/** Bundle returned by useDxfViewerRibbon. */
export interface DxfViewerRibbonReturn {
  readonly ribbonCommands: RibbonCommandsApi;
  readonly ribbonContextualTabs: readonly RibbonTab[];
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
    canUndo, canRedo,
  } = params;

  // ADR-345 Fase 5B + ADR-353 Phase A — contextual tab list (the active trigger
  // is owned by `RibbonContextualTabScope`, ADR-532 Stage 2).
  const ribbonContextualTabs = RIBBON_CONTEXTUAL_TABS;

  // ADR-345 Fase 5.5 — text editor bridge (toggle/combobox state + handlers).
  const textEditorBridge = useRibbonTextEditorBridge();

  // ADR-353 Phase A — Array contextual bridge + action interception.
  const arrayBridge = useRibbonArrayBridge({ levelManager, universalSelection });
  const arrayActionInterceptor = useArrayRibbonActions({
    levelManager, universalSelection,
    handleToolChange, fallback: wrappedHandleAction,
  });
  // ADR-510 Φ5 — EXPLODE wraps the array interceptor (chain: explode → array →
  // base). Generic Modify command: breaks the selection into primitives, undoable.
  const explodeActionInterceptor = useExplodeRibbonAction({
    levelManager, universalSelection,
    handleToolChange, fallback: arrayActionInterceptor,
  });
  // ADR-186 — JOIN «Ένωση» wraps EXPLODE (chain: join → explode → array → base).
  // The inverse Modify command: merges the selection into one entity, undoable.
  const joinActionInterceptor = useJoinRibbonAction({
    levelManager, universalSelection,
    handleToolChange, fallback: explodeActionInterceptor,
  });
  // ADR-575 — GROUP «Ομαδοποίηση»/UNGROUP wraps JOIN (chain: group → join → explode
  // → array → base). Wraps selected entities into ONE container / breaks it back.
  const groupActionInterceptor = useGroupRibbonAction({
    levelManager, universalSelection,
    handleToolChange, fallback: joinActionInterceptor,
  });
  // ADR-641 — «Επεξεργασία Μπλοκ» (BEDIT) wraps GROUP (chain: block-edit → group →
  // join → explode → array → base). Enters the exclusive Block Editor for the
  // selected block via the SAME SSoT the double-click uses.
  const blockEditActionInterceptor = useBlockEditRibbonAction({
    levelManager, universalSelection,
    fallback: groupActionInterceptor,
  });

  // ADR-358 Phase 7a / ADR-363 — BIM contextual bridges. ADR-408 Φ5 — MEP circuit.
  const { stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge, mepCircuitBridge, mepPipeNetworkBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, waterAutoSupplyBridge, drainageAutoBridge, heatingAutoBridge, electricalAutoBridge, electricalWeakAutoBridge, hvacAutoBridge, fireAutoBridge, gasAutoBridge, clashDetectionBridge, furnitureBridge, blockLibraryBridge, floorplanSymbolBridge, annotationSymbolBridge, scaleBarBridge, mepFixtureLibraryBridge, mepRiserBridge, floorFinishBridge, wallCoveringBridge, hatchBridge, thermalSpaceBridge } =
    useDxfBimBridges({ levelManager, universalSelection });
  // ADR-510 Φ2E — dual-mode: επεξεργάζεται την επιλεγμένη γεωμετρική οντότητα
  // (undoable) ή, χωρίς επιλογή, τα draw-defaults (QuickStyleStore).
  const lineToolBridge = useRibbonLineToolBridge({ levelManager, universalSelection });
  // ADR-562 Φ3 — per-part dimension style overrides on the selected dimension.
  const dimBridge = useRibbonDimBridge({ levelManager, universalSelection });
  const xlineModeBridge = useRibbonXlineModeBridge();
  // ADR-646 Φ4 #6 — Scale tool contextual tab ↔ ScaleToolStore (self-contained).
  const scaleToolBridge = useRibbonScaleToolBridge();

  // ADR-363 — THE single «Κλείσιμο» primitive for EVERY contextual tab (generic
  // BIM entities + mep + array). Deselect via the existing SSoT `clearAll()`
  // (already used in 12+ sites) + drop any active tool back to `select` (absorbs
  // the array close-tab behavior). `routeRibbonAction` invokes this for any
  // `*.action(s).close` key, so per-bridge close handlers no longer exist.
  const closeContextualTab = useCallback((): void => {
    universalSelection.clearAll();
    handleToolChange('select' as ToolType);
  }, [universalSelection, handleToolChange]);

  const ribbonCommands = useRibbonCommands({
    activeTool, handleToolChange, handleRibbonComingSoon,
    wrappedHandleAction: blockEditActionInterceptor,
    closeContextualTab,
    canUndo, canRedo,
    textEditorBridge, arrayBridge, stairBridge, wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, wallCoveringBridge, hatchBridge, thermalSpaceBridge, columnBridge, beamBridge, foundationBridge,
    slabOpeningBridge, mepCircuitBridge, mepPipeNetworkBridge, mepFixtureBridge, mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, waterAutoSupplyBridge, drainageAutoBridge, heatingAutoBridge, electricalAutoBridge, electricalWeakAutoBridge, hvacAutoBridge, fireAutoBridge, gasAutoBridge, clashDetectionBridge, furnitureBridge, blockLibraryBridge, floorplanSymbolBridge, annotationSymbolBridge, scaleBarBridge, mepFixtureLibraryBridge, mepRiserBridge, lineToolBridge, dimBridge, xlineModeBridge, scaleToolBridge,
  });

  return { ribbonCommands, ribbonContextualTabs };
}
