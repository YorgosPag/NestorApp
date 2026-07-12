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
 */

/** One authored segment. `dot` ignores `lengthMm` (a dot is a zero-length dash). */
export type LinePatternSegmentKind = 'dash' | 'gap' | 'dot';

export interface LinePatternSegment {
  readonly kind: LinePatternSegmentKind;
  /** mm — used for `dash` / `gap`; ignored (forced 0) for `dot`. */
  readonly lengthMm: number;
}

/** Sensible default length (mm) for a freshly-added dash/gap row (acadiso gap). */
export const DEFAULT_SEGMENT_LENGTH_MM = 3.175;

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
  | 'pattern.badLength';

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
  const glyph = (k: LinePatternSegmentKind) =>
    k === 'dash' ? '▬' : k === 'dot' ? '·' : ' ';
  return segments.map((s) => glyph(s.kind)).join('').trim() || '—';
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
  const hasVisible = segments.some((s) => s.kind === 'dash' || s.kind === 'dot');
  const hasGap = segments.some((s) => s.kind === 'gap');
  const badLength = segments.some(
    (s) => s.kind !== 'dot' && (!Number.isFinite(s.lengthMm) || s.lengthMm <= 0),
  );
  if (badLength) return { ok: false, patternError: 'pattern.badLength' };
  if (!hasVisible) return { ok: false, patternError: 'pattern.needsVisible' };
  if (!hasGap) return { ok: false, patternError: 'pattern.needsGap' };
  return { ok: true };
}
