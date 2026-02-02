'use client';
import React from 'react';
import { ToolbarWithCursorCoordinates } from '../../ui/components/ToolbarWithCursorCoordinates';
import { useOverlayStore } from '../../overlays/overlay-store';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../../systems/selection';
// 🏢 ENTERPRISE (2027-01-27): Command Pattern for Undo/Redo - ADR-032
import { useCommandHistory, DeleteOverlayCommand } from '../../core/commands';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
// 🏢 ENTERPRISE (2026-02-02): Point2D REMOVED - mouseCoordinates now from CursorContext (SSoT)
import { PANEL_LAYOUT } from '../../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens
// 🏢 ADR-050: Overlay Toolbar Integration (2027-01-27)
import type { OverlayToolbarState, OverlayToolbarHandlers } from '../../ui/toolbar/overlay-section/types';
import { USE_UNIFIED_OVERLAY_TOOLBAR } from '../../config/feature-flags';

interface ToolbarSectionProps extends DXFViewerLayoutProps {
  overlayMode: OverlayEditorMode;
  setOverlayMode: (mode: OverlayEditorMode) => void;
  currentStatus: Status;
  setCurrentStatus: (status: Status) => void;
  currentKind: OverlayKind;
  setCurrentKind: (kind: OverlayKind) => void;
  // 🏢 ADR-050: Overlay section collapse state
  showOverlayToolbar?: boolean;
  isOverlaySectionCollapsed?: boolean;
  onToggleOverlaySection?: () => void;
  // 🏢 ENTERPRISE (2026-02-02): mouseCoordinates REMOVED - ToolbarStatusBar uses CursorContext (SSoT)
}

export const ToolbarSection: React.FC<ToolbarSectionProps> = (props) => {
  const {
    overlayMode,
    setOverlayMode,
    currentStatus,
    setCurrentStatus,
    currentKind,
    setCurrentKind,
    showOverlayToolbar = false,
    isOverlaySectionCollapsed = false,
    onToggleOverlaySection,
    // 🏢 ENTERPRISE (2026-02-02): mouseCoordinates REMOVED - using CursorContext (SSoT)
    ...dxfProps
  } = props;

  const overlayStore = useOverlayStore();
  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();
  // 🏢 ENTERPRISE (2027-01-27): Command Pattern for Undo/Redo - ADR-032
  const { execute } = useCommandHistory();

  const handleOverlayDuplicate = () => {
    // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
    const primarySelectedId = universalSelection.getPrimaryId();
    if (primarySelectedId) {
      overlayStore.duplicate(primarySelectedId);
    }
  };

  const handleOverlayDelete = () => {
    // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
    const primarySelectedId = universalSelection.getPrimaryId();
    if (primarySelectedId) {
      // 🏢 ENTERPRISE (2027-01-27): Use Command Pattern for undo support - ADR-032
      // ❌ OLD: overlayStore.remove(primarySelectedId); // NO UNDO SUPPORT
      // ✅ NEW: Command Pattern with full undo/redo support
      execute(new DeleteOverlayCommand(primarySelectedId, overlayStore));
    }
  };

  // 🏢 ADR-050: Prepare overlay toolbar state (only if feature flag enabled)
  const overlayToolbarState: OverlayToolbarState | undefined = (USE_UNIFIED_OVERLAY_TOOLBAR && showOverlayToolbar) ? {
    mode: overlayMode,
    currentStatus: currentStatus,
    currentKind: currentKind,
    draftPolygonInfo: {
      pointCount: 0, // Will be updated via EventBus
      canSave: false
    }
  } : undefined;

  // 🏢 ADR-050: Prepare overlay toolbar handlers (only if feature flag enabled)
  const overlayToolbarHandlers: OverlayToolbarHandlers | undefined = (USE_UNIFIED_OVERLAY_TOOLBAR && showOverlayToolbar) ? {
    onModeChange: setOverlayMode,
    onStatusChange: setCurrentStatus,
    onKindChange: setCurrentKind,
    onDuplicate: handleOverlayDuplicate,
    onDelete: handleOverlayDelete,
    onToolChange: dxfProps.onToolChange
  } : undefined;

  return (
    <div className={PANEL_LAYOUT.FLEX_SHRINK.NONE}>
      {/* 🏢 ENTERPRISE: Removed wrapper padding (PANEL_LAYOUT.SPACING.SM) - toolbar has internal padding */}
      <ToolbarWithCursorCoordinates
          activeTool={dxfProps.activeTool}
          onToolChange={dxfProps.onToolChange}
          onAction={(action, data) => {
            dxfProps.onAction(action, data);
          }}
          showGrid={dxfProps.showGrid}
          autoCrop={false}
          canUndo={dxfProps.canUndo}
          canRedo={dxfProps.canRedo}
          snapEnabled={dxfProps.snapEnabled ?? false}
          showLayers={dxfProps.showLayers}
          showCursorSettings={dxfProps.showCursorSettings}
          currentZoom={dxfProps.currentZoom}
          commandCount={0}
          onSceneImported={dxfProps.onSceneImported}
          // 🏢 ADR-050: Overlay toolbar integration (only if feature flag enabled)
          overlayToolbarState={overlayToolbarState}
          overlayToolbarHandlers={overlayToolbarHandlers}
          showOverlaySection={USE_UNIFIED_OVERLAY_TOOLBAR && showOverlayToolbar}
          selectedOverlayId={universalSelection.getPrimaryId()}
          isOverlaySectionCollapsed={isOverlaySectionCollapsed}
          onToggleOverlaySection={onToggleOverlaySection}
          // 🏢 ENTERPRISE (2026-02-02): mouseCoordinates REMOVED - ToolbarStatusBar uses CursorContext (SSoT)
          showCoordinates={true}
          // 🏢 ENTERPRISE: Removed unnecessary empty spread - all required props are passed explicitly
        />

      {/* Προσωρινά σχολιασμένο για debugging */}
      {/* <OverlayToolbar
        mode={overlayMode}
        onModeChange={setOverlayMode}
        currentStatus={currentStatus}
        onStatusChange={setCurrentStatus}
        currentKind={currentKind}
        onKindChange={setCurrentKind}
        snapEnabled={dxfProps.snapEnabled || false}
        onSnapToggle={dxfProps.onToggleSnap || (() => {})}
        selectedOverlayId={overlayStore.selectedOverlayId}
        onDuplicate={handleOverlayDuplicate}
        onDelete={handleOverlayDelete}
        canUndo={false}
        canRedo={false}
        onUndo={() => console.log('Overlay undo not yet implemented')}
        onRedo={() => console.log('Overlay redo not yet implemented')}
      /> */}
    </div>
  );
};
