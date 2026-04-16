// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
/**
 * USEPANELCONTENTRENDERER HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 5 refactoring
 * Panel content rendering logic
 */

import React from 'react';
// 🏢 ENTERPRISE: Unified EventBus for type-safe event dispatch
import { EventBus } from '../../systems/events';
import { LazyPanelWrapper } from '../components/shared';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';

// ✅ CENTRALIZED: Use existing LazyLoadWrapper system instead of duplicate React.lazy
// ADR-309 Phase 1: LazyHierarchyDebugPanel removed (hierarchy tab eliminated)
import {
  LazyLevelPanel as LevelPanel,
  LazyColorPalettePanel as ColorPalettePanel,
} from '../components/LazyLoadWrapper';

// EntitiesSettings removed - content moved to colors panel
import type { SceneModel } from '../../types/scene';
import type { ToolType } from '../toolbar/types';
import type { PanelType } from './useFloatingPanelState';
import type { LayerOperationsCallbacks } from './useLayerOperations';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';

interface UsePanelContentRendererParams {
  activePanel: PanelType;
  scene: SceneModel | null;
  currentTool: ToolType;
  selectedEntityIds: string[];
  onEntitySelect: (ids: string[]) => void;
  expandedKeys: Set<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  layerOperations: LayerOperationsCallbacks;
  // ADR-309 Phase 2: Wizard button in LevelPanel
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext) => void;
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
  layerOperations,
  onSceneImported,
}: UsePanelContentRendererParams) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'levels':
        // ✅ ENTERPRISE: Αφαίρεση περιττού κενού <div> wrapper (ADR-003 Container Nesting)
        return (
          <LazyPanelWrapper loadingText={t('panels.levels.loading')}>
            <LevelPanel
              currentTool={currentTool}
              scene={scene}
              selectedEntityIds={selectedEntityIds}
              onEntitySelect={onEntitySelect}
              onSceneImported={onSceneImported}
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
              onToolChange={(tool: ToolType) => {
                EventBus.emit('level-panel:tool-change', tool);
              }}
            />
          </LazyPanelWrapper>
        );

      // ADR-309 Phase 1: 'hierarchy' and 'overlay' cases removed
      // See types/panel-types.ts — FloatingPanelType = 'levels' | 'colors'

      case 'colors':
        // ✅ ENTERPRISE: Αφαίρεση περιττού κενού <div> wrapper (ADR-003 Container Nesting)
        return (
          <LazyPanelWrapper loadingText={t('panels.colors.loading')}>
            <ColorPalettePanel />
          </LazyPanelWrapper>
        );

      // canvas case removed - merged into colors panel

      default:
        return (
          <aside className={`${colors.text.muted} text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
            <p>{t('panels.selectPanel')}</p>
          </aside>
        );
    }
  };

  return { renderPanelContent };
}

