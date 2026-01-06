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
import { textStyleStore, type TextStyle } from '../../../stores/TextStyleStore';

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
    // Map port format → legacy store format (enterprise-typed)
    const updates: Partial<TextStyle> = {};

    if (partial.font !== undefined) updates.fontFamily = partial.font;
    if (partial.size !== undefined) updates.fontSize = partial.size;
    if (partial.color !== undefined) updates.color = partial.color;

    // Type-safe fontWeight mapping (validates 'normal' | 'bold')
    if (partial.weight !== undefined) {
      updates.fontWeight = partial.weight === 'bold' ? 'bold' : 'normal';
    }

    // Type-safe fontStyle mapping (validates 'normal' | 'italic')
    if (partial.style !== undefined) {
      updates.fontStyle = partial.style === 'italic' ? 'italic' : 'normal';
    }

    textStyleStore.set(updates);
  },

  onChange(handler) {
    // Subscribe to legacy store changes (Listener doesn't receive state - we fetch it)
    return textStyleStore.subscribe(() => {
      const state = textStyleStore.get();
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
