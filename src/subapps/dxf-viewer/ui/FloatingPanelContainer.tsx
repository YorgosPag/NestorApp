'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_FLOATING_PANEL_CONTAINER = false;

import React, { useImperativeHandle, forwardRef } from 'react';
import { useTranslationLazy } from '../../../i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PanelTabs } from './components/PanelTabs';
// REMOVED: PropertiesPanel - καρτέλα πλέον αφαιρέθηκε εντελώς
// REMOVED: LayerManagementPanel - replaced with unified overlay system
import type { SceneModel } from '../types/scene';
import { isBimEntity, isStairEntity } from '../types/entities';
import { isWallDrawingTool } from '../systems/tools/region-tool-ids';
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
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { DxfBreadcrumb } from './components/DxfBreadcrumb';

interface FloatingPanelContainerProps {
  sceneModel: SceneModel | null;
  currentTool: ToolType;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
  // ADR-358 Phase 8 sidebar dock — scope inputs for the Properties tab.
  projectId?: string;
  floorplanId?: string;
  /** Universal-selection primary id (used by stair Properties tab). */
  primarySelectedId?: string | null;
}

const FloatingPanelContainerInner = forwardRef<FloatingPanelHandleType, FloatingPanelContainerProps>(function FloatingPanelContainer({
  sceneModel: scene,
  currentTool,
  onSceneImported,
  projectId,
  floorplanId,
  primarySelectedId,
}, ref) {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // Debug logging removed for performance - was causing excessive console output on every render
  const { t, ready, isLoading } = useTranslationLazy('dxf-viewer');

  // ✅ ΒΗΜΑ 1: Extracted state to custom hook
  const { activePanel, expandedKeys, setActivePanel, setExpandedKeys } = useFloatingPanelState();

  const { currentLevelId, setLevelScene, getLevelScene } = useLevels();

  // ✅ ΒΗΜΑ 2: Extracted layer operations to custom hook
  const layerOperations = useLayerOperations({
    scene,
    currentLevelId,
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
    expandedKeys,
    setExpandedKeys,
    layerOperations,
    onSceneImported,
    projectId,
    floorplanId,
    primarySelectedId,
  });

  // ADR-358 Phase 8 / ADR-363 Phase 4 / ADR-366 — auto-switch to the Properties
  // palette when the user selects any BIM element (industry pattern: Revit /
  // AutoCAD Properties palette pops on selection). Covers every BIM type so the
  // merged Παράμετροι/ΒΚΕ/Σχόλια/Ιστορικό sub-tabs surface for 3D selections too.
  // Stays out of the way for plain DXF/layer selections (not BIM) so the user is
  // not bounced off the Levels tab while doing layer work.
  React.useEffect(() => {
    if (!scene || !primarySelectedId) return;
    const entity = scene.entities.find((e) => e.id === primarySelectedId);
    if (!entity) return;
    if ((isBimEntity(entity) || isStairEntity(entity)) && activePanel !== 'properties') {
      setActivePanel('properties');
    }
  }, [primarySelectedId, scene, activePanel, setActivePanel]);

  // ADR-363 — auto-open the Properties palette when the user ACTIVATES the wall
  // tool (Revit «set the type, then draw»): the left panel surfaces the draft
  // wall parameters (ΣΥΝΘΕΣΗ ΣΤΡΩΣΕΩΝ) alongside the contextual ribbon tab.
  // Gated on the TRANSITION into a wall tool (prevToolRef) so a manual switch to
  // another panel WHILE the tool stays active is respected (no bounce-back).
  const prevToolRef = React.useRef<ToolType | null>(null);
  React.useEffect(() => {
    const enteredWallTool =
      isWallDrawingTool(currentTool) && !isWallDrawingTool(prevToolRef.current ?? undefined);
    prevToolRef.current = currentTool;
    if (enteredWallTool && activePanel !== 'properties') {
      setActivePanel('properties');
    }
  }, [currentTool, activePanel, setActivePanel]);

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
      <div className={`${colors.bg.card} ${colors.text.primary} ${PANEL_LAYOUT.SPACING.SM}`}>
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
    prevProps.currentTool === nextProps.currentTool &&
    prevProps.onSceneImported === nextProps.onSceneImported &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.floorplanId === nextProps.floorplanId &&
    prevProps.primarySelectedId === nextProps.primarySelectedId
  );
});