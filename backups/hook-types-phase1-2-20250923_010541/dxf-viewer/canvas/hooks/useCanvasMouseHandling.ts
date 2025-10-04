/**
 * Canvas Mouse Handling Hook
 * Manages all mouse interactions for the DXF canvas
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Point2D as Point } from '../../types/scene';
import type { ProSnapResult } from '../../snapping/extended-types';
import { createMouseUtils } from '../../utils/canvas-core';

interface UseCanvasMouseHandlingOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  rendererRef: React.RefObject<any>;
  snapManager: any;
  activeTool?: string;
  drawingState?: any;
  onMeasurementHover?: (worldPoint: Point | null) => void;
  onDrawingHover?: (worldPoint: Point | null) => void;
}

const PIXEL_GATE = 2.0; // Pixel threshold for mouse move events

export function useCanvasMouseHandling(options: UseCanvasMouseHandlingOptions) {
  const {
    canvasRef,
    rendererRef,
    snapManager,
    activeTool = 'select',
    drawingState,
    onMeasurementHover,
    onDrawingHover
  } = options;

  const [mouseCss, setMouseCss] = useState<Point | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point | null>(null);
  const [snapResult, setSnapResult] = useState<ProSnapResult | null>(null);
  
  const rafRef = useRef<number | null>(null);
  const lastScreenRef = useRef<Point | null>(null);
  const lastSnapResultRef = useRef<ProSnapResult | null>(null);

  // Check if current tool is a drawing tool
  const isDrawingTool = useCallback((tool?: string) => {
    if (!tool) return false;
    if (tool.startsWith('draw-')) return true;
    const t = tool.toLowerCase();
    return [
      'line',
      'polyline',
      'polygon',
      'circle',
      'arc',
      'rectangle',
      'rect',
      'ellipse',
      'spline',
      'freehand'
    ].includes(t);
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const updateMouseWorld = useCallback((pt: Point | null) => {
    setMouseCss(pt);
    
    if (!pt) {
      setMouseWorld(null);
      setSnapResult(null);
      
      if (activeTool?.startsWith('measure-')) {
        onMeasurementHover?.(null);
      }
      if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
        onDrawingHover?.(null);
      }
      return;
    }

    try {
      const cm = rendererRef.current?.getCoordinateManager?.();
      const world = cm?.screenToWorld?.(pt) ?? null;
      setMouseWorld(world);

      // RAF + pixel gate for performance with large files
      if (world && snapManager && rendererRef.current) {
        // Drop events in the same frame
        if (rafRef.current) return;
        
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          
          const cm = rendererRef.current?.getCoordinateManager?.();
          if (!cm) return;

          // Pixel gating check
          if (lastScreenRef.current) {
            const dx = Math.abs(pt.x - lastScreenRef.current.x);
            const dy = Math.abs(pt.y - lastScreenRef.current.y);
            if (dx < PIXEL_GATE && dy < PIXEL_GATE) {
              return;
            }
          }
          lastScreenRef.current = pt;

          // Calculate snap point
          const snapPt = snapManager.calculateSnapPoint(world, cm.getScale());
          
          if (snapPt && (!lastSnapResultRef.current || 
              snapPt.point.x !== lastSnapResultRef.current.point.x || 
              snapPt.point.y !== lastSnapResultRef.current.point.y)) {
            setSnapResult(snapPt);
            lastSnapResultRef.current = snapPt;
            
            if (activeTool?.startsWith('measure-')) {
              onMeasurementHover?.(snapPt.point);
            }
            if (isDrawingTool(activeTool) || drawingState?.isDrawing) {
              onDrawingHover?.(snapPt.point);
            }
          }
        });
      }
    } catch (e) {
      console.warn('Mouse world update failed:', e);
    }
  }, [activeTool, drawingState, isDrawingTool, onMeasurementHover, onDrawingHover, rendererRef, snapManager]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const mouseUtils = createMouseUtils();
    const screenPoint = mouseUtils.getScreenPointFromEvent(e);
    
    updateMouseWorld(screenPoint);
  }, [canvasRef, updateMouseWorld]);

  const handleMouseLeave = useCallback(() => {
    updateMouseWorld(null);
  }, [updateMouseWorld]);

  const getSnapPoint = useCallback((screenPoint: Point): Point | null => {
    if (!snapResult) return null;
    
    const cm = rendererRef.current?.getCoordinateManager?.();
    if (!cm) return null;
    
    const worldPoint = cm.screenToWorld(screenPoint);
    const snapPoint = snapManager?.calculateSnapPoint(worldPoint, cm.getScale());
    
    return snapPoint?.point || worldPoint;
  }, [snapResult, rendererRef, snapManager]);

  return {
    mouseCss,
    mouseWorld,
    snapResult,
    handleMouseMove,
    handleMouseLeave,
    getSnapPoint,
    updateMouseWorld
  };
}