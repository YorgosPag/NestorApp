// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/dxf/decode-processed-json.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:295ce65fd068f3bfad62af0b7a31babb8d317baa991a7d489077c09b68742815

/**
 * Decoder for the `.dxf.processed.json` payloads that the DXF pipeline
 * (ADR-033) writes via `pako.gzip`. Legacy payloads are plain UTF-8; new
 * ones are gzip-compressed. Detect by magic bytes and decode accordingly.
 *
 * Kept in its own module so tests can import it without pulling in the
 * server-only Firebase Admin surface.
 *
 * ⚠️ PORTABLE MODULE (ADR-874) — projected verbatim into
 * `functions/src/generated/` for the thumbnail trigger
 * (`npm run generate:functions-projection`, CHECK 3.93). Only node builtins
 * and relative imports of other projected modules are allowed here.
 *
 * @module lib/dxf/decode-processed-json
 */
import { gunzipSync } from 'zlib';

export function decodeProcessedJsonBytes(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}
