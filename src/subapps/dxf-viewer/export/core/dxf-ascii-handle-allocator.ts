/**
 * DXF ASCII — handle allocator (ADR-644, R2018 structural compliance).
 *
 * ONE monotonic hex-handle generator for the client-side DXF writer. Before ADR-644
 * the file was "otherwise handle-less" (see `dxf-ascii-mline-writer.ts` history) apart
 * from two isolated, hardcoded reserved blocks (MLINE `0x2A/0x2B`, embedded-text STYLE
 * `0xA0`). AutoCAD R2018 (AC1032) REQUIRES a unique `5` (or `105` for DIMSTYLE) handle on
 * every entity, table, table record and object, plus a `$HANDSEED` in the HEADER ≥ every
 * used handle — otherwise «Bad handle 0: already in use» → drawing discarded.
 *
 * This is the SINGLE SOURCE of handles: entities (via the writer's lazy-injecting `pair`
 * sink), every table header/record (explicit, they also need owner `330` + subclass), and
 * the two former reserved blocks (unified here so `$HANDSEED` covers them and nothing can
 * collide). Deterministic — same emission order ⇒ same handles (round-trip-testable).
 *
 * @module export/core/dxf-ascii-handle-allocator
 * @see dxf-ascii-writer — creates the ONE allocator + $HANDSEED backfill
 */

/** The ONE handle generator. `next()` = a fresh unique hex handle; `seedHex()` = the value
 *  for `$HANDSEED` (the next-unused counter, ≥ every handle already handed out). */
export interface HandleAllocator {
  /** Next unique handle as uppercase hex (no leading zeros), e.g. `"100"`, `"101"`, … */
  next(): string;
  /** Current counter (next-unused) as uppercase hex — the `$HANDSEED` value. */
  seedHex(): string;
}

/**
 * First handle. Handles 1–FF are left free so this writer never clashes with the low
 * fixed handles real AutoCAD/ezdxf reserve for standard objects; `0` stays the root owner
 * (`330 0`). Any unique positive value would be valid — the base is purely conventional.
 */
const HANDLE_BASE = 0x100;

/** Create the ONE allocator for a single `writeDxfAscii` run. */
export function createHandleAllocator(): HandleAllocator {
  let counter = HANDLE_BASE;
  return {
    next: () => (counter++).toString(16).toUpperCase(),
    seedHex: () => counter.toString(16).toUpperCase(),
  };
}
