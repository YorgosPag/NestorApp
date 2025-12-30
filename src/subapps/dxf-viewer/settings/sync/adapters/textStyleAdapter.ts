/**
 * @file Text Style Adapter - Legacy Store → Port Implementation
 * @module settings/sync/adapters/textStyleAdapter
 *
 * ✅ ENTERPRISE: Adapter Pattern - Wraps legacy textStyleStore
 *
 * **RESPONSIBILITY**: Translate between TextStylePort interface and legacy store
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { TextStylePort } from '../ports';
import { textStyleStore } from '../../../stores/TextStyleStore';

/**
 * Text Style Adapter
 *
 * Wraps legacy textStyleStore to implement TextStylePort interface
 *
 * @example
 * ```ts
 * const syncDeps = { textStyle: textStyleAdapter };
 * ```
 */
export const textStyleAdapter: TextStylePort = {
  getCurrent() {
    const state = textStyleStore.get();
    return {
      font: state.fontFamily,
      size: state.fontSize,
      color: state.color,
      weight: state.fontWeight,
      style: state.fontStyle
    };
  },

  apply(partial) {
    // Map port format → legacy store format
    const updates: Partial<{
      fontFamily: string;
      fontSize: number;
      color: string;
      fontWeight: string;
      fontStyle: string;
    }> = {};

    if (partial.font !== undefined) updates.fontFamily = partial.font;
    if (partial.size !== undefined) updates.fontSize = partial.size;
    if (partial.color !== undefined) updates.color = partial.color;
    if (partial.weight !== undefined) updates.fontWeight = partial.weight;
    if (partial.style !== undefined) updates.fontStyle = partial.style;

    textStyleStore.set(updates as any);
  },

  onChange(handler) {
    // Subscribe to legacy store changes
    return textStyleStore.subscribe((state: any) => {
      handler({
        font: state.fontFamily,
        size: state.fontSize,
        color: state.color,
        weight: state.fontWeight,
        style: state.fontStyle
      });
    });
  }
};
