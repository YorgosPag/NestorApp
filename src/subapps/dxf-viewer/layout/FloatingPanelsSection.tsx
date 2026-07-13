/**
 * FloatingPanelsSection - Enterprise-Grade Floating Panels Container
 *
 * ENTERPRISE FEATURES:
 * - ✅ React.memo for performance optimization
 * - ✅ Conditional rendering with type-safe logic
 * - ✅ ColorManager, Settings panels, Draggable toolbars
 * - ✅ Layout debug system integration
 * - ✅ Test results modal
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { SceneModel } from '../types/scene';
import type { OverlayEditorMode, OverlayKind, Status, Overlay, UpdateOverlayData } from '../overlays/types';
import type { ToolType } from '../ui/toolbar/types';
import { ColorManager } from '../ui/components/ColorManager';
import { TextOverrideDialog } from '../ui/panels/dimensions/TextOverrideDialog';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
// ADR-189 §4.13: Guide Panel
import { GuidePanel } from '../ui/panels/guide-panel';
// Block Library M1 — «Τα Blocks μου» palette + επιλογή SSoT (palette → placement tool).
import { BlockLibraryPanel } from '../ui/panels/block-library';
import { setSelectedBlockName } from '../bim/block-library/block-library-selection-store';
// ADR-654 — «Έπιπλα Κάτοψης» palette (mirror of Block Library M1 above): selection is
// stored inside the panel itself (furniture-plan-selection-store), so it only needs a
// post-selection callback to activate the placement tool.
import { FurniturePlanPanel } from '../ui/panels/furniture-plan';
// ADR-189: Guide Analysis Panel (10 services → 4 tabs)
import { GuideAnalysisPanel } from '../ui/panels/guide-analysis-panel';
import CoordinateCalibrationOverlay from '../ui/CoordinateCalibrationOverlay';
import { DraggableOverlayToolbar } from '../ui/components/DraggableOverlayToolbar';
import { DraggableOverlayProperties } from '../ui/components/DraggableOverlayProperties';
import { TestResultsModal } from '../debug/TestResultsModal';
import type { UnifiedTestReport } from '../debug/unified-test-runner';
import { isFeatureEnabled } from '../config/experimental-features';
import { LazyFullLayoutDebug } from '../ui/components/LazyLoadWrapper';
// ADR-532 Stage B: overlay-only leaf subscription (re-renders on overlay-selection
// change, NOT on dxf-entity clicks) + imperative store for mutations.
import { useSelectionByType, SelectedEntitiesStore } from '../systems/selection';
// 🏢 ENTERPRISE (2026-01-26): Event Bus for delete command to CanvasSection - ADR-032
import { useEventBus } from '../systems/events';
// 🏢 ENTERPRISE (2027-01-27): ADR-050 - Hide floating toolbar when unified toolbar is enabled
import { USE_UNIFIED_OVERLAY_TOOLBAR } from '../config/feature-flags';
// ADR-176: Responsive layout
import { useResponsiveLayout } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';
import { MobilePanelManager } from './MobilePanelManager';

// ✅ ENTERPRISE: Type-safe props interface
interface FloatingPanelsSectionProps {
  // Color Menu
  colorMenu: { open: boolean; x: number; y: number; ids: string[] };
  currentScene: SceneModel | null;
  handleSceneChange: (scene: SceneModel) => void;
  closeColorMenu: () => void;
  floatingRef: React.RefObject<FloatingPanelHandle>;

  // Settings Panels
  showCursorSettings: boolean;
  showCalibration: boolean;
  showGuidePanel: boolean;
  showGuideAnalysisPanel: boolean;
  showBlockLibraryPanel: boolean;
  /** ADR-654 — «Έπιπλα Κάτοψης» palette visibility (mirror of showBlockLibraryPanel). */
  showFurniturePlanPanel: boolean;
  /** ADR-652 M3 — ενεργό έργο· χωρίς αυτό δεν προσφέρεται δημοσίευση block σε scope «έργου». */
  projectId?: string;
  handleAction: (action: string) => void;

  // Overlay Toolbar
  activeTool: ToolType;
  overlayMode: OverlayEditorMode;
  overlayStatus: Status;
  overlayKind: OverlayKind;
  setOverlayMode: (mode: OverlayEditorMode) => void;
  setOverlayStatus: (status: Status) => void;
  setOverlayKind: (kind: OverlayKind) => void;
  snapEnabled: boolean;
  handleToolChange: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;

  // Overlay Store
  // 🏢 ENTERPRISE (2026-01-25): Selection REMOVED - ADR-030
  // Selection is now handled by useUniversalSelection() from systems/selection/
  overlayStore: {
    update: (id: string, updates: UpdateOverlayData) => void;
    overlays: Record<string, Overlay>;
  };

  isFullscreen?: boolean;

  // Test Modal
  testModalOpen: boolean;
  setTestModalOpen: (open: boolean) => void;
  testReport: UnifiedTestReport | null;
  formattedTestReport: string;
}

/**
 * Container for all floating panels and overlays
 *
 * @param props - Floating panels configuration and callbacks
 * @returns Rendered floating panels section
 */
export const FloatingPanelsSection = React.memo<FloatingPanelsSectionProps>(({
  colorMenu,
  currentScene,
  handleSceneChange,
  closeColorMenu,
  floatingRef,
  showCursorSettings,
  showCalibration,
  showGuidePanel,
  showGuideAnalysisPanel,
  showBlockLibraryPanel,
  showFurniturePlanPanel,
  projectId,
  handleAction,
  activeTool,
  overlayMode,
  overlayStatus,
  overlayKind,
  setOverlayMode,
  setOverlayStatus,
  setOverlayKind,
  snapEnabled,
  handleToolChange,
  canUndo,
  canRedo,
  overlayStore,
  isFullscreen = false,
  testModalOpen,
  setTestModalOpen,
  testReport,
  formattedTestReport,
}) => {
  // ADR-176: Responsive layout detection
  const { layoutMode } = useResponsiveLayout();

  // 🏢 ENTERPRISE: Local state for panel visibility
  const [showOverlayToolbar, setShowOverlayToolbar] = useState(true);

  // ADR-532 Stage B: overlay-only subscription (this panel only cares about the
  // overlay selection — dxf-entity clicks must not re-render it).
  const overlayIds = useSelectionByType('overlay');

  // 🏢 Type-safe overlay selection — only overlay IDs, not dxf-entities
  const selectedOverlayId = overlayIds[0] ?? null;
  const selectedOverlay = selectedOverlayId ? overlayStore.overlays[selectedOverlayId] ?? null : null;

  // 🏢 ENTERPRISE (2026-01-26): Event Bus for delete command - ADR-032
  const eventBus = useEventBus();

  // 🏢 ADR-258B: Auto-select new overlay after polygon save → opens Properties Panel
  useEffect(() => {
    const cleanup = eventBus.on('overlay:polygon-saved', ({ overlayId }) => {
      // handleOverlaySelect(id) parity: select the single overlay (mirror applied
      // by the store-owned legacy sink — ADR-532 Stage B).
      SelectedEntitiesStore.selectEntity({ id: overlayId, type: 'overlay' });
    });
    return cleanup;
  }, [eventBus]);

  // 🏢 ENTERPRISE (2026-01-26): Smart Delete Handler - ADR-032
  // Emits event to CanvasSection which has access to selectedGrips state
  // CanvasSection's handleSmartDelete handles grips + overlays with undo/redo
  const handleDelete = () => {
    eventBus.emit('toolbar:delete', undefined as unknown as void);
  };

  // ADR-176: On mobile/tablet, use MobilePanelManager instead of floating panels
  if (layoutMode !== 'desktop') {
    return (
      <MobilePanelManager
        colorMenu={colorMenu}
        currentScene={currentScene}
        handleSceneChange={handleSceneChange}
        closeColorMenu={closeColorMenu}
        floatingRef={floatingRef}
        showCursorSettings={showCursorSettings}
        handleAction={handleAction}
        testModalOpen={testModalOpen}
        setTestModalOpen={setTestModalOpen}
        testReport={testReport}
        formattedTestReport={formattedTestReport}
      />
    );
  }

  return (
    <>
      {/* COLOR MANAGER */}
      <ColorManager
        colorMenu={colorMenu}
        currentScene={currentScene}
        onSceneChange={handleSceneChange}
        onColorMenuClose={closeColorMenu}
        onExpandForSelection={(ids, scene) =>
          floatingRef.current?.expandForSelection(ids, scene)
        }
      />

      {/* CURSOR SETTINGS PANEL */}
      {showCursorSettings && (
        <CursorSettingsPanel
          isVisible={showCursorSettings}
          onClose={() => handleAction('toggle-cursor-settings')}
        />
      )}

      {/* ADR-189 §4.13: GUIDE PANEL */}
      {showGuidePanel && (
        <GuidePanel
          isVisible={showGuidePanel}
          onClose={() => handleAction('toggle-guide-panel')}
        />
      )}

      {/* Block Library: palette (session + βιβλιοθήκη + έτοιμο περιεχόμενο). Επιλογή κάρτας →
          set selection + activate placement tool· η επόμενη κλικ στον καμβά τοποθετεί το block.
          M3: το `projectId` ξεκλειδώνει τη δημοσίευση σε scope «έργου». */}
      {showBlockLibraryPanel && (
        <BlockLibraryPanel
          isVisible={showBlockLibraryPanel}
          onClose={() => handleAction('toggle-block-library-panel')}
          projectId={projectId}
          onSelectBlock={(name) => {
            setSelectedBlockName(name);
            handleToolChange('block-library');
          }}
        />
      )}

      {/* ADR-654: FURNITURE PLAN PANEL — top-view furniture entourage palette (mirror
          of the Block Library panel above). Selection store lives inside the panel;
          onSelect activates the placement tool once the card resolve completes. */}
      {showFurniturePlanPanel && (
        <FurniturePlanPanel
          isVisible={showFurniturePlanPanel}
          onClose={() => handleAction('toggle-furniture-plan-panel')}
          onSelect={() => handleToolChange('furniture-plan')}
        />
      )}

      {/* ADR-189: GUIDE ANALYSIS PANEL (10 services → 4 tabs) */}
      {showGuideAnalysisPanel && (
        <GuideAnalysisPanel
          isVisible={showGuideAnalysisPanel}
          onClose={() => handleAction('toggle-guide-analysis-panel')}
        />
      )}

      {/* CALIBRATION PANEL */}
      {showCalibration && (
        <CoordinateCalibrationOverlay
          show={showCalibration}
          onToggle={() => handleAction('toggle-calibration')}
          mousePos={null}
          worldPos={null}
        />
      )}

      {/* DRAGGABLE OVERLAY TOOLBAR */}
      {/* 🏢 ADR-050: Hide floating toolbar when unified toolbar is enabled */}
      {showOverlayToolbar && !USE_UNIFIED_OVERLAY_TOOLBAR && (
        <DraggableOverlayToolbar
          mode={overlayMode}
          onModeChange={setOverlayMode}
          currentStatus={overlayStatus}
          onStatusChange={setOverlayStatus}
          currentKind={overlayKind}
          onKindChange={setOverlayKind}
          snapEnabled={snapEnabled}
          onSnapToggle={() => handleAction('toggle-snap')}
          selectedOverlayId={selectedOverlayId}
          onDuplicate={() => {}}
          onDelete={handleDelete}
          canDelete={SelectedEntitiesStore.countByType('overlay') > 0 || SelectedEntitiesStore.countByType('dxf-entity') > 0}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => handleAction('undo')}
          onRedo={() => handleAction('redo')}
          onToolChange={handleToolChange}
          onClose={() => setShowOverlayToolbar(false)}
        />
      )}

      {/* DRAGGABLE OVERLAY PROPERTIES - Fullscreen only (sidebar panel handles normal mode) */}
      {isFullscreen && (
        <DraggableOverlayProperties
          overlay={selectedOverlay}
          overlays={overlayStore.overlays}
          onUpdate={(overlayId, updates) =>
            overlayStore.update(overlayId, updates)
          }
          onClose={() => {
            SelectedEntitiesStore.clearByType('overlay');
          }}
        />
      )}

      {/* PROFESSIONAL LAYOUT DEBUG SYSTEM — gated by its OWN dedicated flag
          (was mis-wired to ENTERPRISE_SETTINGS_SHADOW_MODE → shipped to everyone +
          ran a per-mousemove debug overlay; ADR-040 cursor-lag Φ7). */}
      {isFeatureEnabled('LAYOUT_DEBUG_SYSTEM') && <LazyFullLayoutDebug />}

      {/* TEST RESULTS MODAL */}
      <TestResultsModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        report={testReport}
        formattedReport={formattedTestReport}
      />
      <TextOverrideDialog />
    </>
  );
});

// ✅ ENTERPRISE: Display name for debugging
FloatingPanelsSection.displayName = 'FloatingPanelsSection';
