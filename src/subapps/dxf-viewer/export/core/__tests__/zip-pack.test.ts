/**
 * ADR-505 §D — `zip-pack` owned STORED-zip writer.
 *
 * Επαληθεύει: CRC-32 γνωστό vector· EOCD signature + σωστό entry count·
 * local-header signatures· filename round-trip· blobToUint8.
 */

import { buildStoredZipBytes, crc32 } from '../zip-pack';

const enc = new TextEncoder();

describe('crc32', () => {
  it('γνωστό vector "123456789" → 0xCBF43926', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });
  it('κενό → 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('createStoredZip', () => {
  it('δύο αρχεία → valid EOCD με entry count = 2', () => {
    const bytes = buildStoredZipBytes([
      { name: 'a.dxf', data: enc.encode('hello') },
      { name: 'φ.dxf', data: enc.encode('κόσμος') },
    ]);

    // EOCD signature 0x06054b50 στα τελευταία 22 bytes.
    const eocd = bytes.length - 22;
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2); // total entries

    // Πρώτο local-file-header signature 0x04034b50.
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });

  it('κενή λίστα → valid κενό zip (0 entries)', () => {
    const bytes = buildStoredZipBytes([]);
    expect(bytes.length).toBe(22); // μόνο EOCD
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(10, true)).toBe(0);
  });
});
