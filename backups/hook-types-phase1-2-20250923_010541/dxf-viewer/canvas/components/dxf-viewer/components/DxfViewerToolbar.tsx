'use client';

import React from 'react';
import { EnhancedDXFToolbar } from '../../../../ui/toolbar/EnhancedDXFToolbar';
import type { ToolType } from '../../../../ui/toolbar/types';

interface DxfViewerToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: any) => void;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showLayers: boolean;
  showProperties: boolean;
  showCalibration: boolean;
  currentZoom: number;
  onSceneImported: (file: File, encoding?: string) => void;
}

export function DxfViewerToolbar({
  activeTool,
  onToolChange,
  onAction,
  showGrid,
  canUndo,
  canRedo,
  snapEnabled,
  showLayers,
  showProperties,
  showCalibration,
  currentZoom,
  onSceneImported
}: DxfViewerToolbarProps) {
  return (
    <div className="flex-shrink-0 p-2">
      <EnhancedDXFToolbar
        activeTool={activeTool}
        onToolChange={onToolChange}
        onAction={onAction}
        showGrid={showGrid}
        autoCrop={false}
        canUndo={canUndo}
        canRedo={canRedo}
        snapEnabled={snapEnabled}
        showLayers={showLayers}
        showProperties={showProperties}
        showCalibration={showCalibration}
        currentZoom={currentZoom}
        commandCount={0}
        onSceneImported={onSceneImported}
      />
    </div>
  );
}