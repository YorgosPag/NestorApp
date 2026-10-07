/**
 * Άγκυρες του αναγνώστη κουτιών MP4 (ADR-907 §10.3).
 * Μ = τι δέχεται και τι αρνείται, με όνομα · Φ = η αναδιάταξη fast start δεν χαλά ούτε ένα δείγμα.
 */

import { inspectMp4, planFastStart, type Mp4Inspection, type Mp4Limits, type Mp4Segment } from '../mp4-boxes';
import { FIXTURE_CHUNKS, box, buildMp4, memorySource, type Mp4FixtureOptions } from './mp4-fixture';

const LIMITS: Mp4Limits = { maxBytes: 100 * 1024 * 1024, maxDurationSec: 120 };

const inspect = (options: Mp4FixtureOptions = {}): Promise<Mp4Inspection> =>
  inspectMp4(memorySource(buildMp4(options)), LIMITS);

async function accepted(options: Mp4FixtureOptions = {}): Promise<Extract<Mp4Inspection, { ok: true }>> {
  const result = await inspect(options);
  if (!result.ok) throw new Error(`expected acceptance, got ${result.refusal}`);
  return result;
}

function materialise(source: Uint8Array, segments: readonly Mp4Segment[]): Buffer {
  return Buffer.concat(
    segments.map((segment) => (segment.kind === 'bytes' ? segment.bytes : source.subarray(segment.start, segment.end))),
  );
}

describe('inspectMp4 — Μ: αποδοχή', () => {
  it('Μ1 H.264 High + AAC, 60″ ⇒ δεκτό, με διάρκεια και διαστάσεις', async () => {
    const { facts } = await accepted();
    expect(facts).toEqual({ durationSec: 60, width: 1920, height: 1080, fastStart: false });
  });

  it('Μ2 βίντεο χωρίς ήχο είναι δεκτό', async () => {
    expect((await inspect({ audioFormat: null })).ok).toBe(true);
  });

  it('Μ3 κατακόρυφο βίντεο κινητού: οι διαστάσεις είναι όπως ΠΡΟΒΑΛΛΟΝΤΑΙ', async () => {
    const { facts } = await accepted({ rotated: true });
    expect([facts.width, facts.height]).toEqual([1080, 1920]);
  });

  it('Μ4 ακριβώς 120″ περνά· διάρκεια 64-bit διαβάζεται', async () => {
    expect((await accepted({ durationSec: 120, wideDuration: true })).facts.durationSec).toBe(120);
  });

  it('Μ5 το moov μπροστά αναγνωρίζεται ως fast start', async () => {
    expect((await accepted({ fastStart: true })).facts.fastStart).toBe(true);
  });

  it('🔑 Μ6 ΔΕΝ διαβάζει τα δείγματα — μόνο κεφαλίδες και το moov', async () => {
    const file = Buffer.concat([buildMp4({ fastStart: true }), Buffer.alloc(0)]);
    const padded = Buffer.concat([file, box('mdat', Buffer.alloc(4 * 1024 * 1024))]);
    const source = memorySource(padded);

    expect((await inspectMp4(source, LIMITS)).ok).toBe(true);
    expect(source.bytesRead).toBeLessThan(4096);
  });
});

describe('inspectMp4 — Μ: άρνηση με όνομα', () => {
  it.each<[string, Mp4FixtureOptions, string]>([
    ['HEVC (iPhone εξ ορισμού)', { videoFormat: 'hvc1', h264Profile: null }, 'hevc-codec'],
    ['HEVC hev1', { videoFormat: 'hev1', h264Profile: null }, 'hevc-codec'],
    ['VP9 μέσα σε MP4', { videoFormat: 'vp09', h264Profile: null }, 'unsupported-video-codec'],
    ['H.264 High 10 (δεν παίζει σε κινητά)', { h264Profile: 110 }, 'unsupported-h264-profile'],
    ['ήχος Opus', { audioFormat: 'Opus' }, 'unsupported-audio-codec'],
    ['121″', { durationSec: 121 }, 'too-long'],
    ['περιέκτης QuickTime (.mov)', { brand: 'qt  ' }, 'quicktime-container'],
    ['τεμαχισμένο MP4 (mvex)', { fragmented: true }, 'fragmented'],
    ['μόνο ήχος', { videoTrack: false }, 'no-video-track'],
    ['avc1 χωρίς avcC', { h264Profile: null }, 'malformed'],
  ])('%s ⇒ %s', async (_label, options, refusal) => {
    expect(await inspect(options)).toEqual({ ok: false, refusal });
  });

  it('101 MB ⇒ too-large, ΠΡΙΝ διαβαστεί έστω ένα byte', async () => {
    const source = memorySource(buildMp4(), LIMITS.maxBytes + 1);

    expect(await inspectMp4(source, LIMITS)).toEqual({ ok: false, refusal: 'too-large' });
    expect(source.bytesRead).toBe(0);
  });

  it('αρχείο που δεν ξεκινά με ftyp ⇒ not-mp4', async () => {
    const webm = Buffer.concat([box('EBML', Buffer.alloc(24)), box('mdat', Buffer.alloc(8))]);

    expect(await inspectMp4(memorySource(webm), LIMITS)).toEqual({ ok: false, refusal: 'not-mp4' });
  });

  it('κομμένο αρχείο (κουτί που υπόσχεται bytes που δεν υπάρχουν) ⇒ malformed, δεν πετά', async () => {
    const whole = buildMp4();

    expect(await inspectMp4(memorySource(whole.subarray(0, whole.length - 40)), LIMITS)).toEqual({
      ok: false,
      refusal: 'malformed',
    });
  });

  it('τυχαία bytes ⇒ άρνηση, ποτέ εξαίρεση', async () => {
    const noise = Buffer.from(Array.from({ length: 512 }, (_unused, index) => (index * 97 + 13) % 251));

    expect((await inspectMp4(memorySource(noise), LIMITS)).ok).toBe(false);
  });
});

describe('planFastStart — Φ: αναδιάταξη χωρίς μεταγλώττιση', () => {
  /** Διαβάζει τις θέσεις των κομματιών από το ΑΠΟΤΕΛΕΣΜΑ και επιστρέφει τα bytes που βρίσκονται εκεί. */
  async function chunksAt(output: Buffer, wide: boolean): Promise<string[]> {
    const type = wide ? 'co64' : 'stco';
    const found: number[] = [];
    let at = output.indexOf(type);
    while (at !== -1) {
      const count = output.readUInt32BE(at + 8);
      for (let index = 0; index < count; index += 1) {
        found.push(wide ? Number(output.readBigUInt64BE(at + 12 + index * 8)) : output.readUInt32BE(at + 12 + index * 4));
      }
      at = output.indexOf(type, at + 4);
    }
    const [videoOne, videoTwo, audio] = found;
    return [
      output.subarray(videoOne, videoOne + FIXTURE_CHUNKS[0].length).toString('latin1'),
      output.subarray(audio, audio + FIXTURE_CHUNKS[1].length).toString('latin1'),
      output.subarray(videoTwo, videoTwo + FIXTURE_CHUNKS[2].length).toString('latin1'),
    ];
  }

  const EXPECTED = FIXTURE_CHUNKS.map((chunk) => chunk.toString('latin1'));

  it.each([false, true])('🔑 Φ1 κάθε θέση δείχνει ΑΚΟΜΗ στο δικό της δείγμα (co64=%s)', async (wideOffsets) => {
    const source = buildMp4({ wideOffsets });
    expect(await chunksAt(source, wideOffsets)).toEqual(EXPECTED);

    const output = materialise(source, planFastStart(await accepted({ wideOffsets })));

    expect(await chunksAt(output, wideOffsets)).toEqual(EXPECTED);
  });

  it('Φ2 το αποτέλεσμα είναι fast start, ίδιου μεγέθους, και ξαναδιαβάζεται με τα ίδια στοιχεία', async () => {
    const source = buildMp4();
    const before = await accepted();
    const output = materialise(source, planFastStart(before));
    const after = await inspectMp4(memorySource(output), LIMITS);

    expect(output.length).toBe(source.length);
    expect(after).toMatchObject({ ok: true, facts: { ...before.facts, fastStart: true } });
  });

  it('Φ3 τα δείγματα αντιγράφονται ως ΕΥΡΗ της πηγής — στη μνήμη μένει μόνο το moov', async () => {
    const inspection = await accepted();
    const held = planFastStart(inspection).filter((segment) => segment.kind === 'bytes');

    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ bytes: expect.any(Uint8Array) });
    expect((held[0] as Extract<Mp4Segment, { kind: 'bytes' }>).bytes.byteLength).toBe(inspection.moov.byteLength);
  });

  it('Φ4 δεν πειράζει το moov που του δόθηκε — δουλεύει σε αντίγραφο', async () => {
    const inspection = await accepted();
    const snapshot = Buffer.from(inspection.moov);

    planFastStart(inspection);

    expect(Buffer.from(inspection.moov).equals(snapshot)).toBe(true);
  });

  it('🔑 Φ5 αρχείο που είναι ΗΔΗ fast start βγαίνει ως ένα εύρος — ούτε ένα byte αλλαγμένο', async () => {
    const source = buildMp4({ fastStart: true });

    expect(planFastStart(await accepted({ fastStart: true }))).toEqual([{ kind: 'range', start: 0, end: source.length }]);
  });
});
