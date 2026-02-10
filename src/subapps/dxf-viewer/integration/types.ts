
'use client';

import React, { Dispatch, SetStateAction } from 'react';
import type { DXFEntity, Layer, ViewMode, Status, Point } from '../types';
import type { useDxfViewerState } from '../hooks/useDxfViewerState';
import type { SceneModel } from '../types/scene';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { OverlayEditorMode, OverlayKind, Status as PropertyStatus } from '../overlays/types';

export type DxfViewerState = ReturnType<typeof useDxfViewerState>;

export interface DXFViewerLayoutProps extends Omit<DxfViewerState, 'snapEnabled' | 'handleCalibrationToggle' | 'setSelectedEntityIds'> {
  // ✅ ENTERPRISE FIX: Override snapEnabled to ensure boolean type
  snapEnabled: boolean;

  // ✅ FIX: Override setSelectedEntityIds with proper React Dispatch type (matches useState return)
  setSelectedEntityIds: Dispatch<SetStateAction<string[]>>;

  // ✅ FIX: Add missing setOverlayKind property
  setOverlayKind: (kind: OverlayKind) => void;

  // DXFViewerApp specific props
  dxfFile: File | null;
  status: Status;
  onClear: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCanvasMouseDown: (worldPoint: Point, event: React.MouseEvent) => void;
  onCanvasMouseMove: (worldPoint: Point, event: React.MouseEvent) => void;

  // ✅ ENTERPRISE FIX: Add missing props for FullscreenView
  currentStatus?: PropertyStatus;
  setCurrentStatus?: (status: PropertyStatus) => void;
  currentKind?: OverlayKind;
  setCurrentKind?: (kind: OverlayKind) => void;
  overlayMode?: OverlayEditorMode;
  overlayStatus?: PropertyStatus;
  setOverlayMode?: (mode: OverlayEditorMode) => void;

  // Props from useDxfViewerState that need to be passed down
  className?: string;
  entities: DXFEntity[];
  layers: Layer[];
  scene: SceneModel;
  handleTransformChange: (transform: ViewTransform) => void;
  handleSceneChange: (scene: SceneModel) => void;
  handleCalibrationToggle: () => void;
  canvasTransform?: { scale: number; offsetX: number; offsetY: number };
  onSceneImported?: (file: File, encoding?: string) => void;
  handleFileImport: (file: File) => Promise<void>;

  // 🎯 Canvas visibility controls για debug
  dxfCanvasVisible?: boolean;
  layerCanvasVisible?: boolean;

  // 🔧 PHASE 2 FIX: Missing props που περνάνε από DxfViewerContent
  transform?: ViewTransform;
  onTransformChange?: (transform: ViewTransform) => void;
  onRegionClick?: (regionId: string) => void;
  onMouseMove?: (worldPoint: Point2D, event: React.MouseEvent) => void;
  setOverlayStatus?: (status: PropertyStatus) => void;

  // 🏢 ENTERPRISE (2027-01-27): Mouse coordinates callback for status bar real-time updates
  onMouseCoordinatesChange?: (coords: Point2D | null) => void;
}
