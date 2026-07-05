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
// 🏢 ADR-098: Centralized Timing Constants
import { UI_TIMING } from '../config/timing-config';
import { createExternalStore } from './createExternalStore';

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

const INITIAL_STATE: ToolStateSnapshot = {
  activeTool: 'select',
  previousTool: null,
  isTransitioning: false,
};

// SSoT pub/sub via createExternalStore (WAVE 2.6). `current`/`listeners`/
// `notifyListeners()` collapse into this single store (always-notify, no
// `equals` — matches the original unconditional `listeners.forEach(...)`).
const store = createExternalStore<ToolStateSnapshot>(INITIAL_STATE);

// Escape reactivation lock (ADR-362 hotfix): after ESC cancels a tool, block
// selectTool() for the same tool for ESCAPE_REACTIVATION_LOCK ms.
// Prevents RibbonSplitDropdown onClick from re-activating the just-escaped tool.
let escapedTool: ToolType | null = null;
let escapeExpiresAt = 0;

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
    return store.get();
  },

  /**
   * Subscribe to state changes
   */
  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },

  /**
   * Select a tool
   *
   * @param tool - The tool to select
   */
  selectTool(tool: ToolType): void {
    // Escape reactivation lock: ignore same-tool re-activation within lock window
    if (tool === escapedTool && Date.now() < escapeExpiresAt) {
      return;
    }
    if (store.get().activeTool === tool) {
      return; // No change needed
    }

    store.set({
      activeTool: tool,
      previousTool: store.get().activeTool,
      isTransitioning: true,
    });

    // Reset transitioning state after brief delay
    // 🏢 ADR-098: Using UI_TIMING.TOOL_TRANSITION_RESET
    setTimeout(() => {
      store.set({ ...store.get(), isTransitioning: false });
    }, UI_TIMING.TOOL_TRANSITION_RESET);
  },

  /**
   * Deselect current tool (return to 'select')
   */
  deselectTool(): void {
    if (store.get().activeTool === 'select') {
      return; // Already at select
    }

    store.set({
      activeTool: 'select',
      previousTool: store.get().activeTool,
      isTransitioning: false,
    });
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
      // Set escape lock to block RibbonSplitDropdown re-activation race
      escapedTool = tool;
      escapeExpiresAt = Date.now() + UI_TIMING.ESCAPE_REACTIVATION_LOCK;
      store.set({
        activeTool: 'select',
        previousTool: tool,
        isTransitioning: false,
      });
      return;
    }

    // Check tool metadata for continuous mode
    const metadata = getToolMetadata(tool);

    if (!metadata.allowsContinuous) {
      // Non-continuous tool - return to select after completion
      store.set({
        activeTool: 'select',
        previousTool: tool,
        isTransitioning: false,
      });
    }
    // 🏢 ENTERPRISE: If allowsContinuous=true, tool stays active (no state change)
  },

  /**
   * Return to previous tool (if exists)
   */
  returnToPreviousTool(): void {
    const snapshot = store.get();
    if (snapshot.previousTool && snapshot.previousTool !== snapshot.activeTool) {
      store.set({
        activeTool: snapshot.previousTool,
        previousTool: snapshot.activeTool,
        isTransitioning: false,
      });
    } else {
      this.deselectTool();
    }
  },

  /**
   * Reset store to initial state
   */
  reset(): void {
    escapedTool = null;
    escapeExpiresAt = 0;
    // NOTE: `store.set(...)`, NOT `store.reset(...)` — this is a runtime/public
    // API reset (called by app code + tests), not a test-lifecycle teardown.
    // It must notify still-attached subscribers (useToolState-bound components)
    // and must NOT drop them, matching the original `current = ...; notifyListeners();`.
    store.set({
      activeTool: 'select',
      previousTool: null,
      isTransitioning: false,
    });
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
