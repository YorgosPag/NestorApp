/**
 * Line Pattern Segments — ADR-362 (Path B: reusable custom line patterns).
 *
 * Pure bridge between a **human-authored segment list** (what the Revit-style
 * "Line Pattern" editor edits) and the **DXF-native mm pattern array** (what the
 * whole app already renders — `config/linetype-iso-catalog.ts` format:
 * positive = dash length, negative = gap length, `0` = dot).
 *
 * The editor speaks in explicit, independent lengths — exactly Giorgio's request:
 *   - "απόσταση τελειών"           → a `dot` followed by a `gap` (the dot spacing)
 *   - "μήκος γραμμικών τμημάτων"   → a `dash` with its length + a `gap`
 *
 * No new pattern engine: this only reshapes data into the existing catalog
 * format, which `resolveLinetypePatternMm` + `dashMmToScreenPx` already consume.
 *
 * ADR-642 Φ2 (#2, embedded text) — the segment list is now a discriminated union:
 * beyond the geometry rows (dash/gap/dot), a `text` row carries an embedded-text
 * element (AutoCAD `["GAS",STYLE,S,R,X,Y]`). Text does NOT round-trip through the
 * `number[]` mm pattern (it is not expressible there); the `segmentsToComplex`
 * bridge lifts a text-carrying segment list into the full `ComplexLinetypeDef`
 * (the render + registry SSoT), while `segmentsToDashPattern` stays the geometry-
 * only reshaper the simple fast-path consumes.
 */

import type { LinetypeOrigin } from './linetype-iso-catalog';
import type {
  ComplexLinetypeDef,
  PatternElement,
} from './complex-linetype-types';
import { DEFAULT_SCALE_SPACE } from './complex-linetype-adapters';

/** One authored segment kind — geometry (`dash`/`gap`/`dot`) or embedded `text` (#2). */
export type LinePatternSegmentKind = 'dash' | 'gap' | 'dot' | 'text';

/** Geometry segment — `dot` ignores `lengthMm` (a dot is a zero-length dash). */
export interface LinePatternGeometrySegment {
  readonly kind: 'dash' | 'gap' | 'dot';
  /** mm — used for `dash` / `gap`; ignored (forced 0) for `dot`. */
  readonly lengthMm: number;
}

/**
 * Embedded-text segment — ADR-642 Φ2 (#2). Mirrors `TextElement`: the drawn string,
 * its text style (`styleId` = font family resolved by the SAME `resolveEntityFont`
 * SSoT the TEXT entities use), and the AutoCAD S/R/X/Y placement + follow-path role.
 */
export interface LinePatternTextSegment {
  readonly kind: 'text';
  readonly value: string;
  readonly styleId: string;
  readonly scale: number;
  readonly rotationDeg: number;
  readonly offsetXMm: number;
  readonly offsetYMm: number;
  /** `true` → rotation is relative to the line tangent (topographic); `false` → absolute. */
  readonly followPath: boolean;
}

/** One authored segment — discriminated on `kind`. */
export type LinePatternSegment = LinePatternGeometrySegment | LinePatternTextSegment;

/** Sensible default length (mm) for a freshly-added dash/gap row (acadiso gap). */
export const DEFAULT_SEGMENT_LENGTH_MM = 3.175;

/**
 * Text style options for the embedded-text picker — font family identifiers the
 * shared `resolveEntityFont`/`buildUIFont` SSoT resolves (loaded CAD glyph font
 * first, else CSS fallback). Technical identifiers (same in every locale, like the
 * linetype names in the picker) → not i18n prose. `'Liberation Sans'` is the bundled
 * glyph-path substitute (ADR-530) so the default renders as crisp outlines.
 */
export const LINETYPE_TEXT_STYLE_OPTIONS: readonly string[] = [
  'arial',
  'Liberation Sans',
  'romans',
  'isocp',
  'simplex',
];

/** Defaults for a freshly-added text row (Q2 — follow-path is the topographic de-facto). */
export const DEFAULT_TEXT_STYLE_ID = 'arial';
export const DEFAULT_TEXT_SCALE = 1;
export const DEFAULT_TEXT_FOLLOW_PATH = true;

/** A fresh text segment — empty value (the validator blocks committing an empty one). */
export function defaultTextSegment(): LinePatternTextSegment {
  return {
    kind: 'text',
    value: '',
    styleId: DEFAULT_TEXT_STYLE_ID,
    scale: DEFAULT_TEXT_SCALE,
    rotationDeg: 0,
    offsetXMm: 0,
    offsetYMm: 0,
    followPath: DEFAULT_TEXT_FOLLOW_PATH,
  };
}

/** True when any authored segment carries embedded text (→ store as `complex`, not `pattern`). */
export function hasTextSegments(segments: readonly LinePatternSegment[]): boolean {
  return segments.some((s) => s.kind === 'text');
}

/** Reserved names the user may not reuse for a custom pattern (AutoCAD sentinels). */
export const RESERVED_LINETYPE_NAMES: readonly string[] = ['ByLayer', 'ByBlock'];

/** Validation failure codes — the UI maps these to i18n keys (no hardcoded text). */
export type LinePatternErrorCode =
  | 'name.empty'
  | 'name.reserved'
  | 'name.taken'
  | 'pattern.empty'
  | 'pattern.needsVisible'
  | 'pattern.needsGap'
  | 'pattern.badLength'
  | 'pattern.textEmpty';

export interface LinePatternValidation {
  readonly ok: boolean;
  readonly nameError?: LinePatternErrorCode;
  readonly patternError?: LinePatternErrorCode;
}

/**
 * Segment list → DXF mm pattern (`[dash>0, gap<0, dot=0, …]`). Dashes stay
 * positive, gaps become negative, dots collapse to `0`. Non-finite / non-positive
 * dash & gap lengths are dropped (the validator blocks committing those anyway).
 */
export function segmentsToDashPattern(
  segments: readonly LinePatternSegment[],
): number[] {
  const out: number[] = [];
  for (const seg of segments) {
    if (seg.kind === 'text') continue; // text is not expressible as a mm dash value
    if (seg.kind === 'dot') {
      out.push(0);
      continue;
    }
    const len = Math.abs(seg.lengthMm);
    if (!Number.isFinite(len) || len <= 0) continue;
    out.push(seg.kind === 'gap' ? -len : len);
  }
  return out;
}

/**
 * Deterministic per-line linetype NAME for copy-on-write pattern editing
 * (ADR-510 Φ2E #4). The inline «Τμήματα Μοτίβου» editor forks a shared ISO
 * linetype into this per-entity OWNED name on the first edit, then updates that
 * name's pattern in place on subsequent ones (`upsertUserLinetype`). Deterministic
 * + ASCII + RNG-free so the same line always maps to the same owned name
 * (idempotent, undo-stable, no registry bloat across edits of one line).
 */
export function linePatternName(entityId: string): string {
  return `LTP-${entityId}`;
}

/** DXF mm pattern → segment list (for editing an existing custom pattern). */
export function dashPatternToSegments(
  pattern: readonly number[],
): LinePatternSegment[] {
  return pattern.map((v) => {
    if (v === 0) return { kind: 'dot', lengthMm: 0 };
    return v < 0
      ? { kind: 'gap', lengthMm: Math.abs(v) }
      : { kind: 'dash', lengthMm: v };
  });
}

/**
 * Compact glyph preview of a pattern (`'▬ ▬ ·'`) for the linetype `description`
 * field — mirrors the ISO catalog's human-readable descriptions.
 */
export function describeSegments(segments: readonly LinePatternSegment[]): string {
  const glyph = (s: LinePatternSegment): string => {
    if (s.kind === 'text') return s.value ? ` ${s.value} ` : ' T ';
    return s.kind === 'dash' ? '▬' : s.kind === 'dot' ? '·' : ' ';
  };
  return segments.map(glyph).join('').trim() || '—';
}

/**
 * Validate a name + segment list for registration. Name must be non-empty, not a
 * reserved sentinel, and not already taken (case-sensitive, AutoCAD convention).
 * A pattern must carry at least one visible mark (dash/dot) AND at least one gap
 * (otherwise it is just a solid line), with every dash/gap length > 0.
 */
export function validateLinePattern(
  name: string,
  segments: readonly LinePatternSegment[],
  existingNames: readonly string[],
): LinePatternValidation {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, nameError: 'name.empty' };
  if (RESERVED_LINETYPE_NAMES.includes(trimmed)) return { ok: false, nameError: 'name.reserved' };
  if (existingNames.includes(trimmed)) return { ok: false, nameError: 'name.taken' };

  if (segments.length === 0) return { ok: false, patternError: 'pattern.empty' };
  // Text counts as a visible mark (──GAS──) — a text row satisfies "needs visible".
  const hasVisible = segments.some((s) => s.kind === 'dash' || s.kind === 'dot' || s.kind === 'text');
  const hasGap = segments.some((s) => s.kind === 'gap');
  const emptyText = segments.some((s) => s.kind === 'text' && s.value.trim().length === 0);
  const badLength = segments.some(
    (s) => (s.kind === 'dash' || s.kind === 'gap') && (!Number.isFinite(s.lengthMm) || s.lengthMm <= 0),
  );
  if (emptyText) return { ok: false, patternError: 'pattern.textEmpty' };
  if (badLength) return { ok: false, patternError: 'pattern.badLength' };
  if (!hasVisible) return { ok: false, patternError: 'pattern.needsVisible' };
  if (!hasGap) return { ok: false, patternError: 'pattern.needsGap' };
  return { ok: true };
}

// ── Complex bridge (ADR-642 Φ2) — text-carrying segment lists ⇄ ComplexLinetypeDef ──

/** One authored segment → its `PatternElement` (geometry or embedded text). */
function segmentToElement(seg: LinePatternSegment): PatternElement {
  if (seg.kind === 'text') {
    return {
      kind: 'text',
      value: seg.value,
      styleId: seg.styleId,
      scale: seg.scale,
      rotationDeg: seg.rotationDeg,
      offsetXMm: seg.offsetXMm,
      offsetYMm: seg.offsetYMm,
      followPath: seg.followPath,
    };
  }
  if (seg.kind === 'gap') return { kind: 'gap', lengthMm: Math.abs(seg.lengthMm) };
  if (seg.kind === 'dot') return { kind: 'dot' };
  return { kind: 'dash', lengthMm: Math.abs(seg.lengthMm) };
}

/**
 * Segment list → `ComplexLinetypeDef` (single layer). The registry/render SSoT for
 * any type the `number[]` pattern cannot express (i.e. one carrying embedded text).
 * `scaleSpace` uses the Φ1 default (`model`, AutoCAD-faithful) so a text linetype
 * scales exactly like the simple types.
 */
export function segmentsToComplex(
  name: string,
  segments: readonly LinePatternSegment[],
  description = '',
  origin: LinetypeOrigin = 'user-created',
): ComplexLinetypeDef {
  return {
    name,
    description,
    layers: [{ elements: segments.map(segmentToElement) }],
    scaleSpace: DEFAULT_SCALE_SPACE,
    origin,
  };
}

/** One `PatternElement` → an authored segment (inverse of `segmentToElement`). */
function elementToSegment(el: PatternElement): LinePatternSegment {
  if (el.kind === 'text') {
    return {
      kind: 'text',
      value: el.value,
      styleId: el.styleId,
      scale: el.scale,
      rotationDeg: el.rotationDeg,
      offsetXMm: el.offsetXMm,
      offsetYMm: el.offsetYMm,
      followPath: el.followPath,
    };
  }
  if (el.kind === 'gap') return { kind: 'gap', lengthMm: el.lengthMm };
  if (el.kind === 'dot') return { kind: 'dot', lengthMm: 0 };
  if (el.kind === 'dash') return { kind: 'dash', lengthMm: el.lengthMm };
  // symbol (Φ3) — not authorable yet; skip by projecting to a zero-gap (never emitted).
  return { kind: 'gap', lengthMm: 0 };
}

/**
 * `ComplexLinetypeDef` → authored segment list (first layer). Lets the editor load
 * an existing text-carrying linetype back into rows. Symbol elements (Φ3) are not
 * yet authorable and are dropped.
 */
export function complexToSegments(def: ComplexLinetypeDef): LinePatternSegment[] {
  const layer = def.layers[0];
  if (!layer) return [];
  return layer.elements
    .filter((el) => el.kind !== 'symbol')
    .map(elementToSegment);
}
