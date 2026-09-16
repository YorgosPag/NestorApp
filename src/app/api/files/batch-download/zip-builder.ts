/**
 * =============================================================================
 * ZIP BUILDER — καθαρός, χωρίς δίκτυο και χωρίς εξουσιοδότηση (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * Υλοποιεί ZIP (PKZIP APPNOTE 6.3.3) με το `zlib` του Node — **καμία εξάρτηση**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΜΕ **ΑΥΤΗ** ΤΗΝ ΤΟΜΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η διαδρομή ήταν **267 γραμμές**, από τις οποίες **~125 συσκευασία** — δηλαδή ο
 * αναγνώστης που ρωτούσε *«ποιος φυλάει αυτά τα bytes;»* έπρεπε να προσπεράσει
 * τρεις σελίδες `DataView.setUint32`. Το ταβάνι του N.7.1 για διαδρομή API είναι
 * **300 γραμμές κώδικα**, και η τομή το σέβεται **χωρίς** να κόψει λογική.
 *
 * ⚠️ Η τομή ακολουθεί το γραμμένο μάθημα του `container-transition-policy`:
 * *«κάτω τα **δεδομένα** (καμία εξάρτηση), πάνω οι **ερωτήσεις**»*. Εδώ κάτω είναι
 * η **μορφή αρχείου** — δεν ξέρει τίποτα για μισθωτές, δοχεία ή Firestore, και
 * **δεν πρέπει** να μάθει: ένας κωδικοποιητής που μπορεί να δοκιμαστεί μόνο μέσα
 * από `withAuth` δοκιμάζεται πάντα μαζί με τη μηχανή εξουσιοδότησης — και τότε ένα
 * πράσινο δεν λέει **ποιο από τα δύο** δούλεψε.
 *
 * ⛔ **ΜΗΝ εισαγάγεις εδώ `firebaseAdmin`, `next/server` ή οτιδήποτε διαβάζει.**
 *
 * @module app/api/files/batch-download/zip-builder
 */

import { deflateRawSync } from 'zlib';

export interface ZipEntry {
  readonly filename: string;
  readonly data: Uint8Array;
}

/**
 * CRC-32 (πολυώνυμο 0xEDB88320) — το απαιτεί η ίδια η μορφή, σε **δύο** κεφαλίδες.
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Τα δύο μεγέθη + το άθροισμα ελέγχου μιας εγγραφής — γράφονται **δύο** φορές. */
interface EntryShape {
  readonly nameBytes: Uint8Array;
  readonly compressed: Uint8Array;
  readonly crc: number;
  readonly rawSize: number;
}

/** Local file header: 30 bytes + όνομα. */
function localHeader(shape: EntryShape): Uint8Array {
  const buffer = new ArrayBuffer(30 + shape.nameBytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x04034b50, true);            // Signature
  view.setUint16(4, 20, true);                    // Version needed (2.0)
  view.setUint16(6, 0x0800, true);                // Flags: bit 11 = UTF-8 ονόματα
  view.setUint16(8, 8, true);                     // Compression: deflate
  view.setUint16(10, 0, true);                    // Mod time
  view.setUint16(12, 0, true);                    // Mod date
  view.setUint32(14, shape.crc, true);
  view.setUint32(18, shape.compressed.length, true);
  view.setUint32(22, shape.rawSize, true);
  view.setUint16(26, shape.nameBytes.length, true);
  view.setUint16(28, 0, true);                    // Extra field length
  new Uint8Array(buffer).set(shape.nameBytes, 30);
  return new Uint8Array(buffer);
}

/** Central directory header: 46 bytes + όνομα. */
function centralHeader(shape: EntryShape, offset: number): Uint8Array {
  const buffer = new ArrayBuffer(46 + shape.nameBytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x02014b50, true);            // Signature
  view.setUint16(4, 20, true);                    // Version made by
  view.setUint16(6, 20, true);                    // Version needed
  view.setUint16(8, 0x0800, true);                // Flags: bit 11 = UTF-8 ονόματα
  view.setUint16(10, 8, true);                    // Compression: deflate
  view.setUint16(12, 0, true);                    // Mod time
  view.setUint16(14, 0, true);                    // Mod date
  view.setUint32(16, shape.crc, true);
  view.setUint32(20, shape.compressed.length, true);
  view.setUint32(24, shape.rawSize, true);
  view.setUint16(28, shape.nameBytes.length, true);
  view.setUint16(30, 0, true);                    // Extra field length
  view.setUint16(32, 0, true);                    // Comment length
  view.setUint16(34, 0, true);                    // Disk number
  view.setUint16(36, 0, true);                    // Internal attributes
  view.setUint32(38, 0, true);                    // External attributes
  view.setUint32(42, offset, true);               // Offset of local header
  new Uint8Array(buffer).set(shape.nameBytes, 46);
  return new Uint8Array(buffer);
}

/** End of central directory: 22 bytes. */
function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const buffer = new ArrayBuffer(22);
  const view = new DataView(buffer);
  view.setUint32(0, 0x06054b50, true);            // Signature
  view.setUint16(4, 0, true);                     // Disk number
  view.setUint16(6, 0, true);                     // Central dir disk
  view.setUint16(8, count, true);                 // Entries on disk
  view.setUint16(10, count, true);                // Total entries
  view.setUint32(12, size, true);                 // Central dir size
  view.setUint32(16, offset, true);               // Central dir offset
  view.setUint16(20, 0, true);                    // Comment length
  return new Uint8Array(buffer);
}

/**
 * **Οι εγγραφές → ένα ZIP.**
 *
 * ⚠️ Τα ονόματα θεωρούνται **ήδη αποσαφηνισμένα** (βλ. {@link uniqueZipNames}):
 * η μορφή ZIP **επιτρέπει** δύο εγγραφές με το ίδιο όνομα, και ο αποσυμπιεστής
 * απλώς γράφει τη μία πάνω στην άλλη — δηλαδή ο άνθρωπος ζητά 5 αρχεία και
 * παίρνει 3, **χωρίς κανένα σφάλμα**.
 */
export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const shape: EntryShape = {
      nameBytes: new TextEncoder().encode(entry.filename),
      compressed: new Uint8Array(deflateRawSync(entry.data)),
      crc: crc32(entry.data),
      rawSize: entry.data.length,
    };

    locals.push(localHeader(shape), shape.compressed);
    centrals.push(centralHeader(shape, offset));
    offset += 30 + shape.nameBytes.length + shape.compressed.length;
  }

  const centralSize = centrals.reduce((sum, header) => sum + header.length, 0);
  const eocd = endOfCentralDirectory(entries.length, centralSize, offset);

  const result = new Uint8Array(offset + centralSize + eocd.length);
  let position = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}

/**
 * **Ονόματα που δεν τρώνε το ένα το άλλο** — `σχέδιο.pdf` · `σχέδιο (2).pdf`.
 *
 * 🔴 **ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΤΩΡΑ ΚΑΙ ΟΧΙ ΠΡΙΝ**: μέχρι το Β8 το όνομα το έδινε ο
 * **πελάτης** ανά αρχείο. Από το Β8 το παράγει ο **διακομιστής** από το
 * `FileRecord` — και δύο αρχεία της ίδιας οντότητας **νόμιμα** μοιράζονται
 * `displayName`. Χωρίς αποσαφήνιση, η μετάβαση σε `fileIds` θα *έχανε* αρχεία
 * σιωπηλά: ακριβώς το είδος βλάβης που ένα «πέρασε το build» δεν δείχνει.
 */
export function uniqueZipNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();

  return names.map(name => {
    const taken = seen.get(name);
    if (taken === undefined) {
      seen.set(name, 1);
      return name;
    }

    seen.set(name, taken + 1);
    const dot = name.lastIndexOf('.');
    return dot <= 0
      ? `${name} (${taken})`
      : `${name.slice(0, dot)} (${taken})${name.slice(dot)}`;
  });
}
