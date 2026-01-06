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
import { gripStyleStore, type GripStyle } from '../../../stores/GripStyleStore';
import { UI_COLORS } from '../../../config/color-config';

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
      color: state.colors?.cold ?? UI_COLORS.OVERLAY_GRIP_COLD,
      hoverColor: state.colors?.warm ?? UI_COLORS.TEST_GRIP_HOVER,
      selectedColor: state.colors?.hot ?? UI_COLORS.OVERLAY_GRIP_HOT
    };
  },

  apply(partial) {
    // Map port format → legacy store format (enterprise-typed)
    const updates: Partial<GripStyle> = {};

    if (partial.size !== undefined) {
      updates.gripSize = partial.size;
    }

    if (partial.color !== undefined || partial.hoverColor !== undefined || partial.selectedColor !== undefined) {
      const currentState = gripStyleStore.get();
      updates.colors = {
        cold: partial.color ?? currentState.colors.cold,
        warm: partial.hoverColor ?? currentState.colors.warm,
        hot: partial.selectedColor ?? currentState.colors.hot,
        contour: currentState.colors.contour
      };
    }

    gripStyleStore.set(updates);
  },

  onChange(handler) {
    // Subscribe to legacy store changes (Listener doesn't receive state - we fetch it)
    return gripStyleStore.subscribe(() => {
      const state = gripStyleStore.get();
      handler({
        size: state.gripSize,
        color: state.colors.cold,
        hoverColor: state.colors.warm,
        selectedColor: state.colors.hot
      });
    });
  }
};
