"use client";

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
import { createExternalStore } from './createExternalStore';

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

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). Patch-merge shape; the
// hand-rolled store always notified on `set`/`reset` (no identity guard) — factory
// used WITHOUT `equals`, byte-identical always-notify behaviour.
const store = createExternalStore<CompletionStyle>({ ...DEFAULT_COMPLETION_STYLE });

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
    return store.get();
  },

  /**
   * Update completion styles (partial update supported)
   * Notifies all subscribers after update
   *
   * @param next - Partial style updates
   */
  set(next: Partial<CompletionStyle>) {
    store.set({ ...store.get(), ...next });
  },

  /**
   * Reset to default completion styles
   */
  reset() {
    store.set({ ...DEFAULT_COMPLETION_STYLE });
  },

  /**
   * Subscribe to style changes
   * @param callback - Function to call on changes
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    return store.subscribe(callback);
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
