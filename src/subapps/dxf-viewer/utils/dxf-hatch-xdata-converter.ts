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
import { buildHatchSceneEntity } from './dxf-hatch-converter';

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

interface LineEdge { x1: number; y1: number; x2: number; y2: number; }

/**
 * Extract the boundary line edges from the `R14_HATCH_DATA` section. Each edge is `1070 1`
 * (line) followed by exactly four `1040` (x1,y1,x2,y2). The elevation/normal matrix that
 * precedes the edges uses lone `1040`/`1010`/`1011` codes (never `1070 1`+4×`1040`), so the
 * arity check skips it; the pattern-definition section that follows starts with a `1070 1`
 * that has only two `1040` args → the arity check terminates collection there.
 *
 * Returns `null` if a curved edge (type 2/3/4) is present anywhere in the boundary — such a
 * boundary cannot be reconstructed as a polygon here, so the caller must fall back.
 */
function extractR14LineEdges(pairs: DxfPairs): LineEdge[] | null {
  let r14 = -1;
  for (let i = 0; i < pairs.length; i += 1) {
    if (pairs[i][0] === '1000' && pairs[i][1] === 'R14_HATCH_DATA') { r14 = i; break; }
  }
  if (r14 < 0) return null;

  const edges: LineEdge[] = [];
  let started = false;
  let i = r14 + 1;
  while (i < pairs.length) {
    const [c, v] = pairs[i];
    if (c === '1070') {
      const t = v.trim();
      if (t === '1') {
        const p1 = pairs[i + 1]; const p2 = pairs[i + 2];
        const p3 = pairs[i + 3]; const p4 = pairs[i + 4];
        if (p1?.[0] === '1040' && p2?.[0] === '1040' && p3?.[0] === '1040' && p4?.[0] === '1040') {
          edges.push({ x1: +p1[1], y1: +p2[1], x2: +p3[1], y2: +p4[1] });
          started = true;
          i += 5;
          continue;
        }
        if (started) break; // pattern-definition section reached (1070 1 with <4 args)
      } else if (t === '2' || t === '3' || t === '4') {
        // Arc / ellipse / spline boundary edge — unsupported polygon reconstruction.
        return null;
      }
    } else if (c === '1000' && started) {
      break; // next XDATA string section
    }
    i += 1;
  }

  return edges.length > 0 ? edges : null;
}

/**
 * Chain line edges into closed boundary paths, splitting on geometric discontinuity so islands
 * (separate loops) become separate paths — robust regardless of the proprietary `1071` grouping
 * semantics. Consecutive edges share an exact endpoint in the file, so an EDGE_JOIN_TOL gap marks
 * a new loop. Each vertex list is the ordered edge start points (the loop closes back to vertex 0).
 */
function edgesToBoundaryPaths(edges: LineEdge[]): Point2D[][] {
  const paths: Point2D[][] = [];
  let cur: Point2D[] = [];
  let lastEnd: Point2D | null = null;

  for (const e of edges) {
    if (lastEnd && (Math.abs(e.x1 - lastEnd.x) > EDGE_JOIN_TOL || Math.abs(e.y1 - lastEnd.y) > EDGE_JOIN_TOL)) {
      if (cur.length >= 3) paths.push(cur);
      cur = [];
    }
    cur.push({ x: e.x1, y: e.y1 });
    lastEnd = { x: e.x2, y: e.y2 };
  }
  if (cur.length >= 3) paths.push(cur);

  return paths;
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

  const edges = extractR14LineEdges(pairs);
  if (!edges) return null;

  const boundaryPaths = edgesToBoundaryPaths(edges);
  if (boundaryPaths.length === 0) return null;

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
  });
}
