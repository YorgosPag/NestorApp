/**
 * ADR-736 Φ3 — `zip-unpack`: ο αναγνώστης zip χωρίς εξάρτηση.
 *
 * Η **κύρια** απόδειξη είναι round-trip με τον ΔΙΚΟ μας writer (`zip-pack`, ADR-505 §D): ό,τι
 * γράφουμε το ξαναδιαβάζουμε, byte-προς-byte. Πάνω από αυτό ελέγχονται (α) η **DEFLATE**
 * διαδρομή — που είναι αυτή που θα συναντήσει στην πράξη κάθε zip τρίτου, αφού ο δικός μας
 * writer γράφει μόνο STORED — και (β) ότι τα όρια **πετούν** αντί να επιστρέφουν σκουπίδια.
 */

import { buildStoredZipBytes, type ZipFile } from '../zip-pack';
import { unpackZip, unpackZipBlob, ZipUnpackError } from '../zip-unpack';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytesOf = (s: string): Uint8Array => encoder.encode(s);

/** Ένα ΠΡΑΓΜΑΤΙΚΟ DEFLATE zip, φτιαγμένο με την πλατφόρμα — όχι χειρόγραφα bytes. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

async function buildDeflatedZip(name: string, content: Uint8Array): Promise<Uint8Array> {
  const deflater = new CompressionStream('deflate-raw');
  const done = drain(deflater.readable);
  const writer = deflater.writable.getWriter();
  await writer.write(content);
  await writer.close();
  const compressed = await done;

  // Ίδιο layout με το `zip-pack`, αλλά method=8 και δύο διαφορετικά μεγέθη.
  const nameBytes = encoder.encode(name);
  const local = new Uint8Array(30 + nameBytes.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(6, 0x0800, true);
  lv.setUint16(8, 8, true); // DEFLATE
  lv.setUint32(18, compressed.length, true);
  lv.setUint32(22, content.length, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);

  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(8, 0x0800, true);
  cv.setUint16(10, 8, true); // DEFLATE
  cv.setUint32(20, compressed.length, true);
  cv.setUint32(24, content.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, 0, true);
  central.set(nameBytes, 46);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length + compressed.length, true);

  const out = new Uint8Array(local.length + compressed.length + central.length + eocd.length);
  out.set(local, 0);
  out.set(compressed, local.length);
  out.set(central, local.length + compressed.length);
  out.set(eocd, local.length + compressed.length + central.length);
  return out;
}

describe('zip-unpack — round-trip με τον δικό μας writer (STORED)', () => {
  it('επιστρέφει τα ίδια ονόματα και τα ίδια bytes', async () => {
    const files: ZipFile[] = [
      { name: 'plan.dxf', data: bytesOf('0\nSECTION\n') },
      { name: 'dianomi_1.JPG', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) },
    ];
    const entries = await unpackZip(buildStoredZipBytes(files));
    expect(entries.map((e) => e.name)).toEqual(['plan.dxf', 'dianomi_1.JPG']);
    expect(decoder.decode(entries[0].data)).toBe('0\nSECTION\n');
    expect([...entries[1].data]).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  });

  it('διατηρεί ΕΛΛΗΝΙΚΑ ονόματα (ο writer σηκώνει τη σημαία UTF-8)', async () => {
    // Το πραγματικό δείγμα είναι ολόκληρο ελληνικό: «Διανομή Ευόσμου … φύλλο 1».
    const greek = '2026-07-20 - Διανομή Ευόσμου 1967-68-81 - φύλλο 1.JPG';
    const entries = await unpackZip(buildStoredZipBytes([{ name: greek, data: bytesOf('x') }]));
    expect(entries[0].name).toBe(greek);
  });

  it('διαβάζει σωστά όταν υπάρχουν ΠΟΛΛΑ αρχεία (οι μετατοπίσεις συσσωρεύονται)', async () => {
    // Λάθος στον υπολογισμό του `localHeaderOffset` περνά απαρατήρητο με ΕΝΑ αρχείο.
    const files = Array.from({ length: 12 }, (_, i) => ({
      name: `img_${i}.jpg`,
      data: bytesOf('x'.repeat(i * 37 + 1)),
    }));
    const entries = await unpackZip(buildStoredZipBytes(files));
    expect(entries).toHaveLength(12);
    entries.forEach((e, i) => expect(e.data.length).toBe(i * 37 + 1));
  });

  it('παραλείπει τις εγγραφές φακέλου (τελειώνουν σε «/»)', async () => {
    const entries = await unpackZip(
      buildStoredZipBytes([
        { name: 'ΤΟΠΟΓΡΑΦΙΚΑ/', data: new Uint8Array(0) },
        { name: 'ΤΟΠΟΓΡΑΦΙΚΑ/a.jpg', data: bytesOf('a') },
      ]),
    );
    expect(entries.map((e) => e.name)).toEqual(['ΤΟΠΟΓΡΑΦΙΚΑ/a.jpg']);
  });

  it('δέχεται Blob (η μορφή που δίνει το <input type="file">)', async () => {
    const bytes = buildStoredZipBytes([{ name: 'a.jpg', data: bytesOf('a') }]);
    const entries = await unpackZipBlob(new Blob([bytes as BlobPart]));
    expect(entries.map((e) => e.name)).toEqual(['a.jpg']);
  });
});

describe('zip-unpack — DEFLATE (ό,τι γράφει ΚΑΘΕ zip τρίτου)', () => {
  it('αποσυμπιέζει σωστά μια deflated εγγραφή', async () => {
    // Επαναλαμβανόμενο περιεχόμενο ⇒ το DEFLATE όντως συμπιέζει, άρα η διαδρομή inflate
    // δοκιμάζεται πραγματικά (με ασυμπίεστα bytes ο έλεγχος θα ήταν κενός).
    const original = bytesOf('ΤΟΠΟΓΡΑΦΙΚΟ '.repeat(500));
    const zip = await buildDeflatedZip('big.txt', original);
    expect(zip.length).toBeLessThan(original.length);
    const entries = await unpackZip(zip);
    expect(entries).toHaveLength(1);
    expect(decoder.decode(entries[0].data)).toBe(decoder.decode(original));
  });
});

describe('zip-unpack — τα όρια ΠΕΤΟΥΝ, δεν επιστρέφουν σκουπίδια', () => {
  it('μη-zip → not-a-zip', async () => {
    await expect(unpackZip(bytesOf('0\nSECTION\n2\nHEADER\n'))).rejects.toThrow(ZipUnpackError);
    await expect(unpackZip(bytesOf('0\nSECTION\n'))).rejects.toMatchObject({ code: 'not-a-zip' });
  });

  it('ZIP64 φρουρός → ρητό zip64-unsupported (ΟΧΙ σιωπηλά μισό αποτέλεσμα)', async () => {
    const bytes = buildStoredZipBytes([{ name: 'a.jpg', data: bytesOf('a') }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint16(bytes.length - 22 + 10, 0xffff, true); // «το αληθινό πλήθος είναι στο ZIP64»
    await expect(unpackZip(bytes)).rejects.toMatchObject({ code: 'zip64-unsupported' });
  });

  it('κρυπτογραφημένη εγγραφή → encrypted', async () => {
    const bytes = buildStoredZipBytes([{ name: 'a.jpg', data: bytesOf('a') }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const central = view.getUint32(bytes.length - 22 + 16, true);
    view.setUint16(central + 8, 0x0800 | 0x0001, true);
    await expect(unpackZip(bytes)).rejects.toMatchObject({ code: 'encrypted' });
  });

  it('άγνωστη μέθοδος συμπίεσης (π.χ. LZMA) → method-unsupported', async () => {
    const bytes = buildStoredZipBytes([{ name: 'a.jpg', data: bytesOf('a') }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const central = view.getUint32(bytes.length - 22 + 16, true);
    view.setUint16(central + 10, 14, true); // 14 = LZMA
    await expect(unpackZip(bytes)).rejects.toMatchObject({ code: 'method-unsupported' });
  });

  it('χαλασμένο central directory → corrupt', async () => {
    const bytes = buildStoredZipBytes([{ name: 'a.jpg', data: bytesOf('a') }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint32(bytes.length - 22 + 16, 3, true); // το central δείχνει σε σκουπίδια
    await expect(unpackZip(bytes)).rejects.toMatchObject({ code: 'corrupt' });
  });
});
