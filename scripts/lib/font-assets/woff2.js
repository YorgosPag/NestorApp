/**
 * CHECK 3.69 — ΑΝΑΓΝΩΣΤΗΣ WOFF2 (ADR-805 §10).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ.** Το `opentype.js` **δεν διαβάζει WOFF2** («Unsupported OpenType signature
 * wOF2»). Ως τις 2026-10-10 δεν διανέμαμε κανένα `.woff2`, οπότε το κενό ήταν αόρατο· τη μέρα που
 * η Roboto του UI έγινε checked-in δυαδικό, κάθε αρχείο της θα έβγαινε ⛔ `unreadable-asset` —
 * η πύλη θα μπλόκαρε επειδή **δεν μπορεί να κοιτάξει**, όχι επειδή βρήκε κάτι.
 *
 * 🔑 **ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ ΑΠΟΚΩΔΙΚΟΠΟΙΗΤΗΣ ΓΛΥΦΩΝ.** Το WOFF2 μετασχηματίζει **μόνο** τα `glyf` /
 * `loca` (και προαιρετικά το `hmtx`). Τα `name`, `cmap`, `fvar`, `maxp` μένουν **αυτούσια** μέσα
 * στο ρεύμα Brotli — και το Brotli το έχει το ίδιο το Node (`node:zlib`). Άρα: κεφαλίδα →
 * κατάλογος πινάκων → αποσυμπίεση → ο πίνακας που ζητήθηκε. Καμία νέα εξάρτηση.
 *
 * Προδιαγραφή: W3C «WOFF File Format 2.0» §3-§5 · OpenType `name` / `cmap` / `fvar`.
 *
 * @module scripts/lib/font-assets/woff2
 */

'use strict';

const zlib = require('node:zlib');

const SIGNATURE = 0x774f4632; // 'wOF2'
const COLLECTION_FLAVOR = 0x74746366; // 'ttcf'
const HEADER_BYTES = 48;

/** Ο πίνακας γνωστών ετικετών της προδιαγραφής (§5.2) — η θέση είναι ο κωδικός. */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];
const ARBITRARY_TAG = 63;

const isWoff2 = (buffer) => buffer.length >= HEADER_BYTES && buffer.readUInt32BE(0) === SIGNATURE;

/** `UIntBase128` (§4.1): ως 5 bytes, 7 bit το καθένα, το υψηλό bit = «ακολουθεί κι άλλο». */
function readBase128(buffer, at) {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = buffer[at + i];
    if (i === 0 && byte === 0x80) throw new Error('WOFF2: UIntBase128 με αρχικό μηδενικό');
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: at + i + 1 };
  }
  throw new Error('WOFF2: UIntBase128 μακρύτερο από 5 bytes');
}

/**
 * Ένα στοιχείο του καταλόγου. Το μήκος **μέσα στο ρεύμα** είναι το `transformLength` όταν ο
 * πίνακας είναι μετασχηματισμένος, αλλιώς το `origLength`.
 *
 * ⚠️ Η σημασία της «έκδοσης μετασχηματισμού» **αντιστρέφεται** για `glyf`/`loca`: εκεί το **0**
 * σημαίνει «μετασχηματισμένος» και το 3 «αυτούσιος»· για κάθε άλλον, το 0 σημαίνει «αυτούσιος».
 */
function readDirectoryEntry(buffer, at) {
  const flags = buffer[at];
  let cursor = at + 1;
  let tag = KNOWN_TAGS[flags & 0x3f];
  if ((flags & 0x3f) === ARBITRARY_TAG) {
    tag = buffer.toString('latin1', cursor, cursor + 4);
    cursor += 4;
  }
  const version = flags >> 6;
  const orig = readBase128(buffer, cursor);
  cursor = orig.next;
  const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
  let length = orig.value;
  if (transformed) {
    const t = readBase128(buffer, cursor);
    length = t.value;
    cursor = t.next;
  }
  return { entry: { tag, length, transformed }, next: cursor };
}

/**
 * Οι ζητούμενοι πίνακες ενός WOFF2, ως `{ tag: Buffer }`. Πίνακας που λείπει απλώς δεν
 * επιστρέφεται· μετασχηματισμένος πίνακας που ζητήθηκε ⇒ `throw` (δεν τον αποκωδικοποιούμε,
 * και ένα σιωπηλό «άδειο» θα διαβαζόταν ως «δεν έχει»).
 */
function readTables(buffer, wanted) {
  if (!isWoff2(buffer)) throw new Error('WOFF2: λάθος υπογραφή');
  if (buffer.readUInt32BE(4) === COLLECTION_FLAVOR) throw new Error('WOFF2: συλλογή (ttcf) δεν υποστηρίζεται');
  const numTables = buffer.readUInt16BE(12);
  const compressedSize = buffer.readUInt32BE(20);

  const entries = [];
  let cursor = HEADER_BYTES;
  for (let i = 0; i < numTables; i += 1) {
    const read = readDirectoryEntry(buffer, cursor);
    entries.push(read.entry);
    cursor = read.next;
  }

  const stream = zlib.brotliDecompressSync(buffer.subarray(cursor, cursor + compressedSize));
  const out = {};
  let offset = 0;
  for (const entry of entries) {
    if (wanted.includes(entry.tag)) {
      if (entry.transformed) throw new Error(`WOFF2: ο πίνακας «${entry.tag}» είναι μετασχηματισμένος`);
      out[entry.tag] = stream.subarray(offset, offset + entry.length);
    }
    offset += entry.length;
  }
  return out;
}

// ─── name ────────────────────────────────────────────────────────────────────

const NAME_IDS = { copyright: 0, family: 1, subfamily: 2, version: 5, license: 13, licenseURL: 14 };

function decodeNameString(table, platformID, start, length) {
  const bytes = table.subarray(start, start + length);
  if (platformID === 1) return bytes.toString('latin1');
  // Πλατφόρμες 0 (Unicode) και 3 (Windows): UTF-16 **big-endian**.
  return Buffer.from(bytes).swap16().toString('utf16le');
}

/**
 * Το `name` table ως `{ nameID: string }`. Προτιμάται η εγγραφή Windows/Αγγλικά (3 · 0x409),
 * μετά οποιαδήποτε Windows/Unicode, και τελευταία η Macintosh — η ίδια σειρά με το `opentype.js`
 * που διαβάζει τα TTF, ώστε δύο μορφές του ίδιου αρχείου να δίνουν την ίδια απόδειξη.
 */
function parseNameTable(table) {
  const count = table.readUInt16BE(2);
  const storage = table.readUInt16BE(4);
  const best = new Map();
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 12;
    const platformID = table.readUInt16BE(at);
    const languageID = table.readUInt16BE(at + 4);
    const nameID = table.readUInt16BE(at + 6);
    const rank = platformID === 3 ? (languageID === 0x409 ? 3 : 2) : (platformID === 0 ? 2 : 1);
    if ((best.get(nameID)?.rank ?? 0) >= rank) continue;
    const text = decodeNameString(table, platformID, storage + table.readUInt16BE(at + 10), table.readUInt16BE(at + 8));
    best.set(nameID, { rank, text: text.trim() });
  }
  return Object.fromEntries([...best].map(([id, v]) => [id, v.text]));
}

// ─── cmap ────────────────────────────────────────────────────────────────────

/** Μορφή 4 (BMP): τμήματα με `idDelta` ή δείκτη στον πίνακα γλύφων. Γλύφος 0 = «δεν υπάρχει». */
function codepointsOfFormat4(sub) {
  const segCount = sub.readUInt16BE(6) / 2;
  const ends = 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  const rangeOffsets = deltas + segCount * 2;
  const out = [];
  for (let s = 0; s < segCount; s += 1) {
    const end = sub.readUInt16BE(ends + s * 2);
    const start = sub.readUInt16BE(starts + s * 2);
    const delta = sub.readUInt16BE(deltas + s * 2);
    const rangeOffset = sub.readUInt16BE(rangeOffsets + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c += 1) {
      let glyph = (c + delta) & 0xffff;
      if (rangeOffset !== 0) {
        const raw = sub.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (c - start) * 2);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) out.push(c);
    }
  }
  return out;
}

/** Μορφή 12 (πλήρες Unicode): ομάδες `startChar..endChar → startGlyph`. */
function codepointsOfFormat12(sub) {
  const groups = sub.readUInt32BE(12);
  const out = [];
  for (let g = 0; g < groups; g += 1) {
    const at = 16 + g * 12;
    const start = sub.readUInt32BE(at);
    const end = sub.readUInt32BE(at + 4);
    const startGlyph = sub.readUInt32BE(at + 8);
    for (let c = start; c <= end; c += 1) if (startGlyph + (c - start) !== 0) out.push(c);
  }
  return out;
}

/**
 * Οι κωδικοί Unicode που το αρχείο **όντως χαρτογραφεί σε γλύφο**. Ενώνει κάθε υποπίνακα Unicode
 * (πλατφόρμες 0 και 3) μορφής 4 ή 12· άγνωστη μορφή ⇒ `throw` με όνομα, ποτέ «κενή κάλυψη».
 */
function parseCmapCodepoints(table) {
  const numTables = table.readUInt16BE(2);
  const found = new Set();
  let unicodeSubtables = 0;
  for (let i = 0; i < numTables; i += 1) {
    const platformID = table.readUInt16BE(4 + i * 8);
    if (platformID !== 0 && platformID !== 3) continue;
    const sub = table.subarray(table.readUInt32BE(4 + i * 8 + 4));
    const format = sub.readUInt16BE(0);
    if (format === 4) codepointsOfFormat4(sub).forEach((c) => found.add(c));
    else if (format === 12) codepointsOfFormat12(sub).forEach((c) => found.add(c));
    else if (format === 14) continue; // variation selectors — δεν είναι κάλυψη
    else throw new Error(`cmap: μη υποστηριζόμενη μορφή ${format}`);
    unicodeSubtables += 1;
  }
  if (unicodeSubtables === 0) throw new Error('cmap: κανένας υποπίνακας Unicode');
  return [...found].sort((a, b) => a - b);
}

// ─── fvar ────────────────────────────────────────────────────────────────────

const fixed = (table, at) => table.readInt32BE(at) / 65536;

/** Οι άξονες μιας variable γραμματοσειράς: `[{ tag, min, default, max }]`. */
function parseFvarAxes(table) {
  const axesAt = table.readUInt16BE(4);
  const axisCount = table.readUInt16BE(8);
  const axisSize = table.readUInt16BE(10);
  const axes = [];
  for (let i = 0; i < axisCount; i += 1) {
    const at = axesAt + i * axisSize;
    axes.push({
      tag: table.toString('latin1', at, at + 4),
      min: fixed(table, at + 4),
      default: fixed(table, at + 8),
      max: fixed(table, at + 12),
    });
  }
  return axes;
}

// ─── Η απόδειξη, στο σχήμα που περιμένει το `evidence.js` ────────────────────

/** Ό,τι διαβάζει ο αναγνώστης TTF από το `name` table — από WOFF2. */
function readNames(buffer) {
  const tables = readTables(buffer, ['name', 'maxp']);
  if (!tables.name) throw new Error('WOFF2: λείπει ο πίνακας name');
  const names = parseNameTable(tables.name);
  const pick = (key) => names[NAME_IDS[key]] || null;
  return {
    family: pick('family'),
    subfamily: pick('subfamily'),
    copyright: pick('copyright'),
    license: pick('license'),
    licenseURL: pick('licenseURL'),
    version: pick('version'),
    glyphs: tables.maxp ? tables.maxp.readUInt16BE(4) : null,
  };
}

/** Κάλυψη + άξονες — ό,τι χρειάζεται μια άγκυρα για να κρίνει «τι ΜΠΟΡΕΙ να αποδώσει το αρχείο». */
function readCoverage(buffer) {
  const tables = readTables(buffer, ['cmap', 'fvar']);
  if (!tables.cmap) throw new Error('WOFF2: λείπει ο πίνακας cmap');
  return {
    codepoints: parseCmapCodepoints(tables.cmap),
    axes: tables.fvar ? parseFvarAxes(tables.fvar) : [],
  };
}

module.exports = {
  isWoff2,
  readTables,
  parseNameTable,
  parseCmapCodepoints,
  parseFvarAxes,
  readNames,
  readCoverage,
};
