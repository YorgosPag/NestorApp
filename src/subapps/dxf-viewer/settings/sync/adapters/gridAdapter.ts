/**
 * @file Grid Adapter - Legacy Store → Port Implementation
 * @module settings/sync/adapters/gridAdapter
 *
 * ✅ ENTERPRISE: Adapter Pattern - Wraps legacy globalGridStore
 *
 * **RESPONSIBILITY**: Translate between GridPort interface and legacy store
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { GridPort } from '../ports';
import { globalGridStore } from '../../../settings-provider/globalStores';

/**
 * Grid Adapter
 *
 * Wraps legacy globalGridStore to implement GridPort interface
 *
 * @example
 * ```ts
 * const syncDeps = { grid: gridAdapter };
 * ```
 */
export const gridAdapter: GridPort = {
  getState() {
    const state = globalGridStore.settings;
    return {
      enabled: state.enabled,
      spacing: state.size,
      color: state.color,
      opacity: state.opacity
    };
  },

  apply(partial) {
    // Map port format → legacy store format
    const updates: Partial<{
      enabled: boolean;
      spacing: number;
      color: string;
      opacity: number;
    }> = {};

    if (partial.enabled !== undefined) updates.enabled = partial.enabled;
    if (partial.spacing !== undefined) updates.spacing = partial.spacing;
    if (partial.color !== undefined) updates.color = partial.color;
    if (partial.opacity !== undefined) updates.opacity = partial.opacity;

    globalGridStore.update(updates);
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return globalGridStore.subscribe((state) => {
      handler({
        enabled: state.enabled,
        spacing: state.size,
        color: state.color,
        opacity: state.opacity
      });
    });
  }
};
