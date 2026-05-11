/**
 * ADR-344 Phase 4 — TipTap mark for the DXF `\O` overline code.
 *
 * Marks a run of text with a horizontal line drawn above. The canvas
 * renderer reads the `overline` flag off `TextRunStyle` (no HTML render);
 * this extension's HTML mapping exists only for the contenteditable
 * surface during edit sessions.
 *
 * @module text-engine/edit/marks/overline-mark
 */

import { Mark } from '@tiptap/core';

export const OverlineMark = Mark.create({
  name: 'overline',

  parseHTML() {
    return [{ tag: 'span[data-overline="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-overline': 'true', ...HTMLAttributes }, 0];
  },
});
