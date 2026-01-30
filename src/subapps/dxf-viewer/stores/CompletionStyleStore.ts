/**
 * @module CompletionStyleStore
 * @description ADR-056: Centralized Entity Completion Styles Store
 *
 * ENTERPRISE PATTERN: Mirrors ToolStyleStore for completion phase
 * - Global store accessible from anywhere (no React context required)
 * - Synchronized with DxfSettingsContext via StyleManagerProvider
 * - Single source of truth for completion styles
 *
 * ARCHITECTURE (Same as Preview System):
 * ```
 * DxfSettingsContext → StyleManagerProvider → completionStyleStore
 *                                                    ↓
 *                                          applyCompletionStyles()
 *                                                    ↓
 *                                            Entity Creation
 * ```
 *
 * @example
 * ```typescript
 * // Reading styles (no React required)
 * const styles = completionStyleStore.get();
 *
 * // Applying to entity
 * import { applyCompletionStyles } from '../hooks/useLineCompletionStyle';
 * applyCompletionStyles(entity); // Reads from store automatically
 * ```
 *
 * @author Anthropic Claude Code
 * @since 2026-01-30
 * @see ADR-056 in centralized_systems.md
 */

import { useSyncExternalStore } from 'react';
import type { LineType } from '../settings-core/types';

/**
 * Completion style interface
 * Matches ToolStyle interface for consistency
 */
export interface CompletionStyle {
  enabled: boolean;
  color: string;
  fillColor: string;
  lineWidth: number;
  opacity: number;
  lineType: LineType;
  dashScale: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  dashOffset: number;
  breakAtCenter: boolean;
}

// Default completion styles (white lines - typical for completed entities)
const DEFAULT_COMPLETION_STYLE: CompletionStyle = {
  enabled: true,
  color: '#FFFFFF',
  fillColor: 'transparent',
  lineWidth: 1,
  opacity: 1,
  lineType: 'solid' as LineType,
  dashScale: 1.0,
  lineCap: 'round',
  lineJoin: 'round',
  dashOffset: 0,
  breakAtCenter: false,
};

// Store state
let current: CompletionStyle = { ...DEFAULT_COMPLETION_STYLE };

// Subscribers for reactive updates
type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Completion Style Store
 *
 * ENTERPRISE PATTERN: Global store with subscribe/notify pattern
 * Same API as toolStyleStore for consistency
 */
export const completionStyleStore = {
  /**
   * Get current completion styles
   * @returns Current CompletionStyle object
   */
  get(): CompletionStyle {
    return current;
  },

  /**
   * Update completion styles (partial update supported)
   * Notifies all subscribers after update
   *
   * @param next - Partial style updates
   */
  set(next: Partial<CompletionStyle>) {
    current = { ...current, ...next };
    listeners.forEach(listener => listener());
  },

  /**
   * Reset to default completion styles
   */
  reset() {
    current = { ...DEFAULT_COMPLETION_STYLE };
    listeners.forEach(listener => listener());
  },

  /**
   * Subscribe to style changes
   * @param callback - Function to call on changes
   * @returns Unsubscribe function
   */
  subscribe(callback: Listener): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};

/**
 * React hook for completion styles
 * Uses useSyncExternalStore for optimal React integration
 *
 * @returns Current CompletionStyle object (reactive)
 */
export function useCompletionStyle(): CompletionStyle {
  return useSyncExternalStore(
    completionStyleStore.subscribe,
    completionStyleStore.get,
    completionStyleStore.get // Server snapshot (same as client)
  );
}
