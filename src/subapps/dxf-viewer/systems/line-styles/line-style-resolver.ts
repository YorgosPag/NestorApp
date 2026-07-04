/**
 * ADR-570 Φ1 — ByStyle resolution chain for named line styles.
 *
 * SSoT for the AutoCAD/Revit resolution order **per-object override → ByStyle →
 * ByLayer** (ADR-570 §2.2). Given a `lineStyleId` pointer (or none) plus whatever
 * concrete per-object properties an entity carries, it returns the effective pen
 * color / lineweight / linetype pattern.
 *
 * Pure functions — no side effects, trivially unit-testable. Mirrors the pure
 * `dim-style-resolver.ts` (ADR-362). The render pipeline consumes this when the
 * full dynamic ByStyle re-resolution is wired in a follow-up phase; until then it
 * is the documented single source of the resolution rule (exercised by tests).
 */

import type { LineStyleRegistry } from './line-style-registry';
import {
  LINE_STYLE_BYLAYER_LWT,
  LINE_STYLE_BYLAYER_PEN,
  LINE_STYLE_DEFAULT_PATTERN,
  type LinePatternKey,
} from './line-style-types';

/** Concrete per-object overrides — any field left `undefined` falls back to ByStyle. */
export interface LineStyleOverrides {
  /** Explicit per-object pen color (hex). `undefined` ⇒ inherit ByStyle. */
  readonly penColor?: string;
  /** Explicit per-object lineweight (mm). `undefined` ⇒ inherit ByStyle. */
  readonly lineweight?: number;
  /** Explicit per-object linetype (catalog name). `undefined` ⇒ inherit ByStyle. */
  readonly pattern?: LinePatternKey;
}

/** The effective ByStyle-resolved properties actually used by the renderer. */
export interface ResolvedLineStyleProps {
  readonly penColor: string;
  readonly lineweight: number;
  readonly pattern: LinePatternKey;
}

/**
 * Resolve the effective properties: **override → ByStyle → ByLayer/default**.
 * A missing/unknown `lineStyleId` simply skips the ByStyle tier (pure ByLayer).
 */
export function resolveLineStyle(
  lineStyleId: string | undefined,
  overrides: LineStyleOverrides,
  registry: LineStyleRegistry,
): ResolvedLineStyleProps {
  const base = lineStyleId ? registry.getStyle(lineStyleId) : undefined;
  return {
    penColor: overrides.penColor ?? base?.penColor ?? LINE_STYLE_BYLAYER_PEN,
    lineweight: overrides.lineweight ?? base?.lineweight ?? LINE_STYLE_BYLAYER_LWT,
    pattern: overrides.pattern ?? base?.pattern ?? LINE_STYLE_DEFAULT_PATTERN,
  };
}
