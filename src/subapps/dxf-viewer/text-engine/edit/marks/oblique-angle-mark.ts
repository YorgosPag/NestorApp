/**
 * ADR-344 Phase 4 — TipTap mark for the DXF `\Q` oblique-angle code.
 *
 * Shears glyphs by the given angle (in degrees, positive = slant right).
 * Distinct from italic — `\Q` is a numeric continuous parameter applied
 * by the font renderer as an affine transform.
 *
 * @module text-engine/edit/marks/oblique-angle-mark
 */

import { Mark } from '@tiptap/core';

export const ObliqueAngleMark = Mark.create({
  name: 'obliqueAngle',

  addAttributes() {
    return {
      angle: {
        default: 0,
        parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-oblique-angle') ?? '0'),
        renderHTML: (attrs: { angle: number }) => ({ 'data-oblique-angle': String(attrs.angle) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-oblique-angle]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
