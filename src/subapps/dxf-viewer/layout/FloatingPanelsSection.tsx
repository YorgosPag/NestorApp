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

import React, { useState } from 'react';
import { UI_COLORS } from '../config/color-config';
import type { SceneModel } from '../types/scene';
import type { OverlayEditorMode, OverlayKind, Status, Overlay } from '../overlays/types';
import type { ToolType } from '../ui/toolbar/types';
import { ColorManager } from '../ui/components/ColorManager';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
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

// ✅ ENTERPRISE: Type-safe props interface
interface FloatingPanelsSectionProps {
  // Color Menu
  colorMenu: { open: boolean; x: number; y: number; ids: string[] };
  currentScene: SceneModel | null;
  handleSceneChange: (scene: SceneModel) => void;
  closeColorMenu: () => void;
  floatingRef: React.RefObject<any>;

  // Settings Panels
  showCursorSettings: boolean;
  showCalibration: boolean;
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
    update: (id: string, updates: Partial<Overlay>) => void;
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
  // 🏢 ENTERPRISE: Local state for panel visibility
  const [showOverlayToolbar, setShowOverlayToolbar] = useState(true);

  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();

  // 🏢 ENTERPRISE (2026-01-26): Event Bus for delete command - ADR-032
  const eventBus = useEventBus();

  // 🏢 ENTERPRISE (2026-01-26): Smart Delete Handler - ADR-032
  // Emits event to CanvasSection which has access to selectedGrips state
  // CanvasSection's handleSmartDelete handles grips + overlays with undo/redo
  const handleDelete = () => {
    eventBus.emit('toolbar:delete', undefined as unknown as void);
  };

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
          selectedOverlayId={universalSelection.getPrimaryId()}
          onDuplicate={() => {}}
          onDelete={handleDelete}
          canDelete={universalSelection.getByType('overlay').length > 0}
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
        overlay={universalSelection.getPrimaryId() ? overlayStore.overlays[universalSelection.getPrimaryId()!] ?? null : null}
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
