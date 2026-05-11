/**
 * ADR-344 Phase 4 — TipTap mark for the DXF `\W` width-factor code.
 *
 * Stretches glyph advances horizontally (1.0 = normal, 0.8 = condensed,
 * 1.2 = expanded). Combined with `\T` tracking at render time.
 *
 * @module text-engine/edit/marks/width-factor-mark
 */

import { Mark } from '@tiptap/core';

export const WidthFactorMark = Mark.create({
  name: 'widthFactor',

  addAttributes() {
    return {
      factor: {
        default: 1,
        parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-width-factor') ?? '1'),
        renderHTML: (attrs: { factor: number }) => ({ 'data-width-factor': String(attrs.factor) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-width-factor]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
