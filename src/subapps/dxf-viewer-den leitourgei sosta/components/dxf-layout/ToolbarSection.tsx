'use client';
import React from 'react';
import { EnhancedDXFToolbar } from '../../ui/toolbar/EnhancedDXFToolbar';
import { useOverlayStore } from '../../overlays/overlay-store';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';

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

  const handleOverlayDuplicate = () => {
    if (overlayStore.selectedOverlayId) {
      overlayStore.duplicate(overlayStore.selectedOverlayId);
    }
  };

  const handleOverlayDelete = () => {
    if (overlayStore.selectedOverlayId) {
      overlayStore.remove(overlayStore.selectedOverlayId);
    }
  };

  return (
    <div className="flex-shrink-0">
      <div className="p-2">
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
          snapEnabled={dxfProps.snapEnabled}
          showLayers={dxfProps.showLayers}
          showCalibration={dxfProps.showCalibration}
          showCursorSettings={dxfProps.showCursorSettings}
          currentZoom={dxfProps.currentZoom}
          commandCount={0}
          onSceneImported={dxfProps.handleFileImport}
        />
      </div>

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
