/**
 * Το δίχτυ της βιτρίνας (ADR-923 §5.13 Δ3 · Δ6): κρίση χώρων με μνήμη συνθήκης, πέρασμα καταλόγου με δρομέα, ουρά.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { SupplierStandingRead } from '@/subapps/catalog/public/public-publication-condition';
import { expandPublicCatalogPage } from '../public/public-catalog-pass.server';
import { sweepPublicCatalog } from '../public/public-catalog-sweep.server';
import { drainPublicModel, type PublicDrainDeps } from '../public/public-model-writer.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef } from '../public/public-outbox.server';

jest.mock('../public/public-model-writer.server', () => ({
  LIVE_PUBLIC_DRAIN_DEPS: {},
  drainPublicModel: jest.fn(),
}));

const COMPANY = 'comp-a';
const MODELS = 'catalog_product_models';
const PRODUCTS = 'catalog_products';
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const OPEN: SupplierStandingRead = { kind: 'known', standing: { kind: 'verified', basis: 'registry' } };
const CLOSED: SupplierStandingRead = { kind: 'known', standing: { kind: 'unverified' } };
const UNKNOWN: SupplierStandingRead = { kind: 'unknown' };

let fake: FakeFirestore;
let db: Firestore;

const drain = drainPublicModel as jest.MockedFunction<typeof drainPublicModel>;
const catalogRef = () => publicOutboxRef(db, COMPANY, PUBLIC_CATALOG_SCOPE);
const catalog = async () => (await catalogRef().get()).data() ?? {};
const depsOf = (read: SupplierStandingRead): PublicDrainDeps => ({ readStanding: async () => read } as unknown as PublicDrainDeps);
const sweep = (read: SupplierStandingRead, nowMs = NOW) => sweepPublicCatalog(db, nowMs, Date.now() + 5000, depsOf(read));

async function seedCatalog(extra: Record<string, unknown> = {}): Promise<void> {
  await catalogRef().set({ companyId: COMPANY, scope: 'catalog', revision: 1, drainedRevision: 1, dirty: false, queuedAt: 1, ...extra });
}

async function seedRoots(models: number, products = 0): Promise<void> {
  for (let i = 0; i < models; i += 1) {
    const id = `cpmod_${String(i).padStart(4, '0')}`;
    await db.collection(MODELS).doc(id).set({ id, companyId: COMPANY, isDeleted: false, parentId: null });
  }
  for (let i = 0; i < products; i += 1) {
    const id = `cprod_${String(i).padStart(4, '0')}`;
    await db.collection(PRODUCTS).doc(id).set({ id, companyId: COMPANY, isDeleted: false, modelId: null });
  }
}

const outboxScopes = () => Object.values(fake.getAllDocs('catalog_public_outbox')).map((doc) => doc.scope as string);

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  drain.mockReset();
  drain.mockResolvedValue('published');
});

describe('μνήμη συνθήκης στη σάρωση', () => {
  async function walk(reads: readonly SupplierStandingRead[]) {
    const revisions: number[] = [];
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW });
    for (const read of reads) {
      await sweep(read);
      revisions.push((await catalog()).revision as number);
    }
    return revisions;
  }

  it('open → unknown → closed: η μετάβαση σημειώνει το catalog, άρα φτάνει σε delete', async () => {
    await expect(walk([UNKNOWN, CLOSED])).resolves.toEqual([1, 2]);
    expect((await catalog()).seenCondition).toBe('closed');
  });

  it('open → unknown → open: καμία αλλαγή, ούτε σημείωση', async () => {
    await expect(walk([UNKNOWN, OPEN])).resolves.toEqual([1, 1]);
    expect((await catalog()).seenCondition).toBe('open');
  });

  it('το unknown δεν καταργεί τη μνήμη και μετριέται στο αποτέλεσμα', async () => {
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW });
    await expect(sweep(UNKNOWN)).resolves.toMatchObject({ judged: 1, unknownCompanies: 1, transitions: 0 });
    expect((await catalog()).seenCondition).toBe('open');
  });

  it('ο αναγνώστης που πετά μετριέται ως unknown', async () => {
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW });
    const deps = { readStanding: async () => { throw new Error('5xx'); } } as unknown as PublicDrainDeps;
    await expect(sweepPublicCatalog(db, NOW, Date.now() + 5000, deps)).resolves.toMatchObject({ unknownCompanies: 1, failed: 0 });
  });

  it('κάθε χώρος κρίνεται μία φορά ανά πέρασμα, και από την κρίση και από τα αδειάσματα', async () => {
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW });
    for (const id of ['cpmod_a', 'cpmod_b']) {
      await publicOutboxRef(db, COMPANY, { kind: 'model', modelId: id }).set({ companyId: COMPANY, scope: `model:${id}`, revision: 1, dirty: true, queuedAt: 1 });
    }
    drain.mockImplementation(async (_db, companyId, _modelId, _atMs, deps) => {
      await deps?.readStanding(companyId);
      return 'published';
    });
    const readStanding = jest.fn(async () => OPEN);
    await sweepPublicCatalog(db, NOW, Date.now() + 5000, { readStanding } as unknown as PublicDrainDeps);
    expect(drain).toHaveBeenCalledTimes(2);
    expect(readStanding).toHaveBeenCalledTimes(1);
  });

  it('η μετάβαση μετριέται, η ίδια γνώση όχι', async () => {
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW });
    await expect(sweep(CLOSED)).resolves.toMatchObject({ transitions: 1 });
    await expect(sweep(CLOSED)).resolves.toMatchObject({ transitions: 0 });
  });
});

describe('ημερήσιο πλήρες πέρασμα', () => {
  it('ανοιχτός χώρος μετά από 24 ώρες σημειώνεται μία φορά', async () => {
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW - DAY });
    await sweep(OPEN);
    expect(await catalog()).toMatchObject({ fullPassAtMs: NOW, drainedRevision: 2 });
    await sweep(OPEN);
    expect((await catalog()).revision).toBe(2);
  });

  it('πριν από τις 24 ώρες δεν σημειώνεται', async () => {
    await seedCatalog({ seenCondition: 'open', fullPassAtMs: NOW - DAY + 1 });
    await sweep(OPEN);
    expect((await catalog()).revision).toBe(1);
  });

  it('κλειστός χώρος δεν ξαναπερνά χωρίς μετάβαση', async () => {
    await seedCatalog({ seenCondition: 'closed', fullPassAtMs: 0 });
    await sweep(CLOSED);
    expect((await catalog()).revision).toBe(1);
  });
});

describe('πέρασμα ολόκληρου του καταλόγου', () => {
  it('απλώνεται σε ρίζες μοντέλων και απλά προϊόντα, ποτέ σε υπο-μοντέλα ή ξένο χώρο', async () => {
    await seedRoots(2, 1);
    await db.collection(MODELS).doc('cpmod_sub').set({ id: 'cpmod_sub', companyId: COMPANY, isDeleted: false, parentId: 'cpmod_0000' });
    await db.collection(MODELS).doc('cpmod_x').set({ id: 'cpmod_x', companyId: 'comp-b', isDeleted: false, parentId: null });
    await seedCatalog({ revision: 2, dirty: true });
    while (await expandPublicCatalogPage(db, COMPANY));
    expect(outboxScopes().sort()).toEqual(['catalog', 'model:cpmod_0000', 'model:cpmod_0001', 'model:cprod_0000'].sort());
    expect(await catalog()).toMatchObject({ drainedRevision: 2, dirty: false });
    expect((await catalog()).pass).toBeUndefined();
  });

  it('μεγάλος κατάλογος: τμηματικά, με δρομέα, χωρίς να χαθεί ρίζα', async () => {
    await seedRoots(450);
    await seedCatalog({ revision: 2, dirty: true });
    await expect(expandPublicCatalogPage(db, COMPANY)).resolves.toBe(true);
    expect((await catalog()).pass).toMatchObject({ revision: 2, phase: 'models', afterId: 'cpmod_0199' });
    while (await expandPublicCatalogPage(db, COMPANY));
    expect(outboxScopes()).toHaveLength(451);
  });

  it('αλλαγή στη διάρκεια: το πέρασμα κλείνει στη δική του αναθεώρηση και το scope μένει βρώμικο', async () => {
    await seedRoots(1);
    await seedCatalog({ revision: 2, dirty: true });
    await expandPublicCatalogPage(db, COMPANY);
    await catalogRef().set({ revision: 3 }, { merge: true });
    while (await expandPublicCatalogPage(db, COMPANY));
    expect(await catalog()).toMatchObject({ drainedRevision: 2, revision: 3, dirty: true });
  });
});

describe('ουρά', () => {
  async function seedDirty(id: string, queuedAt: number): Promise<void> {
    const ref = publicOutboxRef(db, COMPANY, { kind: 'model', modelId: id });
    await ref.set({ companyId: COMPANY, scope: `model:${id}`, revision: 1, dirty: true, queuedAt });
  }

  it('αδειάζει τα βρώμικα μοντέλα, παλαιότερο πρώτο', async () => {
    await seedDirty('cpmod_b', 2);
    await seedDirty('cpmod_a', 1);
    await expect(sweep(OPEN)).resolves.toMatchObject({ drained: 2, failed: 0 });
    expect(drain.mock.calls.map((call) => call[2])).toEqual(['cpmod_a', 'cpmod_b']);
  });

  it('deferred και raced πάνε πίσω και μετριούνται, χωρίς δεύτερη προσπάθεια στο ίδιο πέρασμα', async () => {
    await seedDirty('cpmod_a', 1);
    await seedDirty('cpmod_b', 2);
    drain.mockResolvedValueOnce('deferred').mockResolvedValueOnce('raced');
    await expect(sweep(OPEN)).resolves.toMatchObject({ drained: 0, deferred: 1, raced: 1 });
    expect(drain).toHaveBeenCalledTimes(2);
    const ref = publicOutboxRef(db, COMPANY, { kind: 'model', modelId: 'cpmod_a' });
    expect((await ref.get()).data()?.queuedAt).not.toBe(1);
  });

  it('έγγραφο που πετά δεν σταματά τα επόμενα', async () => {
    await seedDirty('cpmod_a', 1);
    await seedDirty('cpmod_b', 2);
    drain.mockRejectedValueOnce(new Error('1 MiB'));
    await expect(sweep(OPEN)).resolves.toMatchObject({ failed: 1, drained: 1 });
  });

  it('μετά το όριο χρόνου δεν ξεκινά νέο άδειασμα', async () => {
    await seedDirty('cpmod_a', 1);
    await expect(sweepPublicCatalog(db, NOW, Date.now() - 1, depsOf(OPEN))).resolves.toMatchObject({ drained: 0 });
    expect(drain).not.toHaveBeenCalled();
  });
});
