/**
 * USEPANELCONTENTRENDERER HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 5 refactoring
 * Panel content rendering logic
 */

import React from 'react';
import { LazyPanelWrapper } from '../components/shared';

// ✅ Lazy loaded components για καλύτερη initial performance (ΒΗΜΑ 14)
const AdminLayerManager = React.lazy(() =>
  import('../components/AdminLayerManager').then(module => ({
    default: module.AdminLayerManager
  }))
);
const LevelPanel = React.lazy(() =>
  import('../components/LevelPanel').then(module => ({
    default: module.LevelPanel
  }))
);
const HierarchyDebugPanel = React.lazy(() =>
  import('../../components/HierarchyDebugPanel').then(module => ({
    default: module.HierarchyDebugPanel
  }))
);
const ColorPalettePanel = React.lazy(() =>
  import('../components/ColorPalettePanel').then(module => ({
    default: module.ColorPalettePanel
  }))
);
const EntitiesSettings = React.lazy(() =>
  import('../components/dxf-settings/settings/special/EntitiesSettings').then(module => ({
    default: module.EntitiesSettings
  }))
);
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

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'overlay':
        return (
          <div className="space-y-4">
            <LazyPanelWrapper loadingText="Φόρτωση διαχείρισης επιπέδων...">
              <AdminLayerManager className="bg-gray-800 rounded-lg p-4" />
            </LazyPanelWrapper>
          </div>
        );

      case 'levels':
        return (
          <div>
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
          </div>
        );

      case 'hierarchy':
        return (
          <div>
            <LazyPanelWrapper loadingText="Φόρτωση ιεραρχίας...">
              <HierarchyDebugPanel />
            </LazyPanelWrapper>
          </div>
        );

      case 'layers':
        // REMOVED: LayerManagementPanel - now uses unified overlay system
        return null;

      case 'colors':
        return (
          <div>
            <LazyPanelWrapper loadingText="Φόρτωση παλέτας χρωμάτων...">
              <ColorPalettePanel />
            </LazyPanelWrapper>
          </div>
        );

      case 'canvas':
        return (
          <div>
            <LazyPanelWrapper loadingText="Φόρτωση ρυθμίσεων οντοτήτων...">
              <EntitiesSettings />
            </LazyPanelWrapper>
          </div>
        );

      default:
        return (
          <div className="text-gray-400 text-center py-8">
            <p>Επιλέξτε ένα panel από τις καρτέλες</p>
          </div>
        );
    }
  };

  return { renderPanelContent };
}