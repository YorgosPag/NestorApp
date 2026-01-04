/**
 * USEPANELCONTENTRENDERER HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 5 refactoring
 * Panel content rendering logic
 */

import React from 'react';
import { LazyPanelWrapper } from '../components/shared';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// ✅ CENTRALIZED: Use existing LazyLoadWrapper system instead of duplicate React.lazy
import {
  LazyAdminLayerManager as AdminLayerManager,
  LazyLevelPanel as LevelPanel,
  LazyHierarchyDebugPanel as HierarchyDebugPanel,
  LazyColorPalettePanel as ColorPalettePanel,
} from '../components/LazyLoadWrapper';

// EntitiesSettings removed - content moved to colors panel
import type { SceneModel } from '../../types/scene';
import type { ToolType } from '../toolbar/types';
import type { PanelType } from './useFloatingPanelState';
import type { LayerOperationsCallbacks } from './useLayerOperations';

interface UsePanelContentRendererParams {
  activePanel: PanelType;
  scene: SceneModel | null;
  currentTool: ToolType;
  selectedEntityIds: string[];
  onEntitySelect: (ids: string[]) => void;
  expandedKeys: Set<string>;
  setExpandedKeys: (keys: Set<string>) => void;
  layerOperations: LayerOperationsCallbacks;
}

/**
 * Custom hook για το rendering του panel content στο FloatingPanelContainer
 * Εξαγωγή από FloatingPanelContainer.tsx για καλύτερη οργάνωση
 */
export function usePanelContentRenderer({
  activePanel,
  scene,
  currentTool,
  selectedEntityIds,
  onEntitySelect,
  expandedKeys,
  setExpandedKeys,
  layerOperations
}: UsePanelContentRendererParams) {
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'overlay':
        // ✅ ENTERPRISE: Χρήση κεντρικοποιημένων tokens αντί hardcoded values
        return (
          <div className={PANEL_LAYOUT.CONTAINER.SECTION_SPACING}>
            <LazyPanelWrapper loadingText="Φόρτωση διαχείρισης επιπέδων...">
              <AdminLayerManager className={`${colors.bg.secondary} ${quick.card} ${PANEL_LAYOUT.CONTAINER.INNER_PADDING}`} />
            </LazyPanelWrapper>
          </div>
        );

      case 'levels':
        // ✅ ENTERPRISE: Αφαίρεση περιττού κενού <div> wrapper (ADR-003 Container Nesting)
        return (
          <LazyPanelWrapper loadingText="Φόρτωση επιπέδων...">
            <LevelPanel
              currentTool={currentTool}
              scene={scene}
              selectedEntityIds={selectedEntityIds}
              onEntitySelect={onEntitySelect}
              expandedKeys={expandedKeys}
              onExpandChange={setExpandedKeys}
              onLayerToggle={layerOperations.handleLayerToggle}
              onLayerDelete={layerOperations.handleLayerDelete}
              onLayerColorChange={layerOperations.handleLayerColorChange}
              onLayerRename={layerOperations.handleLayerRename}
              onLayerCreate={layerOperations.handleLayerCreate}
              onEntityToggle={layerOperations.handleEntityToggle}
              onEntityDelete={layerOperations.handleEntityDelete}
              onEntityColorChange={layerOperations.handleEntityColorChange}
              onEntityRename={layerOperations.handleEntityRename}
              onColorGroupToggle={layerOperations.handleColorGroupToggle}
              onColorGroupDelete={layerOperations.handleColorGroupDelete}
              onColorGroupColorChange={layerOperations.handleColorGroupColorChange}
              onEntitiesMerge={layerOperations.handleEntitiesMerge}
              onLayersMerge={layerOperations.handleLayersMerge}
              onColorGroupsMerge={layerOperations.handleColorGroupsMerge}
              onToolChange={(tool) => {
                window.dispatchEvent(new CustomEvent('level-panel:tool-change', { detail: tool }));
              }}
            />
          </LazyPanelWrapper>
        );

      case 'hierarchy':
        // ✅ ENTERPRISE: Αφαίρεση περιττού κενού <div> wrapper (ADR-003 Container Nesting)
        return (
          <LazyPanelWrapper loadingText="Φόρτωση ιεραρχίας...">
            <HierarchyDebugPanel />
          </LazyPanelWrapper>
        );

      // 🏢 ENTERPRISE: 'layers' case removed - not in FloatingPanelType
      // See types/panel-types.ts for valid panel types

      case 'colors':
        // ✅ ENTERPRISE: Αφαίρεση περιττού κενού <div> wrapper (ADR-003 Container Nesting)
        return (
          <LazyPanelWrapper loadingText="Φόρτωση παλέτας χρωμάτων...">
            <ColorPalettePanel />
          </LazyPanelWrapper>
        );

      // canvas case removed - merged into colors panel

      default:
        return (
          <div className={`${colors.text.muted} text-center py-8`}>
            <p>Επιλέξτε ένα panel από τις καρτέλες</p>
          </div>
        );
    }
  };

  return { renderPanelContent };
}