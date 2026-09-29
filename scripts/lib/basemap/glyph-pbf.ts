/**
 * @fileoverview **Τα `.pbf` γραμματοσειρών της MapLibre, σε bytes** — ανάγνωση κωδικοσημείων και ένωση δύο εκδοχών του
 * ίδιου εύρους, ώστε ένα συμπλήρωμα να προσθέτει **μόνο** ό,τι λείπει.
 * @related ADR-891 §9.5 · `glyph-supplement.ts` (καταναλωτής) · `font-maker.ts` (παράγει το συμπλήρωμα)
 *
 * Σχήμα (maplibre/font-maker `main.cpp`, ίδιο με το `glyphs.proto` της MapLibre):
 * `glyphs { 1: fontstack* }` · `fontstack { 1: name, 2: range, 3: glyph* }` ·
 * `glyph { 1: id, 2: bitmap, 3: width, 4: height, 5: left, 6: top, 7: advance }`.
 *
 * 🔑 **Ο πρώτος κερδίζει** — η ίδια σημασιολογία με το `font-maker`, που ψάχνει τον χαρακτήρα στα faces **με τη σειρά**.
 * Άρα «βάση + συμπλήρωμα» ισοδυναμεί με «font-maker με το TTF του συμπληρώματος ως τελευταίο face», χωρίς να
 * ξαναχτιστούν ~50 TTF του upstream (οι παράμετροι SDF είναι ίδιες: 24 px, buffer 3 — μετρημένο στα bytes).
 *
 * ⚠️ Χωρίς βιβλιοθήκη protobuf, επίτηδες: χρειάζονται μόνο varint + length-delimited, και ο αναγνώστης **πετά** σε
 * οτιδήποτε άλλο αντί να μαντέψει (ένα σιωπηλά λάθος `.pbf` σβήνει ετικέτες χωρίς σφάλμα στον browser).
 */

const WIRE_VARINT = 0;
const WIRE_BYTES = 2;

interface PbfField {
  readonly field: number;
  /** Αριθμός για varint, bytes για length-delimited. */
  readonly value: number | Uint8Array;
  /** Τα ωμά bytes ολόκληρου του πεδίου (ετικέτα + τιμή) — για αντιγραφή χωρίς επανακωδικοποίηση. */
  readonly raw: Uint8Array;
}

function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  for (;;) {
    if (cursor >= bytes.length) throw new Error('glyph pbf: κομμένο varint');
    const byte = bytes[cursor++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, cursor];
    shift += 7;
    if (shift > 49) throw new Error('glyph pbf: varint πάνω από 7 bytes');
  }
}

function readFields(bytes: Uint8Array): PbfField[] {
  const fields: PbfField[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    const [tag, afterTag] = readVarint(bytes, offset);
    const wire = tag & 7;
    const field = Math.floor(tag / 8);
    if (wire === WIRE_VARINT) {
      const [value, next] = readVarint(bytes, afterTag);
      offset = next;
      fields.push({ field, value, raw: bytes.subarray(start, offset) });
    } else if (wire === WIRE_BYTES) {
      const [length, dataStart] = readVarint(bytes, afterTag);
      offset = dataStart + length;
      if (offset > bytes.length) throw new Error('glyph pbf: πεδίο πέρα από το τέλος');
      fields.push({ field, value: bytes.subarray(dataStart, offset), raw: bytes.subarray(start, offset) });
    } else {
      throw new Error(`glyph pbf: μη αναμενόμενος τύπος καλωδίου ${wire}`);
    }
  }
  return fields;
}

function writeVarint(value: number): number[] {
  const out: number[] = [];
  let rest = value;
  while (rest >= 0x80) {
    out.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  out.push(rest);
  return out;
}

function lengthDelimited(field: number, payload: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from(writeVarint(field * 8 + WIRE_BYTES)), Buffer.from(writeVarint(payload.length)), payload]);
}

function asBytes(field: PbfField): Uint8Array {
  if (typeof field.value === 'number') throw new Error(`glyph pbf: το πεδίο ${field.field} έπρεπε να είναι bytes`);
  return field.value;
}

/** Το ένα `fontstack` του αρχείου (το `font-maker` γράφει πάντα ακριβώς ένα). */
function onlyFontstack(pbf: Uint8Array): PbfField[] {
  const stacks = readFields(pbf).filter((f) => f.field === 1);
  if (stacks.length !== 1) throw new Error(`glyph pbf: αναμενόταν 1 fontstack, βρέθηκαν ${stacks.length}`);
  return readFields(asBytes(stacks[0]));
}

function glyphId(glyph: PbfField): number {
  const id = readFields(asBytes(glyph)).find((f) => f.field === 1)?.value;
  if (typeof id !== 'number') throw new Error('glyph pbf: γλυφή χωρίς id');
  return id;
}

/** Τα κωδικοσημεία ενός εύρους, με τη σειρά του αρχείου. */
export function glyphCodepoints(pbf: Uint8Array): number[] {
  return onlyFontstack(pbf).filter((f) => f.field === 3).map(glyphId);
}

export interface GlyphMergeResult {
  readonly pbf: Buffer;
  /** Κωδικοσημεία που ήρθαν από το συμπλήρωμα — κενό ⇒ το αρχείο της βάσης μένει όπως ήταν. */
  readonly added: readonly number[];
}

/**
 * Ενώνει δύο εκδοχές του **ίδιου** εύρους: όλα τα πεδία της βάσης αυτούσια (όνομα, εύρος, γλυφές), και στο τέλος οι
 * γλυφές του συμπληρώματος που **δεν** υπάρχουν στη βάση. Ίδια είσοδος ⇒ ίδια bytes.
 */
export function mergeGlyphRange(base: Uint8Array, supplement: Uint8Array): GlyphMergeResult {
  const baseFields = onlyFontstack(base);
  const baseRange = baseFields.find((f) => f.field === 2);
  const supplementFields = onlyFontstack(supplement);
  const supplementRange = supplementFields.find((f) => f.field === 2);
  if (baseRange === undefined || supplementRange === undefined) throw new Error('glyph pbf: fontstack χωρίς range');
  const rangeOf = (f: PbfField) => Buffer.from(asBytes(f)).toString('utf8');
  if (rangeOf(baseRange) !== rangeOf(supplementRange)) {
    throw new Error(`glyph pbf: διαφορετικά εύρη ${rangeOf(baseRange)} ≠ ${rangeOf(supplementRange)}`);
  }

  const present = new Set(baseFields.filter((f) => f.field === 3).map(glyphId));
  const additions = supplementFields.filter((f) => f.field === 3 && !present.has(glyphId(f)));
  const stack = Buffer.concat([...baseFields.map((f) => f.raw), ...additions.map((f) => f.raw)]);
  return { pbf: lengthDelimited(1, stack), added: additions.map(glyphId) };
}

/** Κωδικοσημεία → κλειστά διαστήματα `[από, έως]`, ταξινομημένα — συμπαγής, διαφοροποιήσιμη μορφή για το git. */
export function codepointRuns(codepoints: Iterable<number>): Array<[number, number]> {
  const sorted = [...new Set(codepoints)].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  for (const cp of sorted) {
    const last = runs[runs.length - 1];
    if (last !== undefined && cp === last[1] + 1) last[1] = cp;
    else runs.push([cp, cp]);
  }
  return runs;
}
