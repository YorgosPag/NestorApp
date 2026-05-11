'use client';

/**
 * ADR-345 Fase 2 — Layers ribbon tab content.
 * Wires LevelPanel inside the ribbon body via internal hooks.
 * Mirrors the wiring previously done in FloatingPanelContainer
 * (useLayerOperations + useLevels) so the level/layer UX is identical.
 */

import React from 'react';
import { LevelPanel } from '../../components/LevelPanel';
import { useLevels } from '../../../systems/levels';
import { useLayerOperations } from '../../hooks/useLayerOperations';
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState';
import type { SceneModel } from '../../../types/scene';
import type { ToolType } from '../../toolbar/types';
import type { DxfSaveContext } from '../../../services/dxf-firestore.service';

export interface LayersTabContentProps {
  scene: SceneModel | null;
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;
  onSceneImported?: (
    file: File,
    encoding?: string,
    saveContext?: DxfSaveContext,
  ) => void;
}

export const LayersTabContent: React.FC<LayersTabContentProps> = ({
  scene,
  currentTool,
  onToolChange,
  selectedEntityIds,
  setSelectedEntityIds,
  onSceneImported,
}) => {
  const { currentLevelId, setLevelScene } = useLevels();
  const { expandedKeys, setExpandedKeys } = useFloatingPanelState();

  const ops = useLayerOperations({
    scene,
    currentLevelId,
    selectedEntityIds,
    onEntitySelect: setSelectedEntityIds,
    setLevelScene,
  });

  return (
    <div className="dxf-ribbon-layers-tab">
      <LevelPanel
        currentTool={currentTool}
        onToolChange={onToolChange}
        scene={scene}
        selectedEntityIds={selectedEntityIds}
        onSceneImported={onSceneImported}
        onEntitySelect={setSelectedEntityIds}
        expandedKeys={expandedKeys}
        onExpandChange={setExpandedKeys}
        onLayerToggle={ops.handleLayerToggle}
        onLayerDelete={ops.handleLayerDelete}
        onLayerColorChange={ops.handleLayerColorChange}
        onLayerRename={ops.handleLayerRename}
        onLayerCreate={ops.handleLayerCreate}
        onEntityToggle={ops.handleEntityToggle}
        onEntityDelete={ops.handleEntityDelete}
        onEntityColorChange={ops.handleEntityColorChange}
        onEntityRename={ops.handleEntityRename}
        onColorGroupToggle={ops.handleColorGroupToggle}
        onColorGroupDelete={ops.handleColorGroupDelete}
        onColorGroupColorChange={ops.handleColorGroupColorChange}
        onEntitiesMerge={ops.handleEntitiesMerge}
        onLayersMerge={ops.handleLayersMerge}
        onColorGroupsMerge={ops.handleColorGroupsMerge}
      />
    </div>
  );
};

export default LayersTabContent;
