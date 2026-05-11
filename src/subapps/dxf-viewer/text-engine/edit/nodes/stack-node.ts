/**
 * ADR-344 Phase 4 — TipTap inline node for the DXF `\S` stack code.
 *
 * Represents a stacked fraction / tolerance display as an atomic inline
 * node (not user-editable as plain text). The canvas renderer reads
 * attrs directly; HTML mapping is a debug fallback for the
 * contenteditable surface during edit sessions.
 *
 * @module text-engine/edit/nodes/stack-node
 */

import { Node } from '@tiptap/core';
import type { DxfColor } from '../../types/text-toolbar.types';

const DEFAULT_COLOR: DxfColor = { kind: 'ByLayer' };

function parseColor(raw: string | null): DxfColor {
  if (!raw) return DEFAULT_COLOR;
  try {
    return JSON.parse(raw) as DxfColor;
  } catch {
    return DEFAULT_COLOR;
  }
}

export const StackNode = Node.create({
  name: 'stack',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      top: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-top') ?? '',
        renderHTML: (attrs: { top: string }) => ({ 'data-top': attrs.top }),
      },
      bottom: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-bottom') ?? '',
        renderHTML: (attrs: { bottom: string }) => ({ 'data-bottom': attrs.bottom }),
      },
      stackType: {
        default: 'tolerance',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-stack-type') ?? 'tolerance',
        renderHTML: (attrs: { stackType: string }) => ({ 'data-stack-type': attrs.stackType }),
      },
      fontFamily: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-font-family') ?? '',
        renderHTML: (attrs: { fontFamily: string }) => ({ 'data-font-family': attrs.fontFamily }),
      },
      height: {
        default: 0,
        parseHTML: (el: HTMLElement) => parseFloat(el.getAttribute('data-height') ?? '0'),
        renderHTML: (attrs: { height: number }) => ({ 'data-height': String(attrs.height) }),
      },
      color: {
        default: DEFAULT_COLOR,
        parseHTML: (el: HTMLElement) => parseColor(el.getAttribute('data-color')),
        renderHTML: (attrs: { color: DxfColor }) => ({ 'data-color': JSON.stringify(attrs.color) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-stack="true"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      { 'data-stack': 'true', ...HTMLAttributes },
      `${node.attrs.top as string}|${node.attrs.bottom as string}`,
    ];
  },
});
