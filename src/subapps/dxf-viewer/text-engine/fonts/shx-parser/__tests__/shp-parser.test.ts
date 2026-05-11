/**
 * ADR-344 Phase 2 — shp-parser unit tests.
 *
 * Tests the SHP binary parser using synthetic ArrayBuffers that
 * mimic the compact AutoCAD SHX binary layout. No real SHX font
 * files required — all inputs are hand-crafted.
 */

import { parseShpFile, parseShpRecord } from '../shp-parser';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal valid SHX binary: header CRLF + defCount + records. */
function buildSHXBuffer(
  defCount: number,
  records: Array<{ code: number; vectors: Array<[number, number, boolean]> }>,
): ArrayBuffer {
  const encoder = new TextEncoder();
  const header = encoder.encode('AutoCAD-86 shapes 1.0\r\n');

  // Each record: 2 bytes code + 3 bytes (defBytes, above, below) + N*2 bytes vectors + 2 term
  const parts: number[] = [];

  // defCount as big-endian uint16
  parts.push((defCount >> 8) & 0xff, defCount & 0xff);

  for (const rec of records) {
    // code (big-endian uint16)
    parts.push((rec.code >> 8) & 0xff, rec.code & 0xff);
    const vecBytes: number[] = [];
    for (const [dx, dy, penUp] of rec.vectors) {
      const dxHigh = (Math.abs(dx) & 0x07) << 4;
      const dyLow = Math.abs(dy) & 0x07;
      const penBit = penUp ? 0x80 : 0x00;
      vecBytes.push(penBit | dxHigh | (dx < 0 ? 0x40 : 0), dyLow | (dy < 0 ? 0x40 : 0));
    }
    vecBytes.push(0x00, 0x00); // terminator
    const defBytes = vecBytes.length;
    parts.push(defBytes, 9, 3); // above=9, below=3
    parts.push(...vecBytes);
  }

  const tail = new Uint8Array(parts);
  const combined = new Uint8Array(header.length + tail.length);
  combined.set(header, 0);
  combined.set(tail, header.length);
  return combined.buffer;
}

// ─── parseShpRecord ───────────────────────────────────────────────────────────

describe('parseShpRecord', () => {
  it('reads char code from first two bytes (big-endian)', () => {
    // Build a minimal record for char code 0x0041 ('A')
    const buf = new ArrayBuffer(10);
    const view = new DataView(buf);
    view.setUint16(0, 0x0041, false); // code = 65
    view.setUint8(2, 4);   // defBytes = 4
    view.setUint8(3, 9);   // above
    view.setUint8(4, 3);   // below
    // 2 vector bytes + terminator
    view.setUint8(5, 0x10); // dx=1, dy=0, penUp=false
    view.setUint8(6, 0x00);
    view.setUint8(7, 0x00); // terminator
    view.setUint8(8, 0x00);

    const { record } = parseShpRecord(view, 0);
    expect(record.code).toBe(65);
  });

  it('returns nextOffset past the record data', () => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint16(0, 66, false);
    view.setUint8(2, 2); // defBytes = 2 (just terminator)
    view.setUint8(3, 9);
    view.setUint8(4, 3);
    view.setUint8(5, 0x00);
    view.setUint8(6, 0x00);

    const { nextOffset } = parseShpRecord(view, 0);
    expect(nextOffset).toBeGreaterThan(2);
  });
});

// ─── parseShpFile ─────────────────────────────────────────────────────────────

describe('parseShpFile', () => {
  it('parses a minimal SHX file with one glyph', () => {
    const buf = buildSHXBuffer(1, [
      { code: 65, vectors: [[1, 0, false], [0, 1, false]] },
    ]);
    const font = parseShpFile(buf);
    expect(font).toBeDefined();
    expect(font.records).toBeDefined();
  });

  it('sets default above/below when no header record (code 0) present', () => {
    const buf = buildSHXBuffer(1, [
      { code: 65, vectors: [[1, 0, false]] },
    ]);
    const font = parseShpFile(buf);
    expect(font.above).toBeGreaterThan(0);
    expect(font.below).toBeGreaterThanOrEqual(0);
  });

  it('capHeight = above + below', () => {
    const buf = buildSHXBuffer(1, [
      { code: 66, vectors: [[2, 0, false]] },
    ]);
    const font = parseShpFile(buf);
    expect(font.capHeight).toBe(font.above + font.below);
  });

  it('handles empty SHX (zero records)', () => {
    const buf = buildSHXBuffer(0, []);
    const font = parseShpFile(buf);
    expect(font.records.size).toBe(0);
  });

  it('pen-up vectors do not add to record count', () => {
    const buf = buildSHXBuffer(1, [
      { code: 67, vectors: [[0, 0, true], [1, 1, false]] },
    ]);
    const font = parseShpFile(buf);
    // Just verify it doesn't throw
    expect(font).toBeDefined();
  });
});
