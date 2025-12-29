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
import type { GridSettings } from '../../../systems/rulers-grid/config';
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
      enabled: state.visual.enabled,
      spacing: state.visual.step,
      color: state.visual.color,
      opacity: state.visual.opacity
    };
  },

  apply(partial) {
    // Map port format → legacy store format (nested visual object)
    const visualUpdates: Partial<GridSettings['visual']> = {};

    if (partial.enabled !== undefined) visualUpdates.enabled = partial.enabled;
    if (partial.spacing !== undefined) visualUpdates.step = partial.spacing;
    if (partial.color !== undefined) visualUpdates.color = partial.color;
    if (partial.opacity !== undefined) visualUpdates.opacity = partial.opacity;

    // Update only the visual section
    if (Object.keys(visualUpdates).length > 0) {
      const currentState = globalGridStore.settings;
      globalGridStore.update({
        ...currentState,
        visual: { ...currentState.visual, ...visualUpdates }
      });
    }
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return globalGridStore.subscribe((state) => {
      handler({
        enabled: state.visual.enabled,
        spacing: state.visual.step,
        color: state.visual.color,
        opacity: state.visual.opacity
      });
    });
  }
};
