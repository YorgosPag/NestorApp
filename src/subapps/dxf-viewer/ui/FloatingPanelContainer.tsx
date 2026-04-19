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
// REMOVED: LayerManagementPanel - replaced with unified overlay system
import type { SceneModel } from '../types/scene';
import type { ToolType } from '../ui/toolbar/types';
import type { DxfSaveContext } from '../services/dxf-firestore.service';
import { useLevels } from '../systems/levels';
import { useFloatingPanelState } from './hooks/useFloatingPanelState';
import { useLayerOperations } from './hooks/useLayerOperations';
import { useFloatingPanelHandle, type FloatingPanelHandle as FloatingPanelHandleType } from './hooks/useFloatingPanelHandle';

// Re-export FloatingPanelHandle type
export type { FloatingPanelHandleType as FloatingPanelHandle };
import { usePanelNavigation } from './hooks/usePanelNavigation';
import { usePanelContentRenderer } from './hooks/usePanelContentRenderer';
import { usePanelDescription } from './hooks/usePanelDescription';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { DxfBreadcrumb } from './components/DxfBreadcrumb';

interface FloatingPanelContainerProps {
  sceneModel: SceneModel | null;
  selectedEntityIds: string[];
  onEntitySelect: (ids: string[]) => void;
  zoomLevel: number;
  currentTool: ToolType;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
}

const FloatingPanelContainerInner = forwardRef<FloatingPanelHandleType, FloatingPanelContainerProps>(function FloatingPanelContainer({
  sceneModel: scene,
  selectedEntityIds,
  onEntitySelect,
  zoomLevel,
  currentTool,
  onSceneImported,
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
    layerOperations,
    onSceneImported,
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
      <div className={`fixed ${PANEL_LAYOUT.POSITION.RIGHT_4} ${PANEL_LAYOUT.POSITION.TOP_4} ${colors.bg.overlay} backdrop-blur-sm ${quick.card} ${getStatusBorder('default')} ${PANEL_LAYOUT.SHADOW.XL} ${PANEL_LAYOUT.WIDTH.PANEL_SM}`}>
        <div className={`${PANEL_LAYOUT.SPACING.LG} text-center ${colors.text.muted}`}>
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
    // 🏢 ENTERPRISE: bg.card for consistency with ListCard backgrounds
    // 🧪 TEST: Removed quick.card to hide outer border
    <div className={`${PANEL_LAYOUT.WIDTH.PANEL_LG} flex flex-col ${colors.bg.card} rounded-lg relative`}>
      {/* 🏢 ENTERPRISE: Breadcrumb — Ιεραρχία τοποθεσίας σχεδίου (Εταιρεία → Έργο → Κτίριο → Όροφος) */}
      <DxfBreadcrumb />
      {/* 🏢 ENTERPRISE: Only bottom border on tabs container (quick.borderB) */}
      <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${colors.bg.card} ${quick.borderB}`}>
        <PanelTabs
          activePanel={activePanel}
          onTabClick={panelNavigation.handleTabClick}
          disabledPanels={panelNavigation.getDisabledPanels()}
          isCollapsed={false}
        />
      </div>

      {/* ✅ ENTERPRISE: Centralized spacing from PANEL_LAYOUT (ADR-003) */}
      {/* 🏢 ENTERPRISE: bg.card for consistency with ListCard backgrounds */}
      <div className={`${colors.bg.card} ${colors.text.primary} ${PANEL_LAYOUT.CONTAINER.PADDING}`}>
        {renderPanelContent()}
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
    prevProps.currentTool === nextProps.currentTool &&
    prevProps.onSceneImported === nextProps.onSceneImported
  );
});