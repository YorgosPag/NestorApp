'use client';
import React, { useEffect } from 'react';
import CrosshairOverlay from './CrosshairOverlay';
import ZoomWindowOverlay from './ZoomWindowOverlay';
import SelectionMarqueeOverlay from './SelectionMarqueeOverlay';
import CoordinateCalibrationOverlay from './CoordinateCalibrationOverlay';
import SnapIndicatorOverlay from './SnapIndicatorOverlay';
import SnapModeIndicator from './SnapModeIndicator';
import { DynamicInputSystem } from '../systems/dynamic-input';
import CursorTooltipOverlay from './CursorTooltipOverlay';
import { useCursor } from '../systems/cursor';
import type { SceneModel } from '../types/scene';
import type { Point2D as Point } from '../types/scene';
import type { ProSnapResult, ExtendedSnapType } from '../snapping/extended-types';
import type { ViewTransform } from '../systems/rulers-grid/config';

interface Props {
  mouseCss: Point | null;
  mouseWorld: Point | null;
  canvasRect: DOMRect | null;
  isZoomWindowActive: boolean;
  showCalibration: boolean;
  onCalibrationToggle?: (show: boolean) => void;
  currentScene: SceneModel | null;
  coordinateManager?: any;
  snapResult?: ProSnapResult | null;
  transform: ViewTransform;
  enabledSnapModes?: Set<ExtendedSnapType>; // για τον mode indicator
  activeTool?: string; // για dynamic input
  tempPoints?: Point[]; // για multi-point tools
  marqueeOverlayRef?: React.RefObject<{start: Point; end: Point} | null>; // για selection marquee
}

export default function CanvasOverlays({
  mouseCss,
  mouseWorld,
  canvasRect,
  isZoomWindowActive,
  showCalibration,
  onCalibrationToggle,
  currentScene,
  coordinateManager,
  snapResult,
  transform,
  enabledSnapModes,
  activeTool = 'select',
  tempPoints = null,
  marqueeOverlayRef,
}: Props) {
  const { updatePosition, updateViewport, setWorldPosition, settings } = useCursor();


  // Update cursor system with mouse coordinates
  useEffect(() => {
    updatePosition(mouseCss);
    setWorldPosition(mouseWorld);
  }, [mouseCss, mouseWorld, updatePosition, setWorldPosition]);

  // Update cursor system with viewport
  useEffect(() => {
    if (canvasRect) {
      updateViewport({ 
        width: canvasRect.width, 
        height: canvasRect.height 
      });
    }
  }, [canvasRect, updateViewport]);

  // Create selection state from marqueeOverlayRef
  const selectionState = React.useMemo(() => {
    const marqueeData = marqueeOverlayRef?.current;
    if (!marqueeData) {
      return { 
        marquee: { active: false }, 
        lasso: { active: false, points: [] } 
      };
    }

    // Determine marquee kind based on direction (LTR=window, RTL=crossing)
    const kind = marqueeData.end.x >= marqueeData.start.x ? 'window' : 'crossing';
    
    return {
      marquee: {
        active: true,
        start: marqueeData.start,
        end: marqueeData.end,
        kind
      },
      lasso: { active: false, points: [] }
    };
  }, [marqueeOverlayRef?.current]);

  return (
    <>
      <CrosshairOverlay
        isActive={!!mouseCss}
        cursorPosition={mouseCss}
        viewport={{ width: canvasRect?.width ?? 1920, height: canvasRect?.height ?? 1080 }}
        className="absolute inset-0"
      />
      <SnapIndicatorOverlay
        snapResult={snapResult}
        viewport={{ width: canvasRect?.width ?? 1920, height: canvasRect?.height ?? 1080 }}
        canvasRect={canvasRect}
        transform={transform}
        className="absolute inset-0"
      />
      <SnapModeIndicator
        snapResult={snapResult}
        mouseCss={mouseCss}
        enabledModes={enabledSnapModes || new Set()}
        className="absolute inset-0 pointer-events-none"
      />
      <ZoomWindowOverlay
        zoomWindowState={{ isActive: isZoomWindowActive || false, isDragging: false, startPoint: null, currentPoint: null, previewRect: null }}
        className="absolute inset-0"
      />
      <SelectionMarqueeOverlay
        state={selectionState}
        className="absolute inset-0"
      />
      <CoordinateCalibrationOverlay
        mousePos={mouseCss}
        worldPos={mouseWorld}
        canvasRect={canvasRect ?? undefined}
        coordinateManager={coordinateManager}
        currentScene={currentScene ?? undefined}
        onInjectTestEntity={() => {}}
        show={showCalibration}
        onToggle={onCalibrationToggle}
      />
      <DynamicInputSystem
        isActive={!!mouseCss}
        cursorPosition={mouseCss}
        viewport={{ width: canvasRect?.width ?? 1920, height: canvasRect?.height ?? 1080 }}
        activeTool={activeTool}
        canvasRect={canvasRect}
        mouseWorldPosition={mouseWorld}
        tempPoints={tempPoints}
        className="absolute"
      />
      <CursorTooltipOverlay
        isActive={!!mouseCss}
        cursorPosition={mouseCss}
        activeTool={activeTool}
        canvasRect={canvasRect}
        className="absolute"
      />
    </>
  );
}
