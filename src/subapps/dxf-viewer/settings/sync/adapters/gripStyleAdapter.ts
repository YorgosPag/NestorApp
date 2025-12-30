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
        cold: partial.color ?? currentState.colors?.cold ?? UI_COLORS.OVERLAY_GRIP_COLD,
        warm: partial.hoverColor ?? currentState.colors?.warm ?? UI_COLORS.TEST_GRIP_HOVER,
        hot: partial.selectedColor ?? currentState.colors?.hot ?? UI_COLORS.OVERLAY_GRIP_HOT,
        contour: currentState.colors?.contour ?? UI_COLORS.BLACK
      };
    }

    gripStyleStore.set(updates as any);
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return gripStyleStore.subscribe((state: any) => {
      handler({
        size: state.gripSize,
        color: state.colors?.cold ?? UI_COLORS.OVERLAY_GRIP_COLD,
        hoverColor: state.colors?.warm ?? UI_COLORS.TEST_GRIP_HOVER,
        selectedColor: state.colors?.hot ?? UI_COLORS.OVERLAY_GRIP_HOT
      });
    });
  }
};
