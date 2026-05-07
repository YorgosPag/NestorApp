'use client';

/**
 * DxfViewerContent — Main orchestrator component for the DXF Viewer.
 * ADR-065 SRP split: delegates logic to useDxfViewerCallbacks + useDxfViewerEffects.
 *
 * Related files:
 * - useDxfViewerCallbacks.ts (callbacks/memos)
 * - useDxfViewerEffects.ts (useEffect subscriptions)
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DXF_VIEWER_CONTENT = false;

import { useNotifications } from '../../../providers/NotificationProvider';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🤖 ADR-185: AI Drawing Assistant feature flag
import { USE_AI_DRAWING_ASSISTANT } from '../config/feature-flags';
// ✅ ENTERPRISE: Centralized copy-to-clipboard hook
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
// 🏢 ADR-241: Centralized fullscreen — Portal-based, zero remount
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';

import React from 'react';

// Types
import type { DxfViewerAppProps } from '../types';
import type { ViewTransform } from '../rendering/types/Types';
import type { ToolType } from '../ui/toolbar/types';

// Hooks
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useSnapContext } from '../snapping/context/SnapContext';
import { useCanvasOperations } from '../hooks/interfaces/useCanvasOperations';
import { useEventBus } from '../systems/events/EventBus';
// 🏢 ENTERPRISE (2026-01-30): ADR-055 Entity Creation Manager
import { useEntityCreationManager } from '../systems/entity-creation';

// ✅ ENTERPRISE: State Management Hooks (PHASE 4)
import { useOverlayState } from '../hooks/state/useOverlayState';
import { useCanvasTransformState } from '../hooks/state/useCanvasTransformState';
import { useColorMenuState } from '../hooks/state/useColorMenuState';

// Stores and Managers
import { useOverlayStore } from '../overlays/overlay-store';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../systems/selection';
import { useLevelManager } from '../systems/levels/useLevels';
import { useGripContext } from '../providers/GripProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ⚡ LCP OPTIMIZATION: Critical UI Components
import { type FloatingPanelHandle } from '../ui/FloatingPanelContainer';

// 🚀 LAZY LOADED: Non-Critical UI Components
const OverlayToolbar = React.lazy(() => import('../ui/OverlayToolbar').then(mod => ({ default: mod.OverlayToolbar })));
const ColorManager = React.lazy(() => import('../ui/components/ColorManager').then(mod => ({ default: mod.ColorManager })));
const ProSnapToolbar = React.lazy(() => import('../ui/components/ProSnapToolbar').then(mod => ({ default: mod.ProSnapToolbar })));
const TestsModal = React.lazy(() => import('../ui/components/TestsModal').then(mod => ({ default: mod.TestsModal })));
const CursorSettingsPanel = React.lazy(() => import('../ui/CursorSettingsPanel'));
const CoordinateCalibrationOverlay = React.lazy(() => import('../ui/CoordinateCalibrationOverlay'));
const AutoSaveStatus = React.lazy(() => import('../ui/components/AutoSaveStatus').then(mod => ({ default: mod.AutoSaveStatus })));
const CentralizedAutoSaveStatus = React.lazy(() => import('../ui/components/CentralizedAutoSaveStatus').then(mod => ({ default: mod.CentralizedAutoSaveStatus })));
const OverlayProperties = React.lazy(() => import('../ui/OverlayProperties').then(mod => ({ default: mod.OverlayProperties })));
const DraggableOverlayToolbar = React.lazy(() => import('../ui/components/DraggableOverlayToolbar').then(mod => ({ default: mod.DraggableOverlayToolbar })));
const DraggableOverlayProperties = React.lazy(() => import('../ui/components/DraggableOverlayProperties').then(mod => ({ default: mod.DraggableOverlayProperties })));
// ADR-340 Phase 5-6 — floorplan background panel + dialogs
const FloorplanBackgroundPanel = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.FloorplanBackgroundPanel })));
const ReplaceConfirmDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.ReplaceConfirmDialog })));
const CalibrationDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.CalibrationDialog })));
const DxfAiChatPanel = React.lazy(() => import('../ai-assistant/components/DxfAiChatPanel'));
const ToolbarWithCursorCoordinates = React.lazy(() => import('../ui/components/ToolbarWithCursorCoordinates').then(mod => ({ default: mod.ToolbarWithCursorCoordinates })));

// Layout Components - Canvas V2
import { SidebarSection } from '../layout/SidebarSection';
import { MobileSidebarDrawer } from '../layout/MobileSidebarDrawer';
import { useResponsiveLayout } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

const MainContentSection = React.lazy(() => import('../layout/MainContentSection').then(mod => ({ default: mod.MainContentSection })));
const FloatingPanelsSection = React.lazy(() => import('../layout/FloatingPanelsSection').then(mod => ({ default: mod.FloatingPanelsSection })));

// ✅ ENTERPRISE ARCHITECTURE: Transform Context (Single Source of Truth)
import { TransformProvider } from '../contexts/TransformContext';

// 🧪 UNIFIED TEST RUNNER
import { type UnifiedTestReport } from '../debug/unified-test-runner';

// 🏢 ENTERPRISE: Performance Monitor
import { usePerformanceMonitorToggle } from '../hooks/usePerformanceMonitorToggle';
import { PerformanceCategory } from '@/core/performance/types/performance.types';
import { ClientOnlyPerformanceDashboard } from '@/core/performance/components/ClientOnlyPerformanceDashboard';

// ✅ ADR-065 SRP: Extracted hooks
import { useDxfViewerCallbacks } from './useDxfViewerCallbacks';
import { useDxfViewerEffects } from './useDxfViewerEffects';

// ✅ PERFORMANCE: Memoize the main component
export const DxfViewerContent = React.memo<DxfViewerAppProps>((props) => {
  const floatingRef = React.useRef<FloatingPanelHandle>(null);
  const state = useDxfViewerState();
  const notifications = useNotifications();
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

  // 🏢 Performance Monitor Toggle
  const { isEnabled: perfMonitorEnabled, toggle: togglePerfMonitor } = usePerformanceMonitorToggle();

  // ✅ ENTERPRISE: State Management Hooks (PHASE 4)
  const { overlayMode, overlayStatus, overlayKind, setOverlayMode, setOverlayStatus, setOverlayKind } = useOverlayState();
  const { canvasTransform, setCanvasTransform } = useCanvasTransformState({ currentScene: state.currentScene, activeTool: state.activeTool });
  const { colorMenu, openColorMenu, closeColorMenu, colorMenuRef } = useColorMenuState();

  // 🎯 Canvas visibility states
  const [dxfCanvasVisible, setDxfCanvasVisible] = React.useState(true);
  const [layerCanvasVisible, setLayerCanvasVisible] = React.useState(true);

  // Destructure state
  const {
    activeTool, handleToolChange, handleAction, showGrid, toggleGrid,
    canUndo, canRedo, snapEnabled, showLayers, showCalibration,
    showCursorSettings, showGuidePanel, showGuideAnalysisPanel,
    currentZoom, handleFileImport, currentScene, selectedEntityIds,
    setSelectedEntityIds, handleSceneChange, handleCalibrationToggle,
    drawingState, onMeasurementPoint, onMeasurementHover, onMeasurementCancel,
    onDrawingPoint, onDrawingHover, onDrawingCancel, onDrawingDoubleClick,
    onEntityCreated, gripSettings
  } = state;

  // Stores and managers
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const levelManager = useLevelManager();
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
  const contextSetTransformRef = React.useRef<((t: ViewTransform) => void) | null>(null);
  const isInitializedRef = React.useRef(false);
  const canvasTransformRef = React.useRef(canvasTransform);
  const prevGripStateRef = React.useRef<{ shouldEnableGrips: boolean } | null>(null);
  const prevPrimarySelectedIdRef = React.useRef<string | null>(null);
  const levelManagerRef = React.useRef(levelManager);
  const handleSceneChangeRef = React.useRef(handleSceneChange);

  // 🏢 Universal selection primary ID
  const primarySelectedId = universalSelection.getPrimaryId();

  // ✅ ADR-065 SRP: Extracted callbacks
  const {
    showCopyableNotification, wrappedHandleAction, handleTransformReady,
    wrappedHandleTransformChange, panToWorldOrigin, handleFileImportWithEncoding,
    handleRegionClick, nudgeSelection, selectionIdSet,
  } = useDxfViewerCallbacks({
    notifications, copyToClipboard, handleAction,
    togglePerfMonitor, perfMonitorEnabled, fullscreen,
    setTestsModalOpen, setPdfPanelOpen, setAiChatOpen,
    setCanvasTransform, contextSetTransformRef,
    currentScene, selectedEntityIds, handleSceneChange,
    handleFileImport, levelManager, overlayStore,
    universalSelection, setOverlayStatus, setOverlayKind,
    showLayers, floatingRef,
  });

  // ✅ ADR-065 SRP: Extracted effects
  useDxfViewerEffects({
    activeTool, overlayMode, currentScene, canvasTransform,
    showLayers, selectedEntityIds, primarySelectedId,
    setOverlayMode, setCanvasTransform, setSelectedEntityIds,
    handleToolChange, handleAction, handleSceneChange,
    updateGripSettings, showCopyableNotification,
    eventBus, notifications, canvasOps,
    levelManager, overlayStore, universalSelection,
    floatingRef, isInitializedRef, canvasTransformRef,
    prevGripStateRef, prevPrimarySelectedIdRef,
    levelManagerRef, handleSceneChangeRef,
  });

  // ✅ PERFORMANCE: Memoize wrappedState
  const wrappedState = React.useMemo(() => ({
    ...state,
    handleAction: wrappedHandleAction,
    onAction: wrappedHandleAction
  }), [state, wrappedHandleAction]);

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
    canvasTransform,
    onOverlaySelect: (id: string | null) => {
      if (id) {
        universalSelection.select(id, 'overlay');
      } else {
        universalSelection.clearByType('overlay');
      }
    }
  });

  // Keyboard shortcuts hook
  const { handleCanvasMouseMove } = useKeyboardShortcuts({
    selectedEntityIds, currentScene,
    onNudgeSelection: nudgeSelection,
    onColorMenuClose: closeColorMenu,
    onDrawingCancel: state.onDrawingCancel,
    activeTool, overlayMode, overlayStore
  });

  // Pointer events class for desktop layering mode
  const rootPointerEventsClass =
    layoutMode === 'desktop' && activeTool === 'layering'
      ? PANEL_LAYOUT.POINTER_EVENTS.NONE
      : PANEL_LAYOUT.POINTER_EVENTS.AUTO;

  return (
      <TransformProvider
        initialTransform={canvasTransform}
        onTransformReady={handleTransformReady}
      >
      <section
        className={`flex h-full ${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.GAP.SM} ${colors.bg.primary} ${rootPointerEventsClass}`}
      >
      {/* ✅ PHASE 5: Sidebar Section — ADR-176: Responsive */}
      {/* ADR-309 Phase 2: handleFileImportWithEncoding passed so LevelPanel can show wizard */}
      {layoutMode === 'desktop' ? (
        <SidebarSection
          floatingRef={floatingRef}
          currentScene={currentScene}
          selectedEntityIds={selectedEntityIds}
          setSelectedEntityIds={setSelectedEntityIds}
          currentZoom={currentZoom}
          activeTool={activeTool}
          onSceneImported={handleFileImportWithEncoding}
        />
      ) : (
        <MobileSidebarDrawer
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          floatingRef={floatingRef}
          currentScene={currentScene}
          selectedEntityIds={selectedEntityIds}
          setSelectedEntityIds={setSelectedEntityIds}
          currentZoom={currentZoom}
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
          canvasTransform={canvasTransform}
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
      </TransformProvider>
  );
});

export default DxfViewerContent;
