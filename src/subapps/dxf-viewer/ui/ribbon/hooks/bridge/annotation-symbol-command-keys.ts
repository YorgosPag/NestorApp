/**
 * ADR-583 — Annotation-symbol (North arrow) contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-annotation-symbol-tab.ts`) and the bridge mappings
 * (`useRibbonAnnotationSymbolBridge`). Mirror of `FLOORPLAN_SYMBOL_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

export const ANNOTATION_SYMBOL_RIBBON_KEYS = {
  stringParams: {
    /** Catalog variant selector (which North arrow to place). */
    symbolId: 'annotationSymbol.params.symbolId',
  },
  params: {
    /** mm — nominal paper height (annotative). */
    sizeMm: 'annotationSymbol.params.sizeMm',
    /** deg — initial rotation about the insertion point (0 = north / up). */
    rotation: 'annotationSymbol.params.rotation',
  },
} as const;

export type AnnotationSymbolRibbonNumberCommandKey =
  | typeof ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm
  | typeof ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation;

export type AnnotationSymbolRibbonStringCommandKey =
  | typeof ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId;

const NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>([
  ANNOTATION_SYMBOL_RIBBON_KEYS.params.sizeMm,
  ANNOTATION_SYMBOL_RIBBON_KEYS.params.rotation,
]);
const STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  ANNOTATION_SYMBOL_RIBBON_KEYS.stringParams.symbolId,
]);

export function isAnnotationSymbolRibbonKey(commandKey: string): boolean {
  return NUMBER_KEY_SET.has(commandKey);
}

export function isAnnotationSymbolRibbonStringKey(commandKey: string): boolean {
  return STRING_KEY_SET.has(commandKey);
}
