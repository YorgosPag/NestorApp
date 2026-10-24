/**
 * ADR-920 Β3β — το τρίτο κεφάλι του ραφιού: ψήσιμο εδάφους + συμφιλίωση, σε ψεύτικο κάδο (καμία εγγραφή σε GCS).
 *
 * Fixture: η επίπεδη κλίση του Β2 (20 m × 20 m σε μεγέθη ΕΓΣΑ'87, +10 % προς ανατολή), γραμμένη ως κανονική πηγή
 * με τον **ίδιο** κωδικοποιητή που χρησιμοποιεί η πόρτα.
 */

import { createHash } from 'crypto';
import { gunzipSync } from 'node:zlib';

import { encodeListingTerrainSource, parseListingTerrainSource } from '@/lib/terrain/publication/listing-terrain-source';
import {
  TERRAIN_DECLARATION_METADATA_KEY,
  encodeTerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import { LISTING_MODEL_SHELF, LISTING_TERRAIN_SHELF, shelfRecipe } from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

interface StoredObject {
  readonly bytes: Buffer;
  readonly generation: number;
  readonly timeCreated?: string;
  readonly contentType?: string;
  readonly contentEncoding?: string;
  readonly custom?: Record<string, string>;
}

interface SaveOptions {
  readonly contentType?: string;
  readonly metadata?: { contentEncoding?: string; metadata?: Record<string, string> };
}

class FakeBucket {
  readonly objects = new Map<string, StoredObject>();
  downloads = 0;
  private nextGeneration = 100;

  put(name: string, bytes: Buffer, extra: Partial<StoredObject> = {}): void {
    this.nextGeneration += 1;
    this.objects.set(name, { timeCreated: '2026-10-01T08:00:00.000Z', ...extra, bytes, generation: this.nextGeneration });
  }

  file(name: string) {
    const bucket = this;
    const need = (): StoredObject => {
      const found = bucket.objects.get(name);
      if (!found) throw new Error(`no such object: ${name}`);
      return found;
    };
    return {
      name,
      get metadata() {
        return { metadata: bucket.objects.get(name)?.custom };
      },
      getMetadata: async () => {
        const found = need();
        return [{ generation: String(found.generation), timeCreated: found.timeCreated, metadata: found.custom }];
      },
      download: async (): Promise<[Buffer]> => {
        bucket.downloads += 1;
        return [need().bytes];
      },
      save: async (bytes: Buffer, options: SaveOptions) => {
        bucket.put(name, bytes, {
          contentType: options.contentType,
          contentEncoding: options.metadata?.contentEncoding,
          custom: options.metadata?.metadata,
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
const { reconcilePublicTerrainShelf } = require('../public-shelf-terrain.service') as
  typeof import('../public-shelf-terrain.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bakeListingTerrain } = require('../public-shelf-terrain-bake') as typeof import('../public-shelf-terrain-bake');

const LISTING = 'prop_77aa21bc';
const PREFIX = `listings/${LISTING}/`;
const PATH = 'companies/c1/entities/property/p1/domains/construction/categories/drawings/files/terrain-source.json';
const SOURCE: PublicShelfSource<ListingMaterial> = { privateStoragePath: PATH, material: { kind: 'terrain' } };
const DECLARATION = { surveyorName: 'Τοπογράφος Α', surveyedOn: '2026-05-04', rightsAffirmed: true } as const;
const E0 = 400_000_000;
const N0 = 4_200_000_000;

function sourceBytes(slope = 0.1): Buffer {
  const points: number[][] = [];
  for (let x = E0; x <= E0 + 20_000; x += 2_000) {
    for (let y = N0; y <= N0 + 20_000; y += 2_000) points.push([x, y, 120_000 + slope * (x - E0)]);
  }
  const source = parseListingTerrainSource({ version: 1, points, breaklines: [], boundary: null, envelope: null });
  if (source === null) throw new Error('fixture source must parse');
  return Buffer.from(encodeListingTerrainSource(source), 'utf8');
}

function putSource(bytes = sourceBytes(), declared = true): void {
  privateBucket.put(PATH, bytes, {
    custom: declared ? { [TERRAIN_DECLARATION_METADATA_KEY]: encodeTerrainSurveyDeclaration(DECLARATION) } : {},
  });
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const jsonKeys = (): string[] => [...shelf.objects.keys()].filter((key) => key.endsWith('.json'));

beforeEach(() => {
  shelf.objects.clear();
  privateBucket.objects.clear();
  privateBucket.downloads = 0;
});

describe('bakeListingTerrain — ο ψήστης', () => {
  it('🔴 δημοσιεύει το ΣΤΙΓΜΙΟΤΥΠΟ, ποτέ την πηγή — καμία απόλυτη συντεταγμένη στα bytes', () => {
    const baked = bakeListingTerrain(sourceBytes(), DECLARATION);
    if (!baked.ok) throw new Error(baked.failure);
    const snapshot = JSON.parse(baked.json.toString('utf8')) as { version: number; points?: unknown; mesh: { positions: number[] } };

    expect(snapshot.version).toBe(1);
    expect(snapshot).not.toHaveProperty('points');
    expect(snapshot.mesh.positions.every((n) => Math.abs(n) < 100_000)).toBe(true);
    expect(gunzipSync(baked.gzipped).equals(baked.json)).toBe(true);
    expect(baked.card.survey).toEqual({ surveyorName: 'Τοπογράφος Α', surveyedOn: '2026-05-04' });
  });

  it('ντετερμινιστικό: ίδια πηγή ⇒ ίδια bytes (άρα ίδιο κλειδί)', () => {
    const a = bakeListingTerrain(sourceBytes(), DECLARATION);
    const b = bakeListingTerrain(sourceBytes(), DECLARATION);
    if (!a.ok || !b.ok) throw new Error('bake');
    expect(a.json.equals(b.json)).toBe(true);
  });

  it.each([
    ['όχι JSON', Buffer.from('not json'), 'malformed-source'],
    ['άγνωστη έκδοση πηγής', Buffer.from(JSON.stringify({ version: 9, points: [] })), 'malformed-source'],
    ['δύο σημεία', Buffer.from(JSON.stringify({ version: 1, points: [[0, 0, 1], [1000, 0, 1]], breaklines: [], boundary: null, envelope: null })), 'insufficient-surface'],
  ])('ονομασμένη άρνηση (%s)', (_label, raw, failure) => {
    expect(bakeListingTerrain(raw, DECLARATION)).toEqual({ ok: false, failure });
  });
});

describe('reconcilePublicTerrainShelf — η συμφιλίωση', () => {
  it('🔑 κλειδί = sha256 των ΑΣΥΜΠΙΕΣΤΩΝ bytes · gzip στη μεταφορά · κάρτα στα metadata', async () => {
    putSource();

    const report = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);

    expect(report).toMatchObject({ outcome: 'reconciled', rejected: 0, removed: 0 });
    const [key] = jsonKeys();
    const saved = shelf.objects.get(key)!;
    const json = gunzipSync(saved.bytes);
    expect(key).toBe(`${PREFIX}${sha256(json)}.json`);
    expect(saved.contentEncoding).toBe('gzip');
    expect(saved.contentType).toBe('application/json');
    expect(report.published).toEqual([expect.objectContaining({ key, at: '2026-10-01T08:00:00.000Z' })]);
    expect(JSON.parse(saved.custom!.shelfTerrainCard)).toEqual(report.published[0].card);
  });

  it('🔑 cache hit: δεύτερο πέρασμα δεν κατεβάζει ούτε ψήνει, και δίνει την ΙΔΙΑ κάρτα', async () => {
    putSource();
    const first = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);
    privateBucket.downloads = 0;

    const second = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);

    expect(privateBucket.downloads).toBe(0);
    expect(second.published).toEqual(first.published);
  });

  it('🔴 χωρίς δήλωση Δ2 ⇒ δεν δημοσιεύεται τίποτα', async () => {
    putSource(sourceBytes(), false);

    const report = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);

    expect(report).toMatchObject({ outcome: 'reconciled', published: [], rejected: 1 });
    expect(jsonKeys()).toEqual([]);
  });

  it('🔴 νέα πηγή ⇒ το παλιό στιγμιότυπο ΣΒΗΝΕΤΑΙ · κενό σύνολο ⇒ το ράφι αδειάζει', async () => {
    putSource(sourceBytes(0.1));
    await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);
    const [oldKey] = jsonKeys();

    putSource(sourceBytes(0.2));
    const replaced = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);
    expect(replaced.removed).toBe(1);
    expect(jsonKeys()).not.toContain(oldKey);

    const withdrawn = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, []);
    expect(withdrawn.removed).toBe(1);
    expect(jsonKeys()).toEqual([]);
  });

  it('⛔ δεν αγγίζει τα αρχεία άλλων κεφαλιών στο ίδιο πρόθεμα', async () => {
    shelf.put(`${PREFIX}${'a'.repeat(64)}.glb`, Buffer.from('glb'));

    await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, []);

    expect(shelf.objects.has(`${PREFIX}${'a'.repeat(64)}.glb`)).toBe(true);
  });

  it('🔴 νέα έκδοση στιγμιοτύπου ή πηγής ⇒ νέα συνταγή ⇒ ξαναψήσιμο χωρίς τον ιδιοκτήτη', () => {
    const encoding = LISTING_TERRAIN_SHELF.encoding;
    const recipe = shelfRecipe(encoding);
    expect(shelfRecipe({ ...encoding, snapshotVersion: encoding.snapshotVersion + 1 })).not.toBe(recipe);
    expect(shelfRecipe({ ...encoding, sourceVersion: encoding.sourceVersion + 1 })).not.toBe(recipe);
  });

  it('η λάθος γραμμή αρνείται ονομαστικά, χωρίς να πετάξει', async () => {
    const report = await reconcilePublicTerrainShelf(LISTING_MODEL_SHELF, LISTING, [SOURCE]);
    expect(report).toMatchObject({ outcome: 'failed', published: [] });
  });
});
