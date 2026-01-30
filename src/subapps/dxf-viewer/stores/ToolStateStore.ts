"use client";

/**
 * ToolStateStore - Centralized Tool State Management
 *
 * @description
 * Single Source of Truth for tool state across the DXF Viewer.
 * This store manages:
 * - Active tool selection (line, rectangle, circle, select, etc.)
 * - Tool completion behavior (allowsContinuous logic)
 * - Tool persistence after entity creation
 *
 * @pattern useSyncExternalStore (React 18+ native pattern)
 * @see {@link ToolStyleStore.ts} - Same pattern used for styling
 * @see {@link ToolStateManager.ts} - Tool metadata definitions
 *
 * @enterprise ADR-055: Centralized Tool State Persistence
 * Problem: Tool state was split between React useState (useDxfViewerState)
 *          and state machine (useDrawingMachine), causing desync
 * Solution: Single store that both systems subscribe to
 *
 * @author Anthropic Claude Code
 * @since 2026-01-30
 */

import { useSyncExternalStore } from 'react';
import type { ToolType } from '../ui/toolbar/types';
import { getToolMetadata } from '../systems/tools/ToolStateManager';

// ============================================================================
// TYPES
// ============================================================================

export interface ToolStateSnapshot {
  /** Current active tool */
  activeTool: ToolType;
  /** Previous tool (for returning after cancel) */
  previousTool: ToolType | null;
  /** Whether a tool transition is in progress */
  isTransitioning: boolean;
}

type Listener = () => void;

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

let current: ToolStateSnapshot = {
  activeTool: 'select',
  previousTool: null,
  isTransitioning: false,
};

const listeners = new Set<Listener>();

/**
 * Notify all subscribers of state change
 */
function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

/**
 * Centralized Tool State Store
 *
 * @example
 * ```tsx
 * // In any component:
 * import { toolStateStore, useToolState } from '../stores/ToolStateStore';
 *
 * // Read state (reactive)
 * const { activeTool, previousTool } = useToolState();
 *
 * // Update state
 * toolStateStore.selectTool('line');
 *
 * // After entity completion
 * toolStateStore.handleToolCompletion('line');
 * ```
 */
export const toolStateStore = {
  /**
   * Get current state snapshot
   */
  get(): ToolStateSnapshot {
    return current;
  },

  /**
   * Subscribe to state changes
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Select a tool
   *
   * @param tool - The tool to select
   */
  selectTool(tool: ToolType): void {
    if (current.activeTool === tool) {
      return; // No change needed
    }

    current = {
      activeTool: tool,
      previousTool: current.activeTool,
      isTransitioning: true,
    };
    notifyListeners();

    // Reset transitioning state after brief delay
    setTimeout(() => {
      current = { ...current, isTransitioning: false };
      notifyListeners();
    }, 50);
  },

  /**
   * Deselect current tool (return to 'select')
   */
  deselectTool(): void {
    if (current.activeTool === 'select') {
      return; // Already at select
    }

    current = {
      activeTool: 'select',
      previousTool: current.activeTool,
      isTransitioning: false,
    };
    notifyListeners();
  },

  /**
   * Handle tool completion after entity creation
   *
   * This is the SINGLE SOURCE OF TRUTH for the continuous mode decision.
   * Pattern: AutoCAD/BricsCAD - tools with allowsContinuous=true stay active
   *
   * @param tool - The tool that just completed an action
   * @param forceDeselect - Force return to 'select' (e.g., on ESC/cancel)
   */
  handleToolCompletion(tool: ToolType, forceDeselect: boolean = false): void {
    if (forceDeselect) {
      // Explicit cancel - always return to select
      current = {
        activeTool: 'select',
        previousTool: tool,
        isTransitioning: false,
      };
      notifyListeners();
      return;
    }

    // Check tool metadata for continuous mode
    const metadata = getToolMetadata(tool);

    if (!metadata.allowsContinuous) {
      // Non-continuous tool - return to select after completion
      current = {
        activeTool: 'select',
        previousTool: tool,
        isTransitioning: false,
      };
      notifyListeners();
    }
    // 🏢 ENTERPRISE: If allowsContinuous=true, tool stays active (no state change)
  },

  /**
   * Return to previous tool (if exists)
   */
  returnToPreviousTool(): void {
    if (current.previousTool && current.previousTool !== current.activeTool) {
      current = {
        activeTool: current.previousTool,
        previousTool: current.activeTool,
        isTransitioning: false,
      };
      notifyListeners();
    } else {
      this.deselectTool();
    }
  },

  /**
   * Reset store to initial state
   */
  reset(): void {
    current = {
      activeTool: 'select',
      previousTool: null,
      isTransitioning: false,
    };
    notifyListeners();
  },
};

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook to subscribe to tool state changes
 *
 * @returns Current tool state snapshot
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeTool, previousTool, isTransitioning } = useToolState();
 *
 *   return <div>Current tool: {activeTool}</div>;
 * }
 * ```
 */
export function useToolState(): ToolStateSnapshot {
  return useSyncExternalStore(
    toolStateStore.subscribe,
    toolStateStore.get,
    toolStateStore.get // Server snapshot (same as client for this use case)
  );
}

/**
 * Hook to get just the active tool (optimized for components that only need this)
 *
 * @returns Current active tool
 */
export function useActiveTool(): ToolType {
  const state = useToolState();
  return state.activeTool;
}
