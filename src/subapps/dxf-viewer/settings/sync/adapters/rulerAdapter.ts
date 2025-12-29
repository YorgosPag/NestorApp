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
import type { RulerSettings } from '../../../systems/rulers-grid/config';
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
      enabled: state.horizontal.enabled, // Use horizontal ruler as primary
      units: state.units,
      color: state.horizontal.color,
      opacity: 1.0 // RulerSettings doesn't have opacity, using default
    };
  },

  apply(partial) {
    // Map port format → legacy store format (nested structure)
    const currentState = globalRulerStore.settings;
    const updates: Partial<RulerSettings> = { ...currentState };

    if (partial.enabled !== undefined) {
      updates.horizontal = { ...currentState.horizontal, enabled: partial.enabled };
      updates.vertical = { ...currentState.vertical, enabled: partial.enabled };
    }
    if (partial.units !== undefined) {
      updates.units = partial.units as 'mm' | 'cm' | 'm' | 'inches' | 'feet';
    }
    if (partial.color !== undefined) {
      updates.horizontal = { ...updates.horizontal!, color: partial.color };
      updates.vertical = { ...updates.vertical!, color: partial.color };
    }
    // opacity is ignored as RulerSettings doesn't support it

    if (Object.keys(updates).length > 0) {
      globalRulerStore.update(updates);
    }
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return globalRulerStore.subscribe((state) => {
      handler({
        enabled: state.horizontal.enabled,
        units: state.units,
        color: state.horizontal.color,
        opacity: 1.0 // Default value as RulerSettings doesn't have opacity
      });
    });
  }
};
