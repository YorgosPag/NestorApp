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
import { canvasUtilities } from '@/styles/design-tokens';
import type { SceneModel } from '../types/scene';
import type { Point2D as Point } from '../types/scene';
import type { ProSnapResult, ExtendedSnapType } from '../snapping/extended-types';
import type { ViewTransform } from '../systems/rulers-grid/config';
import type { CoordinateManager } from './calibration/types';

interface Props {
  mouseCss: Point | null;
  mouseWorld: Point | null;
  canvasRect: DOMRect | null;
  isZoomWindowActive: boolean;
  showCalibration: boolean;
  onCalibrationToggle?: (show: boolean) => void;
  currentScene: SceneModel | null;
  coordinateManager?: CoordinateManager;
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
    console.log('🖱️ [CanvasOverlays] Mouse position updated:', { mouseCss, mouseWorld });
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

  // 🎯 ChatGPT-5 Final Fix: Layering mode πάντα ενεργό
  const isLayering = activeTool === 'layering';
  const rect = canvasRect;
  const defaultCss = rect ? {x: rect.width / 2, y: rect.height / 2} : null;

  // Crosshair ΠΑΝΤΑ ενεργό σε layering - στόχος: ποτέ isActive:false
  const crosshairActive = isLayering || !!mouseCss;

  // ΠΑΝΤΑ έχει position σε layering - στόχος: ποτέ cursorPosition:null
  const crosshairPosition = mouseCss ?? defaultCss;

  // 🎯 ChatGPT-5 FIX: Υπολογισμός και πέρασμα world coordinates
  const view = transform; // η τρέχουσα pan/zoom matrix
  // Χρησιμοποιούμε απλό inverse transform (αφού το transform είναι ViewTransform)
  const calculateWorldPosition = (cssPos: {x: number, y: number}) => {
    if (!view) return cssPos;
    // Απλή μετατροπή CSS -> world coordinates
    return {
      x: (cssPos.x - view.offsetX) / view.scale,
      y: (cssPos.y - view.offsetY) / view.scale
    };
  };

  // ΠΑΝΤΑ υπολογίζει world position - στόχος: ποτέ mouseWorld:null σε layering
  const mouseWorldCalculated = (crosshairPosition && view)
    ? calculateWorldPosition(crosshairPosition)
    : crosshairPosition; // fallback σε CSS coords αν δεν έχει view

  console.log('🎯 [CanvasOverlays] Rendering CrosshairOverlay with:', {
    isActive: crosshairActive,
    cursorPosition: crosshairPosition,
    mouseWorld: mouseWorldCalculated,
    activeTool
  });

  return (
    <div style={canvasUtilities.layers.overlayBase}>
      <CrosshairOverlay
        isActive={crosshairActive}  // Active in layering mode OR when mouse position available
        cursorPosition={crosshairPosition}
        mouseWorld={mouseWorldCalculated}
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
    </div>
  );
}
