/**
 * 🏢 ENTERPRISE: DXF MLINESTYLE object reader (ADR-635 Φ C.7)
 *
 * MLINESTYLE lives in the DXF **OBJECTS** section (NOT the TABLES section — that is
 * why it cannot reuse the TABLES-based `parseStyleTable`). It defines the N parallel
 * line elements an MLINE draws: each element has an `offset` (group 49), an ACI
 * `color` (group 62) and a linetype (group 6, follow-up). An MLINE references its
 * style by NAME (entity group 2) and by HANDLE (entity group 340), so the returned
 * map is keyed by BOTH — a lookup succeeds with whichever the entity carries.
 *
 * ⚠️ SELF-CONTAINED on purpose (mirror of `style-table-reader.ts`): it does NOT import
 * `DxfEntityParser`, so it stays a leaf and cannot form the runtime cycle
 * converters → mline-converter → (value)style-parser → entity-parser → converters.
 *
 * ⚠️ ORDERED scan (not a `Map<code,value>`): the per-element `49/62/6` codes REPEAT,
 * so a flat map would keep only the LAST element — same idiom as HATCH/MLINE vertices.
 *
 * @see AutoCAD DXF Reference: MLINESTYLE object · MLINE entity (group 340 pointer)
 * @see text-engine/parser/style-table-reader.ts — sibling table reader (TABLES section)
 */

/** One line element of an MLINESTYLE (group 49 offset + optional ACI color group 62). */
export interface MlineElementDef {
  /** Signed perpendicular offset from the style's zero line (group 49). */
  readonly offset: number;
  /** Raw ACI color code string (group 62); resolved to a hex by the converter. */
  readonly aci?: string;
}

/** A parsed MLINESTYLE definition (name + handle + ordered line elements). */
export interface MlineStyleDef {
  readonly name: string;
  readonly handle?: string;
  readonly elements: readonly MlineElementDef[];
}

/** Per-drawing map of MLINESTYLE lookups, keyed by BOTH style name AND handle. */
export type MlineStyleMap = Map<string, MlineStyleDef>;

/**
 * AutoCAD's built-in "STANDARD" mline style: two elements at ±0.5. Used as the
 * fallback when a drawing has no OBJECTS section, no MLINESTYLE, or an MLINE whose
 * named/handled style is absent — matching AutoCAD's own default.
 */
export const STANDARD_MLINE_STYLE: MlineStyleDef = {
  name: 'STANDARD',
  elements: [{ offset: 0.5 }, { offset: -0.5 }],
};

/**
 * Build a `{ name|handle → MlineStyleDef }` map from a DXF's OBJECTS section.
 * Returns an empty map when there is no OBJECTS section / no MLINESTYLE object.
 */
export function buildMlineStyleMap(lines: readonly string[]): MlineStyleMap {
  const map: MlineStyleMap = new Map();
  const range = findObjectsSectionRange(lines);
  if (!range) return map;

  let i = range.start;
  while (i < range.end - 1) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? '';
    if (code === '0' && value === 'MLINESTYLE') {
      const { pairs, next } = collectOrderedPairs(lines, i + 2, range.end);
      const def = pairsToMlineStyle(pairs);
      if (def) {
        map.set(def.name, def);
        if (def.handle) map.set(def.handle, def);
      }
      i = next;
    } else {
      i += 2;
    }
  }
  return map;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Locate the OBJECTS `SECTION` as a `[start,end)` line range, or null when absent. */
function findObjectsSectionRange(lines: readonly string[]): { start: number; end: number } | null {
  for (let i = 0; i + 3 < lines.length; i += 2) {
    if (lines[i]?.trim() === '0' && lines[i + 1]?.trim() === 'SECTION'
      && lines[i + 2]?.trim() === '2' && lines[i + 3]?.trim() === 'OBJECTS') {
      const start = i + 4;
      for (let j = start; j < lines.length - 1; j += 2) {
        if (lines[j]?.trim() === '0' && lines[j + 1]?.trim() === 'ENDSEC') return { start, end: j };
      }
      return { start, end: lines.length };
    }
  }
  return null;
}

/** Collect ordered `[code,value]` pairs from `start` until the next `0` (or `end`). */
function collectOrderedPairs(
  lines: readonly string[],
  start: number,
  end: number,
): { pairs: Array<readonly [string, string]>; next: number } {
  const pairs: Array<readonly [string, string]> = [];
  let i = start;
  while (i < end - 1) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim() ?? '';
    if (!code) { i += 2; continue; }
    if (code === '0') break;
    pairs.push([code, value]);
    i += 2;
  }
  return { pairs, next: i };
}

/**
 * Fold ordered MLINESTYLE pairs into a definition. Each `49` opens a new element;
 * a `62` AFTER the first `49` is that element's colour (a `62` BEFORE it is the
 * style's fill colour — ignored). Returns null when no name / no elements.
 */
function pairsToMlineStyle(pairs: ReadonlyArray<readonly [string, string]>): MlineStyleDef | null {
  let name: string | undefined;
  let handle: string | undefined;
  const elements: MlineElementDef[] = [];

  for (const [code, value] of pairs) {
    if (code === '2' && name === undefined) name = value;
    else if (code === '5' && handle === undefined) handle = value;
    else if (code === '49') {
      const offset = parseFloat(value);
      if (!Number.isNaN(offset)) elements.push({ offset });
    } else if (code === '62' && elements.length > 0) {
      const last = elements[elements.length - 1];
      elements[elements.length - 1] = { offset: last.offset, aci: value };
    }
  }

  if (!name || elements.length === 0) return null;
  return { name, ...(handle && { handle }), elements };
}
