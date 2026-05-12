/**
 * ADR-344 Phase 11.D — DXF XDATA codec for ANNOTATIVE entities.
 *
 * Encodes / decodes the per-entity annotation-scale list as DXF XDATA under
 * the `AcDbAnnotativeData` application name (AutoCAD convention).
 *
 * Wire format (per AutoCAD DXF reference, R2008+):
 *
 *   1001 AcDbAnnotativeData
 *   1070 <count>              ; number of attached scales
 *   1071 <handle>             ; SCALE table object handle (repeated `count` times)
 *
 * The handle (1071) is a 32-bit reference into the DXF dictionary `ACAD_SCALELIST`,
 * which lists named scales with their paper-/model-space ratios. Because the
 * ScaleList dictionary lookup belongs to a higher-level DXF section assembler
 * (out of scope for Phase 11.D), this codec works with **resolved**
 * `EntityAnnotationScale` records directly — callers provide the scale list
 * already dereferenced.
 *
 * Each line is a `string` (raw DXF text-mode line). Callers concatenate them
 * with the appropriate newline convention.
 */

import type { EntityAnnotationScale } from '../../types/entities';

export const XDATA_APP_NAME = 'AcDbAnnotativeData';
export const XDATA_GROUP_APPNAME = 1001;
export const XDATA_GROUP_INT16 = 1070;
export const XDATA_GROUP_HANDLE = 1071;

// ─── Decode ───────────────────────────────────────────────────────────────────

/**
 * One raw XDATA pair (group code + string value) as produced by a DXF lexer.
 * Code is the integer group code (1000-1071 for XDATA); value is the raw
 * string from the next line.
 */
export interface RawXDataPair {
  readonly code: number;
  readonly value: string;
}

/**
 * Parse a raw XDATA pair stream and extract annotation scales attached under
 * `AcDbAnnotativeData`. Scales are resolved via the provided `scaleResolver`
 * (typically a lookup into the `ACAD_SCALELIST` dictionary).
 *
 * Returns `null` if the entity has no annotative XDATA block.
 */
export function parseAnnotativeXData(
  pairs: readonly RawXDataPair[],
  scaleResolver: (handle: string) => EntityAnnotationScale | null,
): readonly EntityAnnotationScale[] | null {
  const block = findAppBlock(pairs, XDATA_APP_NAME);
  if (!block || block.length === 0) return null;

  const scales: EntityAnnotationScale[] = [];
  for (const pair of block) {
    if (pair.code !== XDATA_GROUP_HANDLE) continue;
    const resolved = scaleResolver(pair.value);
    if (resolved) scales.push(resolved);
  }
  return scales.length > 0 ? scales : null;
}

/**
 * Slice the XDATA pair list down to the entries that belong to `appName`.
 * Each application block begins at `1001 <appName>` and ends at the next
 * `1001 <other>` marker or end-of-list.
 */
function findAppBlock(
  pairs: readonly RawXDataPair[],
  appName: string,
): RawXDataPair[] | null {
  let inBlock = false;
  const out: RawXDataPair[] = [];
  for (const pair of pairs) {
    if (pair.code === XDATA_GROUP_APPNAME) {
      if (inBlock) break;
      if (pair.value === appName) {
        inBlock = true;
        continue;
      }
    }
    if (inBlock) out.push(pair);
  }
  return inBlock ? out : null;
}

// ─── Encode ───────────────────────────────────────────────────────────────────

/**
 * Build the XDATA pair list for an entity carrying `scales`. The pairs must be
 * appended to the entity record body by the higher-level DXF assembler. Each
 * scale must have a corresponding handle in the DXF `ACAD_SCALELIST`
 * dictionary; the caller supplies the handle via `handleResolver`.
 *
 * Returns an empty array if `scales` is empty (no XDATA block emitted).
 */
export function serializeAnnotativeXData(
  scales: readonly EntityAnnotationScale[],
  handleResolver: (scale: EntityAnnotationScale) => string,
): readonly RawXDataPair[] {
  if (scales.length === 0) return [];
  const pairs: RawXDataPair[] = [
    { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
    { code: XDATA_GROUP_INT16, value: String(scales.length) },
  ];
  for (const scale of scales) {
    pairs.push({ code: XDATA_GROUP_HANDLE, value: handleResolver(scale) });
  }
  return pairs;
}

/**
 * Format a pair stream as canonical DXF text lines (two lines per pair).
 * Lines are returned without trailing newlines; callers join with `\r\n` or
 * `\n` depending on the target file convention.
 */
export function formatXDataLines(pairs: readonly RawXDataPair[]): readonly string[] {
  const out: string[] = [];
  for (const pair of pairs) {
    out.push(String(pair.code));
    out.push(pair.value);
  }
  return out;
}
