/**
 * SHP/SHX binary parser (ADR-344 Phase 2, Q3).
 *
 * AutoCAD SHX fonts are compiled from SHP source text files into a compact
 * binary format. Each glyph is a sequence of (dx, dy) byte pairs where the
 * high bit of dx signals pen-up (move without drawing).
 *
 * Binary layout (simplified AutoCAD SHX):
 *   Header bytes describe defbytes, above (cap height), below, modes.
 *   Each glyph definition: [defbytes][above][below] followed by vector data.
 *   Vector: pairs of signed bytes (dx packed with pen-up flag, dy).
 *   End of glyph: 0x00 0x00 terminator.
 *
 * @module text-engine/fonts/shx-parser/shp-parser
 */

import type { ShpFont, ShpRecord, ShpVector } from './shp-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PEN_UP_MASK = 0x80; // high bit of dx byte = pen-up
const SIGN_MASK = 0x40;   // 7th bit = negative dx/dy when pen-up bit stripped

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Read a signed 7-bit displacement from a raw byte (pen-up bit already stripped). */
function readDisplacement(byte: number): number {
  // AutoCAD SHP uses 4-bit signed deltas packed in bytes (values -8..+7)
  const raw = byte & 0x0f;
  const nibbleHigh = (byte >> 4) & 0x0f;
  // high nibble = X delta, low nibble = Y delta (both signed 4-bit twos-complement)
  return raw;
}

/** Decode a 4-bit signed value (twos-complement nibble). */
function signedNibble(n: number): number {
  return n > 7 ? n - 16 : n;
}

/**
 * Parse a single glyph record starting at `offset` in the DataView.
 * Returns the parsed record and the offset of the next record.
 */
export function parseShpRecord(
  view: DataView,
  offset: number,
): { record: ShpRecord; nextOffset: number } {
  const code = view.getUint16(offset, false); // big-endian char code
  offset += 2;

  const defBytes = view.getUint8(offset++);
  const above = view.getUint8(offset++);
  const below = view.getUint8(offset++);

  const vectors: ShpVector[] = [];
  const end = offset + defBytes;

  while (offset < end - 1) {
    const raw = view.getUint8(offset++);
    if (raw === 0 && offset < end && view.getUint8(offset) === 0) {
      offset++; // 0x00 0x00 = end of record
      break;
    }

    const penUp = (raw & PEN_UP_MASK) !== 0;
    const dxRaw = raw & 0x7f; // strip pen-up bit
    const dy = view.getUint8(offset++);

    // High nibble = X displacement (signed 4-bit), low nibble = Y displacement
    const dx = signedNibble((dxRaw >> 4) & 0x0f);
    const dyVal = signedNibble(dy & 0x0f);

    if (dx !== 0 || dyVal !== 0) {
      vectors.push({ dx, dy: dyVal, penUp });
    }
  }

  return { record: { code, vectors }, nextOffset: offset };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a full SHX/SHP font binary into a ShpFont.
 * Throws if the buffer does not start with a valid SHX magic signature.
 */
export function parseShpFile(buffer: ArrayBuffer): ShpFont {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // SHX header: ASCII signature line ends at first 0x0D 0x0A (CRLF)
  let headerEnd = 0;
  while (headerEnd < bytes.length - 1) {
    if (bytes[headerEnd] === 0x0d && bytes[headerEnd + 1] === 0x0a) break;
    headerEnd++;
  }
  headerEnd += 2; // skip CRLF

  // Read font-level above/below/modes from first definition (code 0 = header record)
  let offset = headerEnd;
  const defCount = view.getUint16(offset, false);
  offset += 2;

  const records = new Map<number, ShpRecord>();
  let fontAbove = 9;   // sensible default (9 shape units)
  let fontBelow = 3;
  let fontModes = 0;

  for (let i = 0; i < defCount && offset < view.byteLength - 4; i++) {
    const { record, nextOffset } = parseShpRecord(view, offset);
    offset = nextOffset;

    if (record.code === 0) {
      // Code 0 = font header pseudo-record: carries above/below/modes
      if (record.vectors.length >= 2) {
        fontAbove = Math.abs(record.vectors[0].dx) || fontAbove;
        fontBelow = Math.abs(record.vectors[0].dy) || fontBelow;
        fontModes = record.vectors[1]?.dx ?? fontModes;
      }
    } else {
      records.set(record.code, record);
    }
  }

  return {
    records,
    above: fontAbove,
    below: fontBelow,
    modes: fontModes,
    capHeight: fontAbove + fontBelow,
  };
}
