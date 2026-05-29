'use client';
import { useNotifications } from '../../../providers/NotificationProvider';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🤖 ADR-185: AI Drawing Assistant feature flag
import { USE_AI_DRAWING_ASSISTANT } from '../config/feature-flags';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import React from 'react';
import type { DxfViewerAppProps } from '../types';
import type { ToolType } from '../ui/toolbar/types';
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useLayerCommandShortcuts } from '../hooks/useLayerCommandShortcuts';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useSnapContext } from '../snapping/context/SnapContext';
import { useCanvasOperations } from '../hooks/interfaces/useCanvasOperations';
import { useEventBus, EventBus } from '../systems/events/EventBus';
import { useEntityCreationManager } from '../systems/entity-creation';
import { useOverlayState } from '../hooks/state/useOverlayState';
import { useCanvasTransformState } from '../hooks/state/useCanvasTransformState';
import { useColorMenuState } from '../hooks/state/useColorMenuState';
import { useOverlayStore } from '../overlays/overlay-store';
import { useUniversalSelection } from '../systems/selection';
import { useLevelManager } from '../systems/levels/useLevels';
// ADR-375 Phase B.2 — sync per-level BIM render settings into the store
import { useBimRenderSettingsSync } from '../state/hooks/useBimRenderSettingsSync';
// ADR-375 Phase C.1 — sync per-company pen table overrides into the resolver
import { useBimPenTableSync } from '../state/hooks/useBimPenTableSync';
import { useDimAssociationObserver } from '../hooks/dimensions/useDimAssociationObserver';
import { useGripContext } from '../providers/GripProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import {
  OverlayToolbar, ColorManager, ProSnapToolbar, TestsModal, CursorSettingsPanel,
  CoordinateCalibrationOverlay, AutoSaveStatus, CentralizedAutoSaveStatus, OverlayProperties,
  DraggableOverlayToolbar, DraggableOverlayProperties, FloorplanBackgroundPanel,
  ReplaceConfirmDialog, CalibrationDialog, DxfAiChatPanel, DxfFindReplaceHost,
  DxfSymbolPickerHost, RenumberOpeningsHost, OpeningTagStyleHost, OpeningSchedulePdfHost,
  ThermalEnvelopeHost,
  AdminLayerManagerDialogHost,
  DxfImportModal, SimpleProjectDialog, ConstructionLayerScaffoldDialog,
  FloorplanImportWizard, MainContentSection, FloatingPanelsSection,
} from './dxf-viewer-lazy-components';
// Layout Components - Canvas V2
import { SidebarSection } from '../layout/SidebarSection';
import { MobileSidebarDrawer } from '../layout/MobileSidebarDrawer';
import { useResponsiveLayout } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';
// ADR-040 Phase XXII.C: TransformContext duplicate SSoT removed. ImmediateTransformStore
// (Phase XIII) is the sole transform SSoT. Legacy React Context Provider deleted to kill
// per-notch useState cascade + duplicate EventBus.emit on wheel zoom.
import { type UnifiedTestReport } from '../debug/unified-test-runner';
import { usePerformanceMonitorToggle } from '../hooks/usePerformanceMonitorToggle';
import { PerformanceCategory } from '@/core/performance/types/performance.types';
import { ClientOnlyPerformanceDashboard } from '@/core/performance/components/ClientOnlyPerformanceDashboard';
// ✅ ADR-065 SRP: Extracted hooks
import { useDxfViewerCallbacks } from './useDxfViewerCallbacks';
import { useDxfViewerEffects } from './useDxfViewerEffects';
import { useAutoFitOnFileChange } from './useAutoFitOnFileChange';
// 📐 ADR-345 Fase 4: i18n for the "Coming Soon" toast on unwired ribbon buttons.
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 📐 ADR-345/353: contextual tabs config + trigger resolver (SSoT)
import { RIBBON_CONTEXTUAL_TABS, useActiveContextualTrigger } from './ribbon-contextual-config';
import { useRibbonArrayBridge } from '../ui/ribbon/hooks/useRibbonArrayBridge';
import { useArrayRibbonActions } from '../ui/ribbon/hooks/useArrayRibbonActions';
// 📐 ADR-358 Phase 7a / ADR-363: BIM contextual bridges aggregated
import { useDxfBimBridges } from './useDxfBimBridges';
import { useRibbonLineToolBridge } from '../ui/ribbon/hooks/useRibbonLineToolBridge';
import { useRibbonXlineModeBridge } from '../ui/ribbon/hooks/useRibbonXlineModeBridge';
// 📐 ADR-358 Phase 8: top-bar wrapper (RibbonRoot + StairAdvancedPanelHost) — N.7.1 size split
import { DxfViewerTopBar } from './DxfViewerTopBar';
// 📐 ADR-345 Fase 5.5: bridge text-engine ↔ ribbon contextual tab (toggles + comboboxes)
import { useRibbonTextEditorBridge } from '../ui/ribbon/hooks/useRibbonTextEditorBridge';
import { useRibbonCommands } from '../ui/ribbon/hooks/useRibbonCommands';
// ADR-344 Phase 6.E: selection→toolbar + toolbar→CommandHistory always-on bridges
import { useTextToolbarSelectionSync } from '../ui/text-toolbar/hooks/useTextToolbarSelectionSync';
import { useTextToolbarCommandBridge } from '../ui/text-toolbar/hooks/useTextToolbarCommandBridge';
import { buildDxfImportSaveContext } from './dxf-import-save-context';
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
  // ADR-345 Fase 5B + ADR-353 Phase A — contextual tab list.
  const ribbonContextualTabs = RIBBON_CONTEXTUAL_TABS;
  // ADR-345 Fase 5.5 — text editor bridge (toggle/combobox state + handlers).
  const textEditorBridge = useRibbonTextEditorBridge();
  // ADR-344 Phase 6.E — selection → toolbar populate (Layer 1) + toolbar → CommandHistory (Layer 2).
  // Mounted here (always-on orchestrator) so both the ribbon and the floating panel stay in sync
  // regardless of which UI surface the user has open.
  useTextToolbarSelectionSync();
  useTextToolbarCommandBridge();
  const eventBus = useEventBus();
  const colors = useSemanticColors();
  const { copy: copyToClipboard } = useCopyToClipboard();
  // 🏢 ADR-241: Centralized fullscreen
  const fullscreen = useFullscreen();
  // ADR-176: Responsive layout + sidebar drawer state
  const { layoutMode } = useResponsiveLayout();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  // 🧪 Test runner state
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [testReport, setTestReport] = React.useState<UnifiedTestReport | null>(null);
  const [formattedTestReport, setFormattedTestReport] = React.useState<string>('');
  const [testsModalOpen, setTestsModalOpen] = React.useState(false);
  // 🏢 PDF + AI panel state
  const [pdfPanelOpen, setPdfPanelOpen] = React.useState(false);
  const [aiChatOpen, setAiChatOpen] = React.useState(false);
  // ADR-345 Fase 6: Import dialog state (lifted from EnhancedDXFToolbar — SSOT)
  const [showEnhancedImport, setShowEnhancedImport] = React.useState(false);
  const [showImportWizard, setShowImportWizard] = React.useState(false);
  const [showLegacyImport, setShowLegacyImport] = React.useState(false);
  // 🏢 Performance Monitor Toggle
  const { isEnabled: perfMonitorEnabled, toggle: togglePerfMonitor } = usePerformanceMonitorToggle();
  // ✅ ENTERPRISE: State Management Hooks (PHASE 4)
  const { overlayMode, overlayStatus, overlayKind, setOverlayMode, setOverlayStatus, setOverlayKind } = useOverlayState();
  // ADR-040 Phase XIII: setCanvasTransform writes through to TransformStore.
  // DxfViewerContent does NOT subscribe to the transform value → no re-render
  // on pan/zoom. Leaf consumers subscribe via useTransformValue / useTransformScale.
  const { setCanvasTransform } = useCanvasTransformState({ currentScene: state.currentScene, activeTool: state.activeTool });
  const { colorMenu, openColorMenu, closeColorMenu, colorMenuRef } = useColorMenuState();
  // 🎯 Canvas visibility states
  const [dxfCanvasVisible, setDxfCanvasVisible] = React.useState(true);
  const [layerCanvasVisible, setLayerCanvasVisible] = React.useState(true);
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
  // ADR-375 Phase C.1 — subscribe to per-company pen table overrides
  useBimPenTableSync();
  const { updateGripSettings } = useGripContext();
  const { enabledModes, toggleMode } = useSnapContext();
  const canvasOps = useCanvasOperations();
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
  const activeContextualTrigger = useActiveContextualTrigger({ primarySelectedId, selectedEntityIds, currentScene, activeTool });
  // Auto fit-to-view on FileRecord transition (extracted hook, ADR-340 Phase 9).
  useAutoFitOnFileChange({
    currentScene,
    fileRecordId: levelManager.fileRecordId ?? null,
    handleAction,
  });
  // ✅ ADR-065 SRP: Extracted callbacks
  const {
    showCopyableNotification, wrappedHandleAction,
    wrappedHandleTransformChange, panToWorldOrigin, handleFileImportWithEncoding,
    handleRegionClick, nudgeSelection, selectionIdSet,
  } = useDxfViewerCallbacks({
    notifications, copyToClipboard, handleAction,
    togglePerfMonitor, perfMonitorEnabled, fullscreen,
    setTestsModalOpen, setPdfPanelOpen, setAiChatOpen,
    setShowEnhancedImport, setShowImportWizard, setShowLegacyImport,
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
  // Overlay drawing hook
  const {
    overlayCanvasRef, draftPolygon, snapPoint,
    handleOverlayCanvasClick, finishDrawing, handleVertexDrag,
    handleRegionUpdate, handleOverlayMouseMove, clearSnapPoint,
    setDraftPolygon, snapManager
  } = useOverlayDrawing({
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
  // ADR-353 Phase A — Array contextual bridge + action interception.
  const arrayBridge = useRibbonArrayBridge({ levelManager, universalSelection });
  const arrayActionInterceptor = useArrayRibbonActions({
    levelManager, universalSelection,
    handleToolChange, fallback: wrappedHandleAction,
  });
  // ADR-362 Phase J2 — Dimension associativity observer (auto-follow geometry).
  useDimAssociationObserver(levelManager.getLevelScene, levelManager.setLevelScene, () => levelManager.currentLevelId);
  // ADR-358 Phase 7a / ADR-363 — BIM contextual bridges (stair / wall / opening / slab / column / beam).
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
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
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
          dxfCanvasVisible={dxfCanvasVisible}
          layerCanvasVisible={layerCanvasVisible}
          setDxfCanvasVisible={setDxfCanvasVisible}
          setLayerCanvasVisible={setLayerCanvasVisible}
          showCopyableNotification={showCopyableNotification}
          showGrid={showGrid}
          activeTool={activeTool}
          handleToolChange={handleToolChange}
          testModalOpen={testModalOpen}
          setTestModalOpen={setTestModalOpen}
          testReport={testReport}
          setTestReport={setTestReport}
          formattedTestReport={formattedTestReport}
          setFormattedTestReport={setFormattedTestReport}
          panToWorldOrigin={panToWorldOrigin}
          showCalibration={showCalibration}
          handleCalibrationToggle={handleCalibrationToggle}
          onSidebarToggle={() => setSidebarOpen(prev => !prev)}
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
          testModalOpen={testModalOpen}
          setTestModalOpen={setTestModalOpen}
          testReport={testReport}
          formattedTestReport={formattedTestReport}
          />
        </React.Suspense>
      </FullscreenOverlay>
      <React.Suspense fallback={<div className="hidden" />}>
        <TestsModal
          isOpen={testsModalOpen}
          onClose={() => setTestsModalOpen(false)}
          showCopyableNotification={showCopyableNotification}
        />
      </React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}>
        <FloorplanBackgroundPanel
          isOpen={pdfPanelOpen}
          onClose={() => setPdfPanelOpen(false)}
        />
      </React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}>
        <ReplaceConfirmDialog />
      </React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}>
        <CalibrationDialog />
      </React.Suspense>
      {/* ADR-345 Fase 6: Import dialogs — SSOT owner (migrated from EnhancedDXFToolbar) */}
      <React.Suspense fallback={<div className="hidden" />}>
        <DxfImportModal
          isOpen={showLegacyImport}
          onClose={() => setShowLegacyImport(false)}
          onImport={async (file, encoding) => { await handleFileImportWithEncoding(file, encoding); }}
        />
      </React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}>
        <SimpleProjectDialog
          isOpen={showEnhancedImport}
          onClose={() => setShowEnhancedImport(false)}
          onFileImport={(file: File) => handleFileImportWithEncoding(file)}
        />
      </React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}>
        <FloorplanImportWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onComplete={(file, meta) => {
            setShowImportWizard(false);
            if (meta.format && meta.format !== 'dxf') return;
            void handleFileImportWithEncoding(file, undefined, buildDxfImportSaveContext(meta));
          }}
        />
      </React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}><ConstructionLayerScaffoldDialog /></React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}><DxfFindReplaceHost open={state.findReplaceOpen} onOpenChange={state.setFindReplaceOpen} /></React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}><DxfSymbolPickerHost open={state.symbolPickerOpen} onOpenChange={state.setSymbolPickerOpen} /></React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}><RenumberOpeningsHost projectId={levelManager.saveContext?.projectId ?? undefined} floorplanId={levelManager.fileRecordId ?? undefined} /></React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}><OpeningTagStyleHost projectId={levelManager.saveContext?.projectId ?? undefined} /></React.Suspense>
      <React.Suspense fallback={<div className="hidden" />}><OpeningSchedulePdfHost getEntities={() => (levelManager.getLevelScene(levelManager.currentLevelId ?? '')?.entities ?? []) as unknown as ReadonlyArray<Record<string, unknown>>} levels={levelManager.levels} /></React.Suspense>
      {/* ADR-396 P6 — Thermal Envelope (ETICS) authoring dialog (opened via Analyze tab). */}
      <React.Suspense fallback={<div className="hidden" />}><ThermalEnvelopeHost currentLevelId={levelManager.currentLevelId} levels={levelManager.levels} /></React.Suspense>
      {/* ADR-391 — AdminLayerManager modal (opened via View tab button or Ctrl+L). */}
      <React.Suspense fallback={<div className="hidden" />}><AdminLayerManagerDialogHost projectId={levelManager.saveContext?.projectId ?? null} /></React.Suspense>
      {USE_AI_DRAWING_ASSISTANT && (
        <React.Suspense fallback={<div className="hidden" />}>
          <DxfAiChatPanel
            isOpen={aiChatOpen}
            onClose={() => setAiChatOpen(false)}
            getScene={levelManager.getLevelScene}
            setScene={levelManager.setLevelScene}
            levelId={levelManager.currentLevelId || '0'}
          />
        </React.Suspense>
      )}
      {perfMonitorEnabled && (
        <ClientOnlyPerformanceDashboard
          showDetails
          updateInterval={2000}
          categories={[
            PerformanceCategory.RENDERING,
            PerformanceCategory.MEMORY
          ]}
        />
      )}
      </section>
      </div>
  );
});
export default DxfViewerContent;