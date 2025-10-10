/**
 * @file Grip Style Adapter - Legacy Store → Port Implementation
 * @module settings/sync/adapters/gripStyleAdapter
 *
 * ✅ ENTERPRISE: Adapter Pattern - Wraps legacy gripStyleStore
 *
 * **RESPONSIBILITY**: Translate between GripStylePort interface and legacy store
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { GripStylePort } from '../ports';
import { gripStyleStore } from '../../../stores/GripStyleStore';

/**
 * Grip Style Adapter
 *
 * Wraps legacy gripStyleStore to implement GripStylePort interface
 *
 * @example
 * ```ts
 * const syncDeps = { gripStyle: gripStyleAdapter };
 * ```
 */
export const gripStyleAdapter: GripStylePort = {
  getCurrent() {
    const state = gripStyleStore.get();
    return {
      size: state.gripSize,
      color: state.colors?.cold ?? '#0000FF',
      hoverColor: state.colors?.warm ?? '#FF69B4',
      selectedColor: state.colors?.hot ?? '#FF0000'
    };
  },

  apply(partial) {
    // Map port format → legacy store format
    const updates: Partial<{
      gripSize: number;
      colors: {
        cold?: string;
        warm?: string;
        hot?: string;
        contour?: string;
      };
    }> = {};

    if (partial.size !== undefined) {
      updates.gripSize = partial.size;
    }

    if (partial.color !== undefined || partial.hoverColor !== undefined || partial.selectedColor !== undefined) {
      const currentState = gripStyleStore.get();
      updates.colors = {
        cold: partial.color ?? currentState.colors?.cold ?? '#0000FF',
        warm: partial.hoverColor ?? currentState.colors?.warm ?? '#FF69B4',
        hot: partial.selectedColor ?? currentState.colors?.hot ?? '#FF0000',
        contour: currentState.colors?.contour ?? '#000000'
      };
    }

    gripStyleStore.set(updates);
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return gripStyleStore.subscribe((state) => {
      handler({
        size: state.gripSize,
        color: state.colors?.cold ?? '#0000FF',
        hoverColor: state.colors?.warm ?? '#FF69B4',
        selectedColor: state.colors?.hot ?? '#FF0000'
      });
    });
  }
};
