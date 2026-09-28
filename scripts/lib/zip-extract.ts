/**
 * @fileoverview **Ανάγνωση .zip σε καθαρό Node** — επιλεκτική εξαγωγή στη μνήμη, από τον κεντρικό κατάλογο.
 * @related ADR-889 §10 (ζώνες αντικειμενικών αξιών) · αδελφό του `tar-extract.ts`
 *
 * 🔑 **ΓΙΑΤΙ ΟΧΙ πακέτο ή `unzip`**: τα ονόματα μέσα στο αρχείο του ΥΠΕΘΟΟ είναι **ελληνικά**
 * (`ΚΥΚΛΙΚΕΣ_ΖΩΝΕΣ_…`), και το `Expand-Archive`/`unzip` τα αποδίδει διαφορετικά ανά πλατφόρμα και
 * κωδικοσελίδα. Εδώ ο καλών διαλέγει εγγραφές με **κατάληξη** και διαβάζει bytes — καμία εξάρτηση
 * από το πώς ονομάστηκαν. Καμία νέα άδεια προς έλεγχο (N.5): μόνο `node:zlib`.
 *
 * Υποστηρίζει ό,τι παράγει κάθε σύγχρονο εργαλείο: μέθοδοι **0** (stored) και **8** (deflate), χωρίς
 * κρυπτογράφηση. ZIP64 **απορρίπτεται ρητά** (δεν χρειάζεται: η πηγή είναι 13 MB) — ποτέ σιωπηλή ανάγνωση σκουπιδιών.
 */

import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  readonly path: string;
  readonly data: Buffer;
}

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const ZIP64_MARKER = 0xffffffff;
/** Bit 11 της σημαίας: το όνομα είναι UTF-8· αλλιώς CP437, που για κατάληξη αρχείου αρκεί. */
const UTF8_NAME_FLAG = 0x0800;

function findEndOfCentralDirectory(archive: Buffer): number {
  // Το σχόλιο του αρχείου είναι έως 65.535 bytes ⇒ η εγγραφή βρίσκεται στο τέλος.
  const lowest = Math.max(0, archive.length - 22 - 0xffff);
  for (let offset = archive.length - 22; offset >= lowest; offset -= 1) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new Error('zip: δεν βρέθηκε ο κεντρικός κατάλογος — δεν είναι αρχείο zip');
}

function inflateEntry(archive: Buffer, localOffset: number, method: number, compressedSize: number, path: string): Buffer {
  if (archive.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) throw new Error(`zip: χαλασμένη τοπική κεφαλίδα (${path})`);
  const nameLength = archive.readUInt16LE(localOffset + 26);
  const extraLength = archive.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const raw = archive.subarray(start, start + compressedSize);
  if (method === 0) return Buffer.from(raw);
  if (method === 8) return inflateRawSync(raw);
  throw new Error(`zip: μέθοδος συμπίεσης ${method} δεν υποστηρίζεται (${path})`);
}

/**
 * Οι εγγραφές του αρχείου που περνούν το `include` — με τη σειρά του κεντρικού καταλόγου.
 * Οι φάκελοι παραλείπονται.
 */
export function readZip(archive: Buffer, include: (path: string) => boolean): ZipEntry[] {
  const end = findEndOfCentralDirectory(archive);
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  if (cursor === ZIP64_MARKER) throw new Error('zip: ZIP64 δεν υποστηρίζεται');

  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_FILE_HEADER) throw new Error('zip: χαλασμένος κεντρικός κατάλογος');
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameBytes = archive.subarray(cursor + 46, cursor + 46 + nameLength);
    const path = nameBytes.toString(flags & UTF8_NAME_FLAG ? 'utf8' : 'latin1');
    cursor += 46 + nameLength + extraLength + commentLength;

    if (path.endsWith('/') || !include(path)) continue;
    if (compressedSize === ZIP64_MARKER || localOffset === ZIP64_MARKER) throw new Error(`zip: ZIP64 δεν υποστηρίζεται (${path})`);
    entries.push({ path, data: inflateEntry(archive, localOffset, method, compressedSize, path) });
  }
  return entries;
}
