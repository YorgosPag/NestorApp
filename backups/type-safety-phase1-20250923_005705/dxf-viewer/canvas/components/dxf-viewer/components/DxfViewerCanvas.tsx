'use client';

import React from 'react';
import { DxfCanvas } from '../../../../DxfCanvas';
import { OverlayCanvas } from '../../../../OverlayCanvas';
import type { DxfCanvasRef } from '../../../../DxfCanvas';
import type { SceneModel } from '../../../../types/scene';
import type { Point2D as Pt } from '../../../../types/scene';
import type { ToolType } from '../../../../ui/toolbar/types';
import type { ExtendedSnapType } from '../../../../snapping/extended-types';

interface DxfViewerCanvasProps {
  dxfCanvasRef: React.RefObject<DxfCanvasRef>;
  enhancedCurrentScene: SceneModel | null;
  selectedEntityIds: string[];
  onSelectEntity: (entityIds: string | string[]) => void;
  onTransformChange: (transform: any) => void;
  
  // Tool state
  activeTool: ToolType;
  isZoomWindowActive: boolean;
  showCalibration: boolean;
  
  // Handlers
  onZoomWindowModeChange: (active: boolean) => void;
  onCalibrationToggle: (show: boolean) => void;
  onSceneChange: (scene: SceneModel) => void;
  
  // Measurement props
  measurements: any[];
  tempMeasurementPoints: Pt[];
  onMeasurementPoint: (p: Pt) => void;
  onMeasurementHover: (p: Pt | null) => void;
  onMeasurementCancel: () => void;
  
  // Drawing props
  onDrawingPoint: (p: Pt) => void;
  onDrawingHover: (p: Pt | null) => void;
  onDrawingCancel: () => void;
  onDrawingDoubleClick: () => void;
  
  // Snap props
  snapEnabled: boolean;
  enabledSnapModes: ExtendedSnapType[];
  onSnapPoint: ((x: number, y: number) => any) | null;
  
  // Grip settings
  gripSettings: any;
}

export function DxfViewerCanvas({
  dxfCanvasRef,
  enhancedCurrentScene,
  selectedEntityIds,
  onSelectEntity,
  onTransformChange,
  activeTool,
  isZoomWindowActive,
  showCalibration,
  onZoomWindowModeChange,
  onCalibrationToggle,
  onSceneChange,
  measurements,
  tempMeasurementPoints,
  onMeasurementPoint,
  onMeasurementHover,
  onMeasurementCancel,
  onDrawingPoint,
  onDrawingHover,
  onDrawingCancel,
  onDrawingDoubleClick,
  snapEnabled,
  enabledSnapModes,
  onSnapPoint,
  gripSettings
}: DxfViewerCanvasProps) {
  return (
    <div className="flex-1 relative">
      <DxfCanvas
        ref={dxfCanvasRef}
        scene={enhancedCurrentScene}
        onTransformChange={onTransformChange}
        selectedEntityIds={selectedEntityIds}
        onSelectEntity={onSelectEntity}
        alwaysShowCoarseGrid={true}
        isZoomWindowActive={isZoomWindowActive}
        onZoomWindowModeChange={onZoomWindowModeChange}
        showCalibration={showCalibration}
        onCalibrationToggle={onCalibrationToggle}
        onSceneChange={onSceneChange}
        activeTool={activeTool}
        // 📏 MEASUREMENT props
        measurements={measurements}
        tempMeasurementPoints={tempMeasurementPoints}
        onMeasurementPoint={onMeasurementPoint}
        onMeasurementHover={onMeasurementHover}
        onMeasurementCancel={onMeasurementCancel}
        // 🎨 DRAWING props
        onDrawingPoint={onDrawingPoint}
        onDrawingHover={onDrawingHover}
        onDrawingCancel={onDrawingCancel}
        onDrawingDoubleClick={onDrawingDoubleClick}
        gripSettings={gripSettings}
        snapEnabled={snapEnabled}
        enabledSnapModes={enabledSnapModes}
        onSnapPoint={onSnapPoint}
        className="absolute inset-0"
      />
      <OverlayCanvas
        transform={dxfCanvasRef.current?.getTransform() || { scale: 1, offsetX: 0, offsetY: 0 }}
      />
    </div>
  );
}