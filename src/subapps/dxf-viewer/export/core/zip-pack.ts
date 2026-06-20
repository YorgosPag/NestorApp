/**
 * ============================================================================
 * ZIP PACK — minimal STORED (uncompressed) ZIP writer (SSoT, zero-dependency)
 * ============================================================================
 *
 * Packages multiple export artifacts (one DXF per floor) into a single `.zip`.
 * Uses the STORED method (no compression) — a fully valid, universally readable
 * ZIP. Deliberately dependency-free: owned + testable, no third-party license
 * surface (N.5), and immune to the host's npm-arborist install issues.
 *
 * Spec: PKWARE APPNOTE — Local File Header + Central Directory + EOCD.
 * UTF-8 filenames flagged (general-purpose bit 11) for Greek floor names.
 *
 * ADR-505 §D.
 */

export interface ZipFile {
  /** Path inside the archive (e.g. `Project_Όροφος 1.dxf`). */
  readonly name: string;
  readonly data: Uint8Array;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const FLAG_UTF8 = 0x0800; // general-purpose bit 11 → filename is UTF-8
const VERSION = 20; // 2.0 — STORED

/** Build a STORED `.zip` Blob from the given files. */
export function createStoredZip(files: readonly ZipFile[]): Blob {
  return new Blob([buildStoredZipBytes(files) as BlobPart], { type: 'application/zip' });
}

/** Build the raw STORED `.zip` bytes (pure — testable without Blob I/O). */
export function buildStoredZipBytes(files: readonly ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, VERSION, true);
    lv.setUint16(6, FLAG_UTF8, true);
    lv.setUint16(8, 0, true); // method = STORED
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);
    localParts.push(local, file.data);

    // Central directory record
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, VERSION, true); // version made by
    cv.setUint16(6, VERSION, true); // version needed
    cv.setUint16(8, FLAG_UTF8, true);
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, 0, true); // mod time
    cv.setUint16(14, 0, true); // mod date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra len
    cv.setUint16(32, 0, true); // comment len
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + size;
  }

  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, SIG_EOCD, true);
  ev.setUint16(4, 0, true); // disk number
  ev.setUint16(6, 0, true); // disk with central dir
  ev.setUint16(8, files.length, true); // entries this disk
  ev.setUint16(10, files.length, true); // total entries
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true); // central dir offset
  ev.setUint16(20, 0, true); // comment len

  return concatBytes([...localParts, ...centralParts, eocd]);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ─── CRC-32 (IEEE 802.3, table-based) ────────────────────────────────────────

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Read a Blob's bytes (helper for callers turning artifact blobs into ZipFiles). */
export async function blobToUint8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
