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

import React from 'react';
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
  overlayStore: {
    selectedOverlayId: string | null;
    getSelectedOverlay: () => Overlay | null;
    setSelectedOverlay: (id: string | null) => void;
    update: (id: string, updates: Partial<Overlay>) => void;
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
      {((activeTool === 'layering' ||
        (activeTool === 'polyline' && overlayMode === 'draw')) ||
        overlayStore.getSelectedOverlay()) && (
        <DraggableOverlayToolbar
          mode={overlayMode}
          onModeChange={setOverlayMode}
          currentStatus={overlayStatus}
          onStatusChange={setOverlayStatus}
          currentKind={overlayKind}
          onKindChange={setOverlayKind}
          snapEnabled={snapEnabled}
          onSnapToggle={() => handleAction('toggle-snap')}
          selectedOverlayId={overlayStore.selectedOverlayId}
          onDuplicate={() => {}}
          onDelete={() => {}}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => handleAction('undo')}
          onRedo={() => handleAction('redo')}
          onToolChange={handleToolChange}
        />
      )}

      {/* DRAGGABLE OVERLAY PROPERTIES */}
      {overlayStore.getSelectedOverlay() && (
        <DraggableOverlayProperties
          overlay={overlayStore.getSelectedOverlay()}
          onUpdate={(overlayId, updates) =>
            overlayStore.update(overlayId, updates)
          }
          onClose={() => {
            overlayStore.setSelectedOverlay(null);
          }}
        />
      )}

      {/* PROFESSIONAL LAYOUT DEBUG SYSTEM */}
      {isFeatureEnabled('LAYOUT_DEBUG_SYSTEM') && <LazyFullLayoutDebug />}

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
