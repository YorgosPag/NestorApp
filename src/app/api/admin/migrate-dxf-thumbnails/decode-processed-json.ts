/**
 * Decoder for the `.dxf.processed.json` payloads that the DXF pipeline
 * (ADR-033) writes via `pako.gzip`. Legacy payloads are plain UTF-8; new
 * ones are gzip-compressed. Detect by magic bytes and decode accordingly.
 *
 * Kept in its own module so tests can import it without pulling in the
 * server-only Firebase Admin surface that `helpers.ts` depends on.
 *
 * Mirror of the Cloud-Function-side decoder in
 * `functions/src/storage/dxf-thumbnail-onfinalize.ts` — keep the two in sync.
 */
import { gunzipSync } from 'zlib';

export function decodeProcessedJsonBytes(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}
