/**
 * 🏢 Old-style POLYLINE — VERTEX records → ordered vertex pairs (ADR-635 · extracted from `dxf-entity-parser.ts`,
 * N.7.1 500-line cap).
 *
 * Each VERTEX is its own `0`-delimited record, so the flat entity parser cannot see them. This walks the VERTEX
 * records after the POLYLINE header and re-emits their 10 / 20 / **30** / 42 as ordered pairs, one vertex after the
 * other — the same shape LWPOLYLINE carries natively, so `parseVerticesFromPairs` reads both.
 *
 * 30 is kept since 2026-10-25: a **3D** POLYLINE (header 70 bit 8) stores each vertex's WCS Z there — the way a
 * surveyor usually delivers breaklines. For a 2D POLYLINE the per-vertex 30 is unused (its elevation is the header
 * point's 30, OCS) — `dxf-elevation-reader.ts` decides which one counts.
 *
 * Pure and dependency-free on purpose: the parser imports it, it imports nothing from the parser (no init cycle,
 * CHECK 3.80).
 */

/** Vertex codes carried into the ordered pairs, in emission order. */
const VERTEX_CODES = ['10', '20', '30', '42'] as const;

export interface PolylineVertexCollection {
  readonly pairs: Array<readonly [string, string]>;
  /** Index of the `0` line that ended the walk (SEQEND or a stray marker); `lines.length` at end of input. */
  readonly stopIndex: number;
  /** `true` when the walk ended on SEQEND — the caller resumes AFTER it; otherwise at `stopIndex`. */
  readonly endedOnSeqend: boolean;
}

/**
 * Collect the VERTEX records starting at `firstIndex` (the `0` line after the POLYLINE header).
 * @param lines all trimmed-or-raw DXF lines (values are trimmed here)
 */
export function collectPolylineVertexPairs(lines: readonly string[], firstIndex: number): PolylineVertexCollection {
  const pairs: Array<readonly [string, string]> = [];
  let i = firstIndex;
  while (i < lines.length - 1) {
    const code = lines[i]!.trim();
    const value = lines[i + 1]!.trim();
    if (code !== '0') { i += 2; continue; }
    if (value !== 'VERTEX') return { pairs, stopIndex: i, endedOnSeqend: value === 'SEQEND' };

    const found = new Map<string, string>();
    let j = i + 2;
    while (j < lines.length - 1) {
      const c = lines[j]!.trim();
      if (c === '0') break;
      if ((VERTEX_CODES as readonly string[]).includes(c)) found.set(c, lines[j + 1]!.trim());
      j += 2;
    }
    for (const c of VERTEX_CODES) {
      const v = found.get(c);
      if (v !== undefined) pairs.push([c, v]);
    }
    i = j;
  }
  return { pairs, stopIndex: lines.length, endedOnSeqend: false };
}
