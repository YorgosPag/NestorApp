'use client';
import { useNotifications } from '../../../providers/NotificationProvider';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import React from 'react';
import type { DxfViewerAppProps } from '../types';
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useLayerCommandShortcuts } from '../hooks/useLayerCommandShortcuts';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useEventBus, EventBus } from '../systems/events/EventBus';
import { useEntityCreationManager } from '../systems/entity-creation';
import { useOverlayState } from '../hooks/state/useOverlayState';
import { useCanvasTransformState } from '../hooks/state/useCanvasTransformState';
import { useColorMenuState } from '../hooks/state/useColorMenuState';
import { useOverlayStore } from '../overlays/overlay-store';
import { useUniversalSelection, useSelectionLevelReset } from '../systems/selection';
import { useLevelManager } from '../systems/levels/useLevels';
import { useBimRenderSettingsSync } from '../state/hooks/useBimRenderSettingsSync'; // ADR-375 B.2 — per-level BIM render settings
import { useStructuralSettingsSync } from '../state/hooks/useStructuralSettingsSync'; // ADR-456 2b — building-level structural code
// ADR-396 P7 — sync per-level thermal envelope spec into the store
import { useThermalEnvelopeSync } from '../state/hooks/useThermalEnvelopeSync';
// ADR-375 Phase C.1 — sync per-company pen table overrides into the resolver
import { useBimPenTableSync } from '../state/hooks/useBimPenTableSync';
import { useDimAssociationObserver } from '../hooks/dimensions/useDimAssociationObserver';
import { useGripContext } from '../providers/GripProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { MainContentSection, FloatingPanelsSection } from './dxf-viewer-lazy-components';
// Layout Components - Canvas V2
import { SidebarSection } from '../layout/SidebarSection';
import { MobileSidebarDrawer } from '../layout/MobileSidebarDrawer';
import { useResponsiveLayout } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';
// ADR-040 Phase XXII.C: TransformContext duplicate SSoT removed. ImmediateTransformStore
// (Phase XIII) is the sole transform SSoT. Legacy React Context Provider deleted to kill
// per-notch useState cascade + duplicate EventBus.emit on wheel zoom.
import { usePerformanceMonitorToggle } from '../hooks/usePerformanceMonitorToggle';
// ✅ ADR-065 SRP: Extracted hooks
import { useDxfViewerCallbacks } from './useDxfViewerCallbacks';
import { useDxfViewerEffects } from './useDxfViewerEffects';
import { useDxfViewerNotifications } from '../hooks/useDxfViewerNotifications';
import { useStructuralAutoAttach } from '../hooks/useStructuralAutoAttach';
import { useStructuralAutoReinforce } from '../hooks/useStructuralAutoReinforce';
import { useStructuralLoadTakedown } from '../hooks/useStructuralLoadTakedown';
import { useStructuralFootingConnect } from '../hooks/useStructuralFootingConnect';
import { useStructuralOrganism } from '../hooks/useStructuralOrganism';
import { useFoundationLevelSync } from '../hooks/useFoundationLevelSync';
import { useColumnAdjacencyNotification } from '../hooks/useColumnAdjacencyNotification';
import { useColumnFootingNotification } from '../hooks/useColumnFootingNotification';
import { useStructuralOrganismNotification } from '../hooks/useStructuralOrganismNotification';
import { useViewportUrlSync } from '../hooks/canvas/useViewportUrlSync';
// 📐 ADR-345 Fase 4: i18n for the "Coming Soon" toast on unwired ribbon buttons.
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 📐 ADR-358 Phase 8: top-bar wrapper (RibbonRoot + persistence hosts) — N.7.1 size split
import { DxfViewerTopBar } from './DxfViewerTopBar';
// ADR-344 Phase 6.E: selection→toolbar + toolbar→CommandHistory always-on bridges
import { useTextToolbarSelectionSync } from '../ui/text-toolbar/hooks/useTextToolbarSelectionSync';
import { useTextToolbarCommandBridge } from '../ui/text-toolbar/hooks/useTextToolbarCommandBridge';
import { use3DSelectionUniversalBridge } from '../bim-3d/systems/selection/use-3d-selection-universal-bridge';
// ✅ N.7.1 size split — extracted UI-state + ribbon assembly + dialogs modules
import { useDxfViewerUiState } from './useDxfViewerUiState';
import { useDxfViewerRibbon } from './useDxfViewerRibbon';
import { DxfViewerDialogs } from './DxfViewerDialogs';
export const DxfViewerContent = React.memo<DxfViewerAppProps>((props) => {
  // ADR-345 — mark the document root while the DXF viewer route is mounted
  // so route-scoped CSS (e.g. hiding the global header border-bottom) only
  // applies here. Cleanup restores the previous value when leaving the route.
  React.useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.appRoute;
    root.dataset.appRoute = 'dxf-viewer';
    return () => {
      if (previous === undefined) {
        delete root.dataset.appRoute;
      } else {
        root.dataset.appRoute = previous;
      }
    };
  }, []);
  const floatingRef = React.useRef<FloatingPanelHandle>(null);
  const state = useDxfViewerState();
  const notifications = useNotifications();
  const { t: tShell } = useTranslation('dxf-viewer-shell');
  const handleRibbonComingSoon = React.useCallback(
    (label: string) => {
      notifications.info(tShell('ribbon.commands.comingSoon', { label }));
    },
    [notifications, tShell],
  );
  // ADR-344 Phase 6.E — selection→toolbar (L1) + toolbar→CommandHistory (L2); always-on orchestrator.
  useTextToolbarSelectionSync();
  useTextToolbarCommandBridge();
  useDxfViewerNotifications(); // ADR-401 Phase C — decoupled host-missing warning toast bridge
  const eventBus = useEventBus();
  const colors = useSemanticColors();
  const { copy: copyToClipboard } = useCopyToClipboard();
  // 🏢 ADR-241: Centralized fullscreen
  const fullscreen = useFullscreen();
  // ADR-176: Responsive layout + sidebar drawer state
  const { layoutMode } = useResponsiveLayout();
  // ✅ N.7.1 size split — ephemeral UI/dialog/canvas-visibility toggle state (SSoT).
  const ui = useDxfViewerUiState();
  // 🏢 Performance Monitor Toggle
  const { isEnabled: perfMonitorEnabled, toggle: togglePerfMonitor } = usePerformanceMonitorToggle();
  // ✅ ENTERPRISE: State Management Hooks (PHASE 4)
  const { overlayMode, overlayStatus, overlayKind, setOverlayMode, setOverlayStatus, setOverlayKind } = useOverlayState();
  // ADR-040 Phase XIII: setCanvasTransform writes through to TransformStore.
  // DxfViewerContent does NOT subscribe to the transform value → no re-render
  // on pan/zoom. Leaf consumers subscribe via useTransformValue / useTransformScale.
  const { setCanvasTransform } = useCanvasTransformState({ currentScene: state.currentScene, activeTool: state.activeTool });
  const { colorMenu, openColorMenu, closeColorMenu, colorMenuRef } = useColorMenuState();
  // Destructure state
  const {
    activeTool, handleToolChange, handleAction, showGrid, toggleGrid,
    canUndo, canRedo, snapEnabled, showLayers, showCalibration,
    showCursorSettings, showGuidePanel, showGuideAnalysisPanel,
    handleFileImport, currentScene,
    handleSceneChange, handleCalibrationToggle,
    drawingState, onMeasurementPoint, onMeasurementHover, onMeasurementCancel,
    onDrawingPoint, onDrawingHover, onDrawingCancel, onDrawingDoubleClick,
    onEntityCreated, gripSettings
  } = state;
  // Stores and managers
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const levelManager = useLevelManager();
  // ADR-375 Phase B.2 — load BimRenderSettings for active level on every switch / Firestore push
  useBimRenderSettingsSync({
    currentLevelId: levelManager.currentLevelId,
    levels: levelManager.levels,
  });
  // ADR-456 Slice 2b — load building-level structural settings (κανονισμός)
  useStructuralSettingsSync({
    currentLevelId: levelManager.currentLevelId,
    levels: levelManager.levels,
    saveContext: levelManager.saveContext,
  });
  // ADR-396 P7 — load per-level ThermalEnvelopeSpec on every switch / Firestore push
  useThermalEnvelopeSync({
    currentLevelId: levelManager.currentLevelId,
    levels: levelManager.levels,
  });
  // ADR-375 Phase C.1 — subscribe to per-company pen table overrides
  useBimPenTableSync();
  // ADR-402 — unified selection: mirror 3D BIM selection into the universal
  // selection so 3D gizmo edits engage the existing per-type persistence
  // auto-save (otherwise the optimistic 3D edit reverts on the next snapshot).
  use3DSelectionUniversalBridge();
  // ADR-420 — clear the 2D selection on floor navigation. Without this, a
  // selection (e.g. Ctrl+A) made on one floor carried over to the next as
  // stale "selected" entities — the UI mirror of the cross-floor scope leak.
  useSelectionLevelReset(levelManager.currentLevelId);
  const { updateGripSettings } = useGripContext();
  // 🏢 ADR-055: Entity Creation Manager
  useEntityCreationManager({
    getLevelScene: levelManager.getLevelScene,
    setLevelScene: levelManager.setLevelScene,
    defaultLevelId: levelManager.currentLevelId || '0',
    debug: false,
  });
  // Refs for effects hook
  const prevGripStateRef = React.useRef<{ shouldEnableGrips: boolean } | null>(null);
  const prevPrimarySelectedIdRef = React.useRef<string | null>(null);
  const levelManagerRef = React.useRef(levelManager);
  const handleSceneChangeRef = React.useRef(handleSceneChange);
  // SSoT: selectedEntityIds derived from universalSelection — single write path
  const selectedEntityIds = React.useMemo(
    () => universalSelection.getSelectedEntityIds(),
    [universalSelection]
  );
  // 🏢 Universal selection primary ID
  const primarySelectedId = universalSelection.getPrimaryId();
  // Viewport auto-fit (initial restore/fit, re-import, level-stable navigation) is
  // owned by the SINGLE `useViewportAutoFit` SSoT controller in CanvasSection (ADR-399).
  // ✅ ADR-065 SRP: Extracted callbacks
  const {
    showCopyableNotification, wrappedHandleAction,
    wrappedHandleTransformChange, panToWorldOrigin, handleFileImportWithEncoding,
    handleRegionClick, nudgeSelection, selectionIdSet,
  } = useDxfViewerCallbacks({
    notifications, copyToClipboard, handleAction,
    togglePerfMonitor, perfMonitorEnabled, fullscreen,
    setTestsModalOpen: ui.setTestsModalOpen, setCreditsModalOpen: ui.setCreditsModalOpen, setPdfPanelOpen: ui.setPdfPanelOpen, setAiChatOpen: ui.setAiChatOpen,
    setShowEnhancedImport: ui.setShowEnhancedImport, setShowImportWizard: ui.setShowImportWizard, setShowLegacyImport: ui.setShowLegacyImport,
    setCanvasTransform,
    currentScene, selectedEntityIds, handleSceneChange,
    handleFileImport, levelManager, overlayStore,
    universalSelection, setOverlayStatus, setOverlayKind,
    showLayers, floatingRef,
  });
  // ✅ ADR-065 SRP: Extracted effects
  useDxfViewerEffects({
    activeTool, overlayMode, currentScene,
    showLayers, selectedEntityIds, primarySelectedId,
    setOverlayMode,
    handleToolChange, handleAction, handleSceneChange,
    updateGripSettings, showCopyableNotification,
    eventBus, notifications,
    levelManager, overlayStore, universalSelection,
    floatingRef,
    prevGripStateRef, prevPrimarySelectedIdRef,
    levelManagerRef, handleSceneChangeRef,
  });
  // ✅ PERFORMANCE: Memoize wrappedState
  const wrappedState = React.useMemo(() => ({
    ...state,
    selectedEntityIds,  // SSoT: override stale raw useState with live universalSelection value
    handleAction: wrappedHandleAction,
    onAction: wrappedHandleAction
  }), [state, selectedEntityIds, wrappedHandleAction]);
  // Overlay drawing hook — retained for its registration side-effects (outputs unused here).
  useOverlayDrawing({
    overlayMode, activeTool, overlayKind, overlayStatus, overlayStore,
    levelManager: {
      getCurrentLevel: () => levelManager.currentLevelId ? { id: levelManager.currentLevelId } : null,
      setLevelScene: levelManager.setLevelScene,
      getLevelScene: levelManager.getLevelScene
    },
    onOverlaySelect: (id: string | null) => universalSelection.handleOverlaySelect(id)
  });
  // Ctrl+A → select all entities via EventBus so CanvasSection updates its own state
  const handleSelectAll = React.useCallback(() => {
    EventBus.emit('canvas:select-all', undefined as unknown as void);
  }, []);
  // Keyboard shortcuts hook
  const { handleCanvasMouseMove } = useKeyboardShortcuts({
    selectedEntityIds, currentScene,
    onNudgeSelection: nudgeSelection,
    onColorMenuClose: closeColorMenu,
    onDrawingCancel: state.onDrawingCancel,
    onSelectAll: handleSelectAll,
    activeTool, overlayMode, overlayStore
  });
  // ADR-358 §5.6.bis Phase 10 — wire Ctrl+Shift+I/U/T/O + Ctrl+Alt+I to layer commands.
  const { history: layerCommandHistory } = useCommandHistory();
  useLayerCommandShortcuts({
    selectedEntityIds,
    currentScene,
    commandHistory: layerCommandHistory,
  });
  // Pointer events class for desktop layering mode
  const rootPointerEventsClass =
    layoutMode === 'desktop' && activeTool === 'layering'
      ? PANEL_LAYOUT.POINTER_EVENTS.NONE
      : PANEL_LAYOUT.POINTER_EVENTS.AUTO;
  // ADR-400: persist + restore pan/zoom + active floor via URL (+localStorage, ADR-040 safe).
  useViewportUrlSync({
    fileRecordId: levelManager.fileRecordId ?? null,
    levelId: levelManager.currentLevelId,
  });

  // ADR-362 Phase J2 — Dimension associativity observer (auto-follow geometry).
  useDimAssociationObserver(levelManager.getLevelScene, levelManager.setLevelScene, () => levelManager.currentLevelId);
  useStructuralAutoAttach({ levelManager }); // ADR-401 Phase D — auto-attach walls under new beam/slab
  useStructuralAutoReinforce({ levelManager }); // ADR-459 Φ4d — «Αυτόματος Οπλισμός» (auto-apply command)
  useStructuralLoadTakedown({ levelManager }); // ADR-464 Φ4 — «Υπολογισμός Φορτίων» (tributary takedown)
  useStructuralFootingConnect({ levelManager }); // ADR-459 Φ4f — manual κολόνα↔πέδιλο connectivity (Ανάλυση)
  useFoundationLevelSync({ levelManager }); // ADR-459 Phase 0 — foundation-level SSoT (cross-level organism)
  useStructuralOrganism({ levelManager }); // ADR-459 Phase 1 — cross-entity structural diagnostics («λείπει το πέδιλο»)
  useColumnAdjacencyNotification({ levelManager }); // ADR-363 — post-creation adjacent-columns→shear-wall merge toast
  useColumnFootingNotification({ levelManager }); // ADR-459 Φ2/3 — proactive «βάλε/επέκτεινε πέδιλο» (cross-level)
  useStructuralOrganismNotification({ levelManager }); // ADR-459 Φ4 — proactive «ενιαίος οπλισμός οργανισμού»
  // ADR-345/353/358/363 — ribbon command assembly (contextual trigger + BIM/array/text bridges).
  const { ribbonCommands, ribbonContextualTabs, activeContextualTrigger } = useDxfViewerRibbon({
    levelManager, universalSelection, activeTool,
    handleToolChange, handleRibbonComingSoon, wrappedHandleAction,
    canUndo, canRedo, primarySelectedId, selectedEntityIds, currentScene,
  });
  return (
      <div className="flex flex-col h-full min-h-0">
        <DxfViewerTopBar
          ribbonCommands={ribbonCommands}
          contextualTabs={ribbonContextualTabs}
          activeContextualTrigger={activeContextualTrigger}
          primarySelectedId={primarySelectedId}
          currentScene={currentScene}
          levelManager={levelManager}
        />
      <section
        className={`flex flex-1 min-h-0 ${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.GAP.SM} ${colors.bg.primary} ${rootPointerEventsClass}`}
      >
      {/* ✅ PHASE 5: Sidebar Section — ADR-176: Responsive */}
      {/* ADR-309 Phase 2: handleFileImportWithEncoding passed so LevelPanel can show wizard */}
      {layoutMode === 'desktop' ? (
        <SidebarSection
          floatingRef={floatingRef}
          currentScene={currentScene}
          activeTool={activeTool}
          onSceneImported={handleFileImportWithEncoding}
          projectId={levelManager.saveContext?.projectId ?? undefined}
          floorplanId={levelManager.fileRecordId ?? undefined}
          primarySelectedId={primarySelectedId}
        />
      ) : (
        <MobileSidebarDrawer
          open={ui.sidebarOpen}
          onOpenChange={ui.setSidebarOpen}
          floatingRef={floatingRef}
          currentScene={currentScene}
          activeTool={activeTool}
          onSceneImported={handleFileImportWithEncoding}
        />
      )}
      {/* 🏢 ADR-241: FullscreenOverlay */}
      <FullscreenOverlay
        isFullscreen={fullscreen.isFullscreen}
        onToggle={fullscreen.toggle}
        ariaLabel="DXF Viewer"
        className="flex flex-1 min-w-0"
        fullscreenClassName="flex-row"
      >
        <React.Suspense fallback={<div className={`flex-1 ${colors.bg.skeleton} ${PANEL_LAYOUT.ANIMATE.PULSE}`} />}>
          <MainContentSection
          state={wrappedState}
          currentScene={currentScene}
          handleFileImportWithEncoding={handleFileImportWithEncoding}
          wrappedHandleTransformChange={wrappedHandleTransformChange}
          handleRegionClick={handleRegionClick}
          handleCanvasMouseMove={handleCanvasMouseMove}
          overlayMode={overlayMode}
          overlayStatus={overlayStatus}
          overlayKind={overlayKind}
          setOverlayMode={setOverlayMode}
          setOverlayStatus={setOverlayStatus}
          setOverlayKind={setOverlayKind}
          dxfCanvasVisible={ui.dxfCanvasVisible}
          layerCanvasVisible={ui.layerCanvasVisible}
          setDxfCanvasVisible={ui.setDxfCanvasVisible}
          setLayerCanvasVisible={ui.setLayerCanvasVisible}
          showCopyableNotification={showCopyableNotification}
          showGrid={showGrid}
          activeTool={activeTool}
          handleToolChange={handleToolChange}
          testModalOpen={ui.testModalOpen}
          setTestModalOpen={ui.setTestModalOpen}
          testReport={ui.testReport}
          setTestReport={ui.setTestReport}
          formattedTestReport={ui.formattedTestReport}
          setFormattedTestReport={ui.setFormattedTestReport}
          panToWorldOrigin={panToWorldOrigin}
          showCalibration={showCalibration}
          handleCalibrationToggle={handleCalibrationToggle}
          onSidebarToggle={() => ui.setSidebarOpen(prev => !prev)}
          isFullscreen={fullscreen.isFullscreen}
          />
        </React.Suspense>
        <React.Suspense fallback={<div className={`${PANEL_LAYOUT.WIDTH.PANEL_SM} ${colors.bg.skeleton} ${PANEL_LAYOUT.ANIMATE.PULSE}`} />}>
          <FloatingPanelsSection
          colorMenu={colorMenu}
          currentScene={currentScene}
          handleSceneChange={handleSceneChange}
          closeColorMenu={closeColorMenu}
          floatingRef={floatingRef}
          showCursorSettings={showCursorSettings}
          showCalibration={showCalibration}
          showGuidePanel={showGuidePanel}
          showGuideAnalysisPanel={showGuideAnalysisPanel}
          handleAction={wrappedHandleAction}
          activeTool={activeTool}
          overlayMode={overlayMode}
          overlayStatus={overlayStatus}
          overlayKind={overlayKind}
          setOverlayMode={setOverlayMode}
          setOverlayStatus={setOverlayStatus}
          setOverlayKind={setOverlayKind}
          snapEnabled={snapEnabled}
          handleToolChange={handleToolChange}
          canUndo={canUndo}
          canRedo={canRedo}
          overlayStore={overlayStore}
          isFullscreen={fullscreen.isFullscreen}
          testModalOpen={ui.testModalOpen}
          setTestModalOpen={ui.setTestModalOpen}
          testReport={ui.testReport}
          formattedTestReport={ui.formattedTestReport}
          />
        </React.Suspense>
      </FullscreenOverlay>
      <DxfViewerDialogs
        ui={ui}
        levelManager={levelManager}
        perfMonitorEnabled={perfMonitorEnabled}
        handleFileImportWithEncoding={handleFileImportWithEncoding}
        showCopyableNotification={showCopyableNotification}
        findReplaceOpen={state.findReplaceOpen}
        setFindReplaceOpen={state.setFindReplaceOpen}
        symbolPickerOpen={state.symbolPickerOpen}
        setSymbolPickerOpen={state.setSymbolPickerOpen}
        selectionIds={selectedEntityIds}
      />
      </section>
      </div>
  );
});
export default DxfViewerContent;
