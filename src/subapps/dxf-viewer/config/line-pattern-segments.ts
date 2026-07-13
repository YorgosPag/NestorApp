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
  SymbolRole,
} from './complex-linetype-types';
import { DEFAULT_SCALE_SPACE } from './complex-linetype-adapters';
import { DEFAULT_LINETYPE_SYMBOL_ID } from './linetype-symbol-catalog';

/**
 * One authored segment kind — geometry (`dash`/`gap`/`dot`), embedded `text` (#2) or
 * embedded `symbol` (#3, ADR-642 Φ3: `──×──×──` φράχτης).
 */
export type LinePatternSegmentKind = 'dash' | 'gap' | 'dot' | 'text' | 'symbol';

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

/**
 * Embedded-symbol segment — ADR-642 Φ3 (#3). Mirrors `SymbolElement`: a glyph from the
 * `linetype-symbol-catalog` (`×`/`+`/`○`/βέλος/…) + AutoCAD S/R/X/Y placement. `role`
 * defaults to `'side'` (along the line); corner roles come in Φ4.
 */
export interface LinePatternSymbolSegment {
  readonly kind: 'symbol';
  readonly glyphId: string;
  readonly role: SymbolRole;
  readonly scale: number;
  readonly rotationDeg: number;
  readonly offsetXMm: number;
  readonly offsetYMm: number;
}

/** One authored segment — discriminated on `kind`. */
export type LinePatternSegment =
  | LinePatternGeometrySegment
  | LinePatternTextSegment
  | LinePatternSymbolSegment;

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

/** Defaults for a freshly-added symbol row — the fence `×` glyph, along-the-line role. */
export const DEFAULT_SYMBOL_SCALE = 1;

/**
 * All symbol placement roles (#4, Illustrator 5-tile) in picker order — the editor's
 * role-selector source. `side` = along the line (Φ3); `innerCorner`/`outerCorner` land on
 * concave/convex vertices; `start`/`end` on the polyline endpoints (Φ4).
 */
export const SYMBOL_ROLES: readonly SymbolRole[] = [
  'side',
  'innerCorner',
  'outerCorner',
  'start',
  'end',
];

/** A fresh symbol segment — the default catalog glyph (`×`), `side` role, scale 1. */
export function defaultSymbolSegment(): LinePatternSymbolSegment {
  return {
    kind: 'symbol',
    glyphId: DEFAULT_LINETYPE_SYMBOL_ID,
    role: 'side',
    scale: DEFAULT_SYMBOL_SCALE,
    rotationDeg: 0,
    offsetXMm: 0,
    offsetYMm: 0,
  };
}

/** True when any authored segment carries embedded text (→ store as `complex`, not `pattern`). */
export function hasTextSegments(segments: readonly LinePatternSegment[]): boolean {
  return segments.some((s) => s.kind === 'text');
}

/** True when any authored segment carries an embedded symbol (ADR-642 Φ3). */
export function hasSymbolSegments(segments: readonly LinePatternSegment[]): boolean {
  return segments.some((s) => s.kind === 'symbol');
}

/**
 * True when the segment list needs full `ComplexLinetypeDef` storage — i.e. it carries
 * text OR symbols, which the `number[]` mm pattern cannot express. The SSoT gate both the
 * dialog (store `complex`) and the editor (WYSIWYG canvas preview vs SVG dash) call.
 */
export function hasComplexSegments(segments: readonly LinePatternSegment[]): boolean {
  return hasTextSegments(segments) || hasSymbolSegments(segments);
}

/** Reserved names the user may not reuse for a custom pattern (AutoCAD sentinels). */
export const RESERVED_LINETYPE_NAMES: readonly string[] = ['ByLayer', 'ByBlock'];

/**
 * Suggest a free, unique NAME for a «Duplicate & edit» of `base` — the Revit/ArchiCAD «Duplicate»
 * default (a named copy the user can keep or rename). Appends the smallest numeric suffix that is not
 * already taken (`Dashed` → `Dashed 2` → `Dashed 3` …). A locale-neutral numeric suffix (not an English
 * «copy» word) keeps it a pure technical identifier — linetype names are not i18n prose (N.11 exempt).
 */
export function suggestCopyName(base: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  const trimmed = base.trim();
  if (trimmed.length > 0 && !taken.has(trimmed)) return trimmed;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${trimmed} ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${trimmed} ${1000}`;
}

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
    // text/symbol are not expressible as a mm dash value (they live in `complex`)
    if (seg.kind === 'text' || seg.kind === 'symbol') continue;
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
    if (s.kind === 'symbol') return ' ✳ ';
    return s.kind === 'dash' ? '▬' : s.kind === 'dot' ? '·' : ' ';
  };
  return segments.map(glyph).join('').trim() || '—';
}

/** Validate a linetype NAME — non-empty, not a reserved sentinel, not already taken. */
function validateName(name: string, existingNames: readonly string[]): LinePatternErrorCode | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'name.empty';
  if (RESERVED_LINETYPE_NAMES.includes(trimmed)) return 'name.reserved';
  if (existingNames.includes(trimmed)) return 'name.taken';
  return null;
}

/**
 * Validate ONE segment list — at least one visible mark (dash/dot/text/symbol) AND at least
 * one gap (otherwise it is just a solid line), with every dash/gap length > 0 and no empty
 * text. Returns the failing code or `null` when valid. SSoT shared by the single-pattern and
 * the compound (per-layer) validators.
 */
function validateSegmentList(
  segments: readonly LinePatternSegment[],
  requireGap = true,
): LinePatternErrorCode | null {
  if (segments.length === 0) return 'pattern.empty';
  // Text/symbol count as a visible mark (──GAS──, ──×──) — either satisfies "needs visible".
  const hasVisible = segments.some(
    (s) => s.kind === 'dash' || s.kind === 'dot' || s.kind === 'text' || s.kind === 'symbol',
  );
  const hasGap = segments.some((s) => s.kind === 'gap');
  const emptyText = segments.some((s) => s.kind === 'text' && s.value.trim().length === 0);
  const badLength = segments.some(
    (s) => (s.kind === 'dash' || s.kind === 'gap') && (!Number.isFinite(s.lengthMm) || s.lengthMm <= 0),
  );
  if (emptyText) return 'pattern.textEmpty';
  if (badLength) return 'pattern.badLength';
  if (!hasVisible) return 'pattern.needsVisible';
  // A compound sub-layer MAY be solid (a continuous rail) — the gap is only required for a
  // standalone single-layer type (else it is just the default solid line).
  if (requireGap && !hasGap) return 'pattern.needsGap';
  return null;
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
  const nameError = validateName(name, existingNames);
  if (nameError) return { ok: false, nameError };
  const patternError = validateSegmentList(segments);
  if (patternError) return { ok: false, patternError };
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
  if (seg.kind === 'symbol') {
    return {
      kind: 'symbol',
      glyphId: seg.glyphId,
      role: seg.role,
      scale: seg.scale,
      rotationDeg: seg.rotationDeg,
      offsetXMm: seg.offsetXMm,
      offsetYMm: seg.offsetYMm,
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
  if (el.kind === 'symbol') {
    return {
      kind: 'symbol',
      glyphId: el.glyphId,
      role: el.role,
      scale: el.scale,
      rotationDeg: el.rotationDeg,
      offsetXMm: el.offsetXMm,
      offsetYMm: el.offsetYMm,
    };
  }
  if (el.kind === 'gap') return { kind: 'gap', lengthMm: el.lengthMm };
  if (el.kind === 'dot') return { kind: 'dot', lengthMm: 0 };
  return { kind: 'dash', lengthMm: el.lengthMm };
}

/**
 * `ComplexLinetypeDef` → authored segment list (first layer). Lets the editor load an
 * existing text/symbol-carrying linetype back into rows (ADR-642 Φ2/Φ3).
 */
export function complexToSegments(def: ComplexLinetypeDef): LinePatternSegment[] {
  const layer = def.layers[0];
  if (!layer) return [];
  return layer.elements.map(elementToSegment);
}

// ── Compound-layer bridge (ADR-642 Φ5, #9) — multi-layer authored model ⇄ ComplexLinetypeDef ──

/**
 * One authored compound layer (#9): a segment list + its perpendicular `offsetMm` from the
 * line axis (0 = the centre/base layer) + an optional per-layer base `widthMm`. A single
 * centre layer is exactly the common (non-compound) type — the editor always works in this
 * model, so the single- and multi-layer paths share ONE code path (no fork).
 */
export interface LinePatternLayer {
  readonly segments: readonly LinePatternSegment[];
  readonly offsetMm: number;
  readonly widthMm?: number;
}

/** Wrap a segment list as a single centre layer (offset 0) — the backward-compatible default. */
export function singleLayer(segments: readonly LinePatternSegment[]): LinePatternLayer[] {
  return [{ segments: [...segments], offsetMm: 0 }];
}

/** A fresh compound layer at a given offset — seeded with one dash + one gap (a plain dashed run). */
export function defaultCompoundLayer(offsetMm: number): LinePatternLayer {
  return {
    segments: [
      { kind: 'dash', lengthMm: DEFAULT_SEGMENT_LENGTH_MM },
      { kind: 'gap', lengthMm: DEFAULT_SEGMENT_LENGTH_MM },
    ],
    offsetMm,
  };
}

/** True when the authored layers form a genuine compound (≥2 layers OR any non-zero offset). */
export function isCompound(layers: readonly LinePatternLayer[]): boolean {
  return layers.length > 1 || layers.some((l) => l.offsetMm !== 0);
}

/**
 * Minimum authored dimension (mm) any grip-driven scale is allowed to reach — ADR-642 §6.7.3 min-guard.
 * Keeps `offsetMm` band half-extent / geometry `lengthMm` from collapsing to zero or flipping sign under
 * a drag. SSoT shared by `scaleLayerSpread`/`scalePatternLength` and the grip overlay's factor mapping.
 */
export const LINE_PATTERN_MIN_MM = 0.05;

/**
 * The offset (mm) that centres layer `index` between the OTHER layers — the midpoint of their min &
 * max offsets (the geometric centre of the compound's span). Exactly what a cross-tie layer wants:
 * sit halfway between the outer rails, whatever their offsets (e.g. rails at 0 and +1.5 → tie +0.75),
 * so a hand-authored railway is not left eccentric. With no other layers there is nothing to centre
 * against → the layer keeps its own offset.
 */
export function centerOffsetForLayer(
  layers: readonly LinePatternLayer[],
  index: number,
): number {
  let min = Infinity;
  let max = -Infinity;
  layers.forEach((l, i) => {
    if (i === index) return;
    if (l.offsetMm < min) min = l.offsetMm;
    if (l.offsetMm > max) max = l.offsetMm;
  });
  if (min === Infinity) return layers[index]?.offsetMm ?? 0; // no other layers
  return (min + max) / 2;
}

// ── Grip-editor scale helpers (ADR-642 Φ6-A, §6.7) — pure model math, jest-testable ──

/** The centre offset (mm) of the whole band — midpoint of ALL layers' min & max offsets (0 when empty). */
export function bandCenterOffset(layers: readonly LinePatternLayer[]): number {
  if (layers.length === 0) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (const l of layers) {
    if (l.offsetMm < min) min = l.offsetMm;
    if (l.offsetMm > max) max = l.offsetMm;
  }
  return (min + max) / 2;
}

/** Half-extent (mm) of the band = the largest `|offset − band centre|` (0 = single/centred, nothing to spread). */
export function bandHalfExtentMm(layers: readonly LinePatternLayer[]): number {
  const center = bandCenterOffset(layers);
  return layers.reduce((m, l) => Math.max(m, Math.abs(l.offsetMm - center)), 0);
}

/** Total authored length (mm) of a segment list = Σ dash + gap lengths (base for the length-scale grip). */
export function patternTotalLengthMm(segments: readonly LinePatternSegment[]): number {
  return segments.reduce(
    (sum, s) => (s.kind === 'dash' || s.kind === 'gap' ? sum + Math.abs(s.lengthMm) : sum),
    0,
  );
}

/**
 * Uniformly scale the band spread (ADR-642 §6.7.2 top/bottom grip): every `offsetMm` moves to
 * `centre + (offset − centre) × factor`, so the band opens/closes around its geometric centre
 * (`bandCenterOffset`) — an asymmetric compound stays coherent. Min-guard (§6.7.3): `factor` is
 * clamped ≥ 0 (no sign flip) and ≥ `MIN_MM / halfExtent` (the band never collapses below ε). With no
 * spread to scale (single/centred layers → halfExtent 0) it is a no-op — a scale cannot create a band.
 */
export function scaleLayerSpread(
  layers: readonly LinePatternLayer[],
  factor: number,
): LinePatternLayer[] {
  const halfExtent = bandHalfExtentMm(layers);
  if (halfExtent <= 0 || !Number.isFinite(factor)) return layers.map((l) => ({ ...l }));
  const safe = Math.max(factor, LINE_PATTERN_MIN_MM / halfExtent, 0);
  const center = bandCenterOffset(layers);
  return layers.map((l) => ({ ...l, offsetMm: center + (l.offsetMm - center) * safe }));
}

/**
 * Uniformly scale the pattern length along the path (ADR-642 §6.7.2 left/right grip): every geometry
 * `dash`/`gap` length is multiplied by `factor`; `dot` (zero-length) and `text`/`symbol` slots are left
 * untouched (they carry no path length). Min-guard (§6.7.3): `factor` is clamped so the SMALLEST dash/gap
 * stays ≥ ε (ratios preserved, no collapse/inversion). With no dash/gap to scale it is a no-op.
 */
export function scalePatternLength(
  layers: readonly LinePatternLayer[],
  factor: number,
): LinePatternLayer[] {
  let minLen = Infinity;
  for (const l of layers) {
    for (const s of l.segments) {
      if (s.kind === 'dash' || s.kind === 'gap') minLen = Math.min(minLen, Math.abs(s.lengthMm));
    }
  }
  if (minLen === Infinity || !Number.isFinite(factor)) return layers.map((l) => ({ ...l }));
  const safe = Math.max(factor, LINE_PATTERN_MIN_MM / minLen, 0);
  return layers.map((l) => ({
    ...l,
    segments: l.segments.map((s) =>
      s.kind === 'dash' || s.kind === 'gap' ? { ...s, lengthMm: Math.abs(s.lengthMm) * safe } : s,
    ),
  }));
}

/**
 * Authored compound layers → `ComplexLinetypeDef` (the render + registry SSoT for #9). Each
 * layer's segments lift through the SAME `segmentToElement` bridge the single-layer path uses;
 * `offsetMm`/`widthMm` ride onto the `StrokeLayer` (0 offset omitted to stay byte-identical to
 * the single-layer output). `scaleSpace` = the Φ1 default so a compound scales like the simple types.
 */
export function layersToComplex(
  name: string,
  layers: readonly LinePatternLayer[],
  description = '',
  origin: LinetypeOrigin = 'user-created',
): ComplexLinetypeDef {
  return {
    name,
    description,
    layers: layers.map((l) => ({
      elements: l.segments.map(segmentToElement),
      ...(l.offsetMm ? { offsetMm: l.offsetMm } : {}),
      ...(l.widthMm != null ? { widthMm: l.widthMm } : {}),
    })),
    scaleSpace: DEFAULT_SCALE_SPACE,
    origin,
  };
}

/** `ComplexLinetypeDef` → authored compound layers (inverse of `layersToComplex`). */
export function complexToLayers(def: ComplexLinetypeDef): LinePatternLayer[] {
  return def.layers.map((l) => ({
    segments: l.elements.map(elementToSegment),
    offsetMm: l.offsetMm ?? 0,
    ...(l.widthMm != null ? { widthMm: l.widthMm } : {}),
  }));
}

/**
 * Compact human-readable description of a compound: single layer → the plain segment glyphs;
 * multi-layer → each layer's glyphs joined by `∥` (parallel bars — the compound affordance).
 */
export function describeLayers(layers: readonly LinePatternLayer[]): string {
  if (layers.length <= 1) return describeSegments(layers[0]?.segments ?? []);
  return layers.map((l) => describeSegments(l.segments)).join(' ∥ ');
}

/**
 * Validate a name + compound layers for registration. Name rules as `validateLinePattern`;
 * EVERY layer must itself be a valid pattern (a compound line with a broken sub-layer is invalid).
 */
export function validateLinePatternLayers(
  name: string,
  layers: readonly LinePatternLayer[],
  existingNames: readonly string[],
): LinePatternValidation {
  const nameError = validateName(name, existingNames);
  if (nameError) return { ok: false, nameError };
  if (layers.length === 0) return { ok: false, patternError: 'pattern.empty' };
  // Genuine compounds allow solid rails; a standalone single layer still needs a gap.
  const requireGap = layers.length === 1;
  for (const l of layers) {
    const patternError = validateSegmentList(l.segments, requireGap);
    if (patternError) return { ok: false, patternError };
  }
  return { ok: true };
}
