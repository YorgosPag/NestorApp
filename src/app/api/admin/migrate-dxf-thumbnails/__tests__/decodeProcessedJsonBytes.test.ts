/**
 * Pins the gzip-aware decoder used by the DXF thumbnail migration helper.
 * Processed DXF JSON is written via `pako.gzip` (ADR-033) so the back-fill
 * must detect the gzip magic (0x1f 0x8b) and ungzip before `JSON.parse`.
 *
 * Regression pin for 2026-04-18 incident: the initial Phase-3 helper assumed
 * plain UTF-8 JSON and failed on every existing processed file.
 */
import { gzipSync } from 'zlib';

import { decodeProcessedJsonBytes } from '../decode-processed-json';

describe('decodeProcessedJsonBytes', () => {
  it('parses plain UTF-8 JSON when no gzip magic is present', () => {
    const buf = Buffer.from('{"hello":"world"}', 'utf8');
    expect(decodeProcessedJsonBytes(buf)).toBe('{"hello":"world"}');
  });

  it('ungzips when the buffer starts with gzip magic bytes', () => {
    const payload = '{"entities":[{"type":"LINE"}]}';
    const gz = gzipSync(Buffer.from(payload, 'utf8'));
    expect(gz[0]).toBe(0x1f);
    expect(gz[1]).toBe(0x8b);
    expect(decodeProcessedJsonBytes(gz)).toBe(payload);
  });

  it('does not misinterpret short buffers as gzip', () => {
    const buf = Buffer.from([0x1f]);
    expect(decodeProcessedJsonBytes(buf)).toBe(buf.toString('utf8'));
  });
});
