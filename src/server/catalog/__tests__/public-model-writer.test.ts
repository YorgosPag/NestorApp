/**
 * Ο γραφέας του δημόσιου εγγράφου (ADR-923 §5.13 Δ3 · Δ4), πάνω στο ψεύτικο Firestore: CAS, συνθήκη, ράφι, ανάκληση μνήμης.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { PublicCatalogMedia } from '@/subapps/catalog/public/public-catalog-schema';
import { PUBLIC_CATALOG_SCHEMA_VERSION } from '@/subapps/catalog/public/public-catalog-schema';
import type { SupplierStandingRead } from '@/subapps/catalog/public/public-publication-condition';
import { publicScopeKey, type PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';
import { drainPublicModel, type PublicDrainDeps } from '../public/public-model-writer.server';
import type { PublicAssetFacts, PublicModelSnapshot } from '../public/public-model-snapshot.server';
import { publicOutboxRef } from '../public/public-outbox.server';

const COMPANY = 'comp-a';
const MODEL = 'cpmod_1';
const PUBLIC = 'public_catalog_models';
const AT = 1_800_000_000_000;

const OPEN: SupplierStandingRead = { kind: 'known', standing: { kind: 'verified', basis: 'manual-review' } };
const CLOSED: SupplierStandingRead = { kind: 'known', standing: { kind: 'unverified' } };
const UNKNOWN: SupplierStandingRead = { kind: 'unknown' };

const ASSET: PublicAssetFacts = { assetId: 'cast_1', labels: { el: 'Φωτό' }, storagePath: 'c/1.jpg' };
const ATTRIBUTE = { id: 'photo', code: 'photo', type: 'asset', labels: { el: 'Φωτό' }, scopable: false, localizable: false, config: { assetKinds: ['image'], maxCount: 1 } };

function snapshot(visible = true): PublicModelSnapshot {
  const family = { labels: { el: 'Οικογένεια' }, attributes: [{ attributeId: 'photo', requiredChannels: ['storefront'] }], variantSchemes: [], imageAttributeId: 'photo' };
  const holder = { values: { photo: { '*': { '*': { type: 'asset', assetIds: ['cast_1'] } } } }, noValueReasons: {}, categoryIds: [] };
  const rule = { id: 'r', subject: { kind: 'catalog' }, audience: { kind: 'anonymous' }, visibility: 'visible' };
  return {
    projection: {
      companyId: COMPANY,
      rootId: MODEL,
      kind: 'productModel',
      code: 'M-1',
      familyId: 'fam',
      schema: { family, attributes: new Map([['photo', ATTRIBUTE]]), scheme: null },
      locales: ['el'],
      categoryLabels: new Map(),
      variants: [{ id: 'cprod_1', code: 'A', label: 'Α', chain: [{ id: 'cprod_1', kind: 'product', revision: 1, holder }], ancestry: { variantId: 'cprod_1', modelIds: [MODEL], categoryDepths: {} } }],
      rules: visible ? [rule] : [],
    },
    // Το δεύτερο μέσο επιτρέπεται, αλλά καμία δημόσια ιδιότητα δεν το δείχνει: δεν ανεβαίνει ποτέ στο ράφι.
    assets: new Map([['cast_1', ASSET], ['cast_2', { ...ASSET, assetId: 'cast_2' }]]),
  } as unknown as PublicModelSnapshot;
}

let fake: FakeFirestore;
let db: Firestore;

const scopeOf = (scope: PublicScope) => publicOutboxRef(db, COMPANY, scope);
const MODEL_SCOPE: PublicScope = { kind: 'model', modelId: MODEL };

async function dirty(revision: number, drainedRevision = 0): Promise<void> {
  await scopeOf(MODEL_SCOPE).set({ companyId: COMPANY, scope: publicScopeKey(MODEL_SCOPE), revision, drainedRevision, dirty: true });
}

const outbox = async () => (await scopeOf(MODEL_SCOPE).get()).data();
const publicDoc = () => fake.getAllDocs(PUBLIC)[MODEL];

function depsWith(overrides: Partial<PublicDrainDeps> = {}): PublicDrainDeps & { readonly revalidate: jest.Mock; readonly reconcileMedia: jest.Mock } {
  const reconcileMedia = jest.fn(async (_id: string, assets: readonly PublicAssetFacts[]) =>
    new Map<string, PublicCatalogMedia>(assets.map((asset) => [asset.assetId, { assetId: asset.assetId, url: `https://cdn/${asset.assetId}`, labels: asset.labels }])));
  return {
    readStanding: async () => OPEN,
    readSnapshot: async () => snapshot(),
    reconcileMedia,
    revalidate: jest.fn(),
    ...overrides,
  } as PublicDrainDeps & { readonly revalidate: jest.Mock; readonly reconcileMedia: jest.Mock };
}

beforeEach(async () => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  await dirty(1);
});

describe('δημοσίευση', () => {
  it('ανοιχτή συνθήκη: γράφει έγγραφο με το κλειστό σχήμα, αδειάζει το outbox, ακυρώνει μνήμη', async () => {
    const deps = depsWith();
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('published');
    expect(publicDoc()).toMatchObject({ schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION, modelId: MODEL, companyId: COMPANY });
    expect(await outbox()).toMatchObject({ drainedRevision: 1, dirty: false });
    expect(deps.revalidate).toHaveBeenCalledWith(COMPANY, MODEL);
  });

  it('στο ράφι πάνε μόνο τα μέσα που βγάζει η προβολή, και το URL φτάνει στο έγγραφο', async () => {
    const deps = depsWith();
    await drainPublicModel(db, COMPANY, MODEL, AT, deps);
    expect(deps.reconcileMedia).toHaveBeenCalledWith(MODEL, [ASSET]);
    expect(JSON.stringify(publicDoc())).toContain('https://cdn/cast_1');
  });

  it('δεύτερη κλήση: καθαρό, καμία νέα εγγραφή ούτε ακύρωση', async () => {
    const deps = depsWith();
    await drainPublicModel(db, COMPANY, MODEL, AT, deps);
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('clean');
    expect(deps.revalidate).toHaveBeenCalledTimes(1);
  });

  it('ίδιο έγγραφο σε νέα αναθεώρηση: unchanged, χωρίς ακύρωση μνήμης', async () => {
    const deps = depsWith();
    await drainPublicModel(db, COMPANY, MODEL, AT, deps);
    await dirty(2, 1);
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('unchanged');
    expect(deps.revalidate).toHaveBeenCalledTimes(1);
    expect(await outbox()).toMatchObject({ drainedRevision: 2, dirty: false });
  });

  it('🔒 έγγραφο που δεν περνά το κλειστό σχήμα δεν γράφεται ποτέ', async () => {
    const broken = snapshot();
    const readSnapshot = async () => ({ ...broken, projection: { ...broken.projection, locales: ['xx'] } }) as unknown as PublicModelSnapshot;
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, depsWith({ readSnapshot }))).rejects.toThrow();
    expect(publicDoc()).toBeUndefined();
    expect(await outbox()).toMatchObject({ drainedRevision: 0, dirty: true });
  });

  it('το ράφι απέτυχε: κανένα έγγραφο, το outbox μένει βρώμικο', async () => {
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, depsWith({ reconcileMedia: async () => null }))).resolves.toBe('media-failed');
    expect(publicDoc()).toBeUndefined();
    expect(await outbox()).toMatchObject({ drainedRevision: 0, dirty: true });
  });
});

describe('απόσυρση', () => {
  beforeEach(async () => {
    await drainPublicModel(db, COMPANY, MODEL, AT, depsWith());
    await dirty(2, 1);
  });

  it('κλειστή συνθήκη: σβήνει χωρίς να διαβάσει τον κατάλογο, αδειάζει το ράφι, ακυρώνει μνήμη', async () => {
    const readSnapshot = jest.fn(async () => snapshot());
    const deps = depsWith({ readStanding: async () => CLOSED, readSnapshot });
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('withdrawn');
    expect(publicDoc()).toBeUndefined();
    expect(readSnapshot).not.toHaveBeenCalled();
    expect(deps.reconcileMedia).toHaveBeenCalledWith(MODEL, []);
    expect(deps.revalidate).toHaveBeenCalledWith(COMPANY, MODEL);
  });

  it('κανένα ορατό SKU: σβήνει', async () => {
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, depsWith({ readSnapshot: async () => snapshot(false) }))).resolves.toBe('withdrawn');
    expect(publicDoc()).toBeUndefined();
  });

  it('η ρίζα δεν υπάρχει πια: σβήνει', async () => {
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, depsWith({ readSnapshot: async () => null }))).resolves.toBe('withdrawn');
    expect(publicDoc()).toBeUndefined();
  });

  it('ράφι που δεν άδειασε ξανασημειώνει το scope: δημόσια bytes δεν μένουν ορφανά', async () => {
    const deps = depsWith({ readStanding: async () => CLOSED, reconcileMedia: async () => null });
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('media-failed');
    expect(publicDoc()).toBeUndefined();
    expect(await outbox()).toMatchObject({ revision: 3, dirty: true });
  });
});

describe('unknown: τίποτα δεν αλλάζει', () => {
  it.each([
    ['αναγνώστης unknown', async () => UNKNOWN],
    ['αναγνώστης που πετά', async () => { throw new Error('5xx'); }],
  ])('%s: το έγγραφο μένει, το outbox βρώμικο, ούτε ράφι ούτε μνήμη', async (_name, readStanding) => {
    await drainPublicModel(db, COMPANY, MODEL, AT, depsWith());
    await dirty(2, 1);
    const before = publicDoc();
    const deps = depsWith({ readStanding });
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('deferred');
    expect(publicDoc()).toEqual(before);
    expect(await outbox()).toMatchObject({ drainedRevision: 1, dirty: true });
    expect(deps.reconcileMedia).not.toHaveBeenCalled();
    expect(deps.revalidate).not.toHaveBeenCalled();
  });
});

describe('φράχτης CAS', () => {
  it('αλλαγή μοντέλου στο ενδιάμεσο: καμία εγγραφή, μένει βρώμικο', async () => {
    const deps = depsWith({
      readSnapshot: async () => {
        await dirty(2);
        return snapshot();
      },
    });
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('raced');
    expect(publicDoc()).toBeUndefined();
    expect(await outbox()).toMatchObject({ revision: 2, dirty: true });
  });

  it('ανάκληση στο ενδιάμεσο (scope catalog): η παλιά ανοιχτή συνθήκη δεν ξαναγεννά το έγγραφο', async () => {
    const catalog: PublicScope = { kind: 'catalog' };
    const deps = depsWith({
      readSnapshot: async () => {
        await scopeOf(catalog).set({ companyId: COMPANY, scope: 'catalog', revision: 1, dirty: true });
        return snapshot();
      },
    });
    await expect(drainPublicModel(db, COMPANY, MODEL, AT, deps)).resolves.toBe('raced');
    expect(publicDoc()).toBeUndefined();
  });
});
