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
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
// ADR-189 §4.13: Guide Panel
import { GuidePanel } from '../ui/panels/guide-panel';
// ADR-189: Guide Analysis Panel (10 services → 4 tabs)
import { GuideAnalysisPanel } from '../ui/panels/guide-analysis-panel';
import CoordinateCalibrationOverlay from '../ui/CoordinateCalibrationOverlay';
import { DraggableOverlayToolbar } from '../ui/components/DraggableOverlayToolbar';
import { DraggableOverlayProperties } from '../ui/components/DraggableOverlayProperties';
import { TestResultsModal } from '../debug/TestResultsModal';
import type { UnifiedTestReport } from '../debug/unified-test-runner';
import { isFeatureEnabled } from '../config/experimental-features';
import { LazyFullLayoutDebug } from '../ui/components/LazyLoadWrapper';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../systems/selection';
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
  testModalOpen,
  setTestModalOpen,
  testReport,
  formattedTestReport,
}) => {
  // ADR-176: Responsive layout detection
  const { layoutMode } = useResponsiveLayout();

  // 🏢 ENTERPRISE: Local state for panel visibility
  const [showOverlayToolbar, setShowOverlayToolbar] = useState(true);

  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();

  // 🏢 Type-safe overlay selection — only overlay IDs, not dxf-entities
  const selectedOverlayId = universalSelection.getIdsByType('overlay')[0] ?? null;
  const selectedOverlay = selectedOverlayId ? overlayStore.overlays[selectedOverlayId] ?? null : null;

  // 🏢 ENTERPRISE (2026-01-26): Event Bus for delete command - ADR-032
  const eventBus = useEventBus();

  // 🏢 ADR-258B: Auto-select new overlay after polygon save → opens Properties Panel
  useEffect(() => {
    const cleanup = eventBus.on('overlay:polygon-saved', ({ overlayId }) => {
      universalSelection.select(overlayId, 'overlay');
    });
    return cleanup;
  }, [eventBus, universalSelection]);

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
          canDelete={universalSelection.getByType('overlay').length > 0 || universalSelection.getByType('dxf-entity').length > 0}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => handleAction('undo')}
          onRedo={() => handleAction('redo')}
          onToolChange={handleToolChange}
          onClose={() => setShowOverlayToolbar(false)}
        />
      )}

      {/* DRAGGABLE OVERLAY PROPERTIES - Only when overlay is selected */}
      {/* 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030 */}
      <DraggableOverlayProperties
        overlay={selectedOverlay}
        overlays={overlayStore.overlays}
        onUpdate={(overlayId, updates) =>
          overlayStore.update(overlayId, updates)
        }
        onClose={() => {
          // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
          universalSelection.clearByType('overlay');
        }}
      />

      {/* PROFESSIONAL LAYOUT DEBUG SYSTEM */}
      {isFeatureEnabled('ENTERPRISE_SETTINGS_SHADOW_MODE') && <LazyFullLayoutDebug />}

      {/* TEST RESULTS MODAL */}
      <TestResultsModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        report={testReport}
        formattedReport={formattedTestReport}
      />
    </>
  );
});

// ✅ ENTERPRISE: Display name for debugging
FloatingPanelsSection.displayName = 'FloatingPanelsSection';
