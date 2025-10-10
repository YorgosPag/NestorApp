/**
 * @file Ruler Adapter - Legacy Store → Port Implementation
 * @module settings/sync/adapters/rulerAdapter
 *
 * ✅ ENTERPRISE: Adapter Pattern - Wraps legacy globalRulerStore
 *
 * **RESPONSIBILITY**: Translate between RulerPort interface and legacy store
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { RulerPort } from '../ports';
import { globalRulerStore } from '../../../settings-provider/globalStores';

/**
 * Ruler Adapter
 *
 * Wraps legacy globalRulerStore to implement RulerPort interface
 *
 * @example
 * ```ts
 * const syncDeps = { ruler: rulerAdapter };
 * ```
 */
export const rulerAdapter: RulerPort = {
  getState() {
    const state = globalRulerStore.settings;
    return {
      enabled: state.enabled,
      units: state.units,
      color: state.color,
      opacity: state.opacity
    };
  },

  apply(partial) {
    // Map port format → legacy store format
    const updates: Partial<{
      enabled: boolean;
      units: string;
      color: string;
      opacity: number;
    }> = {};

    if (partial.enabled !== undefined) updates.enabled = partial.enabled;
    if (partial.units !== undefined) updates.units = partial.units;
    if (partial.color !== undefined) updates.color = partial.color;
    if (partial.opacity !== undefined) updates.opacity = partial.opacity;

    globalRulerStore.update(updates);
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return globalRulerStore.subscribe((state) => {
      handler({
        enabled: state.enabled,
        units: state.units,
        color: state.color,
        opacity: state.opacity
      });
    });
  }
};
