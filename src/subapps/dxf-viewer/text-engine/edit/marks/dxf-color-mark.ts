/**
 * ADR-344 Phase 4 — TipTap mark for the DXF `\C` (ACI) + `\c` (TrueColor) codes.
 *
 * Stores a full `DxfColor` discriminated-union value on every text run.
 * The HTML serialisation embeds the value as JSON on a `data-dxf-color`
 * attribute (used only by the contenteditable surface in edit sessions —
 * the canvas renderer consumes the AST directly).
 *
 * @module text-engine/edit/marks/dxf-color-mark
 */

import { Mark } from '@tiptap/core';
import type { DxfColor } from '../../types/text-toolbar.types';

const DEFAULT_COLOR: DxfColor = { kind: 'ByLayer' };

function parseDxfColorAttr(raw: string | null): DxfColor {
  if (!raw) return DEFAULT_COLOR;
  try {
    const v = JSON.parse(raw) as DxfColor;
    return v;
  } catch {
    return DEFAULT_COLOR;
  }
}

export const DxfColorMark = Mark.create({
  name: 'dxfColor',

  addAttributes() {
    return {
      color: {
        default: DEFAULT_COLOR,
        parseHTML: (el: HTMLElement) => parseDxfColorAttr(el.getAttribute('data-dxf-color')),
        renderHTML: (attrs: { color: DxfColor }) => ({
          'data-dxf-color': JSON.stringify(attrs.color),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-dxf-color]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});
