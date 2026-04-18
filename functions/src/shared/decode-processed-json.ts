/**
 * Decoder for the `.dxf.processed.json` payloads that the DXF pipeline
 * (ADR-033) writes via `pako.gzip`. Legacy payloads are plain UTF-8; new
 * ones are gzip-compressed. Detect by magic bytes and decode accordingly.
 *
 * Mirror of `src/app/api/admin/migrate-dxf-thumbnails/decode-processed-json.ts`
 * — keep the two in sync (the Cloud Functions build cannot import from `src/`).
 */
import { gunzipSync } from 'zlib';

export function decodeProcessedJsonBytes(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}
