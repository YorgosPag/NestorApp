'use client';

import React from 'react';
import type { ToolType } from '../toolbar/types';
import { EnhancedDXFToolbar } from '../toolbar/EnhancedDXFToolbar';
import { useCursor } from '../../systems/cursor';

interface ToolbarWithCursorCoordinatesProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void;
  showGrid: boolean;
  autoCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showLayers: boolean;
  showCalibration?: boolean;
  showCursorSettings?: boolean;
  currentZoom: number;
  commandCount?: number;
  className?: string;
  onSceneImported?: (file: File, encoding?: string) => void;
}

export function ToolbarWithCursorCoordinates(props: ToolbarWithCursorCoordinatesProps) {
  const { worldPosition, settings } = useCursor();

  // 🏢 ENTERPRISE (2026-02-02): This component is now DEPRECATED
  // ToolbarStatusBar uses CursorContext.worldPosition directly (SSoT)
  // Kept for backward compatibility only

  return (
    <EnhancedDXFToolbar
      {...props}
      // 🏢 ENTERPRISE (2026-02-02): mouseCoordinates prop REMOVED
      // ToolbarStatusBar now uses CursorContext.worldPosition directly (SSoT)
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
}
