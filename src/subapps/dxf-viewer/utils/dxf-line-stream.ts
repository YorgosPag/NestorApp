/**
 * 🏢 ENTERPRISE — DXF line stream normalisation (SSoT).
 *
 * ONE decision lives here: how a raw .dxf string becomes the `string[]` that every parser
 * in this folder indexes with a fixed 2-line (code, value) stride. It is a single line of
 * code guarding two expensive, separately-learned lessons — hence its own module, so the
 * rationale cannot drift away from the code it protects.
 */

/**
 * Split raw DXF content into the (code\nvalue) line stream.
 *
 * ⚠️ DO NOT filter empty lines. DXF is a strict (code\nvalue) stream and AutoCAD writes
 * EMPTY string values (empty TEXT/handle/name codes). Dropping blank lines shifts the fixed
 * 2-line stride in parseEntities/parseHeader/table-parsers → alignment corrupts and ~90% of
 * entities are silently lost (real R12 sample: 4483 → 467). Empty values survive as '' so
 * every (code, value) pair stays aligned.
 *
 * ⚠️ DO NOT `.trim()` here either (ADR-635 Φ C.19). MTEXT >250 chars is written as 250-char
 * chunks cut at a FIXED offset — a cut lands inside runs of spaces, and a leading/trailing
 * space IS content ("…Εύοσμου, " + "όπως…" → "…Εύοσμου,όπως…" when trimmed). Measured on a
 * real AutoCAD 2021 export: 9 of 74 chunks carry significant edge whitespace.
 *
 * Stripping ONLY the `\r` line-ending is behaviour-preserving for every other consumer,
 * because they ALL trim their own code AND value already (`parseEntity`, `lineAt`,
 * `parseHeader`, `findSectionRange`, `dxf-table-parsers`) — verified by grep: no raw
 * `lines[i]` read exists outside them.
 */
export function splitDxfLines(content: string): string[] {
  return content.split('\n').map(line => line.replace(/\r+$/, ''));
}
