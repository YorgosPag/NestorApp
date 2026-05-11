/**
 * ADR-344 Phase 4 — TipTap mark for the DXF `\T` tracking code.
 *
 * Per-run character tracking / inter-letter spacing factor.
 * 1.0 = no extra spacing, 1.5 = 50 % extra space between glyphs.
 *
 * @module text-engine/edit/marks/tracking-mark
 */

import { Mark } from '@tiptap/core';

export const TrackingMark = Mark.create({
  name: 'tracking',

  addAttributes() {
    return {
      tracking: {
        default: 1,
        parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-tracking') ?? '1'),
        renderHTML: (attrs: { tracking: number }) => ({ 'data-tracking': String(attrs.tracking) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tracking]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
