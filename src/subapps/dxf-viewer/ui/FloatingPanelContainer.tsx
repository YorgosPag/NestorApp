'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_FLOATING_PANEL_CONTAINER = false;

import React, { useImperativeHandle, forwardRef } from 'react';
import { useTranslationLazy } from '../../../i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PanelTabs } from './components/PanelTabs';
// REMOVED: PropertiesPanel - καρτέλα πλέον αφαιρέθηκε εντελώς
import { useOverlayManager } from '../state/overlay-manager';
import { StorageStatus } from '../components/StorageStatus';
// REMOVED: LayerManagementPanel - replaced with unified overlay system
import { AutoSaveStatus } from './components/AutoSaveStatus';
import { CentralizedAutoSaveStatus } from './components/CentralizedAutoSaveStatus';
import type { SceneModel } from '../types/scene';
import type { ToolType } from '../ui/toolbar/types';
import { useLevels } from '../systems/levels';
import { useFloatingPanelState, type PanelType } from './hooks/useFloatingPanelState';
import { useLayerOperations } from './hooks/useLayerOperations';
import { useFloatingPanelHandle, type SideTab, type FloatingPanelHandle as FloatingPanelHandleType } from './hooks/useFloatingPanelHandle';

// Re-export FloatingPanelHandle type
export type { FloatingPanelHandleType as FloatingPanelHandle };
import { usePanelNavigation } from './hooks/usePanelNavigation';
import { usePanelContentRenderer } from './hooks/usePanelContentRenderer';
import { usePanelDescription } from './hooks/usePanelDescription';

interface FloatingPanelContainerProps {
  sceneModel: SceneModel | null;
  selectedEntityIds: string[];
  onEntitySelect: (ids: string[]) => void;
  zoomLevel: number;
  currentTool: ToolType;
}

const FloatingPanelContainerInner = forwardRef<FloatingPanelHandleType, FloatingPanelContainerProps>(function FloatingPanelContainer({
  sceneModel: scene,
  selectedEntityIds,
  onEntitySelect,
  zoomLevel,
  currentTool
}, ref) {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // Debug logging removed for performance - was causing excessive console output on every render
  const { t, ready, isLoading } = useTranslationLazy('dxf-viewer');

  // ✅ ΒΗΜΑ 1: Extracted state to custom hook
  const { activePanel, expandedKeys, setActivePanel, setExpandedKeys } = useFloatingPanelState();

  const overlayManager = useOverlayManager();
  const selectedRegions = overlayManager?.selectedRegionIds || [];
  const visibleRegions = overlayManager?.visibleRegions || [];

  const { currentLevelId, setLevelScene, getLevelScene } = useLevels();

  // ✅ ΒΗΜΑ 2: Extracted layer operations to custom hook
  const layerOperations = useLayerOperations({
    scene,
    currentLevelId,
    selectedEntityIds,
    onEntitySelect,
    setLevelScene
  });

  // ✅ ΒΗΜΑ 3: Extracted imperative handle to custom hook
  const handleMethods = useFloatingPanelHandle({
    expandedKeys,
    setActivePanel,
    setExpandedKeys
  });

  // ✅ ΒΗΜΑ 4: Extracted panel navigation to custom hook
  const panelNavigation = usePanelNavigation({
    setActivePanel
  });

  // ✅ ΒΗΜΑ 5: Extracted panel content rendering to custom hook
  const { renderPanelContent } = usePanelContentRenderer({
    activePanel,
    scene,
    currentTool,
    selectedEntityIds,
    onEntitySelect,
    expandedKeys,
    setExpandedKeys,
    layerOperations
  });

  // ✅ ΒΗΜΑ 6: Extracted panel description logic to custom hook
  const { description, zoomText } = usePanelDescription({
    activePanel,
    visibleRegions,
    zoomLevel
  });

  // Imperative handle for parent control
  useImperativeHandle(ref, () => handleMethods, [handleMethods]);

  // Don't render panels until translations are ready
  if (isLoading) {
    return (
      <div className={`fixed right-4 top-4 ${colors.bg.overlay} backdrop-blur-sm ${quick.card} ${getStatusBorder('default')} shadow-xl w-80`}>
        <div className={`p-4 text-center ${colors.text.muted}`}>
          Loading translations...
        </div>
      </div>
    );
  }

  // Throttled logging for dev - reduce spam
  if (process.env.NODE_ENV === 'development') {
    const now = Date.now();
    (window as Window & { _glog?: { t: number } })._glog ??= { t: 0 };
    if (now - ((window as Window & { _glog?: { t: number } })._glog?.t || 0) > 1000) {

      if ((window as Window & { _glog?: { t: number } })._glog) {
        ((window as unknown) as Window & { _glog: { t: number } })._glog.t = now;
      }
    }
  }

  return (
    <div className={`w-96 h-full flex flex-col ${colors.bg.primary} ${quick.card} relative`}>
      <div className={`flex-shrink-0 ${colors.bg.primary} ${quick.card} ${getStatusBorder('default')}`}>
        <PanelTabs
          activePanel={activePanel}
          onTabClick={panelNavigation.handleTabClick}
          disabledPanels={panelNavigation.getDisabledPanels()}
          isCollapsed={false}
        />
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto ${colors.bg.primary} ${colors.text.primary} py-4 px-2`}>
        <div className="w-[368px]">
          {renderPanelContent()}
        </div>
      </div>

      {/* STATUS BAR ΜΕΤΑΚΙΝΗΘΗΚΕ ΣΤΟ ΑΡΙΣΤΕΡΟ CONTAINER */}

    </div>
  );
});

// Memoize the component to prevent unnecessary re-renders
export const FloatingPanelContainer = React.memo(FloatingPanelContainerInner, (prevProps, nextProps) => {
  // Custom comparison for performance optimization
  return (
    prevProps.sceneModel === nextProps.sceneModel &&
    prevProps.selectedEntityIds.length === nextProps.selectedEntityIds.length &&
    prevProps.selectedEntityIds.every((id, index) => id === nextProps.selectedEntityIds[index]) &&
    prevProps.onEntitySelect === nextProps.onEntitySelect &&
    prevProps.zoomLevel === nextProps.zoomLevel &&
    prevProps.currentTool === nextProps.currentTool
  );
});