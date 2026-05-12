/**
 * ADR-344 Phase 4 — TipTap extension registry for DXF text editing.
 *
 * Exports the canonical list of DXF-specific Mark and Node extensions
 * (custom inline codes \O, \H, \W, \Q, \T, \C/\c, \S). The Phase 5 editor
 * mounts these alongside TipTap's standard extensions (Document, Paragraph,
 * Text, Bold, Italic, Strike, Underline, History) — which are installed
 * separately via `@tiptap/starter-kit` when the editor component is built.
 *
 * Adjusting this list = adjusting which DXF inline codes the editor can
 * produce. Adding a new code → create the Mark/Node, export it, register
 * it here, and update the serializers (dxf-to-tiptap + tiptap-to-dxf).
 *
 * @module text-engine/edit/tiptap-config
 */

import type { Extensions } from '@tiptap/core';
import {
  OverlineMark,
  FontHeightMark,
  WidthFactorMark,
  ObliqueAngleMark,
  TrackingMark,
  DxfColorMark,
} from './marks';
import { StackNode } from './nodes';
import { createSpellCheckExtension } from './spell-check-extension';
import type { CustomTermPayload, SpellLanguage } from '../spell';

/**
 * All DXF-specific TipTap extensions in canonical order.
 * Order matters only when multiple marks would apply to the same span —
 * later marks override earlier ones (TipTap stacks them).
 */
export const dxfTextExtensions: Extensions = [
  // Inline marks (one per DXF inline code)
  OverlineMark,
  FontHeightMark,
  WidthFactorMark,
  ObliqueAngleMark,
  TrackingMark,
  DxfColorMark,
  // Inline nodes
  StackNode,
];

/**
 * Build the DXF text extension list including the ADR-344 Phase 8 spell
 * check extension. Callers that already mount `dxfTextExtensions` opt into
 * spell check by switching to this builder + passing the company's custom
 * dictionary entries.
 */
export function buildDxfTextExtensionsWithSpell(opts: {
  readonly languages?: readonly SpellLanguage[];
  readonly initialCustomTerms: readonly CustomTermPayload[];
  readonly spellEnabled: boolean;
}): Extensions {
  return [
    ...dxfTextExtensions,
    createSpellCheckExtension({
      languages: opts.languages ?? ['el', 'en'],
      initialCustomTerms: opts.initialCustomTerms,
      enabled: opts.spellEnabled,
      debounceMs: 300,
    }),
  ];
}

/**
 * Stable list of mark names this engine knows about.
 * Consumed by the serialiser's `marksToStyle` for forward-compat checks.
 */
export const DXF_MARK_NAMES = [
  'bold',
  'italic',
  'underline',
  'strike',
  'overline',
  'fontFamily',
  'fontHeight',
  'widthFactor',
  'obliqueAngle',
  'tracking',
  'dxfColor',
] as const;

export type DxfMarkName = (typeof DXF_MARK_NAMES)[number];
