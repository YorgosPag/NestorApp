/**
 * ZIP UNPACK — ανάγνωση `.zip` **χωρίς καμία εξάρτηση** (SSoT, sibling του `zip-pack.ts`).
 *
 * Ο ΝΕΣΤΩΡ **έγραφε** ήδη zip (ADR-505 §D — ένα DXF ανά όροφο, μέθοδος STORED). Το ADR-736 Φ3
 * χρειάζεται το αντίστροφο: ο τοπογράφος στέλνει `eTransmit`-style πακέτο (`.dxf` + τα
 * υπόβαθρα) και ο χρήστης το ρίχνει **ολόκληρο** μέσα.
 *
 * 🔑 **Γιατί μηδέν εξάρτηση (N.5):** ο browser ξέρει ήδη να κάνει inflate —
 * `DecompressionStream('deflate-raw')`. Ό,τι λείπει είναι το **container** (central directory),
 * που είναι ~60 γραμμές ανάγνωσης DataView. Ένα πακέτο unzip θα έφερνε επιφάνεια αδείας,
 * μέγεθος bundle και συντήρηση για κάτι που η πλατφόρμα ήδη κάνει. (Το `DecompressionStream`
 * χρησιμοποιείται ήδη στο repo: `api/floorplans/scene/scene-fetcher.ts`.)
 *
 * **Διαβάζουμε το central directory, ΟΧΙ τη σειρά των local headers** — είναι ο μόνος τρόπος
 * που ορίζει το APPNOTE για αξιόπιστη απαρίθμηση: τα local headers μπορεί να φέρουν μηδενικά
 * μεγέθη (streaming writers, «data descriptor», flag bit 3) και μια ωμή σάρωση θα διάβαζε
 * σκουπίδια. Το central directory είναι πάντα πλήρες.
 *
 * ⚠️ **Ρητά όρια** (πετούν {@link ZipUnpackError}, δεν αποτυγχάνουν σιωπηλά):
 *   · **ZIP64** (>65.535 εγγραφές ή >4 GB) — ασυνήθιστο για πακέτο σχεδίων.
 *   · **Κρυπτογραφημένο** αρχείο.
 *   · Μέθοδος συμπίεσης εκτός STORED (0) / DEFLATE (8) — π.χ. BZIP2, LZMA.
 * ⚠️ **Κωδικοποίηση ονομάτων:** το APPNOTE ορίζει UTF-8 **μόνο** όταν είναι σηκωμένο το
 * general-purpose bit 11. Παλιά Windows Explorer γράφουν το όνομα σε OEM codepage (για ελληνικά:
 * CP737) **χωρίς** τη σημαία — και το `TextDecoder` **δεν** υποστηρίζει CP737 (WHATWG Encoding).
 * Άρα ένα ελληνικό όνομα από τέτοιο zip μπορεί να φτάσει αλλοιωμένο. **Αυτό δεν είναι σφάλμα
 * εδώ και δεν το κρύβουμε:** ο resolver του ADR-736 δεν εξαρτάται μόνο από το όνομα — πέφτει σε
 * ταύτιση **διαστάσεων σε pixels**, που δεν ξέρει τίποτα από codepages.
 *
 * @see ./zip-pack.ts — ο writer (STORED-only), ίδιο APPNOTE, ίδια μηδενική εξάρτηση
 * @see docs/centralized-systems/reference/adrs/ADR-736-dxf-external-references.md
 */

const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const EOCD_MIN_SIZE = 22;
/** Το σχόλιο του EOCD είναι έως 64 KiB — τόσο πίσω το ψάχνουμε το πολύ. */
const MAX_EOCD_COMMENT = 0xffff;
/** Τιμή-φρουρός: «η αληθινή τιμή ζει στα ZIP64 πεδία». */
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_UTF8 = 0x0800;

export type ZipUnpackErrorCode =
  | 'not-a-zip'
  | 'zip64-unsupported'
  | 'encrypted'
  | 'method-unsupported'
  | 'corrupt';

export class ZipUnpackError extends Error {
  readonly code: ZipUnpackErrorCode;
  constructor(code: ZipUnpackErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ZipUnpackError';
  }
}

/** Μία εγγραφή αρχείου μέσα στο αρχειοθέτημα (οι φάκελοι δεν επιστρέφονται). */
export interface ZipEntry {
  /** Η διαδρομή μέσα στο αρχειοθέτημα, όπως γράφτηκε (μπορεί να περιέχει `/`). */
  readonly name: string;
  readonly data: Uint8Array;
}

/** Μια εγγραφή του central directory — ό,τι χρειάζεται για να βρεθούν και να διαβαστούν τα bytes. */
interface CentralRecord {
  readonly name: string;
  readonly method: number;
  readonly flags: number;
  readonly compressedSize: number;
  readonly localHeaderOffset: number;
}

/**
 * Αποσυμπιέζει ένα ολόκληρο `.zip` σε μνήμη. Τα φωτογραφικά υπόβαθρα ενός τοπογραφικού είναι
 * δεκάδες MB — μέγεθος που δικαιολογεί απόλυτα ανάγνωση σε buffer αντί για streaming πολυπλοκότητα.
 */
export async function unpackZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = readCentralDirectory(bytes, view);

  const entries: ZipEntry[] = [];
  for (const record of records) {
    // Οι φάκελοι υπάρχουν ως εγγραφές με όνομα που τελειώνει σε `/` και μηδέν bytes.
    if (record.name.endsWith('/')) continue;
    if ((record.flags & FLAG_ENCRYPTED) !== 0) {
      throw new ZipUnpackError('encrypted', record.name);
    }
    entries.push({ name: record.name, data: await readEntryData(bytes, view, record) });
  }
  return entries;
}

/** Ευκολία για καλούντες που κρατούν `Blob`/`File` (π.χ. είσοδος από `<input type="file">`). */
export async function unpackZipBlob(blob: Blob): Promise<ZipEntry[]> {
  return unpackZip(new Uint8Array(await blob.arrayBuffer()));
}

// ─── Central directory ────────────────────────────────────────────────────────

/** Θέση του EOCD: σάρωση **προς τα πίσω** — το σχόλιο μπορεί να περιέχει την ίδια υπογραφή. */
function findEocdOffset(bytes: Uint8Array, view: DataView): number {
  const earliest = Math.max(0, bytes.length - EOCD_MIN_SIZE - MAX_EOCD_COMMENT);
  for (let i = bytes.length - EOCD_MIN_SIZE; i >= earliest; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }
  throw new ZipUnpackError('not-a-zip');
}

function readCentralDirectory(bytes: Uint8Array, view: DataView): CentralRecord[] {
  if (bytes.length < EOCD_MIN_SIZE) throw new ZipUnpackError('not-a-zip');
  const eocd = findEocdOffset(bytes, view);

  const total = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  // Οι φρουροί σημαίνουν «η αληθινή τιμή είναι στο ZIP64 EOCD» — που δεν διαβάζουμε.
  if (total === ZIP64_SENTINEL_16 || centralOffset === ZIP64_SENTINEL_32) {
    throw new ZipUnpackError('zip64-unsupported');
  }

  const decoder = new TextDecoder();
  const records: CentralRecord[] = [];
  let pos = centralOffset;
  for (let i = 0; i < total; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== SIG_CENTRAL) {
      throw new ZipUnpackError('corrupt', `central record ${i}`);
    }
    const flags = view.getUint16(pos + 8, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    records.push({
      // Το bit 11 είναι η **μόνη** δήλωση UTF-8 του format· χωρίς αυτό η κωδικοποίηση είναι
      // ουσιαστικά άγνωστη. Αποκωδικοποιούμε ούτως ή άλλως ως UTF-8 (μη-fatal ⇒ ποτέ throw):
      // τα σύγχρονα εργαλεία γράφουν UTF-8, και όποιο όνομα αλλοιωθεί το πιάνει η ταύτιση
      // διαστάσεων του resolver — βλ. κεφαλίδα.
      name: decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength)),
      method: view.getUint16(pos + 10, true),
      flags,
      compressedSize: view.getUint32(pos + 20, true),
      localHeaderOffset: view.getUint32(pos + 42, true),
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return records;
}

// ─── Δεδομένα μιας εγγραφής ───────────────────────────────────────────────────

/**
 * Τα bytes μιας εγγραφής. Το **local** header είναι η αυθεντία για το πού αρχίζουν τα δεδομένα
 * (τα δικά του `nameLength`/`extraLength` μπορεί να διαφέρουν από του central — το APPNOTE το
 * επιτρέπει ρητά), ενώ το **μέγεθος** έρχεται από το central (το local μπορεί να είναι μηδέν).
 */
async function readEntryData(
  bytes: Uint8Array,
  view: DataView,
  record: CentralRecord,
): Promise<Uint8Array> {
  const local = record.localHeaderOffset;
  if (local + 30 > bytes.length) throw new ZipUnpackError('corrupt', record.name);
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const end = start + record.compressedSize;
  if (end > bytes.length) throw new ZipUnpackError('corrupt', record.name);
  const raw = bytes.subarray(start, end);

  if (record.method === METHOD_STORED) return raw.slice();
  if (record.method === METHOD_DEFLATE) return inflateRaw(raw);
  throw new ZipUnpackError('method-unsupported', `${record.name} (method ${record.method})`);
}

/**
 * DEFLATE **χωρίς** zlib κεφαλίδα — αυτό ακριβώς σημαίνει `'deflate-raw'`. Το σκέτο `'deflate'`
 * περιμένει zlib wrapper (RFC 1950) και **αποτυγχάνει σε κάθε εγγραφή zip**: κλασική παγίδα.
 */
async function inflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  const inflater = new DecompressionStream('deflate-raw');
  // ⚠️ Η ΣΕΙΡΑ ΕΧΕΙ ΣΗΜΑΣΙΑ: ο αναγνώστης στήνεται **πριν** γραφτούν τα bytes. Με αντίστροφη
  // σειρά, ένα μεγάλο υπόβαθρο γεμίζει το εσωτερικό buffer και το `write()` δεν επιστρέφει ποτέ
  // (backpressure χωρίς καταναλωτή) — αδιέξοδο που εμφανίζεται μόνο σε μεγάλα αρχεία.
  const inflated = drainStream(inflater.readable);
  const writer = inflater.writable.getWriter();
  await writer.write(raw);
  await writer.close();
  return inflated;
}

/**
 * Συλλέγει ένα `ReadableStream<Uint8Array>` σε έναν πίνακα bytes.
 *
 * Σκόπιμα **χωρίς** `new Response(stream).arrayBuffer()`, που θα ήταν συντομότερο: το Fetch API
 * δεν είναι εγγυημένο σε κάθε περιβάλλον όπου τρέχει αυτός ο κώδικας (jsdom δεν το εκθέτει),
 * ενώ ο reader του stream **είναι** — αφού μας τον έδωσε το ίδιο το `DecompressionStream`.
 */
async function drainStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
