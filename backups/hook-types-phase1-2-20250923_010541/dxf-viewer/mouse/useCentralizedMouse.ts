/**
 * Centralized Mouse System
 * Integrates all mouse interactions with clear priority system
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_CENTRALIZED_MOUSE = false;

import React, { useEffect, useCallback } from 'react';
import { useMouseStateManager, MouseMode } from './MouseStateManager';
import { createGripDragHandler } from './handlers/GripDragHandler';
import { createMarqueeSelectionHandler } from './handlers/MarqueeSelectionHandler';
import { createHoverHandler } from './handlers/HoverHandler';
import type { Point2D, SceneModel } from '../types/scene';

export interface CentralizedMouseOptions {
  // Scene and selection state
  scene: SceneModel | null;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  hoverIdRef: React.MutableRefObject<string | null>;
  
  // Canvas and transform
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  transformRef: React.MutableRefObject<any>;
  
  // Settings
  gripSettings: any;
  activeTool: string;
  
  // Rendering
  render: (scene: SceneModel) => void;
  marqueeOverlayRef: React.MutableRefObject<{ start: Point2D; end: Point2D } | null>;
  
  // Callbacks
  onSelectionChange: (entityIds: string[]) => void;
  onHoverChange: (entityId: string | null) => void;
  onGeometryUpdate: (entityId: string, geometry: any) => void;
  onCommitGeometry: (entityId: string, geometry: any) => void;
  setCursor: (cursor: string) => void;
  
  // Mouse position tracking
  updateMousePosition: (point: Point2D) => void;
}

export function useCentralizedMouse(options: CentralizedMouseOptions) {
  const {
    state,
    registerHandler,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cancel,
    forceMode
  } = useMouseStateManager();

  const {
    scene,
    selectedIdsRef,
    hoverIdRef,
    canvasRef,
    transformRef,
    gripSettings,
    activeTool,
    render,
    marqueeOverlayRef,
    onSelectionChange,
    onHoverChange,
    onGeometryUpdate,
    onCommitGeometry,
    setCursor,
    updateMousePosition
  } = options;

  // Register all mouse interaction handlers
  useEffect(() => {
    if (DEBUG_CENTRALIZED_MOUSE) console.log('🎯 [CentralizedMouse] Registering all mouse handlers');

    // 1. Grip Drag Handler (Highest Priority)
    const gripDragHandler = createGripDragHandler({
      scene,
      selectedIdsRef,
      transformRef,
      canvasRef,
      gripSettings,
      onGeometryUpdate,
      onCommit: onCommitGeometry,
      setCursor,
      render
    });
    registerHandler(gripDragHandler);

    // 2. Marquee Selection Handler (Medium Priority)
    const marqueeHandler = createMarqueeSelectionHandler({
      scene,
      selectedIdsRef,
      activeTool,
      onSelectionChange,
      marqueeOverlayRef,
      render
    });
    registerHandler(marqueeHandler);

    // 3. Hover Handler (Low Priority)
    const hoverHandler = createHoverHandler({
      scene,
      selectedIdsRef,
      hoverIdRef,
      transformRef,
      canvasRef,
      onHoverChange,
      render,
      setCursor
    });
    registerHandler(hoverHandler);

    if (DEBUG_CENTRALIZED_MOUSE) console.log('🎯 [CentralizedMouse] All handlers registered successfully');
  }, [
    scene,
    selectedIdsRef,
    hoverIdRef,
    canvasRef,
    transformRef,
    gripSettings,
    activeTool,
    render,
    marqueeOverlayRef,
    onSelectionChange,
    onHoverChange,
    onGeometryUpdate,
    onCommitGeometry,
    setCursor,
    registerHandler
  ]);

  // Handle mouse position updates
  const handleMouseMove = useCallback((point: Point2D, event?: React.MouseEvent<HTMLCanvasElement>) => {
    // Always update mouse position for crosshair
    updateMousePosition(point);

    // Let state manager handle the interaction
    const handled = onMouseMove(point, event);

    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] MouseMove: mode=${MouseMode[state.mode]}, handled=${handled}`);

    return handled;
  }, [onMouseMove, updateMousePosition, state.mode]);

  // Handle mouse down
  const handleMouseDown = useCallback((point: Point2D, event?: React.MouseEvent<HTMLCanvasElement>) => {
    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] MouseDown at: ${point.x}, ${point.y}`);

    const handled = onMouseDown(point, event);

    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] MouseDown: handled=${handled}, new_mode=${MouseMode[state.mode]}`);

    return handled;
  }, [onMouseDown, state.mode]);

  // Handle mouse up
  const handleMouseUp = useCallback((event?: React.MouseEvent<HTMLCanvasElement>) => {
    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] MouseUp: current_mode=${MouseMode[state.mode]}`);

    onMouseUp(event);

    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] MouseUp: completed, new_mode=${MouseMode[state.mode]}`);
  }, [onMouseUp, state.mode]);

  // Handle escape key (cancel current interaction)
  const handleEscape = useCallback(() => {
    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] Escape pressed: canceling ${MouseMode[state.mode]} mode`);
    cancel();
  }, [cancel, state.mode]);

  // Update cursor based on current mode
  useEffect(() => {
    const currentMode = MouseMode[state.mode];
    if (DEBUG_CENTRALIZED_MOUSE) console.log(`🎯 [CentralizedMouse] Mode changed to: ${currentMode}`);

    // Mode-specific cursor handling is done by individual handlers
    // But we can set default cursors for modes here if needed
    switch (state.mode) {
      case MouseMode.IDLE:
        setCursor('crosshair');
        break;
      case MouseMode.GRIP_DRAG:
        setCursor('grabbing');
        break;
      // Other modes handle their own cursors
    }
  }, [state.mode, setCursor]);

  return {
    // Mouse event handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleEscape,
    
    // Current state
    currentMode: state.mode,
    isActive: state.mode !== MouseMode.IDLE,
    isDragging: state.isPressed && state.mode !== MouseMode.IDLE,
    
    // State manager controls (for special cases)
    forceMode,
    cancel,
    
    // Current mouse state
    mouseState: state
  };
}