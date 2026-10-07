/**
 * @fileoverview **Ο αναγνώστης κουτιών MP4** — τι είναι αυτό το αρχείο, χωρίς να το αποκωδικοποιήσει κανείς.
 * @related ADR-907 §10.3 (Φάση 4 — βίντεο αγγελίας)
 * @module lib/media/mp4-boxes
 *
 * 🔑 **Διαβάζει ΜΟΝΟ τη δομή** (ISO/IEC 14496-12): ποια κουτιά υπάρχουν, πού, και τι δηλώνει το `moov`.
 * Κανένα δείγμα εικόνας ή ήχου δεν αγγίζεται ⇒ καμία βιβλιοθήκη, κανένα ffmpeg (N.5).
 *
 * 🔑 **Ζητά bytes από {@link ByteSource}, όχι `Buffer`**: ένα βίντεο 100 MB δεν φορτώνεται ποτέ ολόκληρο. Ο server
 * δίνει πηγή πάνω σε αιτήματα εύρους του κάδου· ο browser πάνω σε `File.slice`. Ο **ίδιος** κριτής και στις δύο
 * πλευρές — ο άνθρωπος μαθαίνει στο ανέβασμα ό,τι θα έκρινε ο server στη δημοσίευση.
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — καμία I/O πέρα από την πηγή που του δίνεται, κανένα Node API, κανένα DOM API.
 */

/** Τυχαία πρόσβαση σε bytes, χωρίς υπόσχεση ότι χωρούν στη μνήμη. */
export interface ByteSource {
  readonly size: number;
  /** Τα bytes `[start, start + length)` — λιγότερα **μόνο** αν τελειώσει το αρχείο. */
  read(start: number, length: number): Promise<Uint8Array>;
}

/** Τα κριτήρια **αποδοχής** — του καλούντος, όχι του αναγνώστη. */
export interface Mp4Limits {
  readonly maxBytes: number;
  readonly maxDurationSec: number;
}

/** Γιατί ένα αρχείο **δεν** γίνεται δεκτό — **ένα όνομα ανά αιτία**, ώστε ο άνθρωπος να μάθει τι να αλλάξει. */
export type Mp4Refusal =
  | 'too-large'
  | 'not-mp4'
  | 'quicktime-container'
  | 'malformed'
  | 'fragmented'
  | 'no-video-track'
  | 'hevc-codec'
  | 'unsupported-video-codec'
  | 'unsupported-h264-profile'
  | 'unsupported-audio-codec'
  | 'too-long';

/** Ένα κουτί ανώτατου επιπέδου: τύπος και θέση **μέσα στο αρχείο**. */
export interface Mp4TopBox {
  readonly type: string;
  readonly offset: number;
  readonly size: number;
}

/** Ό,τι δηλώνει το αρχείο για τον εαυτό του. */
export interface Mp4Facts {
  readonly durationSec: number;
  /** Διαστάσεις **όπως προβάλλονται** — κατακόρυφο βίντεο κινητού έχει ήδη αντιστραμμένα πλάτος/ύψος. */
  readonly width: number;
  readonly height: number;
  /** Το `moov` προηγείται των δειγμάτων ⇒ παίζει πριν κατέβει ολόκληρο. */
  readonly fastStart: boolean;
}

export type Mp4Inspection =
  | {
      readonly ok: true;
      readonly facts: Mp4Facts;
      readonly boxes: readonly Mp4TopBox[];
      /** Το κουτί `moov` **ολόκληρο** (με την κεφαλίδα του) — η πρώτη ύλη της αναδιάταξης. */
      readonly moov: Uint8Array;
    }
  | { readonly ok: false; readonly refusal: Mp4Refusal };

/** Κωδικοποίηση H.264 σε MP4: με τις παραμέτρους στο κουτί (`avc1`) ή μέσα στη ροή (`avc3`). */
const H264_SAMPLE_ENTRIES: readonly string[] = ['avc1', 'avc3'];
/** HEVC — ό,τι γράφει το iPhone εξ ορισμού. Ονομάζεται χωριστά: το μήνυμα λέει τι να αλλάξει. */
const HEVC_SAMPLE_ENTRIES: readonly string[] = ['hvc1', 'hev1', 'dvh1', 'dvhe'];
/**
 * Προφίλ H.264 που παίζει **κάθε** browser: Baseline (66) · Main (77) · Extended (88) · High (100).
 * Τα High 10 (110) · 4:2:2 (122) · 4:4:4 (244) δεν αποκωδικοποιούνται σε κινητά.
 */
const PLAYABLE_H264_PROFILES: readonly number[] = [66, 77, 88, 100];
const BRAND_QUICKTIME = 'qt  ';

/** Ένα `moov` μεγαλύτερο από αυτό δεν είναι βίντεο δύο λεπτών — είναι λάθος αρχείο ή επίθεση μνήμης. */
const MAX_MOOV_BYTES = 16 * 1024 * 1024;
const MAX_TOP_BOXES = 4096;
const CONTAINER_PATH_TO_SAMPLE_TABLE: readonly string[] = ['mdia', 'minf', 'stbl'];

class Mp4Refused extends Error {
  constructor(readonly refusal: Mp4Refusal) {
    super(refusal);
  }
}

interface InnerBox {
  readonly type: string;
  /** Αρχή του **περιεχομένου** (μετά την κεφαλίδα). */
  readonly start: number;
  readonly end: number;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function fourCC(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

/** Μέγεθος κουτιού από την κεφαλίδα του: 32-bit, 64-bit (`size == 1`) ή «ως το τέλος» (`size == 0`). */
function boxSpan(header: Uint8Array, remaining: number): { size: number; headerSize: number } {
  if (header.byteLength < 8) throw new Mp4Refused('malformed');
  const view = viewOf(header);
  const size32 = view.getUint32(0);
  if (size32 === 0) return { size: remaining, headerSize: 8 };
  if (size32 !== 1) return { size: size32, headerSize: 8 };
  if (header.byteLength < 16) throw new Mp4Refused('malformed');
  return { size: Number(view.getBigUint64(8)), headerSize: 16 };
}

/** Τα παιδιά ενός κουτιού-περιέκτη, **μέσα σε bytes που ήδη κρατάμε**. */
function childrenOf(bytes: Uint8Array, start: number, end: number): InnerBox[] {
  const boxes: InnerBox[] = [];
  let at = start;
  while (at + 8 <= end) {
    const { size, headerSize } = boxSpan(bytes.subarray(at, Math.min(at + 16, end)), end - at);
    if (size < headerSize || at + size > end) throw new Mp4Refused('malformed');
    boxes.push({ type: fourCC(bytes, at + 4), start: at + headerSize, end: at + size });
    at += size;
  }
  return boxes;
}

function childOf(bytes: Uint8Array, parent: InnerBox, type: string): InnerBox | null {
  return childrenOf(bytes, parent.start, parent.end).find((box) => box.type === type) ?? null;
}

function descend(bytes: Uint8Array, from: InnerBox, path: readonly string[]): InnerBox | null {
  let box: InnerBox | null = from;
  for (const type of path) {
    if (box === null) return null;
    box = childOf(bytes, box, type);
  }
  return box;
}

/** Τα κουτιά ανώτατου επιπέδου — **16 bytes ανά κουτί**, ποτέ το περιεχόμενό τους. */
export async function scanTopBoxes(source: ByteSource): Promise<Mp4TopBox[]> {
  const boxes: Mp4TopBox[] = [];
  let offset = 0;
  while (offset < source.size) {
    if (boxes.length >= MAX_TOP_BOXES) throw new Mp4Refused('malformed');
    const header = await source.read(offset, 16);
    const { size, headerSize } = boxSpan(header, source.size - offset);
    if (size < headerSize || offset + size > source.size) throw new Mp4Refused('malformed');
    boxes.push({ type: fourCC(header, 4), offset, size });
    offset += size;
  }
  return boxes;
}

async function requireMp4Brand(source: ByteSource, boxes: readonly Mp4TopBox[]): Promise<void> {
  const ftyp = boxes[0];
  if (ftyp === undefined || ftyp.type !== 'ftyp' || ftyp.size < 16) throw new Mp4Refused('not-mp4');
  const head = await source.read(ftyp.offset, 16);
  if (fourCC(head, 8) === BRAND_QUICKTIME) throw new Mp4Refused('quicktime-container');
}

function durationOf(moov: Uint8Array, root: InnerBox): number {
  const mvhd = childOf(moov, root, 'mvhd');
  if (mvhd === null) throw new Mp4Refused('malformed');
  const view = viewOf(moov);
  const wide = moov[mvhd.start] === 1;
  const timescale = view.getUint32(mvhd.start + (wide ? 20 : 12));
  const duration = wide ? Number(view.getBigUint64(mvhd.start + 24)) : view.getUint32(mvhd.start + 16);
  if (timescale === 0) throw new Mp4Refused('malformed');
  return duration / timescale;
}

function handlerOf(moov: Uint8Array, trak: InnerBox): string | null {
  const hdlr = descend(moov, trak, ['mdia', 'hdlr']);
  return hdlr === null ? null : fourCC(moov, hdlr.start + 8);
}

/** Η πρώτη εγγραφή του `stsd`: ο τύπος της είναι η κωδικοποίηση. */
function sampleEntryOf(moov: Uint8Array, trak: InnerBox): InnerBox | null {
  const stsd = descend(moov, trak, [...CONTAINER_PATH_TO_SAMPLE_TABLE, 'stsd']);
  if (stsd === null) return null;
  return childrenOf(moov, stsd.start + 8, stsd.end)[0] ?? null;
}

/** Στροφή 90°/270° στον πίνακα του `tkhd` ⇒ το βίντεο **προβάλλεται** κατακόρυφα. */
function isQuarterTurned(moov: Uint8Array, trak: InnerBox): boolean {
  const tkhd = childOf(moov, trak, 'tkhd');
  if (tkhd === null) return false;
  const matrix = tkhd.start + (moov[tkhd.start] === 1 ? 52 : 40);
  const view = viewOf(moov);
  return view.getInt32(matrix) === 0 && view.getInt32(matrix + 16) === 0 && view.getInt32(matrix + 4) !== 0;
}

function requirePlayableH264(moov: Uint8Array, entry: InnerBox): void {
  if (HEVC_SAMPLE_ENTRIES.includes(entry.type)) throw new Mp4Refused('hevc-codec');
  if (!H264_SAMPLE_ENTRIES.includes(entry.type)) throw new Mp4Refused('unsupported-video-codec');
  // VisualSampleEntry: 78 bytes σταθερών πεδίων, μετά τα παιδιά (`avcC`).
  const avcC = childrenOf(moov, entry.start + 78, entry.end).find((box) => box.type === 'avcC');
  if (avcC === undefined) throw new Mp4Refused('malformed');
  if (!PLAYABLE_H264_PROFILES.includes(moov[avcC.start + 1])) throw new Mp4Refused('unsupported-h264-profile');
}

function videoDimensions(moov: Uint8Array, trak: InnerBox, entry: InnerBox): { width: number; height: number } {
  const view = viewOf(moov);
  const coded = { width: view.getUint16(entry.start + 24), height: view.getUint16(entry.start + 26) };
  if (coded.width === 0 || coded.height === 0) throw new Mp4Refused('malformed');
  return isQuarterTurned(moov, trak) ? { width: coded.height, height: coded.width } : coded;
}

function factsOf(moov: Uint8Array, fastStart: boolean, limits: Mp4Limits): Mp4Facts {
  const root: InnerBox = { type: 'moov', start: 8, end: moov.byteLength };
  if (childOf(moov, root, 'mvex') !== null) throw new Mp4Refused('fragmented');

  const traks = childrenOf(moov, root.start, root.end).filter((box) => box.type === 'trak');
  const video = traks.find((trak) => handlerOf(moov, trak) === 'vide');
  if (video === undefined) throw new Mp4Refused('no-video-track');
  const entry = sampleEntryOf(moov, video);
  if (entry === null) throw new Mp4Refused('malformed');
  requirePlayableH264(moov, entry);

  for (const trak of traks.filter((candidate) => handlerOf(moov, candidate) === 'soun')) {
    if (sampleEntryOf(moov, trak)?.type !== 'mp4a') throw new Mp4Refused('unsupported-audio-codec');
  }

  const durationSec = durationOf(moov, root);
  if (durationSec > limits.maxDurationSec) throw new Mp4Refused('too-long');
  return { durationSec, ...videoDimensions(moov, video, entry), fastStart };
}

async function inspectOrThrow(source: ByteSource, limits: Mp4Limits): Promise<Mp4Inspection> {
  if (source.size > limits.maxBytes) throw new Mp4Refused('too-large');
  const boxes = await scanTopBoxes(source);
  await requireMp4Brand(source, boxes);
  if (boxes.some((box) => box.type === 'moof')) throw new Mp4Refused('fragmented');

  const moovBox = boxes.find((box) => box.type === 'moov');
  const mdatBox = boxes.find((box) => box.type === 'mdat');
  if (moovBox === undefined || mdatBox === undefined) throw new Mp4Refused('malformed');
  // Κεφαλίδα 16 bytes (`size == 1`) σε `moov` δεν γράφεται από κανέναν· η άρνηση κρατά την αναδιάταξη απλή.
  if (moovBox.size > MAX_MOOV_BYTES || moovBox.size >= 2 ** 32) throw new Mp4Refused('malformed');

  const moov = await source.read(moovBox.offset, moovBox.size);
  if (moov.byteLength !== moovBox.size || viewOf(moov).getUint32(0) !== moovBox.size) throw new Mp4Refused('malformed');
  const facts = factsOf(moov, moovBox.offset < mdatBox.offset, limits);
  return { ok: true, facts, boxes, moov };
}

/**
 * **Είναι αυτό MP4/H.264 που παίζει παντού, μέσα στα όρια;** — δεν πετά ποτέ· η άρνηση έχει όνομα.
 *
 * ⚠️ Κρίνει ό,τι **δηλώνει** το αρχείο. Δείγματα που διαψεύδουν τη δήλωσή τους τα βρίσκει μόνο αποκωδικοποιητής —
 * και ο αποκωδικοποιητής εδώ είναι ο browser του εκδότη, που έβγαλε το εξώφυλλο από το ίδιο αρχείο.
 */
export async function inspectMp4(source: ByteSource, limits: Mp4Limits): Promise<Mp4Inspection> {
  try {
    return await inspectOrThrow(source, limits);
  } catch (error) {
    if (error instanceof Mp4Refused) return { ok: false, refusal: error.refusal };
    // `RangeError` του `DataView` = το αρχείο υπόσχεται bytes που δεν έχει.
    if (error instanceof RangeError) return { ok: false, refusal: 'malformed' };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Αναδιάταξη: το `moov` μπροστά (fast start)
// ---------------------------------------------------------------------------

/** Ένα κομμάτι του αρχείου εξόδου: bytes που κρατάμε, ή εύρος της πηγής **όπως είναι**. */
export type Mp4Segment =
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array }
  | { readonly kind: 'range'; readonly start: number; readonly end: number };

/** Οι πίνακες θέσεων κάθε κομματιού: `stco` (32-bit) και `co64` (64-bit). */
function chunkOffsetTables(moov: Uint8Array): InnerBox[] {
  const root: InnerBox = { type: 'moov', start: 8, end: moov.byteLength };
  return childrenOf(moov, root.start, root.end)
    .filter((box) => box.type === 'trak')
    .map((trak) => descend(moov, trak, CONTAINER_PATH_TO_SAMPLE_TABLE))
    .filter((stbl): stbl is InnerBox => stbl !== null)
    .flatMap((stbl) => childrenOf(moov, stbl.start, stbl.end))
    .filter((box) => box.type === 'stco' || box.type === 'co64');
}

/** Μετατοπίζει κάθε θέση δείγματος που πέφτει στο `[from, to)` κατά `by` — **επί τόπου**, σε δικό μας αντίγραφο. */
function shiftChunkOffsets(moov: Uint8Array, from: number, to: number, by: number): void {
  const view = viewOf(moov);
  for (const table of chunkOffsetTables(moov)) {
    const count = view.getUint32(table.start + 4);
    const width = table.type === 'co64' ? 8 : 4;
    for (let index = 0; index < count; index += 1) {
      const at = table.start + 8 + index * width;
      const offset = width === 8 ? Number(view.getBigUint64(at)) : view.getUint32(at);
      if (offset < from || offset >= to) continue;
      if (width === 8) view.setBigUint64(at, BigInt(offset + by));
      else if (offset + by > 0xffffffff) throw new Mp4Refused('malformed');
      else view.setUint32(at, offset + by);
    }
  }
}

/**
 * **Το αρχείο με το `moov` πριν από τα δείγματα** — ως συνταγή κομματιών, όχι ως bytes.
 *
 * 🔑 Αναδιάταξη κουτιών, **όχι** μεταγλώττιση: τα δείγματα αντιγράφονται ως εύρη της πηγής, αυτούσια. Αλλάζουν μόνο
 * οι θέσεις που γράφει το `moov` για αυτά — όσα βρίσκονται ανάμεσα στο σημείο εισαγωγής και την παλιά θέση του `moov`
 * μετακινούνται κατά το μέγεθός του.
 *
 * ⚠️ Αρχείο που είναι **ήδη** fast start επιστρέφεται ως **ένα** εύρος: τα bytes του δεν αλλάζουν ούτε κατά ένα.
 */
export function planFastStart(inspection: Extract<Mp4Inspection, { ok: true }>): readonly Mp4Segment[] {
  const { boxes, moov, facts } = inspection;
  const last = boxes[boxes.length - 1];
  const total = last.offset + last.size;
  if (facts.fastStart) return [{ kind: 'range', start: 0, end: total }];

  const moovBox = boxes.find((box) => box.type === 'moov') as Mp4TopBox;
  const insertAt = (boxes.find((box) => box.type === 'mdat') as Mp4TopBox).offset;
  const moved = moov.slice();
  shiftChunkOffsets(moved, insertAt, moovBox.offset, moovBox.size);

  const segments: Mp4Segment[] = [
    { kind: 'range', start: 0, end: insertAt },
    { kind: 'bytes', bytes: moved },
    { kind: 'range', start: insertAt, end: moovBox.offset },
    { kind: 'range', start: moovBox.offset + moovBox.size, end: total },
  ];
  return segments.filter((segment) => segment.kind === 'bytes' || segment.end > segment.start);
}
