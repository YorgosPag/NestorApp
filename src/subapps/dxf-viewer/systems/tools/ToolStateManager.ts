/**
 * Tool State Manager - Centralized tool lifecycle and state management
 * Unifies scattered tool validation, state transitions, and category logic
 */

import { useState, useCallback, useRef } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { ToolType } from '../../ui/toolbar/types';

// Tool categories and validation
// 🏢 ENTERPRISE (Phase 3): Added 'editing' category for move/copy/delete operations
export type ToolCategory = 'selection' | 'drawing' | 'measurement' | 'zoom' | 'utility' | 'editing';

export interface ToolInfo {
  id: ToolType;
  category: ToolCategory;
  requiresCanvas: boolean;
  canInterrupt: boolean;
  allowsContinuous: boolean;
  /** 🏢 ENTERPRISE (2026-01-26): ADR-033 - Whether this tool preserves overlay draw mode when active */
  preservesOverlayMode: boolean;
}

// Centralized tool definitions
// 🏢 ENTERPRISE (2026-01-26): ADR-033 - Added preservesOverlayMode metadata for overlay draw mode lifecycle
const TOOL_DEFINITIONS: Record<ToolType, ToolInfo> = {
  // Selection tools - preserve overlay mode for editing
  'select': { id: 'select', category: 'selection', requiresCanvas: true, canInterrupt: false, allowsContinuous: true, preservesOverlayMode: true },

  // Drawing tools - cancel overlay mode (CAD drawing ≠ overlay drawing)
  // 🏢 ENTERPRISE (2026-01-30): allowsContinuous=true for all drawing tools
  // Pattern: User preference - tool stays active after entity creation for rapid drawing
  'line': { id: 'line', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // 🏢 ENTERPRISE (2026-01-31): Line Perpendicular & Parallel tools - ADR-060
  // Entity selection mode: user picks reference line, then clicks to create new line
  'line-perpendicular': { id: 'line-perpendicular', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'line-parallel': { id: 'line-parallel', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'rectangle': { id: 'rectangle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle': { id: 'circle', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-diameter': { id: 'circle-diameter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-2p-diameter': { id: 'circle-2p-diameter', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-3p': { id: 'circle-3p', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-chord-sagitta': { id: 'circle-chord-sagitta', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-2p-radius': { id: 'circle-2p-radius', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'circle-best-fit': { id: 'circle-best-fit', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // 🏢 ENTERPRISE (2026-01-31): Circle Tangent to 3 Lines (AutoCAD TTT style)
  // Uses entity selection mode - user picks 3 lines, system calculates incircle
  'circle-ttt': { id: 'circle-ttt', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'polyline': { id: 'polyline', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'polygon': { id: 'polygon', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'ellipse': { id: 'ellipse', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // 🏢 ENTERPRISE (2026-01-31): Arc drawing tools - ADR-059
  // AutoCAD pattern: Arc tools require 3 points (or 2 + input for some variants)
  'arc': { id: 'arc', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'arc-3p': { id: 'arc-3p', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'arc-cse': { id: 'arc-cse', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'arc-sce': { id: 'arc-sce', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },

  // Measurement tools - cancel overlay mode (measurement ≠ overlay drawing)
  // 🏢 ENTERPRISE FIX (2026-01-26): allowsContinuous: true for consecutive measurements
  // Pattern: AutoCAD/BricsCAD - measurement tools stay active for multiple measurements
  'measure': { id: 'measure', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-distance': { id: 'measure-distance', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // 🏢 ENTERPRISE (2026-01-27): Continuous distance measurement - AutoCAD MEASUREGEOM pattern
  // Creates separate measurement entities for each pair of points, continues until double-click/Escape
  'measure-distance-continuous': { id: 'measure-distance-continuous', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-area': { id: 'measure-area', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle': { id: 'measure-angle', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-line-arc': { id: 'measure-angle-line-arc', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-two-arcs': { id: 'measure-angle-two-arcs', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-measuregeom': { id: 'measure-angle-measuregeom', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-angle-constraint': { id: 'measure-angle-constraint', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-radius': { id: 'measure-radius', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'measure-perimeter': { id: 'measure-perimeter', category: 'measurement', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },

  // Zoom tools - cancel overlay mode (zoom interaction ≠ overlay drawing)
  'zoom-in': { id: 'zoom-in', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'zoom-out': { id: 'zoom-out', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'zoom-extents': { id: 'zoom-extents', category: 'zoom', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'zoom-window': { id: 'zoom-window', category: 'zoom', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },

  // Utility tools - pan doesn't interact with overlay drawing
  'pan': { id: 'pan', category: 'utility', requiresCanvas: true, canInterrupt: false, allowsContinuous: true, preservesOverlayMode: false },

  // 🏢 ENTERPRISE (Phase 3): Editing tools for entity manipulation
  'move': { id: 'move', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'rotate': { id: 'rotate', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'copy': { id: 'copy', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'delete': { id: 'delete', category: 'editing', requiresCanvas: false, canInterrupt: false, allowsContinuous: false, preservesOverlayMode: false },
  'grip-edit': { id: 'grip-edit', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: true },

  // 🏢 ENTERPRISE: Layering tool - ALWAYS preserves overlay mode (it's the overlay management tool!)
  'layering': { id: 'layering', category: 'utility', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: true },
  // ADR-189: Construction guide tools
  'guide-x': { id: 'guide-x', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-z': { id: 'guide-z', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-parallel': { id: 'guide-parallel', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-delete': { id: 'guide-delete', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-xz': { id: 'guide-xz', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-perpendicular': { id: 'guide-perpendicular', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 §3.7-3.16: Construction snap point tools
  'guide-segments': { id: 'guide-segments', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-distance': { id: 'guide-distance', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-add-point': { id: 'guide-add-point', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-delete-point': { id: 'guide-delete-point', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // ADR-189 §3.9/3.10/3.12: Arc guide tools
  'guide-arc-segments': { id: 'guide-arc-segments', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-arc-distance': { id: 'guide-arc-distance', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  'guide-arc-line-intersect': { id: 'guide-arc-line-intersect', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  'guide-circle-intersect': { id: 'guide-circle-intersect', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: false, preservesOverlayMode: false },
  // ADR-189 B5: Guide drag move tool
  'guide-move': { id: 'guide-move', category: 'editing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
  // Center of rectangle formed by 4 guides
  'guide-rect-center': { id: 'guide-rect-center', category: 'drawing', requiresCanvas: true, canInterrupt: true, allowsContinuous: true, preservesOverlayMode: false },
};

// ============================================================================
// 🏢 ENTERPRISE HELPER FUNCTIONS (ADR-033)
// Standalone functions for tool metadata access without hook dependency
// ============================================================================

/**
 * Get tool metadata from centralized definitions
 * @param tool - The tool type to query
 * @returns ToolInfo for the specified tool, defaults to 'select' if not found
 */
export function getToolMetadata(tool: ToolType): ToolInfo {
  return TOOL_DEFINITIONS[tool] ?? TOOL_DEFINITIONS['select'];
}

/**
 * Check if a tool preserves overlay draw mode when activated
 * Used by DxfViewerContent to determine overlay mode lifecycle
 *
 * @param tool - The tool type to check
 * @returns true if the tool keeps overlay draw mode active, false if it should cancel
 *
 * @example
 * // In DxfViewerContent.tsx:
 * if (overlayMode === 'draw' && !preservesOverlayMode(activeTool)) {
 *   setOverlayMode('select');
 *   eventBus.emit('overlay:cancel-polygon', undefined);
 * }
 */
export function preservesOverlayMode(tool: ToolType): boolean {
  return getToolMetadata(tool).preservesOverlayMode;
}

/**
 * Get all tools that preserve overlay mode (for debugging/documentation)
 * @returns Array of tool types that preserve overlay draw mode
 */
export function getOverlayCompatibleTools(): ToolType[] {
  return (Object.keys(TOOL_DEFINITIONS) as ToolType[]).filter(
    tool => TOOL_DEFINITIONS[tool].preservesOverlayMode
  );
}

// ============================================================================
// 🏢 ENTERPRISE (2026-01-26): STANDALONE TOOL CATEGORY FUNCTIONS
// Single Source of Truth for tool type detection - use these everywhere!
// ADR-036: Centralized Tool Detection - eliminates duplicate tool lists
// ============================================================================

/**
 * Check if a tool is a drawing tool (line, circle, polygon, etc.)
 * ENTERPRISE: This is the SINGLE SOURCE OF TRUTH for drawing tool detection
 *
 * @param tool - The tool type to check (can be string for flexibility)
 * @returns true if the tool is in the 'drawing' category
 *
 * @example
 * if (isDrawingTool(activeTool)) {
 *   // Handle drawing-specific logic
 * }
 */
export function isDrawingTool(tool: string | undefined | null): boolean {
  if (!tool) return false;
  const info = TOOL_DEFINITIONS[tool as ToolType];
  return info?.category === 'drawing';
}

/**
 * Check if a tool is a measurement tool (measure-distance, measure-area, etc.)
 * ENTERPRISE: This is the SINGLE SOURCE OF TRUTH for measurement tool detection
 *
 * @param tool - The tool type to check (can be string for flexibility)
 * @returns true if the tool is in the 'measurement' category
 *
 * @example
 * if (isMeasurementTool(activeTool)) {
 *   // Handle measurement-specific logic
 * }
 */
export function isMeasurementTool(tool: string | undefined | null): boolean {
  if (!tool) return false;
  const info = TOOL_DEFINITIONS[tool as ToolType];
  return info?.category === 'measurement';
}

/**
 * Check if a tool is an interactive tool (requires canvas clicks for operation)
 * Interactive tools are: drawing + measurement tools
 * ENTERPRISE: This is the SINGLE SOURCE OF TRUTH for interactive tool detection
 *
 * @param tool - The tool type to check (can be string for flexibility)
 * @returns true if the tool is drawing or measurement category
 *
 * @example
 * if (isInteractiveTool(activeTool)) {
 *   onDrawingHover(worldPos); // Show preview during drawing/measurement
 * }
 */
export function isInteractiveTool(tool: string | undefined | null): boolean {
  return isDrawingTool(tool) || isMeasurementTool(tool);
}

/**
 * Check if the application is in ANY drawing mode
 * This includes: CAD drawing tools, measurement tools, AND overlay polygon drawing
 * ENTERPRISE: This is the SINGLE SOURCE OF TRUTH for "should we show preview/handle drawing events?"
 *
 * @param tool - The active tool type
 * @param overlayMode - The current overlay mode ('select' | 'draw' | 'edit')
 * @returns true if ANY drawing/measurement operation is active
 *
 * @example
 * // In mouse handlers:
 * if (isInDrawingMode(activeTool, overlayMode)) {
 *   onDrawingHover(worldPos); // Show preview line
 * }
 *
 * @example
 * // In selection handlers:
 * if (!isInDrawingMode(activeTool, overlayMode)) {
 *   cursor.startSelection(screenPos); // Only allow selection when NOT drawing
 * }
 */
export function isInDrawingMode(
  tool: string | undefined | null,
  overlayMode?: 'select' | 'draw' | 'edit' | null
): boolean {
  // CAD drawing/measurement tools
  if (isInteractiveTool(tool)) return true;

  // Overlay polygon drawing mode
  if (overlayMode === 'draw') return true;

  return false;
}

/**
 * Check if a tool allows continuous operation (multiple uses without reselecting)
 * ENTERPRISE: Use this to determine if tool should stay active after completing an action
 *
 * @param tool - The tool type to check (can be string for flexibility)
 * @returns true if the tool supports continuous operation
 *
 * @example
 * if (allowsContinuous(activeTool)) {
 *   startNewDrawing(); // Start next measurement immediately
 * } else {
 *   setActiveTool('select'); // Return to select after completion
 * }
 */
export function allowsContinuous(tool: string | undefined | null): boolean {
  if (!tool) return false;
  const info = TOOL_DEFINITIONS[tool as ToolType];
  return info?.allowsContinuous ?? false;
}

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