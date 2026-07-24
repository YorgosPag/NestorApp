import React from 'react';
import { useEventCallback } from '@/hooks/useEventCallback';
import { useAnimationStore } from '../../../bim-3d/animation/AnimationStore';
import { SNAP_STEP_COMBOBOX_OPTIONS } from './useRibbonCommands-snap-options';
import type {
  RibbonCommandsApi,
  RibbonActionPayload,
  RibbonComboboxState,
} from '../context/RibbonCommandContext';
import type { UseRibbonCommandsProps } from './useRibbonCommands-types';
import { setRibbonFieldReaders } from '../context/RibbonFieldStore';
// ADR-587 Φ4 — the ~210 dispatch branches now live as ordered data-driven route tables.
import {
  buildComboboxRoutes,
  buildBadgeRoutes,
  buildVisibilityRoutes,
  dispatchComboboxWrite,
  dispatchComboboxRead,
  dispatchSimple,
} from './useRibbonCommands-dispatch';
import { routeRibbonAction } from './useRibbonCommands-action';
import { useRibbonToggleCommands } from './useRibbonToggleCommands';
import { useActiveStoreyContext } from '../../../systems/levels/useActiveStoreySync';
import { isCommandRecommendedForStorey } from './bridge/storey-tool-gating';
// ADR-521 — «Τύποι» column-type dropdown: action → setKind + activate column tool.
import { isColumnDrawKindAction, parseColumnDrawKind } from './bridge/column-command-keys';
import { columnToolBridgeStore } from './bridge/column-tool-bridge-store';
import type { ToolType } from '../../toolbar/types';

export type { UseRibbonCommandsProps };

export function useRibbonCommands({
  activeTool,
  handleToolChange,
  handleRibbonComingSoon,
  wrappedHandleAction,
  closeContextualTab,
  canUndo,
  canRedo,
  textEditorBridge,
  arrayBridge,
  stairBridge,
  railingBridge,
  wallBridge,
  openingBridge,
  slabBridge,
  roofBridge,
  floorFinishBridge,
  wallCoveringBridge,
  hatchBridge,
  thermalSpaceBridge,
  columnBridge,
  beamBridge,
  foundationBridge,
  slabOpeningBridge,
  mepCircuitBridge,
  mepPipeNetworkBridge,
  waterAutoSupplyBridge,
  drainageAutoBridge,
  heatingAutoBridge,
  electricalAutoBridge,
  electricalWeakAutoBridge,
  hvacAutoBridge,
  fireAutoBridge,
  gasAutoBridge,
  clashDetectionBridge,
  mepFixtureBridge,
  mepManifoldBridge,
  electricalPanelBridge,
  mepRadiatorBridge,
  mepBoilerBridge,
  mepWaterHeaterBridge,
  mepUnderfloorBridge,
  mepSegmentBridge,
  furnitureBridge,
  genericSolidBridge,
  blockLibraryBridge,
  titleBlockBridge,
  floorplanSymbolBridge,
  annotationSymbolBridge,
  scaleBarBridge,
  mepFixtureLibraryBridge,
  mepRiserBridge,
  lineToolBridge,
  dimBridge,
  xlineModeBridge,
  sketchFidelityBridge,
  scaleToolBridge,
}: UseRibbonCommandsProps): RibbonCommandsApi {
  // ADR-366 §C.1.b snap-to-grid — subscribe so ribbon re-renders on snap change.
  const snapEnabled = useAnimationStore((s) => s.snapEnabled);
  const snapStepUnits = useAnimationStore((s) => s.snapStepUnits);

  // ADR-461 Phase C4 / ADR-467 — active storey context drives the Revit-style
  // ADVISORY tool recommendation (foundation level → foundation/beam/slab; the
  // foundation discipline is graduated by storey, needing `isLowestOccupiedStorey`).
  const activeStorey = useActiveStoreyContext() ?? null;

  // ADR-587 Φ4 — ordered dispatch tables (data). ONE bridges bag (written once) → the
  // three route tables; deps derived via `Object.values` so the 30 bridge identifiers
  // are NOT listed twice (jscpd/N.18). Each builder reads only the subset it needs
  // (badge = 9, visibility = 15) — the extra fields are ignored. Rebuilt only when a
  // bridge ref changes → identical churn cadence to the previous per-callback deps
  // arrays, so ADR-547 stable-identity guarantees are preserved. The combobox table
  // holds BOTH the write (`onComboboxChange`) and read (`getComboboxState`) matchers
  // per bridge, so the two can no longer silently drift (the ADR-449 finish-key bug).
  const bridges = {
    stairBridge, railingBridge, wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge,
    wallCoveringBridge, hatchBridge, thermalSpaceBridge, columnBridge, beamBridge,
    foundationBridge, slabOpeningBridge, mepFixtureBridge, mepManifoldBridge,
    electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge, mepWaterHeaterBridge,
    mepUnderfloorBridge, mepSegmentBridge, furnitureBridge, genericSolidBridge, blockLibraryBridge, titleBlockBridge, floorplanSymbolBridge,
    annotationSymbolBridge, scaleBarBridge, mepFixtureLibraryBridge, mepRiserBridge, arrayBridge,
    lineToolBridge, dimBridge, xlineModeBridge, sketchFidelityBridge, scaleToolBridge,
  };
  const routeTables = React.useMemo(
    () => ({
      combobox: buildComboboxRoutes(bridges),
      badge: buildBadgeRoutes(bridges),
      visibility: buildVisibilityRoutes(bridges),
    }),
    // deps = the 30 bridge refs (the bag is a fresh object each render, its values stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(bridges),
  );

  // ADR-547 Stage 4 Option B — stable identity (useEventCallback): the field
  // WRITERS live in the STABLE dispatch context so memoized value widgets get a
  // stable `onChange` and re-render ONLY from their own `RibbonFieldStore` slice.
  // `animation.snap-step` is the one non-bridge key (writes AnimationStore directly);
  // everything else flows through the ordered route table (textEditor = fallback).
  const onComboboxChange = useEventCallback(
    (key: string, value: string) => {
      if (key === 'animation.snap-step') {
        const step = parseFloat(value);
        if (!Number.isNaN(step) && step > 0) {
          useAnimationStore.getState().setSnapStepUnits(step);
        }
        return;
      }
      dispatchComboboxWrite(routeTables.combobox, key, value, (k, v) => textEditorBridge.onComboboxChange(k, v));
    },
  );

  const getComboboxState = React.useCallback(
    (key: string): RibbonComboboxState | null => {
      if (key === 'animation.snap-step') {
        return { value: String(snapStepUnits), options: SNAP_STEP_COMBOBOX_OPTIONS };
      }
      return dispatchComboboxRead(routeTables.combobox, key, (k) => textEditorBridge.getComboboxState(k));
    },
    [snapStepUnits, routeTables, textEditorBridge],
  );

  // ADR-547 / N.7.1 — boolean-toggle dispatch (write + read) extracted to its own
  // hook. `getToggleState` stays a stable useCallback here (via the sub-hook) so it
  // feeds `RibbonFieldStore` through the layout-effect below unchanged.
  const { onToggle, getToggleState } = useRibbonToggleCommands({
    snapEnabled,
    wallBridge,
    arrayBridge,
    openingBridge,
    roofBridge,
    mepBoilerBridge,
    hatchBridge,
    dimBridge,
    scaleToolBridge,
    blockLibraryBridge,
    textEditorBridge,
  });

  // ADR-358 Phase 7b1 — Stair bridge owns badge keys; ADR-363 Phase 1B adds
  // wall badge keys for the violation indicator on the wall contextual tab.
  const getBadgeState = React.useCallback(
    (badgeKey: string): boolean => dispatchSimple(routeTables.badge, badgeKey, false),
    [routeTables],
  );

  // ADR-358 Phase 7b2b-β Stream F — bridges own their visibility keys; unowned
  // keys default to `true` (panel visible = no breaking change). New bridges add a
  // route entry in `buildVisibilityRoutes`, no new branch here.
  const getPanelVisibility = React.useCallback(
    (visibilityKey: string): boolean => dispatchSimple(routeTables.visibility, visibilityKey, true),
    [routeTables],
  );

  // ADR-461 Phase C4 / ADR-467 — Revit-style advisory recommendation per active
  // storey. Null storey → always `true` (handled inside the pure SSoT) → no change.
  const getCommandRecommendation = React.useCallback(
    (commandKey: string): boolean => isCommandRecommendedForStorey(commandKey, activeStorey),
    [activeStorey],
  );

  // ADR-363 Phase 1E — Wall action keys (delete) handled by bridge before
  // falling through to the generic DxfViewerContent action handler.
  // ADR-547 Stage 4 (Option A) — stabilized via `useEventCallback`: `onAction`
  // feeds the STABLE `RibbonDispatchContext` consumed by every tool button
  // (Large/Small/Split). A plain `useCallback` churned on every edit/selection
  // (its bridge deps change reference) → dispatch context churned → all tool
  // buttons + their Radix Tooltips (×75) re-rendered. Stable identity (reads the
  // latest bridges/wrappedHandleAction at click time) lets `React.memo` on the
  // tool buttons bail when the ribbon shell re-renders for a field-value change.
  // Event-only (button click) → never called during render → safe.
  const onAction = useEventCallback(
    (action: string, data?: RibbonActionPayload) => {
      // ADR-521 — «Τύποι» dropdown: επιλογή τύπου κολώνας → set kind + activate column
      // tool, ΧΩΡΙΣ race. `setKind` ενημερώνει το FSM state.kind (idle → μένει idle)·
      // το `handleToolChange('column')` ενεργοποιεί → `activate()` (effect) κρατά
      // `prev.kind` = το νέο. Ήδη-ενεργό → setKind αλλάζει άμεσα + tool-change no-op.
      // Intercept ΠΡΙΝ το routeRibbonAction (tool activation δεν ανήκει σε entity bridge).
      if (isColumnDrawKindAction(action)) {
        const kind = parseColumnDrawKind(action);
        if (kind) {
          columnToolBridgeStore.get()?.setKind(kind);
          handleToolChange('column' as ToolType);
        }
        return;
      }
      routeRibbonAction(action, data, {
        closeContextualTab,
        wallBridge, openingBridge, slabBridge, roofBridge, floorFinishBridge, wallCoveringBridge, hatchBridge,
        thermalSpaceBridge, columnBridge, beamBridge, foundationBridge, slabOpeningBridge,
        stairBridge, mepCircuitBridge, mepPipeNetworkBridge, waterAutoSupplyBridge,
        drainageAutoBridge, heatingAutoBridge, electricalAutoBridge, electricalWeakAutoBridge,
        hvacAutoBridge, fireAutoBridge, gasAutoBridge, clashDetectionBridge, mepFixtureBridge,
        mepManifoldBridge, electricalPanelBridge, mepRadiatorBridge, mepBoilerBridge,
        mepWaterHeaterBridge, mepUnderfloorBridge, mepSegmentBridge, furnitureBridge,
        scaleToolBridge,
        wrappedHandleAction,
      });
    },
  );

  // ADR-547 Stage 4 (completion) — push the VOLATILE field readers into the
  // zero-React `RibbonFieldStore` from HERE (the hook), not from the provider's
  // render. This decouples the store-update path from the React prop flow: the 4
  // getters are NO LONGER part of the returned `commands` object, so `commands`
  // stays referentially stable across BIM edits → `RibbonRoot` `React.memo` HOLDS
  // → the ribbon shell + tool buttons stop re-rendering. The per-key store +
  // signature cache (`useRibbonFieldSelectors`) re-render only the value widgets
  // whose own slice actually moved. This effect re-runs whenever a getter's
  // identity changes (i.e. on every edit, via the bridge deps), keeping the store
  // current. Layout effect → in sync before subscribers read on the same commit.
  React.useLayoutEffect(() => {
    setRibbonFieldReaders({ getComboboxState, getToggleState, getBadgeState, getPanelVisibility });
  }, [getComboboxState, getToggleState, getBadgeState, getPanelVisibility]);

  return React.useMemo(
    () => ({
      activeTool,
      onToolChange: handleToolChange,
      onComingSoon: handleRibbonComingSoon,
      onAction,
      canUndo,
      canRedo,
      onToggle,
      onComboboxChange,
      getCommandRecommendation,
    }),
    [
      activeTool,
      handleToolChange,
      handleRibbonComingSoon,
      onAction,
      canUndo,
      canRedo,
      onToggle,
      onComboboxChange,
      getCommandRecommendation,
    ],
  );
}
