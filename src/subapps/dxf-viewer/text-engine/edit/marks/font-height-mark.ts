/**
 * ADR-344 Phase 4 — TipTap mark for the DXF `\H` font-height code.
 *
 * Stores the per-run character height in drawing units (absolute mm, not
 * a multiplier). The canvas renderer reads it directly off the AST; HTML
 * mapping is only for contenteditable.
 *
 * @module text-engine/edit/marks/font-height-mark
 */

import { Mark } from '@tiptap/core';

export const FontHeightMark = Mark.create({
  name: 'fontHeight',

  addAttributes() {
    return {
      height: {
        default: 0,
        parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-height') ?? '0'),
        renderHTML: (attrs: { height: number }) => ({ 'data-height': String(attrs.height) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-height]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
