/**
 * Άγκυρες του ψήστη βίντεο (ADR-907 §10.3) — με **αληθινά** κουτιά MP4 και αρχείο της μνήμης στη θέση του κάδου.
 * Ρωτούν: είναι η διεύθυνση το αποτύπωμα **αυτών** που γράφονται; διαβάστηκαν τα δείγματα **μόνο ως ροή**;
 */

import { createHash } from 'crypto';
import { Readable, Writable } from 'stream';

import { inspectMp4 } from '@/lib/media/mp4-boxes';
import { buildMp4, memorySource, type Mp4FixtureOptions } from '@/lib/media/__tests__/mp4-fixture';
import { LISTING_VIDEO_LIMITS } from '@/lib/listings/listing-video-policy';

import {
  PUBLIC_SHELF_VIDEO_CACHE_CONTROL,
  VideoBakeError,
  bakeVideo,
  type RangedFile,
} from '../public-shelf-video-bake';

/** Αρχείο «κάδου» πάνω σε bytes της μνήμης — και μετρά **πόσα** ζητήθηκαν από κάθε δρόμο. */
function rangedFile(bytes: Buffer): RangedFile & { downloaded: number; streamed: number } {
  const file = {
    downloaded: 0,
    streamed: 0,
    async download({ start, end }: { start: number; end: number }): Promise<[Buffer]> {
      const slice = bytes.subarray(start, end + 1);
      file.downloaded += slice.length;
      return [slice];
    },
    createReadStream({ start, end }: { start: number; end: number }): Readable {
      const slice = bytes.subarray(start, end + 1);
      file.streamed += slice.length;
      // Δύο κομμάτια, ώστε η ροή να μην είναι κατά τύχη «ένα γράψιμο».
      const half = Math.ceil(slice.length / 2);
      return Readable.from([slice.subarray(0, half), slice.subarray(half)].filter((part) => part.length > 0));
    },
  };
  return file;
}

async function collect(pipeTo: (sink: Writable) => Promise<void>): Promise<Buffer> {
  const parts: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  await pipeTo(sink);
  return Buffer.concat(parts);
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

async function bake(options: Mp4FixtureOptions = {}) {
  const source = buildMp4(options);
  const file = rangedFile(source);
  const baked = await bakeVideo(file, source.length);
  return { source, file, baked, output: await collect(baked.pipeTo) };
}

describe('bakeVideo — η διεύθυνση είναι το αποτύπωμα ΑΥΤΩΝ που γράφονται', () => {
  it('🔑 Ψ1 βίντεο κινητού (moov στο τέλος): το κλειδί είναι το sha256 της ΑΝΑΔΙΑΤΑΓΜΕΝΗΣ εξόδου', async () => {
    const { source, baked, output } = await bake();

    expect(baked.contentHash).toBe(sha256(output));
    expect(baked.contentHash).not.toBe(sha256(source));
    expect(output.length).toBe(source.length);
  });

  it('Ψ2 η έξοδος ξαναδιαβάζεται ως fast start, με τα ίδια μετρημένα στοιχεία', async () => {
    const { baked, output } = await bake({ rotated: true });
    const again = await inspectMp4(memorySource(output), LISTING_VIDEO_LIMITS);

    expect(again).toMatchObject({ ok: true, facts: { fastStart: true, width: 1080, height: 1920, durationSec: 60 } });
    expect(baked.facts).toEqual({ durationSec: 60, width: 1080, height: 1920, fastStart: true });
  });

  it('Ψ3 βίντεο που είναι ΗΔΗ fast start δημοσιεύεται αυτούσιο — ούτε ένα byte αλλαγμένο', async () => {
    const { source, baked, output } = await bake({ fastStart: true });

    expect(output.equals(source)).toBe(true);
    expect(baked.contentHash).toBe(sha256(source));
  });

  it('🔑 Ψ4 τα δείγματα περνούν ΜΟΝΟ ως ροή — ο αναγνώστης κουτιών δεν τα κατεβάζει ποτέ', async () => {
    const padding = Buffer.alloc(2 * 1024 * 1024, 7);
    const source = Buffer.concat([buildMp4({ fastStart: true }), Buffer.from([0, 0x20, 0, 8]), Buffer.from('free'), padding]);
    const file = rangedFile(source);

    const baked = await bakeVideo(file, source.length);
    expect(file.downloaded).toBeLessThan(8 * 1024);
    // Πρώτο πέρασμα (αποτύπωμα) = όλο το αρχείο, ως ροή.
    expect(file.streamed).toBe(source.length);

    await collect(baked.pipeTo);
    // Δεύτερο πέρασμα (ανέβασμα) = άλλη μία φορά, πάλι ως ροή.
    expect(file.streamed).toBe(source.length * 2);
  });

  it('Ψ5 δύο εκτελέσεις του ίδιου σχεδίου γράφουν τα ίδια bytes (το δεύτερο πέρασμα δεν «θυμάται» το πρώτο)', async () => {
    const { baked, output } = await bake();

    expect((await collect(baked.pipeTo)).equals(output)).toBe(true);
  });
});

describe('bakeVideo — άρνηση με το όνομα του αναγνώστη κουτιών', () => {
  it.each<[string, Mp4FixtureOptions, string]>([
    ['HEVC από iPhone', { videoFormat: 'hvc1', h264Profile: null }, 'hevc-codec'],
    ['121″', { durationSec: 121 }, 'too-long'],
    ['περιέκτης QuickTime', { brand: 'qt  ' }, 'quicktime-container'],
  ])('%s ⇒ %s, και ΔΕΝ διαβάζεται ούτε ένα δείγμα', async (_label, options, failure) => {
    const source = buildMp4(options);
    const file = rangedFile(source);

    await expect(bakeVideo(file, source.length)).rejects.toMatchObject({ name: 'VideoBakeError', failure });
    expect(file.streamed).toBe(0);
  });

  it('πάνω από 100 MB ⇒ too-large, ΠΡΙΝ ζητηθεί έστω ένα byte', async () => {
    const file = rangedFile(buildMp4());

    await expect(bakeVideo(file, LISTING_VIDEO_LIMITS.maxBytes + 1)).rejects.toBeInstanceOf(VideoBakeError);
    expect(file.downloaded + file.streamed).toBe(0);
  });
});

describe('το δημόσιο αντικείμενο βίντεο', () => {
  it('🔑 σερβίρεται με `no-transform` — αλλιώς ο πάροχος μπορεί να χάσει τα αιτήματα εύρους (Safari iOS)', () => {
    expect(PUBLIC_SHELF_VIDEO_CACHE_CONTROL).toMatch(/(^|,\s*)no-transform(\s*,|$)/);
    expect(PUBLIC_SHELF_VIDEO_CACHE_CONTROL).toMatch(/\bpublic\b/);
  });
});
