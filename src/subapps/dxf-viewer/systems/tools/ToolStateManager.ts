/**
 * Tool State Manager - Centralized tool lifecycle and state management
 * Unifies scattered tool validation, state transitions, and category logic
 */

import { useState, useCallback, useRef } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { ToolType } from '../../ui/toolbar/types';
import type { DrawingTool } from '../../hooks/drawing/useUnifiedDrawing';

// Tool categories and validation
// 🏢 ENTERPRISE (Phase 3): Added 'editing' category for move/copy/delete operations
export type ToolCategory = 'selection' | 'drawing' | 'measurement' | 'zoom' | 'utility' | 'editing';

export interface ToolInfo {
  id: ToolType;
  category: ToolCategory;
  requiresCanvas: boolean;
  canInterrupt: boolean;
  allowsContinuous: boolean;
}

// Centralized tool definitions
const TOOL_DEFINITIONS: Record<ToolType, ToolInfo> = {
  'select': { id: 'select', category: 'selection', requiresCanvas: true, canInterrupt: false, allowsContinuous: true },
  'line': { id: 'line', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'rectangle': { id: 'rectangle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'circle': { id: 'circle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'circle-diameter': { id: 'circle-diameter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'circle-2p-diameter': { id: 'circle-2p-diameter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'polyline': { id: 'polyline', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true },
  'polygon': { id: 'polygon', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-distance': { id: 'measure-distance', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-area': { id: 'measure-area', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-angle': { id: 'measure-angle', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-angle-line-arc': { id: 'measure-angle-line-arc', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-angle-two-arcs': { id: 'measure-angle-two-arcs', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-angle-measuregeom': { id: 'measure-angle-measuregeom', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'measure-angle-constraint': { id: 'measure-angle-constraint', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'zoom-in': { id: 'zoom-in', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false },
  'zoom-out': { id: 'zoom-out', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false },
  'zoom-extents': { id: 'zoom-extents', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false },
  'zoom-window': { id: 'zoom-window', category: 'zoom', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'pan': { id: 'pan', category: 'utility', requiresCanvas: true, canInterrupt: false, allowsContinuous: true },
  'grid-toggle': { id: 'grid-toggle', category: 'utility', requiresCanvas: false, canInterrupt: false, allowsContinuous: false },
  // 🏢 ENTERPRISE (Phase 3): Editing tools for entity manipulation
  'move': { id: 'move', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true },
  'copy': { id: 'copy', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false },
  'delete': { id: 'delete', category: 'editing', requiresCanvas: false, canInterrupt: false, allowsContinuous: false },
  'grip-edit': { id: 'grip-edit', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true },
  'layering': { id: 'layering', category: 'utility', requiresCanvas: true, canInterrupt: true, allowsContinuous: true },
};

export interface ToolStateManagerOptions {
  initialTool?: ToolType;
  onToolChange?: (newTool: ToolType, previousTool: ToolType) => void;
  onToolValidation?: (tool: ToolType, isValid: boolean) => void;
}

export interface ToolTransition {
  from: ToolType;
  to: ToolType;
  timestamp: number;
  reason: 'user' | 'system' | 'interrupt' | 'complete';
}

export function useToolStateManager({
  initialTool = 'select',
  onToolChange,
  onToolValidation
}: ToolStateManagerOptions = {}) {
  
  // ============================================================================
  // CORE STATE
  // ============================================================================
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionHistory = useRef<ToolTransition[]>([]);
  const previousTool = useRef<ToolType>(initialTool);

  // ============================================================================
  // TOOL VALIDATION & CATEGORIZATION
  // ============================================================================
  
  const getToolInfo = useCallback((tool: ToolType): ToolInfo => {
    return TOOL_DEFINITIONS[tool] || TOOL_DEFINITIONS['select'];
  }, []);

  const getToolCategory = useCallback((tool: ToolType): ToolCategory => {
    return getToolInfo(tool).category;
  }, [getToolInfo]);

  const isDrawingTool = useCallback((tool: ToolType): boolean => {
    return getToolCategory(tool) === 'drawing';
  }, [getToolCategory]);

  const isMeasurementTool = useCallback((tool: ToolType): boolean => {
    return getToolCategory(tool) === 'measurement';
  }, [getToolCategory]);

  const isZoomTool = useCallback((tool: ToolType): boolean => {
    return getToolCategory(tool) === 'zoom';
  }, [getToolCategory]);

  const isInteractiveTool = useCallback((tool: ToolType): boolean => {
    const info = getToolInfo(tool);
    return info.requiresCanvas && (info.category === 'drawing' || info.category === 'measurement');
  }, [getToolInfo]);

  const validateTool = useCallback((tool: ToolType): boolean => {
    const isValid = tool in TOOL_DEFINITIONS;
    onToolValidation?.(tool, isValid);
    
    if (!isValid) {
      console.warn(`⚠️ ToolStateManager: Invalid tool "${tool}"`);
    }
    
    return isValid;
  }, [onToolValidation]);

  // ============================================================================
  // TOOL TRANSITIONS
  // ============================================================================

  const canTransitionTo = useCallback((newTool: ToolType): boolean => {
    if (!validateTool(newTool)) return false;
    
    const currentInfo = getToolInfo(activeTool);
    const newInfo = getToolInfo(newTool);
    
    // Always allow transition to select
    if (newTool === 'select') return true;
    
    // Allow zoom tools from any state
    if (newInfo.category === 'zoom') return true;
    
    // Allow interruption if current tool supports it
    if (currentInfo.canInterrupt) return true;
    
    // Allow if not currently in an interactive tool
    if (!isInteractiveTool(activeTool)) return true;
    
    console.warn(`⚠️ ToolStateManager: Cannot transition from ${activeTool} to ${newTool}`);
    return false;
  }, [activeTool, validateTool, getToolInfo, isInteractiveTool]);

  const recordTransition = useCallback((
    from: ToolType, 
    to: ToolType, 
    reason: ToolTransition['reason']
  ) => {
    const transition: ToolTransition = {
      from,
      to,
      timestamp: Date.now(),
      reason
    };
    
    transitionHistory.current.push(transition);
    
    // Keep only last 50 transitions
    if (transitionHistory.current.length > 50) {
      transitionHistory.current = transitionHistory.current.slice(-50);
    }

  }, []);

  const setTool = useCallback((
    newTool: ToolType, 
    reason: ToolTransition['reason'] = 'user'
  ): boolean => {
    if (newTool === activeTool) {

      return true;
    }

    if (!canTransitionTo(newTool)) {
      return false;
    }

    setIsTransitioning(true);
    
    const oldTool = activeTool;
    previousTool.current = oldTool;
    
    setActiveTool(newTool);
    recordTransition(oldTool, newTool, reason);
    onToolChange?.(newTool, oldTool);
    
    // Brief transition state
    setTimeout(() => setIsTransitioning(false), PANEL_LAYOUT.TIMING.TOOL_TRANSITION);
    
    return true;
  }, [activeTool, canTransitionTo, recordTransition, onToolChange]);

  const cancelCurrentTool = useCallback((): boolean => {
    return setTool('select', 'system');
  }, [setTool]);

  const returnToPreviousTool = useCallback((): boolean => {
    if (previousTool.current && previousTool.current !== activeTool) {
      return setTool(previousTool.current, 'system');
    }
    return cancelCurrentTool();
  }, [activeTool, setTool, cancelCurrentTool]);

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  const getCurrentToolInfo = useCallback((): ToolInfo => {
    return getToolInfo(activeTool);
  }, [activeTool, getToolInfo]);

  const getTransitionHistory = useCallback((): readonly ToolTransition[] => {
    return [...transitionHistory.current];
  }, []);

  const canContinue = useCallback((): boolean => {
    return getCurrentToolInfo().allowsContinuous;
  }, [getCurrentToolInfo]);

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // Current state
    activeTool,
    isTransitioning,
    previousTool: previousTool.current,
    
    // Tool information
    getToolInfo,
    getToolCategory,
    getCurrentToolInfo,
    
    // Tool validation
    validateTool,
    isDrawingTool,
    isMeasurementTool,
    isZoomTool,
    isInteractiveTool,
    
    // State transitions
    setTool,
    canTransitionTo,
    cancelCurrentTool,
    returnToPreviousTool,
    
    // State queries
    canContinue,
    getTransitionHistory,
    
    // Utility
    isCurrentTool: (tool: ToolType) => activeTool === tool,
    isCategory: (category: ToolCategory) => getToolCategory(activeTool) === category
  };
}