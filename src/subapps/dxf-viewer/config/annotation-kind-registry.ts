/**
 * ADR-583 — Annotation-symbol KIND ↔ TOOL registry (SSoT).
 *
 * Maps each wired annotation-symbol `kind` (north arrow, section mark, grid
 * bubble, …) to the `ToolType` that places it, so the routing predicate, the
 * placement handler, the ribbon buttons/aliases and the contextual trigger all
 * read ONE list instead of scattered `activeTool === 'north-arrow'` literals
 * (which would clone-multiply per kind — N.18). Adding a new kind's tool = ONE
 * entry here (plus the `ToolType` union literal + catalog geometry + i18n).
 *
 * Only kinds with a live placement tool appear here. `AnnotationSymbolKind`
 * (`types/annotation-symbol.ts`) may list future kinds before they are wired.
 *
 * @see config/annotation-symbol-catalog.ts — the per-kind glyph geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { AnnotationSymbolKind } from '../types/annotation-symbol';
import type { ToolType } from '../ui/toolbar/types';

export interface AnnotationKindConfig {
  /** Symbol family this tool places. */
  readonly kind: AnnotationSymbolKind;
  /** Single-click placement tool id (a `ToolType` literal). */
  readonly toolId: ToolType;
}

/**
 * The wired annotation-symbol kinds. Extend by adding an entry (Φ1+); every
 * consumer below derives from this array — no per-kind copy-paste.
 */
export const ANNOTATION_KIND_CONFIGS: readonly AnnotationKindConfig[] = [
  { kind: 'north-arrow', toolId: 'north-arrow' },
  { kind: 'section-mark', toolId: 'section-mark' },
  { kind: 'grid-bubble', toolId: 'grid-bubble' },
  { kind: 'elevation-mark', toolId: 'elevation-mark' },
  { kind: 'detail-callout', toolId: 'detail-callout' },
  { kind: 'revision-tag', toolId: 'revision-tag' },
];

const TOOL_TO_KIND: ReadonlyMap<string, AnnotationSymbolKind> = new Map(
  ANNOTATION_KIND_CONFIGS.map((c) => [c.toolId, c.kind] as const),
);

/** Every tool id that places an annotation symbol (routing predicate source). */
export const ANNOTATION_SYMBOL_TOOL_IDS: ReadonlySet<ToolType> = new Set(
  ANNOTATION_KIND_CONFIGS.map((c) => c.toolId),
);

/** True when `tool` is any annotation-symbol placement tool. */
export function isAnnotationSymbolTool(tool: string | null | undefined): tool is ToolType {
  return tool != null && TOOL_TO_KIND.has(tool);
}

/** The `kind` a placement tool creates, or `null` if it is not an annotation tool. */
export function annotationKindForTool(tool: string | null | undefined): AnnotationSymbolKind | null {
  if (tool == null) return null;
  return TOOL_TO_KIND.get(tool) ?? null;
}
