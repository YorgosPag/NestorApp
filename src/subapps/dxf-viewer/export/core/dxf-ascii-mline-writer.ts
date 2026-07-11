/**
 * DXF ASCII — native MLINE entity + MLINESTYLE (OBJECTS section) writer.
 *
 * ADR-636 Φ2.4 (D.4) / ADR-635 Φ C.7 parity. Full-native round-trip of an imported
 * MLINE: the import (`dxf-mline-converter`) explodes an MLINE into N parallel `polyline`
 * entities but preserves the ORIGINAL params on the first element via `dxfMlineSource`.
 * Here we reverse that — one native `MLINE` entity + its `MLINESTYLE` object — so the
 * MLINE survives as a real DXF entity instead of N loose polylines.
 *
 * Two exact inverses of the import:
 *   • `emitMline`          ↔ `readMlineParams` / `parseMlineVertices` (dxf-mline-converter)
 *   • `emitObjectsSection` ↔ `buildMlineStyleMap`                     (dxf-mline-style-parser)
 *
 * ⚠️ Fidelity boundary (documented, ADR-636 D.4): the import does NOT read the per-element
 * segment-fill params (74/41/75/42), so we emit them as empty (`74 0 / 75 0`). OUR round-trip
 * is exact (verified by test); AutoCAD opens a valid MLINE and REGENERATES its element
 * segments. Absolute no-regen pixel fidelity would need computed segment params (further increment).
 *
 * Split out (N.7.1 file-size SRP) so `dxf-ascii-writer` stays ≤500 lines — mirror of
 * `dxf-ascii-tables-writer` / `dxf-ascii-hatch-writer` / `dxf-ascii-text-writer`.
 *
 * @module export/core/dxf-ascii-mline-writer
 * @see utils/dxf-mline-converter — the import this mirrors
 * @see utils/dxf-mline-style-parser — buildMlineStyleMap (OBJECTS reader)
 */

import type { Entity, PolylineEntity, DxfMlineSource, DxfMlineStyleSource } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { Pair } from './dxf-ascii-hatch-writer';
import { hexToAci } from '../../ui/text-toolbar/controls/aci-palette';

/** Deterministic handles for the OBJECTS section — the file is otherwise handle-less, so a
 *  small reserved block cannot collide. `2A` = the ACAD_MLINESTYLE dictionary, `2B…` = styles. */
const MLINE_DICT_HANDLE = '2A';
const MLINE_STYLE_HANDLE_BASE = 0x2b;

const ACI_BYLAYER = 256;

/** A deduped MLINESTYLE registry: style defs + their (synthetic) handles, keyed by name. */
export interface MlineStyleRegistry {
  /** The deduped `{ def, handle }` list, in first-seen order (for the OBJECTS section). */
  readonly defs: ReadonlyArray<{ readonly def: DxfMlineStyleSource; readonly handle: string }>;
  /** True when no entity carried an MLINE source → the OBJECTS section is skipped entirely. */
  readonly isEmpty: boolean;
  /** The handle a given MLINE source's style resolves to (for the entity's group 340). */
  handleFor(source: DxfMlineSource): string;
}

/**
 * Scan the entities for imported-MLINE provenance markers (`dxfMlineSource`, carried by the
 * first element polyline of each group) and build a name-deduped MLINESTYLE registry. Two
 * MLINEs sharing a style name collapse to ONE MLINESTYLE object (AutoCAD names are unique).
 */
export function buildMlineStyleRegistry(entities: readonly Entity[]): MlineStyleRegistry {
  const byName = new Map<string, { def: DxfMlineStyleSource; handle: string }>();
  for (const e of entities) {
    if (e.type !== 'polyline') continue;
    const src = (e as PolylineEntity).dxfMlineSource;
    if (!src || byName.has(src.style.name)) continue;
    const handle = (MLINE_STYLE_HANDLE_BASE + byName.size).toString(16).toUpperCase();
    byName.set(src.style.name, { def: src.style, handle });
  }
  const defs = [...byName.values()];
  return {
    defs,
    isEmpty: defs.length === 0,
    handleFor: (source) => byName.get(source.style.name)?.handle ?? MLINE_DICT_HANDLE,
  };
}

/** The set of `groupId`s owned by an MLINE source — the sibling element polylines whose
 *  geometry the native MLINE re-draws, so the writer suppresses them (no duplicate POLYLINE). */
export function collectMlineGroupIds(entities: readonly Entity[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const e of entities) {
    if (e.type !== 'polyline') continue;
    const src = (e as PolylineEntity).dxfMlineSource;
    if (src && e.groupId) ids.add(e.groupId);
  }
  return ids;
}

// ─── MLINE entity ─────────────────────────────────────────────────────────────

/** Unit vector of `(dx,dy)` — zero-length degrades to `(0,0)` (never NaN). */
function unit(dx: number, dy: number): Point2D {
  const len = Math.hypot(dx, dy);
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

/** Per-vertex segment direction (last vertex reuses the previous segment's direction). */
function vertexDirection(v: readonly Point2D[], i: number): Point2D {
  const j = i < v.length - 1 ? i : i - 1;
  return unit(v[j + 1].x - v[j].x, v[j + 1].y - v[j].y);
}

/**
 * Emit one native `MLINE` — the inverse of the import `convertMline`. Reads back through
 * `readMlineParams` (40/70/71/2/340/62) + `parseMlineVertices` (11/21). Direction (12/22) is
 * the segment direction; miter (13/23) is its left-normal (simple, straight-join miter). The
 * 100 subclass markers + start point (10/20/30) + counts (72/73) are AutoCAD-structural (the
 * import ignores them). Element segment params are empty per the fidelity boundary (see header).
 */
export function emitMline(
  pair: Pair, source: DxfMlineSource, styleHandle: string, layer: string, s: number,
): void {
  const v = source.refPath;
  if (v.length < 2) return;
  const elemCount = source.style.elements.length;

  pair(0, 'MLINE');
  pair(100, 'AcDbEntity');
  pair(8, layer);
  if (source.entityColor) pair(62, hexToAci(source.entityColor));
  pair(100, 'AcDbMline');
  pair(2, source.styleName ?? source.style.name);
  pair(340, styleHandle);
  pair(40, source.scale);
  pair(70, source.justification);
  pair(71, source.isClosed ? 3 : 1); // bit 2 = closed (import reads `& 2`); bit 1 = has-vertices
  pair(72, v.length);
  pair(73, elemCount);
  pair(10, v[0].x * s); pair(20, v[0].y * s); pair(30, 0); // start point (= first vertex)

  for (let i = 0; i < v.length; i += 1) {
    pair(11, v[i].x * s); pair(21, v[i].y * s); pair(31, 0);
    const d = vertexDirection(v, i);
    pair(12, d.x); pair(22, d.y); pair(32, 0);
    pair(13, -d.y); pair(23, d.x); pair(33, 0); // miter = left-normal of direction
    for (let e = 0; e < elemCount; e += 1) { pair(74, 0); pair(75, 0); }
  }
}

// ─── OBJECTS section (MLINESTYLE) ─────────────────────────────────────────────

/** Emit one `MLINESTYLE` object — the inverse of `pairsToMlineStyle`. The pre-`49` `62` is the
 *  style fill colour (import ignores it); each `49` opens an element, a following `62` is that
 *  element's colour (emitted only when the source carried one, so a colourless element stays so). */
function emitMlineStyle(pair: Pair, def: DxfMlineStyleSource, handle: string): void {
  pair(0, 'MLINESTYLE');
  pair(5, handle);
  pair(330, MLINE_DICT_HANDLE);
  pair(100, 'AcDbMlineStyle');
  pair(2, def.name);
  pair(70, 0);              // style flags
  pair(3, '');              // description (empty)
  pair(62, ACI_BYLAYER);    // fill colour (BYLAYER) — pre-49 → import treats as fill, ignores
  pair(51, 0);              // start angle
  pair(52, 0);              // end angle
  pair(71, def.elements.length);
  for (const el of def.elements) {
    pair(49, el.offset);
    if (el.aci) pair(62, Number(el.aci)); // element colour (after 49 → element aci on import)
    pair(6, 'BYLAYER');                    // element linetype
  }
}

/**
 * Emit the `OBJECTS` section holding the `ACAD_MLINESTYLE` dictionary + one `MLINESTYLE` per
 * distinct style. DXF file order places OBJECTS last (after ENTITIES, before EOF). Skipped
 * entirely when no MLINE was exported (`registry.isEmpty`) → header-less/legacy envelope
 * unaffected. `buildMlineStyleMap` re-reads these blocks by scanning for `0 MLINESTYLE`.
 */
export function emitObjectsSection(pair: Pair, registry: MlineStyleRegistry): void {
  if (registry.isEmpty) return;
  pair(0, 'SECTION');
  pair(2, 'OBJECTS');
  // ACAD_MLINESTYLE dictionary (owner of the MLINESTYLE objects).
  pair(0, 'DICTIONARY');
  pair(5, MLINE_DICT_HANDLE);
  pair(330, '0');
  pair(100, 'AcDbDictionary');
  for (const { def, handle } of registry.defs) {
    pair(3, def.name);
    pair(350, handle);
  }
  for (const { def, handle } of registry.defs) emitMlineStyle(pair, def, handle);
  pair(0, 'ENDSEC');
}
