/**
 * Συνθετικά MP4 για τις άγκυρες του αναγνώστη κουτιών (ADR-907 §10.3) — **μόνο δομή**, κανένα πραγματικό δείγμα.
 * Κάθε «δείγμα» είναι μια αναγνωρίσιμη ακολουθία bytes, ώστε ένα test να ρωτά «δείχνει η θέση ακόμη ΕΚΕΙ;».
 */

import type { ByteSource } from '../mp4-boxes';

const u32 = (value: number): Buffer => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value);
  return out;
};
const u16 = (value: number): Buffer => {
  const out = Buffer.alloc(2);
  out.writeUInt16BE(value);
  return out;
};

export function box(type: string, ...payload: readonly Uint8Array[]): Buffer {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]);
}

const IDENTITY_MATRIX = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
const QUARTER_TURN_MATRIX = [0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000];

function matrix(values: readonly number[]): Buffer {
  const out = Buffer.alloc(36);
  values.forEach((value, index) => out.writeInt32BE(value, index * 4));
  return out;
}

function mvhd(durationSec: number, wide: boolean): Buffer {
  const timescale = 1000;
  if (!wide) return box('mvhd', Buffer.alloc(12), u32(timescale), u32(durationSec * timescale), Buffer.alloc(80));
  const duration = Buffer.alloc(8);
  duration.writeBigUInt64BE(BigInt(durationSec * timescale));
  return box('mvhd', Buffer.from([1, 0, 0, 0]), Buffer.alloc(16), u32(timescale), duration, Buffer.alloc(80));
}

function tkhd(rotated: boolean): Buffer {
  return box('tkhd', Buffer.alloc(40), matrix(rotated ? QUARTER_TURN_MATRIX : IDENTITY_MATRIX), Buffer.alloc(8));
}

function hdlr(handler: string): Buffer {
  return box('hdlr', Buffer.alloc(8), Buffer.from(handler, 'latin1'), Buffer.alloc(13));
}

function visualEntry(format: string, width: number, height: number, profile: number | null): Buffer {
  const fixed = Buffer.alloc(78);
  fixed.set(u16(width), 24);
  fixed.set(u16(height), 26);
  const config = profile === null ? [] : [box('avcC', Buffer.from([1, profile, 0, 31]))];
  return box(format, fixed, ...config);
}

function chunkTable(offsets: readonly number[], wide: boolean): Buffer {
  if (!wide) return box('stco', Buffer.alloc(4), u32(offsets.length), ...offsets.map(u32));
  const entries = offsets.map((offset) => {
    const out = Buffer.alloc(8);
    out.writeBigUInt64BE(BigInt(offset));
    return out;
  });
  return box('co64', Buffer.alloc(4), u32(offsets.length), ...entries);
}

function trak(handler: string, entry: Buffer, offsets: readonly number[], rotated: boolean, wide: boolean): Buffer {
  const stsd = box('stsd', Buffer.alloc(4), u32(1), entry);
  const stbl = box('stbl', stsd, chunkTable(offsets, wide));
  return box('trak', tkhd(rotated), box('mdia', hdlr(handler), box('minf', stbl)));
}

export interface Mp4FixtureOptions {
  readonly brand?: string;
  readonly videoFormat?: string;
  readonly h264Profile?: number | null;
  readonly audioFormat?: string | null;
  readonly durationSec?: number;
  readonly width?: number;
  readonly height?: number;
  readonly rotated?: boolean;
  /** `moov` πριν από τα δείγματα; Οι κάμερες κινητών το γράφουν **μετά**. */
  readonly fastStart?: boolean;
  readonly wideOffsets?: boolean;
  readonly wideDuration?: boolean;
  readonly fragmented?: boolean;
  readonly videoTrack?: boolean;
}

/** Τα «δείγματα»: δύο κομμάτια εικόνας και ένα ήχου, το καθένα με δική του υπογραφή. */
export const FIXTURE_CHUNKS: readonly Buffer[] = [
  Buffer.from('VIDEO-CHUNK-ONE--', 'latin1'),
  Buffer.from('AUDIO-CHUNK', 'latin1'),
  Buffer.from('VIDEO-CHUNK-TWO-----', 'latin1'),
];

function moovFor(options: Mp4FixtureOptions, chunkOffsets: readonly number[]): Buffer {
  const wide = options.wideOffsets ?? false;
  const profile = options.h264Profile === undefined ? 100 : options.h264Profile;
  const video = visualEntry(options.videoFormat ?? 'avc1', options.width ?? 1920, options.height ?? 1080, profile);
  const traks: Buffer[] = [];
  if (options.videoTrack ?? true) {
    traks.push(trak('vide', video, [chunkOffsets[0], chunkOffsets[2]], options.rotated ?? false, wide));
  }
  if (options.audioFormat !== null) {
    traks.push(trak('soun', box(options.audioFormat ?? 'mp4a', Buffer.alloc(28)), [chunkOffsets[1]], false, wide));
  }
  const extras = options.fragmented ? [box('mvex', Buffer.alloc(8))] : [];
  return box('moov', mvhd(options.durationSec ?? 60, options.wideDuration ?? false), ...traks, ...extras);
}

/** Ένα ολόκληρο αρχείο, με τις θέσεις των δειγμάτων **σωστές** για τη διάταξη που ζητήθηκε. */
export function buildMp4(options: Mp4FixtureOptions = {}): Buffer {
  const ftyp = box('ftyp', Buffer.from(options.brand ?? 'isom', 'latin1'), u32(0), Buffer.from('isomavc1', 'latin1'));
  const free = box('free', Buffer.alloc(5));
  const mdat = box('mdat', ...FIXTURE_CHUNKS);
  const moovSize = moovFor(options, [0, 0, 0]).length;
  const dataStart = ftyp.length + free.length + ((options.fastStart ?? false) ? moovSize : 0) + 8;
  const offsets = [
    dataStart,
    dataStart + FIXTURE_CHUNKS[0].length,
    dataStart + FIXTURE_CHUNKS[0].length + FIXTURE_CHUNKS[1].length,
  ];
  const moov = moovFor(options, offsets);
  return (options.fastStart ?? false) ? Buffer.concat([ftyp, free, moov, mdat]) : Buffer.concat([ftyp, free, mdat, moov]);
}

/** Πηγή πάνω σε bytes της μνήμης — και μετρά **πόσα** ζητήθηκαν, για τις άγκυρες «δεν διαβάζει τα δείγματα». */
export function memorySource(bytes: Uint8Array, declaredSize = bytes.byteLength): ByteSource & { bytesRead: number } {
  const source = {
    size: declaredSize,
    bytesRead: 0,
    async read(start: number, length: number): Promise<Uint8Array> {
      const slice = bytes.subarray(start, start + length);
      source.bytesRead += slice.byteLength;
      return slice;
    },
  };
  return source;
}
