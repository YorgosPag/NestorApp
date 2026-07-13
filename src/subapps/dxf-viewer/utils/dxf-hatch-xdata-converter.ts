/**
 * 🏢 ENTERPRISE: R12 associative-hatch INSERT → scene HATCH (ADR-635 Φ C.6)
 *
 * AutoCAD R12 / AC1009 has **no HATCH entity**. A hatch is stored as an anonymous block
 * (`*X#`) full of exploded pattern LINEs, INSERTed into model space and tagged with XDATA:
 *
 *   1001 ACAD
 *   1000 HATCH
 *   1002 {
 *     1070 <flags>
 *     1000 <patternName>      ← e.g. GRASS
 *     1040 <scale>            ← e.g. 0.005
 *     1040 <angleDeg>         ← e.g. 0.0
 *     1000 R14_HATCH_DATA
 *     …(elevation/normal matrix)…
 *     1071 <edgeCount>  1070 1  1040 x1 1040 y1 1040 x2 1040 y2  …(N line edges)…
 *   1002 }
 *
 * Without this converter, {@link instantiateInsert} explodes the `*X#` block into thousands of
 * loose LINEs (the KADOS sample: 156 860 lines). Instead we reconstruct a SINGLE `type:'hatch'`
 * scene entity — exactly what modern AutoCAD does when opening an R12 drawing (it re-associates
 * the boundary from `R14_HATCH_DATA`). The `*X#` block is then NOT expanded (see scene-builder).
 *
 * Boundary support is **line edges only** (edge type 1). A boundary containing arc/ellipse/spline
 * edges returns `null` → the caller falls back to normal block explosion (the hatch still shows,
 * just as its original line geometry — safe degradation, never wrong geometry).
 *
 * @see dxf-hatch-converter.ts - buildHatchSceneEntity (shared assembly SSoT)
 * @see AutoCAD DXF Reference: ACAD/HATCH XDATA (R14_HATCH_DATA boundary cache)
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import type { EntityData } from './dxf-converter-helpers';
import { buildHatchSceneEntity, makeInlinePattern } from './dxf-hatch-converter';
import type { PatternLine } from '../data/hatch-pattern-catalog';
import { radToDeg } from '../rendering/entities/shared/geometry-angle-utils';
import { hasAnyBulge, expandPolyline } from '../rendering/entities/shared/geometry-bulge-utils';

type DxfPairs = ReadonlyArray<readonly [string, string]>;

/** Endpoint-match tolerance when chaining boundary line edges into closed paths. */
const EDGE_JOIN_TOL = 1e-6;

interface HatchXdataHead {
  /** Index into `pairs` right after the `1001 ACAD / 1000 HATCH` marker. */
  start: number;
  patternName: string | undefined;
  /** Pattern scale (first 1040 after the name). */
  scale: number | undefined;
  /** Pattern angle in DEGREES (second 1040 after the name). */
  angle: number | undefined;
}

/**
 * Locate the `1001 ACAD` + `1000 HATCH` XDATA marker and read the pattern name, scale and angle
 * that immediately follow. Returns null when the INSERT carries no such hatch tag (the common
 * case — most INSERTs are plain block references).
 */
function readHatchXdataHead(pairs: DxfPairs): HatchXdataHead | null {
  let start = -1;
  for (let i = 0; i < pairs.length - 1; i += 1) {
    if (pairs[i][0] === '1001' && pairs[i][1] === 'ACAD'
      && pairs[i + 1][0] === '1000' && pairs[i + 1][1] === 'HATCH') {
      start = i + 2;
      break;
    }
  }
  if (start < 0) return null;

  // First 1000 after the marker = pattern name; the next up-to-two 1040 = scale, angle.
  let i = start;
  while (i < pairs.length && pairs[i][0] !== '1000') i += 1;
  const patternName = pairs[i]?.[1] || undefined;
  i += 1;

  const nums: number[] = [];
  while (i < pairs.length && nums.length < 2) {
    const [c, v] = pairs[i];
    if (c === '1000') break; // reached R14_HATCH_DATA — scalars done
    if (c === '1040') nums.push(parseFloat(v));
    i += 1;
  }

  return {
    start,
    patternName,
    scale: Number.isFinite(nums[0]) ? nums[0] : undefined,
    angle: Number.isFinite(nums[1]) ? nums[1] : undefined,
  };
}

/**
 * Locate where the boundary-path data begins inside `R14_HATCH_DATA`: the section opens with a
 * handle `1000`, an elevation/normal transform matrix (1011/1021/1031 rows + 1010/1020/1030
 * normal), then repeats the pattern name as a `1000` immediately preceded by the normal's `1030`.
 * Boundary data starts right after that pattern-name `1000`. Returns -1 when no R14 block exists.
 */
function findR14BoundaryStart(pairs: DxfPairs): number {
  let r14 = -1;
  for (let i = 0; i < pairs.length; i += 1) {
    if (pairs[i][0] === '1000' && pairs[i][1] === 'R14_HATCH_DATA') { r14 = i; break; }
  }
  if (r14 < 0) return -1;
  for (let i = r14 + 1; i < pairs.length; i += 1) {
    if (pairs[i][0] === '1000' && pairs[i - 1]?.[0] === '1030') return i + 1;
  }
  return -1;
}

/**
 * Extract boundary polygon paths from the `R14_HATCH_DATA` section. AutoCAD writes a boundary
 * path in one of TWO encodings, both handled here:
 *
 *   • **edge list** — per edge `1070 1` (line) + four `1040` (x1,y1,x2,y2); the polygon is the
 *     ordered edge start points. A geometric gap between an edge's end and the next edge's start
 *     splits a new loop (islands).
 *   • **polyline** — `1071 <numVerts>` immediately followed by `numVerts × (1040 x, 1040 y)`.
 *
 * Collection is bounded by the `1071 0` boundary terminator, so the pattern-definition section
 * that follows (which reuses `1070`/`1040` codes, incl. `1070 3` line-family counts) is never
 * misread. A curved boundary edge (`1070` type 2/3/4 = arc/ellipse/spline) returns `null` so the
 * caller falls back to block explosion (the hatch still shows — safe degradation, not wrong shape).
 */
function extractR14BoundaryPaths(pairs: DxfPairs): Point2D[][] | null {
  const start = findR14BoundaryStart(pairs);
  if (start < 0) return null; // no R14 boundary cache → caller falls back

  const paths: Point2D[][] = [];
  let cur: Point2D[] = [];
  let lastEnd: Point2D | null = null;
  const flush = (): void => { if (cur.length >= 3) paths.push(cur); cur = []; lastEnd = null; };

  let i = start;
  while (i < pairs.length) {
    const [c, v] = pairs[i];

    if (c === '1071') {
      const n = parseInt(v, 10) || 0;
      if (n === 0) break; // boundary terminator — pattern section follows
      if (pairs[i + 1]?.[0] === '1040') {
        // Polyline-vertex path: `n` vertices as consecutive 1040 scalars. AutoCAD writes
        // EITHER 2 (x, y) OR 3 (x, y, bulge) scalars per vertex — infer the stride from the
        // consecutive-1040 count so a bulge column is not misread as the next vertex's X.
        // 🐛 ADR-635 — 3-coord hatches (18/117 in the KADOS sample) were read at stride 2,
        // shifting every vertex by one scalar → spurious (0,x)/(x,0) verts that exploded the
        // hatch bbox to [0..17M] (center ≈ 8.5 km, y≈x) → fit-to-view collapsed to a dot.
        flush();
        i += 1;
        let count = 0;
        while (i + count < pairs.length && pairs[i + count][0] === '1040') count += 1;
        const stride = n > 0 && count === n * 3 ? 3 : 2;
        const verts: Point2D[] = [];
        // ADR-647 Φ2b — at stride 3 the 3rd scalar/vertex is a standard DXF bulge = tan(θ/4)
        // (GRATE hatches: 7/117, 11 arcs). `count === n*3` reliably signals the bulge column
        // (the ADR's `hasBulge` flag showed 0 mismatches vs this inference on the full 117-hatch scan).
        const bulges: number[] = [];
        for (let k = 0; k < n && i + 1 < pairs.length; k += 1) {
          if (pairs[i][0] === '1040' && pairs[i + 1][0] === '1040') {
            verts.push({ x: +pairs[i][1], y: +pairs[i + 1][1] });
            bulges.push(stride === 3 ? +pairs[i + 2][1] : 0);
            i += stride;
          } else break;
        }
        if (verts.length >= 3) {
          // Tessellate arcs ONLY when a real bulge is present (SSoT `bulgeToPolyline` via
          // `expandPolyline`, closed loop — ADR-510, zero new arc math). A straight-only path keeps
          // its raw vertices (unchanged) so island/edge boundaries stay byte-identical.
          paths.push(hasAnyBulge(bulges) ? expandPolyline(verts, bulges, true) : verts);
        }
        continue;
      }
      i += 1; // structural 1071 (numPaths / flag)
      continue;
    }

    if (c === '1070') {
      const t = v.trim();
      if (t === '1') {
        const p1 = pairs[i + 1]; const p2 = pairs[i + 2];
        const p3 = pairs[i + 3]; const p4 = pairs[i + 4];
        if (p1?.[0] === '1040' && p2?.[0] === '1040' && p3?.[0] === '1040' && p4?.[0] === '1040') {
          const s: Point2D = { x: +p1[1], y: +p2[1] };
          const e: Point2D = { x: +p3[1], y: +p4[1] };
          if (lastEnd && (Math.abs(s.x - lastEnd.x) > EDGE_JOIN_TOL || Math.abs(s.y - lastEnd.y) > EDGE_JOIN_TOL)) {
            if (cur.length >= 3) paths.push(cur);
            cur = [];
          }
          cur.push(s);
          lastEnd = e;
          i += 5;
          continue;
        }
        i += 1; // `1070 1` used as a polyline flag (not a 4-coord edge)
        continue;
      }
      if (t === '2' || t === '3' || t === '4') return null; // curved edge → fall back
      i += 1; // `1070 0` style/associativity flag
      continue;
    }

    if (c === '1000') break; // unexpected next XDATA section — stop
    i += 1;
  }
  flush();

  return paths.length > 0 ? paths : null;
}

/**
 * Locate the pattern-definition fingerprint inside `R14_HATCH_DATA` and return the index of the
 * `numFamilies` value (families start at the next pair), or -1. The section opens — right after the
 * boundary terminator `1071 0` — with the distinctive signature (ADR-647 §Locked spec):
 *
 *   1070 <fillFlag 0|1>  1070 1  1040 <angleRad>  1040 <scale>  1070 0  1070 <numFamilies 1..8>
 *
 * The double `1070 … / 1070 1` never occurs in the boundary (each `1070 1` line-edge flag is
 * followed by four `1040`), so scanning from the R14 boundary start is unambiguous.
 */
function findR14PatternDefStart(pairs: DxfPairs): number {
  const from = findR14BoundaryStart(pairs);
  if (from < 0) return -1;
  for (let i = from; i + 5 < pairs.length; i += 1) {
    if (pairs[i][0] === '1070' && (pairs[i][1].trim() === '0' || pairs[i][1].trim() === '1')
      && pairs[i + 1][0] === '1070' && pairs[i + 1][1].trim() === '1'
      && pairs[i + 2][0] === '1040'
      && pairs[i + 3][0] === '1040'
      && pairs[i + 4][0] === '1070' && pairs[i + 4][1].trim() === '0'
      && pairs[i + 5][0] === '1070') {
      const nf = parseInt(pairs[i + 5][1], 10) || 0;
      if (nf >= 1 && nf <= 8) return i + 5;
    }
  }
  return -1;
}

/**
 * Parse the `R14_HATCH_DATA` **pattern definition** into `PatternLine[]` (ADR-647 Φ1) — the SAME
 * shape the native HATCH path (`parseInlinePatternLines`) produces, so the R12 associative-hatch
 * renders/exports 1:1 with AutoCAD (preserve-native, catalog-independent) instead of falling back
 * to a possibly-divergent catalog def.
 *
 * Per family: `1040 angleRad, 1040 baseX, 1040 baseY, 1040 deltaWx, 1040 deltaWy, 1070 numDashes,
 * numDashes × 1040 dash`. Conversions are EMPIRICALLY LOCKED against the exploded `*X#` LINEs
 * (residuals ~1e-9, ADR-647 ground-truth):
 *   - `angle`  = `radToDeg(angleRad)` (already the final baked line angle).
 *   - `origin` = `[baseX, baseY]` (world phase — gives both perpendicular AND along-line dash phase).
 *   - `delta`  = the WORLD offset vector un-rotated by −angle into line-local `[along, perp]`, which
 *                is what the renderer (`buildPatternLineSegments`) expects on `PatternLine.delta`.
 *   - `dashes` = as-is (`>0` line, `<0` gap; empty ⇒ solid).
 *
 * Defensive: a family truncated by `1002`/end-of-pairs is dropped (the unit-test fixtures carry a
 * truncated tail), returning only the fully-read families.
 */
function parseR14PatternLines(pairs: DxfPairs): PatternLine[] {
  const nfIdx = findR14PatternDefStart(pairs);
  if (nfIdx < 0) return [];
  const numFamilies = parseInt(pairs[nfIdx][1], 10) || 0;

  const lines: PatternLine[] = [];
  let i = nfIdx + 1;
  const num = (code: string): number | null => {
    const p = pairs[i];
    if (!p || p[0] !== code) return null; // wrong code / end-of-pairs / `1002` closer ⇒ stop family
    i += 1;
    return parseFloat(p[1]);
  };

  for (let fam = 0; fam < numFamilies; fam += 1) {
    const angleRad = num('1040');
    const baseX = num('1040');
    const baseY = num('1040');
    const deltaWx = num('1040');
    const deltaWy = num('1040');
    const nDashRaw = num('1070');
    if (angleRad === null || baseX === null || baseY === null
      || deltaWx === null || deltaWy === null || nDashRaw === null) break;

    const nDash = Math.max(0, Math.trunc(nDashRaw));
    const dashes: number[] = [];
    let dashOk = true;
    for (let d = 0; d < nDash; d += 1) {
      const dv = num('1040');
      if (dv === null) { dashOk = false; break; }
      dashes.push(dv);
    }
    if (!dashOk) break;

    // Un-rotate the world-delta into line-local [along-stagger, perpendicular-spacing] (ADR-647 §3.2).
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    const localDx = deltaWx * c + deltaWy * s;
    const localDy = -deltaWx * s + deltaWy * c;
    lines.push({ angle: radToDeg(angleRad), origin: [baseX, baseY], delta: [localDx, localDy], dashes });
  }
  return lines;
}

/**
 * If `insert` is an R12 associative-hatch reference (carries `ACAD/HATCH` XDATA with a usable
 * line-edge boundary), reconstruct it as a single `type:'hatch'` scene entity and return it —
 * so the caller can SKIP exploding the referenced `*X#` block into loose lines. Returns `null`
 * for a plain INSERT, or when the boundary is missing / curved (caller falls back to explosion).
 *
 * Color is left BYLAYER (resolved downstream); coordinates stay in the file's units and ride the
 * canonical-mm scale pass exactly like a native HATCH entity.
 */
export function tryConvertInsertHatch(insert: EntityData, index: number): AnySceneEntity | null {
  const pairs = insert.pairs;
  if (!pairs || pairs.length === 0) return null;

  const head = readHatchXdataHead(pairs);
  if (!head) return null;

  const boundaryPaths = extractR14BoundaryPaths(pairs);
  if (!boundaryPaths || boundaryPaths.length === 0) return null;

  // ADR-647 Φ1 — preserve the ORIGINAL pattern definition (R14_HATCH_DATA) as an inlinePattern, so
  // the render + export reproduce it 1:1 with AutoCAD instead of leaning on a (possibly divergent)
  // catalog def. Symmetric with the native `convertHatch` path (shared `makeInlinePattern` SSoT).
  const inlinePattern = makeInlinePattern(head.patternName, parseR14PatternLines(pairs));

  return buildHatchSceneEntity({
    id: `hatch_insert_${index}`,
    layer: insert.layer,
    boundaryPaths,
    patternName: head.patternName,
    solid: false,
    patternTypeCode: 1, // predefined pattern (R12 associative hatch is always a named pattern)
    islandCode: 0,
    angle: head.angle,
    scale: head.scale,
    color: undefined, // BYLAYER — resolved in processSceneEntity
    inlinePattern,
  });
}
