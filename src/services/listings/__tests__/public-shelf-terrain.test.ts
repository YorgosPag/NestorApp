/**
 * ADR-920 Β3β — το τρίτο κεφάλι του ραφιού: ψήσιμο εδάφους + συμφιλίωση, σε ψεύτικο κάδο (καμία εγγραφή σε GCS).
 *
 * Fixture: η επίπεδη κλίση του Β2 (20 m × 20 m σε μεγέθη ΕΓΣΑ'87, +10 % προς ανατολή), γραμμένη ως κανονική πηγή
 * με τον **ίδιο** κωδικοποιητή που χρησιμοποιεί η πόρτα.
 */

import { createHash } from 'crypto';
import { gunzipSync } from 'node:zlib';

import {
  encodeListingTerrainSource,
  parseListingTerrainSource,
  withGeoreferenceChoice,
  withPlotOutline,
} from '@/lib/terrain/publication/listing-terrain-source';
import {
  TERRAIN_DECLARATION_METADATA_KEY,
  encodeTerrainSurveyDeclaration,
} from '@/lib/terrain/publication/terrain-survey-declaration';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import { LISTING_MODEL_SHELF, LISTING_TERRAIN_SHELF, shelfRecipe } from '@/services/upload/utils/public-shelf-kinds';
import { META_RECIPE, META_SOURCE_REF } from '../public-shelf-plan';
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
  saves = 0;
  metadataUpdates = 0;
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
        bucket.saves += 1;
        bucket.put(name, bytes, {
          contentType: options.contentType,
          contentEncoding: options.metadata?.contentEncoding,
          custom: options.metadata?.metadata,
        });
      },
      // Β6.9 Β — όπως το GCS: τα προσαρμοσμένα κλειδιά ΣΥΓΧΩΝΕΥΟΝΤΑΙ, τα bytes και η γενιά μένουν.
      setMetadata: async ({ metadata }: { metadata: Record<string, string> }) => {
        const found = need();
        bucket.metadataUpdates += 1;
        bucket.objects.set(name, { ...found, custom: { ...found.custom, ...metadata } });
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
  shelf.saves = 0;
  shelf.metadataUpdates = 0;
  privateBucket.objects.clear();
  privateBucket.downloads = 0;
});

describe('bakeListingTerrain — ο ψήστης', () => {
  it('🔴 δημοσιεύει το ΣΤΙΓΜΙΟΤΥΠΟ, ποτέ την πηγή — καμία απόλυτη συντεταγμένη στα bytes', () => {
    const baked = bakeListingTerrain(sourceBytes(), DECLARATION);
    if (!baked.ok) throw new Error(baked.failure);
    const snapshot = JSON.parse(baked.json.toString('utf8')) as { version: number; points?: unknown; mesh: { positions: number[] } };

    expect(snapshot.version).toBe(3);
    expect(snapshot).not.toHaveProperty('points');
    expect(snapshot.mesh.positions.every((n) => Math.abs(n) < 100_000)).toBe(true);
    expect(gunzipSync(baked.gzipped).equals(baked.json)).toBe(true);
    expect(baked.card.survey).toEqual({ surveyorName: 'Τοπογράφος Α', surveyedOn: '2026-05-04' });
  });

  it('🔴 ADR-920 §14.11 Π9 — περίγραμμα στο ΔΗΜΟΣΙΟ στιγμιότυπο ΜΟΝΟ με το κουτάκι του ιδιοκτήτη', () => {
    const ring = [
      { x: E0 + 2_000, y: N0 + 2_000 }, { x: E0 + 18_000, y: N0 + 2_000 },
      { x: E0 + 18_000, y: N0 + 18_000 }, { x: E0 + 2_000, y: N0 + 18_000 },
    ];
    const bakedWith = (showInListing: boolean) => {
      const source = withPlotOutline(parseListingTerrainSource(JSON.parse(sourceBytes().toString('utf8')))!, { ringWorldMm: ring, showInListing });
      const baked = bakeListingTerrain(Buffer.from(encodeListingTerrainSource(source!), 'utf8'), DECLARATION);
      if (!baked.ok) throw new Error(baked.failure);
      return JSON.parse(baked.json.toString('utf8')) as { plotOutline: unknown; plotOutlineOmission: unknown };
    };

    expect(bakedWith(false)).toMatchObject({ plotOutline: null, plotOutlineOmission: null });
    expect(bakedWith(true)).toMatchObject({ plotOutline: { areaM2: 256, coverage: 'covered' }, plotOutlineOmission: null });
  });

  it('🔴 ADR-920 §14.12 Α — ΘΕΣΗ στο ΔΗΜΟΣΙΟ στιγμιότυπο ΜΟΝΟ με δηλωμένο ΕΓΣΑ\'87 ΚΑΙ το κουτάκι του ιδιοκτήτη', () => {
    const bakedWith = (system: 'EPSG:2100' | 'local' | null, consent: boolean) => {
      const base = parseListingTerrainSource(JSON.parse(sourceBytes().toString('utf8')))!;
      const source = withGeoreferenceChoice(base, { coordinateSystem: system, showLocationInListing: consent });
      const baked = bakeListingTerrain(Buffer.from(encodeListingTerrainSource(source!), 'utf8'), DECLARATION);
      if (!baked.ok) throw new Error(baked.failure);
      return JSON.parse(baked.json.toString('utf8')) as { georeference: { centre: { lat: number; lng: number } } | null; georeferenceOmission: unknown };
    };

    // Δηλωμένο σύστημα ΧΩΡΙΣ το κουτάκι: ούτε θέση, ούτε σημείωση ότι υπάρχει — τίποτα να «κρυφτεί».
    expect(bakedWith('EPSG:2100', false)).toMatchObject({ georeference: null, georeferenceOmission: null });
    expect(bakedWith(null, false)).toMatchObject({ georeference: null, georeferenceOmission: null });

    const shown = bakedWith('EPSG:2100', true);
    expect(shown.georeferenceOmission).toBeNull();
    // Το fixture είναι στην Πελοπόννησο (E 400 km · N 4 200 km): η θέση πέφτει μέσα στην Ελλάδα, όχι στον Ατλαντικό.
    expect(shown.georeference?.centre.lat).toBeGreaterThan(37);
    expect(shown.georeference?.centre.lat).toBeLessThan(39);
    expect(shown.georeference?.centre.lng).toBeGreaterThan(22);
    expect(shown.georeference?.centre.lng).toBeLessThan(24);
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
    expect(shelfRecipe({ ...encoding, builderRevision: encoding.builderRevision + 1 })).not.toBe(recipe);
  });

  it('Β6.9 Β — η αναθεώρηση του builder είναι στη συνταγή, χωριστά από την έκδοση ΣΧΗΜΑΤΟΣ', () => {
    expect(shelfRecipe(LISTING_TERRAIN_SHELF.encoding)).toBe(
      `json:terrain-s3-w3-b${LISTING_TERRAIN_SHELF.encoding.builderRevision}`,
    );
    expect(LISTING_TERRAIN_SHELF.encoding.snapshotVersion).toBe(3);
    expect(LISTING_TERRAIN_SHELF.encoding.builderRevision).toBe(4);
  });

  it('🏆 Β6.9 Β — ΙΔΙΑ bytes με ΠΑΛΙΑ συνταγή: ανανεώνεται η εγγραφή, όχι τα bytes · μετά, cache hit', async () => {
    putSource();
    await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);
    const [key] = jsonKeys();
    const stored = shelf.objects.get(key)!;
    shelf.objects.set(key, { ...stored, custom: { ...stored.custom, [META_RECIPE]: 'json:terrain-s1-w1' } });
    shelf.saves = 0;
    privateBucket.downloads = 0;

    await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);
    expect(privateBucket.downloads).toBe(1);
    expect(shelf.saves).toBe(0);
    expect(shelf.metadataUpdates).toBe(1);
    expect(shelf.objects.get(key)!.custom![META_RECIPE]).toBe(shelfRecipe(LISTING_TERRAIN_SHELF.encoding));
    expect(shelf.objects.get(key)!.generation).toBe(stored.generation);

    privateBucket.downloads = 0;
    await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);
    expect(privateBucket.downloads).toBe(0);
    expect(shelf.metadataUpdates).toBe(1);
  });

  it('🔴 Β6.9 Β — ΑΛΛΑ bytes από παλιά συνταγή: ψήνεται το νέο και το παλιό .json ΣΒΗΝΕΤΑΙ', async () => {
    putSource();
    const stale = `${PREFIX}${'b'.repeat(64)}.json`;
    shelf.put(stale, Buffer.from('{}'), { custom: { [META_SOURCE_REF]: 'x', [META_RECIPE]: 'json:terrain-s1-w1' } });

    const report = await reconcilePublicTerrainShelf(LISTING_TERRAIN_SHELF, LISTING, [SOURCE]);

    expect(report).toMatchObject({ outcome: 'reconciled', removed: 1, rejected: 0 });
    expect(jsonKeys()).toEqual([report.published[0].key]);
  });

  it('η λάθος γραμμή αρνείται ονομαστικά, χωρίς να πετάξει', async () => {
    const report = await reconcilePublicTerrainShelf(LISTING_MODEL_SHELF, LISTING, [SOURCE]);
    expect(report).toMatchObject({ outcome: 'failed', published: [] });
  });
});
