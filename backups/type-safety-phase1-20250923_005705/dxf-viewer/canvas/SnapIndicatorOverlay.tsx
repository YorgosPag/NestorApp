'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { CADFeedback } from '../utils/feedback-utils';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import type { ProSnapResult } from '../snapping/extended-types';
import type { Point2D } from '../types/scene';
import type { ViewTransform } from '../systems/rulers-grid/config';
import { coordTransforms } from '../systems/rulers-grid/config';

import { UI_COLORS } from '../config/color-config';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_INDICATOR = false;

// === Visual tuning (px, όχι world) ===
const LINE_WIDTH = 1;           // γραμμή marker
const MID_CROSS_HALF = 6;       // μισό μήκος σταυρού (σύνολο 12px)
const END_SQUARE_HALF = 4;      // μισή πλευρά τετραγώνου (σύνολο 8px)
const MIDPOINT_COLOR = UI_COLORS.SNAP_MIDPOINT; // κίτρινο «CAD classic»
const ENDPOINT_COLOR = UI_COLORS.SNAP_ENDPOINT; // κυανό για άκρα (διακριτό από midpoint)

function drawMidpointMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Κίτρινος σταυρός για MIDPOINT
  ctx.save();
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = MIDPOINT_COLOR;
  ctx.fillStyle = MIDPOINT_COLOR;
  
  // οριζόντια γραμμή
  ctx.beginPath();
  ctx.moveTo(Math.round(x - MID_CROSS_HALF) + 0.5, Math.round(y) + 0.5);
  ctx.lineTo(Math.round(x + MID_CROSS_HALF) + 0.5, Math.round(y) + 0.5);
  ctx.stroke();
  
  // κάθετη γραμμή
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, Math.round(y - MID_CROSS_HALF) + 0.5);
  ctx.lineTo(Math.round(x) + 0.5, Math.round(y + MID_CROSS_HALF) + 0.5);
  ctx.stroke();
  
  // ⚡ NUCLEAR: MIDPOINT DOT ELIMINATED
  
  ctx.restore();
}

function drawEndpointMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Κυανό τετράγωνο για ENDPOINT
  ctx.save();
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = ENDPOINT_COLOR;
  
  const rectX = Math.round(x - END_SQUARE_HALF) + 0.5;
  const rectY = Math.round(y - END_SQUARE_HALF) + 0.5;
  const w = END_SQUARE_HALF * 2;
  const h = END_SQUARE_HALF * 2;
  
  ctx.strokeRect(rectX, rectY, w, h);
  ctx.restore();
}

function drawDefaultMarker(ctx: CanvasRenderingContext2D, x: number, y: number, snapType: string = 'default') {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9;

  switch(snapType) {
    case 'intersection':
      // Σταυρός για intersection
      ctx.strokeStyle = UI_COLORS.SNAP_INTERSECTION;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
      break;
      
    case 'perpendicular':
      // Τετράγωνο με γραμμή για perpendicular
      ctx.strokeStyle = UI_COLORS.SNAP_PERPENDICULAR;
      ctx.strokeRect(x - 5, y - 5, 10, 10);
      ctx.beginPath();
      ctx.moveTo(x - 3, y);
      ctx.lineTo(x + 3, y);
      ctx.stroke();
      break;
      
    case 'center':
      // ⚡ NUCLEAR: CENTER CIRCLES ELIMINATED
      break;
      
    default:
      // Default χρυσός X marker
      ctx.strokeStyle = UI_COLORS.SNAP_DEFAULT;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y + 6);
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x - 6, y + 6);
      ctx.stroke();
  }
  
  ctx.restore();
}

interface SnapIndicatorOverlayProps {
  className?: string;
  snapResult?: ProSnapResult | null;
  viewport?: { width: number; height: number };
  canvasRect?: DOMRect | null;
  transform: ViewTransform;
}

export default function SnapIndicatorOverlay({
  className = '',
  snapResult = null,
  viewport = { width: 0, height: 0 },
  transform
}: SnapIndicatorOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastSnapPoint = useRef<string | null>(null);

  // Setup canvas using shared hook
  useCanvasSetup(canvasRef, {
    viewport,
    imageSmoothingEnabled: false
  });

  const renderSnapIndicator = useCallback(() => {
    return; // ⚠️ ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING κίτρινων grips

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (!snapResult || !snapResult.found || !snapResult.snapPoint) {
      lastSnapPoint.current = null;
      return;
    }

    const worldPoint = snapResult.snappedPoint;
    if (!worldPoint) return;
    
    // Snap feedback - παίζει ήχο και vibration όταν βρίσκει νέο snap point
    const currentSnapId = `${snapResult.snapPoint.type}-${worldPoint.x.toFixed(2)}-${worldPoint.y.toFixed(2)}`;
    if (lastSnapPoint.current !== currentSnapId) {
      CADFeedback.onSnap();
      lastSnapPoint.current = currentSnapId;
    }
    
    // --- COORDINATE TRANSFORMATION ---
    const screenPoint = coordTransforms.worldToScreen(worldPoint, transform, canvas.getBoundingClientRect());
    if (!screenPoint) return;
    // --- END TRANSFORMATION ---

    const { x: screenX, y: screenY } = screenPoint;
    
    // Type-specific markers
    const snapType = snapResult.snapPoint?.type;
    
    if (snapType === 'midpoint') {
      drawMidpointMarker(ctx, screenX, screenY);
    } else if (snapType === 'endpoint') {
      drawEndpointMarker(ctx, screenX, screenY);
    } else {
      // Enhanced markers για διάφορους τύπους snap
      drawDefaultMarker(ctx, screenX, screenY, snapType || 'default');
    }

    if (process.env.NODE_ENV === 'development') {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(
        `${snapResult.snapPoint.type} (${Math.round(worldPoint.x)},${Math.round(worldPoint.y)})`,
        screenX + 15,
        screenY - 5
      );
    }
  }, [snapResult, viewport, transform]);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(renderSnapIndicator);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [renderSnapIndicator]);

  const shouldShow = snapResult && snapResult.found && snapResult.snapPoint;
  
  // DEBUG: Log snap indicator state
  if (DEBUG_SNAP_INDICATOR) console.log('🎯 SnapIndicatorOverlay render:', {
    hasSnapResult: !!snapResult,
    found: snapResult?.found,
    hasSnapPoint: !!snapResult?.snapPoint,
    shouldShow,
    snapResult
  });

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      style={{
        zIndex: 1001,
        display: shouldShow ? 'block' : 'none'
      }}
    />
  );
}

export { SnapIndicatorOverlay };
