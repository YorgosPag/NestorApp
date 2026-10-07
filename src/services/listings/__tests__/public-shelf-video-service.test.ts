/**
 * Άγκυρες του κεφαλιού του ραφιού ΒΙΝΤΕΟ (ADR-907 §10) — αληθινός ψήστης, αληθινά κουτιά MP4, ψεύτικος μόνο ο κάδος.
 * Εκτελούν **και** τον κοινό σκελετό `reconcileOnePerSource`, που μοιράζεται το κεφάλι των μοντέλων.
 */

import { createHash } from 'crypto';
import { Readable, Writable } from 'stream';

import { buildMp4 } from '@/lib/media/__tests__/mp4-fixture';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import { LISTING_SHELF, LISTING_VIDEO_SHELF } from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

interface StoredObject {
  readonly bytes: Buffer;
  readonly generation: number;
  readonly timeCreated?: string;
  readonly contentType?: string;
  readonly cacheControl?: string;
  readonly custom?: Record<string, string>;
}

interface WriteOptions {
  readonly contentType?: string;
  readonly metadata?: { cacheControl?: string; metadata?: Record<string, string> };
}

/** Ο ελάχιστος κάδος που ζητά το κεφάλι: μεταδεδομένα, ανάγνωση **εύρους**, εγγραφή ως ροή, σβήσιμο. */
class FakeBucket {
  readonly objects = new Map<string, StoredObject>();
  /** Bytes του **περιεχομένου** που διαβάστηκαν (όχι μεταδεδομένα) — η μέτρηση της γρήγορης διαδρομής. */
  bytesRead = 0;
  writes = 0;
  readonly pinnedGenerations: number[] = [];
  private nextGeneration = 100;

  put(name: string, bytes: Buffer, extra: Partial<StoredObject> = {}): void {
    this.nextGeneration += 1;
    this.objects.set(name, { timeCreated: '2026-10-01T08:00:00.000Z', ...extra, bytes, generation: this.nextGeneration });
  }

  private need(name: string): StoredObject {
    const found = this.objects.get(name);
    if (!found) throw new Error(`no such object: ${name}`);
    return found;
  }

  file(name: string, options?: { generation?: number }) {
    const bucket = this;
    if (options?.generation !== undefined) bucket.pinnedGenerations.push(options.generation);
    const slice = ({ start, end }: { start: number; end: number }): Buffer => {
      const part = bucket.need(name).bytes.subarray(start, end + 1);
      bucket.bytesRead += part.length;
      return part;
    };

    return {
      name,
      bucket,
      get metadata() {
        return { metadata: bucket.objects.get(name)?.custom };
      },
      getMetadata: async () => {
        const found = bucket.need(name);
        return [{ generation: String(found.generation), timeCreated: found.timeCreated, size: String(found.bytes.length) }];
      },
      download: async (range: { start: number; end: number }): Promise<[Buffer]> => [slice(range)],
      createReadStream: (range: { start: number; end: number }): Readable => Readable.from([slice(range)]),
      createWriteStream: (write: WriteOptions): Writable => {
        const parts: Buffer[] = [];
        return new Writable({
          write(chunk: Buffer, _encoding, done) {
            parts.push(Buffer.from(chunk));
            done();
          },
          final(done) {
            bucket.writes += 1;
            bucket.put(name, Buffer.concat(parts), {
              contentType: write.contentType,
              cacheControl: write.metadata?.cacheControl,
              custom: write.metadata?.metadata,
            });
            done();
          },
        });
      },
      delete: async () => {
        bucket.objects.delete(name);
      },
    };
  }

  async getFiles({ prefix }: { prefix: string }) {
    return [[...this.objects.keys()].filter((name) => name.startsWith(prefix)).map((name) => this.file(name))];
  }
}

const shelf = new FakeBucket();
const privateBucket = new FakeBucket();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  getFilesEuBucket: () => privateBucket,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcilePublicVideoShelf } = require('../public-shelf-video.service') as
  typeof import('../public-shelf-video.service');

const LISTING = 'prop_77aa21bc';
const PREFIX = `listings/${LISTING}/`;
const PATH = 'companies/c1/entities/property/p1/domains/sales/categories/videos/files/tour.mp4';
const SOURCE: PublicShelfSource<ListingMaterial> = { privateStoragePath: PATH, material: { kind: 'video' } };

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const mp4Keys = (): string[] => [...shelf.objects.keys()].filter((key) => key.endsWith('.mp4'));

beforeEach(() => {
  shelf.objects.clear();
  privateBucket.objects.clear();
  shelf.writes = 0;
  privateBucket.bytesRead = 0;
  privateBucket.pinnedGenerations.length = 0;
});

describe('reconcilePublicVideoShelf — η πρώτη δημοσίευση', () => {
  it('🔑 Κ1 το κλειδί είναι το sha256 των bytes που ΚΑΘΟΝΤΑΙ στο ράφι, και είναι fast start', async () => {
    privateBucket.put(PATH, buildMp4());

    const report = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(report).toMatchObject({ outcome: 'reconciled', rejected: 0 });
    const [key] = mp4Keys();
    const saved = shelf.objects.get(key)!;
    expect(key).toBe(`${PREFIX}${sha256(saved.bytes)}.mp4`);
    expect(saved.bytes.indexOf('moov')).toBeLessThan(saved.bytes.indexOf('mdat'));
    expect(report.published).toEqual([
      expect.objectContaining({ key, at: '2026-10-01T08:00:00.000Z', durationSec: 60, width: 1920, height: 1080 }),
    ]);
  });

  it('Κ2 το αντικείμενο σερβίρεται ως `video/mp4` με `no-transform` — και ΧΩΡΙΣ το ιδιωτικό μονοπάτι στα μεταδεδομένα', async () => {
    privateBucket.put(PATH, buildMp4());

    await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    const saved = shelf.objects.get(mp4Keys()[0])!;
    expect(saved.contentType).toBe('video/mp4');
    expect(saved.cacheControl).toMatch(/no-transform/);
    expect(JSON.stringify(saved.custom)).not.toContain('companies/');
  });

  it('Κ3 τα δύο περάσματα του ψήστη διαβάζουν αρχείο ΚΑΡΦΩΜΕΝΟ στη γενιά των μεταδεδομένων', async () => {
    privateBucket.put(PATH, buildMp4());
    const generation = privateBucket.objects.get(PATH)!.generation;

    await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(privateBucket.pinnedGenerations).toEqual([generation]);
  });
});

describe('reconcilePublicVideoShelf — η γρήγορη διαδρομή', () => {
  it('🔑 Κ4 δεύτερη συμφιλίωση του ίδιου πρωτοτύπου: ΟΥΤΕ ΕΝΑ byte, καμία εγγραφή, ίδια αναφορά', async () => {
    privateBucket.put(PATH, buildMp4({ rotated: true }));
    const first = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);
    privateBucket.bytesRead = 0;
    shelf.writes = 0;

    const second = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(privateBucket.bytesRead).toBe(0);
    expect(shelf.writes).toBe(0);
    expect(second.published).toEqual(first.published);
    expect(second.published[0]).toMatchObject({ width: 1080, height: 1920 });
  });

  it('Κ5 το πρωτότυπο ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ (νέα γενιά) ⇒ ξαναψήνεται, και το παλιό παράγωγο σβήνεται', async () => {
    privateBucket.put(PATH, buildMp4());
    await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);
    const [before] = mp4Keys();

    privateBucket.put(PATH, buildMp4({ durationSec: 30 }));
    const report = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(mp4Keys()).toEqual([report.published[0].key]);
    expect(report.published[0].key).not.toBe(before);
    expect(report).toMatchObject({ removed: 1, published: [{ durationSec: 30 }] });
  });

  it('Κ6 παράγωγο με ΑΔΙΑΒΑΣΤΑ μετρημένα στοιχεία δεν γίνεται πιστευτό — ξαναψήνεται', async () => {
    privateBucket.put(PATH, buildMp4());
    await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);
    const [key] = mp4Keys();
    const saved = shelf.objects.get(key)!;
    shelf.objects.set(key, { ...saved, custom: { ...saved.custom, shelfPixelWidth: 'NaN' } });
    privateBucket.bytesRead = 0;

    const report = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(privateBucket.bytesRead).toBeGreaterThan(0);
    expect(report.published[0]).toMatchObject({ width: 1920, height: 1080 });
  });
});

describe('reconcilePublicVideoShelf — άρνηση, απόσυρση, γειτονία', () => {
  it('🔑 Κ7 HEVC ⇒ απορρίπτεται, ΤΙΠΟΤΑ δεν γράφεται, και η συμφιλίωση ΔΕΝ πετά', async () => {
    privateBucket.put(PATH, buildMp4({ videoFormat: 'hvc1', h264Profile: null }));

    const report = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(report).toEqual({ outcome: 'reconciled', published: [], removed: 0, rejected: 1 });
    expect(mp4Keys()).toEqual([]);
  });

  it('Κ8 πρωτότυπο που δεν υπάρχει ⇒ ονομασμένη άρνηση, όχι εξαίρεση', async () => {
    const report = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);

    expect(report).toMatchObject({ outcome: 'reconciled', published: [], rejected: 1 });
  });

  it('🔑 Κ9 κενές πηγές = ΑΠΟΣΥΡΣΗ: το βίντεο σβήνεται, οι φωτογραφίες και το μοντέλο της ίδιας αγγελίας ΜΕΝΟΥΝ', async () => {
    privateBucket.put(PATH, buildMp4());
    await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, [SOURCE]);
    const photo = `${PREFIX}${'a'.repeat(64)}.webp`;
    const model = `${PREFIX}${'b'.repeat(64)}.glb`;
    shelf.put(photo, Buffer.from('webp'));
    shelf.put(model, Buffer.from('glb'));
    privateBucket.bytesRead = 0;

    const report = await reconcilePublicVideoShelf(LISTING_VIDEO_SHELF, LISTING, []);

    expect(report).toMatchObject({ outcome: 'reconciled', removed: 1 });
    expect([...shelf.objects.keys()].sort()).toEqual([photo, model].sort());
    expect(privateBucket.bytesRead).toBe(0);
  });

  it('Κ10 γραμμή που ΔΕΝ είναι βίντεο ⇒ αποτυχία με όνομα, και ο κάδος δεν αγγίζεται', async () => {
    shelf.put(`${PREFIX}${'a'.repeat(64)}.webp`, Buffer.from('webp'));

    const report = await reconcilePublicVideoShelf(LISTING_SHELF, LISTING, [SOURCE]);

    expect(report).toMatchObject({ outcome: 'failed', published: [], rejected: 1 });
    expect(shelf.objects.size).toBe(1);
  });
});
