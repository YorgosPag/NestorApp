'use client';
import React, { useEffect } from 'react';
// ✅ ENTERPRISE: Canonical CrosshairOverlay from canvas-v2 (ADR-002: CrosshairOverlay Consolidation)
import CrosshairOverlay from '../canvas-v2/overlays/CrosshairOverlay';
// ✅ ENTERPRISE FIX: Updated import paths to canvas-v2/overlays
import ZoomWindowOverlay from '../canvas-v2/overlays/ZoomWindowOverlay';
import SelectionMarqueeOverlay from '../canvas-v2/overlays/SelectionMarqueeOverlay';
// ✅ ENTERPRISE FIX: CoordinateCalibrationOverlay removed - integrated into new system
import SnapIndicatorOverlay from '../canvas-v2/overlays/SnapIndicatorOverlay';
import SnapModeIndicator from '../canvas-v2/overlays/SnapModeIndicator';
import { DynamicInputSystem } from '../systems/dynamic-input';
import CursorTooltipOverlay from '../canvas-v2/overlays/CursorTooltipOverlay';
import { useCursor } from '../systems/cursor';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
import { portalComponents } from '@/styles/design-tokens';  // ✅ ENTERPRISE: Centralized z-index hierarchy
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013)
import { PANEL_LAYOUT } from '../config/panel-tokens';
import type { SceneModel } from '../types/scene';
// ✅ ENTERPRISE FIX: Correct Point2D import path
import type { Point2D as Point } from '../rendering/types/Types';
import type { ProSnapResult, ExtendedSnapType } from '../snapping/extended-types';
import type { ViewTransform } from '../systems/rulers-grid/config';
// ✅ ENTERPRISE FIX: CoordinateManager types moved to integrated system

interface Props {
  mouseCss: Point | null;
  mouseWorld: Point | null;
  canvasRect: DOMRect | null;
  isZoomWindowActive: boolean;
  showCalibration: boolean;
  onCalibrationToggle?: (show: boolean) => void;
  currentScene: SceneModel | null;
  // ✅ ENTERPRISE FIX: CoordinateManager integrated into new system (unused - kept for backward compatibility)
  coordinateManager?: unknown;
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
  tempPoints = [] as Point[],
  marqueeOverlayRef,
}: Props) {
  const { updatePosition, updateViewport, updateWorldPosition, settings } = useCursor();


  // Update cursor system with mouse coordinates
  useEffect(() => {
    console.log('🖱️ [CanvasOverlays] Mouse position updated:', { mouseCss, mouseWorld });
    updatePosition(mouseCss);
    updateWorldPosition(mouseWorld);
  }, [mouseCss, mouseWorld, updatePosition, updateWorldPosition]);

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
    const kind: "window" | "crossing" = marqueeData.end.x >= marqueeData.start.x ? 'window' : 'crossing';
    
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
    <div className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`} style={{ zIndex: portalComponents.overlay.base.zIndex() }}>
      <CrosshairOverlay
        isActive={crosshairActive}  // Active in layering mode OR when mouse position available
        // ✅ ADR-008: REMOVED cursorPosition/mouseWorld - now tracked internally for pixel-perfect alignment
        viewport={{ width: canvasRect?.width ?? 1920, height: canvasRect?.height ?? 1080 }}
        className={`absolute ${PANEL_LAYOUT.INSET['0']}`}
      />
      <SnapIndicatorOverlay
        snapResult={snapResult ? {
          point: snapResult.snappedPoint,
          type: snapResult.activeMode || 'none'
        } : null}
        viewport={{ width: canvasRect?.width ?? 1920, height: canvasRect?.height ?? 1080 }}
        canvasRect={canvasRect}
        transform={transform}
        className={`absolute ${PANEL_LAYOUT.INSET['0']}`}
      />
      <SnapModeIndicator
        snapResult={snapResult ? {
          point: snapResult.snappedPoint,
          type: snapResult.activeMode || 'none'
        } : null}
        mouseCss={mouseCss}
        enabledModes={enabledSnapModes || new Set()}
        className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
      />
      <ZoomWindowOverlay
        zoomWindowState={{ isActive: isZoomWindowActive || false, isDragging: false, startPoint: null, currentPoint: null, previewRect: null }}
        className={`absolute ${PANEL_LAYOUT.INSET['0']}`}
      />
      <SelectionMarqueeOverlay
        state={selectionState}
        className={`absolute ${PANEL_LAYOUT.INSET['0']}`}
      />
      {/* ✅ ENTERPRISE FIX: CoordinateCalibrationOverlay removed */}
      {/* <CoordinateCalibrationOverlay
        mousePos={mouseCss}
        worldPos={mouseWorld}
        canvasRect={canvasRect ?? undefined}
        coordinateManager={coordinateManager}
        currentScene={currentScene ?? undefined}
        onInjectTestEntity={() => {}}
        show={showCalibration}
        onToggle={onCalibrationToggle}
      */ }
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
