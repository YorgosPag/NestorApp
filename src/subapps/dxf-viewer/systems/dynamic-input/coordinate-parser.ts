/**
 * ADR-357 Phase 6: Coordinate input parser (absolute/relative/polar syntax).
 *
 * Syntax (ADR §5.1 — hybrid):
 *   100,50    → absolute cartesian {x:100, y:50} in displayUnit
 *   @100,50   → relative cartesian: lastRef + {100, 50}
 *   @100<45   → relative polar: lastRef + polar(100, 45°)
 *   100<45    → absolute polar
 *   5m,3m     → unit suffix overrides displayUnit per component
 *
 * Zero React dependencies — pure function, fully unit-testable.
 */

import type { Point2D } from '../../rendering/types/Types';
import { fromDisplay } from '../../config/units';
import type { DisplayUnit } from '../../config/units';
// ADR-510 Φ1 (E2) — SSoT arithmetic evaluator so each coordinate component may be
// typed as a math expression (e.g. "1500+300,2*1000", "@(1+2)m<45").
import { evalExpr } from './numeric-expression';

export type CoordMode = 'abs' | 'rel' | 'polar';

/** True when text contains coordinate syntax — used to bypass isValidNumber guard. */
export function looksLikeCoordSyntax(text: string): boolean {
  const t = text.trim();
  return t.startsWith('@') || t.includes(',') || t.includes('<');
}

/**
 * Apply coordMode prefix to raw input text before parsing.
 * Mode buttons do NOT modify the visible input value — this applies the prefix at Enter time.
 */
export function applyCoordMode(rawText: string, mode: CoordMode): string {
  if (mode === 'abs') return rawText;
  const body = rawText.startsWith('@') ? rawText.slice(1) : rawText;
  if (mode === 'rel') return `@${body}`;
  // polar: @ prefix + first comma → angle-bracket
  return `@${body.replace(',', '<')}`;
}

/**
 * Parse coordinate input text into a world-space Point2D (internal mm).
 * Returns null if text does not match any supported pattern, or if lastRef is
 * required (relative syntax) but absent.
 */
export function parseCoordInput(
  text: string,
  lastRef: Point2D | null,
  displayUnit: DisplayUnit = 'cm',
): Point2D | null {
  const t = text.trim();
  if (!t) return null;

  // ADR-510 Φ1 (E2): strip an optional trailing unit suffix, then evaluate the
  // remainder as an arithmetic expression (so "1500+300", "2*1.5m" both work).
  const parseValue = (s: string): number => {
    const trimmed = s.trim();
    const um = trimmed.match(/(mm|cm|m|in|ft)$/i);
    const exprPart = um ? trimmed.slice(0, trimmed.length - um[1].length) : trimmed;
    const num = evalExpr(exprPart);
    if (num === null) return NaN;
    const unit = (um?.[1]?.toLowerCase() as DisplayUnit | undefined) ?? displayUnit;
    return fromDisplay(num, unit);
  };

  // Regex building blocks. ADR-510 Φ1 (E2): a value component is "anything that is
  // not a component separator" (`,` cartesian, `<` polar); `parseValue` is the sole
  // validator (math + unit aware), so malformed components fall through to `null`.
  const V = String.raw`([^,<]+?)`;
  const A = String.raw`([+-]?\d*\.?\d+)`;

  // Pattern 1: @V<A — relative polar
  const m1 = t.match(new RegExp(`^@${V}\\s*<\\s*${A}$`, 'i'));
  if (m1) {
    const dist = parseValue(m1[1]);
    const deg = parseFloat(m1[2]);
    if (!Number.isFinite(dist) || !Number.isFinite(deg) || !lastRef) return null;
    const rad = (deg * Math.PI) / 180;
    return { x: lastRef.x + dist * Math.cos(rad), y: lastRef.y + dist * Math.sin(rad) };
  }

  // Pattern 2: V<A — absolute polar
  const m2 = t.match(new RegExp(`^${V}\\s*<\\s*${A}$`, 'i'));
  if (m2) {
    const dist = parseValue(m2[1]);
    const deg = parseFloat(m2[2]);
    if (!Number.isFinite(dist) || !Number.isFinite(deg)) return null;
    const rad = (deg * Math.PI) / 180;
    return { x: dist * Math.cos(rad), y: dist * Math.sin(rad) };
  }

  // Pattern 3: @V,V — relative cartesian
  const m3 = t.match(new RegExp(`^@${V}\\s*,\\s*${V}$`, 'i'));
  if (m3) {
    const dx = parseValue(m3[1]);
    const dy = parseValue(m3[2]);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !lastRef) return null;
    return { x: lastRef.x + dx, y: lastRef.y + dy };
  }

  // Pattern 4: V,V — absolute cartesian
  const m4 = t.match(new RegExp(`^${V}\\s*,\\s*${V}$`, 'i'));
  if (m4) {
    const x = parseValue(m4[1]);
    const y = parseValue(m4[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  return null;
}
