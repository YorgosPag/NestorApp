/**
 * Interaction Engine - Unified canvas interaction handling
 * Centralizes mouse, keyboard, and touch interactions with coordinated routing
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Point2D as Point } from '../../rendering/types/Types';
import type { ToolType } from '../../ui/toolbar/types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

export interface InteractionState {
  mousePosition: Point | null;
  mouseWorldPosition: Point | null;
  isMouseDown: boolean;
  isDragging: boolean;
  dragStart: Point | null;
  lastInteractionTime: number;
}

export interface InteractionHandlers {
  onCanvasClick?: (point: Point, worldPoint: Point) => void;
  onCanvasDoubleClick?: (point: Point, worldPoint: Point) => void;
  onCanvasMouseDown?: (point: Point, worldPoint: Point, button: number) => void;
  onCanvasMouseMove?: (point: Point, worldPoint: Point) => void;
  onCanvasMouseUp?: (point: Point, worldPoint: Point, button: number) => void;
  onCanvasDrag?: (startPoint: Point, currentPoint: Point, delta: Point) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onWheel?: (event: WheelEvent) => void;
}

// ✅ ENTERPRISE FIX: Proper typing for managers instead of unknown
interface TransformManager {
  screenToWorld?: (point: Point) => Point;
}

interface SnapManager {
  snap?: (point: Point) => { point: Point } | null;
}

export interface InteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  activeTool?: ToolType;
  enableSnapping?: boolean;
  enableKeyboard?: boolean;
  dragThreshold?: number;
  doubleClickTime?: number;
  snapManager?: SnapManager;
  transformManager?: TransformManager;
  handlers: InteractionHandlers;
}

// 🏢 ADR-096: Centralized Interaction Timing Constants (PANEL_LAYOUT.TIMING)
const DRAG_THRESHOLD = PANEL_LAYOUT.TIMING.DRAG_THRESHOLD_PX;
const DOUBLE_CLICK_TIME = PANEL_LAYOUT.TIMING.DOUBLE_CLICK_MS;

export function useInteractionEngine({
  canvasRef,
  activeTool = 'select',
  enableSnapping = true,
  enableKeyboard = true,
  dragThreshold = DRAG_THRESHOLD,
  doubleClickTime = DOUBLE_CLICK_TIME,
  snapManager,
  transformManager,
  handlers
}: InteractionOptions) {
  
  // ============================================================================
  // CORE STATE
  // ============================================================================
  const [state, setState] = useState<InteractionState>({
    mousePosition: null,
    mouseWorldPosition: null,
    isMouseDown: false,
    isDragging: false,
    dragStart: null,
    lastInteractionTime: 0
  });
  
  // Click detection state
  const lastClickRef = useRef<{ time: number; point: Point } | null>(null);
  const mouseDownRef = useRef<{ point: Point; worldPoint: Point; button: number; time: number } | null>(null);
  
  // ============================================================================
  // COORDINATE TRANSFORMATION
  // ============================================================================
  
  const screenToWorld = useCallback((screenPoint: Point): Point => {
    if (transformManager?.screenToWorld) {
      return transformManager.screenToWorld(screenPoint);
    }
    // Fallback: assume 1:1 mapping
    return { ...screenPoint };
  }, [transformManager]);
  
  const getCanvasPoint = useCallback((event: MouseEvent): Point | null => {
    if (!canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }, [canvasRef]);
  
  // ============================================================================
  // SNAP INTEGRATION
  // ============================================================================
  
  const applySnapping = useCallback((worldPoint: Point): Point => {
    if (!enableSnapping || !snapManager?.snap) {
      return worldPoint;
    }
    
    try {
      const snapResult = snapManager.snap(worldPoint);
      return snapResult?.point || worldPoint;
    } catch (error) {
      console.warn('🔺 InteractionEngine: Snap error:', error);
      return worldPoint;
    }
  }, [enableSnapping, snapManager]);
  
  // ============================================================================
  // MOUSE EVENT HANDLERS
  // ============================================================================
  
  const handleMouseDown = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const canvasPoint = getCanvasPoint(event);
    if (!canvasPoint) return;
    
    const worldPoint = screenToWorld(canvasPoint);
    const snappedWorldPoint = applySnapping(worldPoint);
    
    mouseDownRef.current = {
      point: canvasPoint,
      worldPoint: snappedWorldPoint,
      button: event.button,
      time: Date.now()
    };
    
    setState(prev => ({
      ...prev,
      mousePosition: canvasPoint,
      mouseWorldPosition: snappedWorldPoint,
      isMouseDown: true,
      isDragging: false,
      dragStart: canvasPoint,
      lastInteractionTime: Date.now()
    }));
    
    handlers.onCanvasMouseDown?.(canvasPoint, snappedWorldPoint, event.button);

  }, [getCanvasPoint, screenToWorld, applySnapping, handlers, activeTool]);
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const canvasPoint = getCanvasPoint(event);
    if (!canvasPoint) return;
    
    const worldPoint = screenToWorld(canvasPoint);
    const snappedWorldPoint = applySnapping(worldPoint);
    
    // Check for drag threshold
    const isDragging = Boolean(state.isMouseDown && state.dragStart &&
      (Math.abs(canvasPoint.x - state.dragStart.x) > dragThreshold ||
       Math.abs(canvasPoint.y - state.dragStart.y) > dragThreshold));
    
    setState(prev => ({
      ...prev,
      mousePosition: canvasPoint,
      mouseWorldPosition: snappedWorldPoint,
      isDragging,
      lastInteractionTime: Date.now(),
      isMouseDown: prev.isMouseDown,
      dragStart: prev.dragStart
    }));
    
    // Handle dragging
    if (isDragging && state.dragStart) {
      const delta = {
        x: canvasPoint.x - state.dragStart.x,
        y: canvasPoint.y - state.dragStart.y
      };
      handlers.onCanvasDrag?.(state.dragStart, canvasPoint, delta);
    }
    
    handlers.onCanvasMouseMove?.(canvasPoint, snappedWorldPoint);
  }, [getCanvasPoint, screenToWorld, applySnapping, state, dragThreshold, handlers]);
  
  const handleMouseUp = useCallback((event: MouseEvent) => {
    const canvasPoint = getCanvasPoint(event);
    if (!canvasPoint || !mouseDownRef.current) return;
    
    const worldPoint = screenToWorld(canvasPoint);
    const snappedWorldPoint = applySnapping(worldPoint);
    const mouseDownData = mouseDownRef.current;
    const upTime = Date.now();
    
    // Determine if this is a click (not a drag)
    const isClick = !state.isDragging && 
      (upTime - mouseDownData.time) < 500 &&
      Math.abs(canvasPoint.x - mouseDownData.point.x) < dragThreshold &&
      Math.abs(canvasPoint.y - mouseDownData.point.y) < dragThreshold;
    
    setState(prev => ({
      ...prev,
      isMouseDown: false,
      isDragging: false,
      dragStart: null,
      lastInteractionTime: upTime
    }));
    
    handlers.onCanvasMouseUp?.(canvasPoint, snappedWorldPoint, event.button);
    
    // Handle click detection
    if (isClick) {
      // Check for double click
      const isDoubleClick = lastClickRef.current &&
        (upTime - lastClickRef.current.time) < doubleClickTime &&
        Math.abs(canvasPoint.x - lastClickRef.current.point.x) < dragThreshold &&
        Math.abs(canvasPoint.y - lastClickRef.current.point.y) < dragThreshold;
      
      if (isDoubleClick) {
        handlers.onCanvasDoubleClick?.(canvasPoint, snappedWorldPoint);
        lastClickRef.current = null; // Prevent triple click

      } else {
        handlers.onCanvasClick?.(canvasPoint, snappedWorldPoint);
        lastClickRef.current = { time: upTime, point: canvasPoint };

      }
    }
    
    mouseDownRef.current = null;
  }, [getCanvasPoint, screenToWorld, applySnapping, state, dragThreshold, doubleClickTime, handlers, activeTool]);
  
  const handleWheel = useCallback((event: WheelEvent) => {
    if (handlers.onWheel) {
      event.preventDefault();
      handlers.onWheel(event);

    }
  }, [handlers, activeTool]);
  
  // ============================================================================
  // KEYBOARD EVENT HANDLERS  
  // ============================================================================
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboard) return;
    
    handlers.onKeyDown?.(event);

  }, [enableKeyboard, handlers, activeTool]);
  
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboard) return;
    
    handlers.onKeyUp?.(event);
  }, [enableKeyboard, handlers]);
  
  // ============================================================================
  // EVENT BINDING
  // ============================================================================
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    // Global mouse up (for drag release outside canvas)
    const handleGlobalMouseUp = (event: MouseEvent) => {
      if (state.isMouseDown) {
        handleMouseUp(event);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Keyboard events (if enabled)
    if (enableKeyboard) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      
      if (enableKeyboard) {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [
    canvasRef, 
    handleMouseDown, 
    handleMouseMove, 
    handleMouseUp, 
    handleWheel,
    handleKeyDown, 
    handleKeyUp, 
    enableKeyboard,
    state.isMouseDown
  ]);
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  return {
    // Current state
    state,
    
    // Position accessors
    mousePosition: state.mousePosition,
    mouseWorldPosition: state.mouseWorldPosition,
    
    // Interaction state
    isMouseDown: state.isMouseDown,
    isDragging: state.isDragging,
    
    // Utility functions
    screenToWorld,
    applySnapping,
    
    // Canvas utilities
    getCanvasPoint: (event: MouseEvent) => getCanvasPoint(event),
    
    // State queries
    isInteracting: () => state.isMouseDown || state.isDragging,
    getLastInteractionTime: () => state.lastInteractionTime,
    
    // Manual event triggers (for programmatic interaction)
    triggerClick: (point: Point) => {
      const worldPoint = screenToWorld(point);
      const snappedWorldPoint = applySnapping(worldPoint);
      handlers.onCanvasClick?.(point, snappedWorldPoint);
    }
  };
}