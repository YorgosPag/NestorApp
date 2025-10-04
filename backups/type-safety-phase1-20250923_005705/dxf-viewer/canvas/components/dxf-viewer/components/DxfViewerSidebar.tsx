'use client';

import React from 'react';
import { FloatingPanelContainer } from '../../../../ui/FloatingPanelContainer';
import type { SceneModel } from '../../../../types/scene';
import type { ToolType } from '../../../../ui/toolbar/types';

interface DxfViewerSidebarProps {
  sceneModel: SceneModel | null;
  selectedEntityIds: string[];
  onEntitySelect: (entityIds: string[]) => void;
  zoomLevel: number;
  currentTool: ToolType;
}

export function DxfViewerSidebar({
  sceneModel,
  selectedEntityIds,
  onEntitySelect,
  zoomLevel,
  currentTool
}: DxfViewerSidebarProps) {
  return (
    <div className="w-80 flex-shrink-0 pl-3 pr-0 py-0">
      <div className="h-full bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
        <FloatingPanelContainer
          sceneModel={sceneModel}
          selectedEntityIds={selectedEntityIds}
          onEntitySelect={onEntitySelect}
          zoomLevel={zoomLevel}
          currentTool={currentTool}
        />
      </div>
    </div>
  );
}