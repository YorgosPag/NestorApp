
'use client';

import React from 'react';
import type { DXFEntity, Layer, ToolType, ViewMode, Status, Point, Measurement } from '../types';
import type { DrawingState } from '../hooks/drawing/useUnifiedDrawing';
import type { useDxfViewerState } from '../hooks/useDxfViewerState';

export type DxfViewerState = ReturnType<typeof useDxfViewerState>;

export interface DXFViewerLayoutProps extends DxfViewerState {
  // DXFViewerApp specific props
  dxfFile: File | null;
  status: Status;
  onClear: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCanvasMouseDown: (worldPoint: Point, event: React.MouseEvent) => void;
  onCanvasMouseMove: (worldPoint: Point, event: React.MouseEvent) => void;

  // Props from useDxfViewerState that need to be passed down
  className?: string;
  entities: DXFEntity[];
  layers: Layer[];
  scene: any; // to be refined
  handleTransformChange: (transform: any) => void;
  handleSceneChange: (scene: any) => void;
  handleCalibrationToggle: (show: boolean) => void;
  canvasTransform?: { scale: number; offsetX: number; offsetY: number };
  setSelectedEntityIds: (ids: string[]) => void;
  onSceneImported?: (file: File, encoding?: string) => void;
  handleFileImport: (file: File) => Promise<void>;
}
