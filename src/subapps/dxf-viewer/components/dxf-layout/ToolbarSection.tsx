'use client';
import React from 'react';
import { EnhancedDXFToolbar } from '../../ui/toolbar/EnhancedDXFToolbar';
import { useOverlayStore } from '../../overlays/overlay-store';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../../systems/selection';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens

interface ToolbarSectionProps extends DXFViewerLayoutProps {
  overlayMode: OverlayEditorMode;
  setOverlayMode: (mode: OverlayEditorMode) => void;
  currentStatus: Status;
  setCurrentStatus: (status: Status) => void;
  currentKind: OverlayKind;
  setCurrentKind: (kind: OverlayKind) => void;
}

export const ToolbarSection: React.FC<ToolbarSectionProps> = (props) => {
  const {
    overlayMode,
    setOverlayMode,
    currentStatus,
    setCurrentStatus,
    currentKind,
    setCurrentKind,
    ...dxfProps
  } = props;
  
  const overlayStore = useOverlayStore();
  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();

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
      overlayStore.remove(primarySelectedId);
    }
  };

  return (
    <div className={PANEL_LAYOUT.FLEX_SHRINK.NONE}>
      {/* 🏢 ENTERPRISE: Removed wrapper padding (PANEL_LAYOUT.SPACING.SM) - toolbar has internal padding */}
      <EnhancedDXFToolbar
          activeTool={dxfProps.activeTool}
          onToolChange={dxfProps.onToolChange}
          onAction={(action, data) => {
            console.log('🔧 ToolbarSection onAction called:', { action, data }); // DEBUG
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
