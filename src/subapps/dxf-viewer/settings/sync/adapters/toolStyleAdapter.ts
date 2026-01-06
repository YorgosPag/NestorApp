/**
 * @file Tool Style Adapter - Legacy Store → Port Implementation
 * @module settings/sync/adapters/toolStyleAdapter
 *
 * ✅ ENTERPRISE: Adapter Pattern - Wraps legacy toolStyleStore
 *
 * **RESPONSIBILITY**: Translate between ToolStylePort interface and legacy store
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { ToolStylePort } from '../ports';
import { toolStyleStore, type ToolStyle } from '../../../stores/ToolStyleStore';

/**
 * Tool Style Adapter
 *
 * Wraps legacy toolStyleStore to implement ToolStylePort interface
 *
 * @example
 * ```ts
 * const syncDeps = { toolStyle: toolStyleAdapter };
 * ```
 */
export const toolStyleAdapter: ToolStylePort = {
  getCurrent() {
    const state = toolStyleStore.get();
    return {
      stroke: state.strokeColor,
      fill: state.fillColor,
      width: state.lineWidth,
      opacity: state.opacity,
      dashArray: [] // TODO: Map from lineType to dashArray
    };
  },

  apply(partial) {
    // Map port format → legacy store format (enterprise-typed)
    const updates: Partial<ToolStyle> = {};

    if (partial.stroke !== undefined) updates.strokeColor = partial.stroke;
    if (partial.fill !== undefined) updates.fillColor = partial.fill;
    if (partial.width !== undefined) updates.lineWidth = partial.width;
    if (partial.opacity !== undefined) updates.opacity = partial.opacity;
    // TODO: Map dashArray → lineType

    toolStyleStore.set(updates);
  },

  onChange(handler) {
    // Subscribe to legacy store changes (Listener doesn't receive state - we fetch it)
    return toolStyleStore.subscribe(() => {
      const state = toolStyleStore.get();
      handler({
        stroke: state.strokeColor,
        fill: state.fillColor,
        width: state.lineWidth,
        opacity: state.opacity,
        dashArray: [] // TODO: Map lineType to dashArray
      });
    });
  }
};
