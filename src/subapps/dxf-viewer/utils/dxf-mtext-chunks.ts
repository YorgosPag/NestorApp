/**
 * 🏢 ENTERPRISE — MTEXT content reassembly (ADR-635 Φάση B / ADR-344)
 *
 * DXF spec, MTEXT group codes 1 & 3:
 *   «Text string. If the string is less than 250 characters, all characters appear in
 *    group 1. If it is longer, the string is divided into 250-character CHUNKS which
 *    appear in one or more group-3 codes; the LAST portion appears in group 1.»
 *
 * `EntityData.data` is a flat `Record<string,string>` → it keeps ONE value per code, so
 * every group-3 chunk except the last is overwritten and `data['1']` holds only the tail.
 * Reading `data['1'] || data['3']` therefore reduced a real 5.317-character paragraph block
 * to its 12-character tail (`"1.3329x;\\L }"`): the text did not render wrong — it vanished
 * from the drawing, silently. Worse, when that tail happened to be pure whitespace the
 * empty-text guard in `convertMText` dropped the whole entity (measured: 1 of 8 long MTEXT
 * in a 2021 AutoCAD export of a Greek topographic drawing).
 *
 * ── Why the RAW (untrimmed) value ────────────────────────────────────────────────────
 * AutoCAD cuts at a FIXED 250-character offset, so a cut can land inside a run of spaces.
 * Trimming the chunk edges before joining glues words together across the seam
 * (`"…Εύοσμου, " + "όπως…"` → `"…Εύοσμου,όπως…"`). Measured on the same export: 9 of 74
 * chunks carried significant edge whitespace. Hence the collector must run inside
 * `DxfEntityParser.parseEntity`, the last place that still sees the raw line value.
 *
 * The joined result replaces `data['1']` — that IS the spec meaning of code 1 for MTEXT
 * (the tail exists only *because* there are chunks). Downstream converters keep reading
 * `data['1']`; no signature and no branch changes ripple outward.
 */

/** Entity types whose group 1/3 codes carry chunked MTEXT content. */
const MTEXT_ENTITY_TYPES: ReadonlySet<string> = new Set(['MTEXT', 'MULTILINETEXT']);

/**
 * Group codes that carry MTEXT content: `3` = 250-char continuation chunk (repeatable),
 * `1` = final portion. Any other code (e.g. `7` style, `71` attachment) is untouched.
 */
const MTEXT_CONTENT_CODES: ReadonlySet<string> = new Set(['1', '3']);

/** True when this DXF entity type stores its text as chunked 3…3/1 content. */
export function isMTextEntityType(entityType: string): boolean {
  return MTEXT_ENTITY_TYPES.has(entityType);
}

/**
 * Join the raw chunks in STREAM order. AutoCAD writes 3…3 then 1, so stream order already
 * reproduces the authored string; a file that deviates is reproduced as authored rather
 * than "corrected" by us. No separator, no trim — the chunks are a byte-level split.
 */
export function joinMTextChunks(chunks: readonly string[]): string {
  return chunks.join('');
}

/** Accumulates the raw MTEXT content chunks of ONE entity while its codes stream past. */
export interface MTextContentCollector {
  /** Feed every (code, RAW value) pair of the entity; non-content codes are ignored. */
  take(code: string, rawValue: string): void;
  /** Write the reassembled string back into `data['1']`. No-op when nothing was collected. */
  applyTo(data: Record<string, string>): void;
}

/**
 * Shared no-op for the ~99% of entities that are not MTEXT — `parseEntity` runs once per
 * entity (500k budget), so a per-entity closure+array allocation for LINE/HATCH/… would be
 * pure GC churn. Only a real MTEXT allocates.
 */
const NOOP_COLLECTOR: MTextContentCollector = {
  take: () => undefined,
  applyTo: () => undefined,
};

/** Collector for `entityType`, or an allocation-free no-op when the type is not MTEXT. */
export function createMTextContentCollector(entityType: string): MTextContentCollector {
  if (!isMTextEntityType(entityType)) return NOOP_COLLECTOR;

  const chunks: string[] = [];
  return {
    take(code: string, rawValue: string): void {
      if (MTEXT_CONTENT_CODES.has(code)) chunks.push(rawValue);
    },
    applyTo(data: Record<string, string>): void {
      if (chunks.length > 0) data['1'] = joinMTextChunks(chunks);
    },
  };
}
