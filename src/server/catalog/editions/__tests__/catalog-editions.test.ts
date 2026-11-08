/**
 * Άγκυρες του γραφέα και του συνόρου ανάγνωσης των δημοσιευμένων εκδόσεων (ADR-923 §5.15 Θ.1β).
 *
 * Πάνω στο κοινό `FakeFirestore` (ίδιο με τα τεστ της σχέσης προμήθειας): οι συναλλαγές, τα ερωτήματα με `orderBy` και τα
 * `in` τρέχουν πραγματικά. Ψεύτικα είναι μόνο τα σύνορα εκτός θέματος: ο κάδος (κράτηση · υπογραφή), η μνήμη της βιτρίνας, ο
 * θεατής της σχέσης (έχει δικές του άγκυρες) και η μηχανή του καταλόγου (συνταγή · ομάδα πελατών).
 */

import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PricingViewer } from '@/subapps/catalog/types/price-list';
import { EMPTY_PUBLICATION_RETENTION } from '@/subapps/catalog/types/publication';

jest.mock('server-only', () => ({}));

const fake = new (jest.requireActual('@/test-utils/fake-firestore/fake-firestore').FakeFirestore)();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fake }));

const mockAudit: { entityType: string; entityId: string }[] = [];
jest.mock('@/services/entity-audit-tracked-write', () => ({
  recordTrackedEntityWrite: jest.fn(async (write: { entityType: string; entityId: string }) => { mockAudit.push(write); }),
}));

const mockHolds = new Map<string, boolean>();
jest.mock('../../publishing/publication-bucket.server', () => ({
  publicationBucket: () => ({
    file: (path: string) => ({ setMetadata: async ({ temporaryHold }: { temporaryHold: boolean }) => { mockHolds.set(path, temporaryHold); } }),
  }),
}));

jest.mock('@/lib/storage/signed-download-url', () => ({
  signedDownloadUrl: async ({ storagePath }: { storagePath: string }) => ({ outcome: 'signed', url: `signed://${storagePath}`, expiresAt: 1 }),
}));

let mockShowcaseLive = true;
jest.mock('@/services/public-catalog/public-catalog.reader', () => ({
  readPublicSupplier: async () => (mockShowcaseLive ? { companyId: 'supplier' } : null),
  cached: (load: () => Promise<unknown>) => load(),
}));
jest.mock('../../public/public-model-revalidate.server', () => ({ revalidatePublicEditions: jest.fn() }));

const mockViewers = new Map<string, PricingViewer>();
jest.mock('../../public/showcase-viewer.server', () => ({
  showcaseViewerOf: async (_scope: unknown, source: { kind: string; buyerCompanyId?: string }) =>
    (source.kind === 'anonymous' ? { kind: 'anonymous' } : mockViewers.get(source.buyerCompanyId ?? '') ?? { kind: 'signedIn', customerGroupId: null, parties: [] }),
}));

jest.mock('../../catalog-store.server', () => ({
  runCatalogReadOnly: async (_ctx: unknown, work: (scope: unknown) => Promise<unknown>) => work({}),
  readOwned: async (_scope: unknown, _kind: string, id: string) => ({ id, title: { el: 'Θέρμανση 2026' }, language: 'el' }),
  runForeignCatalogRead: (companyId: string, work: (scope: unknown) => Promise<unknown>) =>
    fake.runTransaction((tx: unknown) => work({ db: fake, tx, ctx: { companyId }, now: new Date().toISOString() })),
}));
jest.mock('../../catalog-library-reads.server', () => ({
  readActiveByIds: async (_scope: unknown, _kind: string, ids: readonly string[]) => new Map(ids.filter((id) => id === GROUP).map((id) => [id, {}])),
}));

import { publishCatalogEdition, withdrawCatalogEdition } from '../catalog-edition-writer.server';
import { readCatalogEditionsFor, resolveLatestCatalogEdition, signCatalogEditionFile, signOwnedCatalogEditionFile } from '../catalog-edition-reads.server';

const SUPPLIER = 'supplier';
const RUN_A = 'cpubx_11111111-1111-4111-8111-111111111111';
const RUN_B = 'cpubx_22222222-2222-4222-8222-222222222222';
const RUN_PRICED = 'cpubx_33333333-3333-4333-8333-333333333333';
const GROUP = 'cgrp_a';
const ctx = { companyId: SUPPLIER, uid: 'u1' } as unknown as AuthContext;
const ANONYMOUS = { kind: 'anonymous' } as const;
const TO_GROUP = { kind: 'customerGroup', customerGroupId: GROUP } as const;

const screenPath = (runId: string) => `catalog-publications/${SUPPLIER}/${runId}/screen.pdf`;

function seedRun(id: string, patch: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.CATALOG_PUBLICATION_RUNS, id, {
    id, companyId: SUPPLIER, recipeId: 'cpubr_1', status: 'ready', priced: false, priceVersion: null, requestedBy: 'u1', inputHash: id,
    artifacts: [{ profile: 'screen', storagePath: screenPath(id), sizeBytes: 10, pageCount: 4, sha256: 'ab', renderMs: 1 }],
    retention: EMPTY_PUBLICATION_RETENTION, dispositionDueAt: null,
    ...patch,
  });
}

const runOf = (id: string) => fake.getData(COLLECTIONS.CATALOG_PUBLICATION_RUNS, id) as { retention: { publishedEditions: number }; dispositionDueAt: string | null };
const editionOf = (id: string) => fake.getData(COLLECTIONS.CATALOG_EDITIONS, id) as { status: string; supersededBy: string | null };
const issuesOf = (work: Promise<unknown>) => work.then(() => [], (cause: { readonly issues?: readonly { readonly code: string }[] }) => (cause.issues ?? []).map((issue) => issue.code));

beforeEach(() => {
  fake.reset();
  mockAudit.length = 0;
  mockHolds.clear();
  mockViewers.clear();
  mockShowcaseLive = true;
  seedRun(RUN_A);
  seedRun(RUN_B);
  seedRun(RUN_PRICED, { priced: true });
});

describe('δημοσίευση', () => {
  it('γράφει έκδοση, μετρητή +1 στην ίδια συναλλαγή, κράτηση GCS και ιστορικό', async () => {
    const edition = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    expect(editionOf(edition.id).status).toBe('published');
    expect(runOf(RUN_A).retention.publishedEditions).toBe(1);
    expect(runOf(RUN_A).dispositionDueAt).toBeNull();
    expect(mockHolds.get(screenPath(RUN_A))).toBe(true);
    expect(mockAudit.map((write) => write.entityType)).toEqual(['catalog_edition', 'catalog_publication_run']);
    expect(edition.title).toEqual({ el: 'Θέρμανση 2026' });
  });

  it('ιδεμπότητη: δεύτερη ίδια αίτηση ⇒ ίδια έκδοση, κανένας δεύτερος μετρητής', async () => {
    const first = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    const second = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    expect(second.id).toBe(first.id);
    expect(runOf(RUN_A).retention.publishedEditions).toBe(1);
  });

  it('νέα έκδοση στο ίδιο ράφι και κοινό ⇒ η παλιά γίνεται «παλαιότερη» και δείχνει στη νέα· το αρχείο της μένει', async () => {
    const old = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    const next = await publishCatalogEdition(ctx, { runId: RUN_B, audience: ANONYMOUS });
    expect(editionOf(old.id)).toMatchObject({ status: 'superseded', supersededBy: next.id });
    expect(runOf(RUN_A).retention.publishedEditions).toBe(1);
    expect(runOf(RUN_B).retention.publishedEditions).toBe(1);
  });

  it('άλλο κοινό στο ίδιο ράφι ⇒ καμία αντικατάσταση', async () => {
    const anonymous = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    await publishCatalogEdition(ctx, { runId: RUN_B, audience: TO_GROUP });
    expect(editionOf(anonymous.id).status).toBe('published');
  });

  it('🔒 Θ4: έκδοση με τιμές ⇒ άρνηση, πριν από κάθε κράτηση', async () => {
    await expect(issuesOf(publishCatalogEdition(ctx, { runId: RUN_PRICED, audience: ANONYMOUS }))).resolves.toEqual(['catalogEditionPriced']);
    expect(mockHolds.size).toBe(0);
  });

  it('🔒 ξένη ή άκυρη διαδρομή, ανύπαρκτη ομάδα ⇒ unknownReference', async () => {
    const foreign = { companyId: 'other', uid: 'u2' } as unknown as AuthContext;
    await expect(issuesOf(publishCatalogEdition(foreign, { runId: RUN_A, audience: ANONYMOUS }))).resolves.toEqual(['unknownReference']);
    await expect(issuesOf(publishCatalogEdition(ctx, { runId: 'a/b', audience: ANONYMOUS }))).resolves.toEqual(['unknownReference']);
    const noGroup = { kind: 'customerGroup', customerGroupId: 'cgrp_missing' } as const;
    await expect(issuesOf(publishCatalogEdition(ctx, { runId: RUN_A, audience: noGroup }))).resolves.toEqual(['unknownReference']);
  });

  it('🔒 αγώνας με τη σάρωση: προθεσμία διάθεσης ήδη ληγμένη ⇒ άρνηση', async () => {
    seedRun(RUN_A, { dispositionDueAt: '2000-01-01T00:00:00.000Z' });
    await expect(issuesOf(publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS }))).resolves.toEqual(['catalogEditionDisposalDue']);
  });
});

describe('απόσυρση', () => {
  it('της ισχύουσας ⇒ ο προκάτοχος ξαναγίνεται ισχύων· μετρητής −1· η κράτηση φεύγει μόνο χωρίς άλλο λόγο', async () => {
    const old = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    const next = await publishCatalogEdition(ctx, { runId: RUN_B, audience: ANONYMOUS });
    await withdrawCatalogEdition(ctx, next.id);
    expect(editionOf(next.id).status).toBe('withdrawn');
    expect(editionOf(old.id)).toMatchObject({ status: 'published', supersededBy: null });
    expect(runOf(RUN_B).retention.publishedEditions).toBe(0);
    expect(mockHolds.get(screenPath(RUN_B))).toBe(false);
    expect(mockHolds.get(screenPath(RUN_A))).toBe(true);
  });

  it('ιδεμπότητη, και ξένη ≡ ανύπαρκτη', async () => {
    const edition = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    await withdrawCatalogEdition(ctx, edition.id);
    await withdrawCatalogEdition(ctx, edition.id);
    expect(runOf(RUN_A).retention.publishedEditions).toBe(0);
    const foreign = { companyId: 'other', uid: 'u2' } as unknown as AuthContext;
    await expect(issuesOf(withdrawCatalogEdition(foreign, edition.id))).resolves.toEqual(['unknownReference']);
  });
});

describe('σύνορο ανάγνωσης', () => {
  async function shelfOfThree() {
    const anonymous = await publishCatalogEdition(ctx, { runId: RUN_A, audience: ANONYMOUS });
    const group = await publishCatalogEdition(ctx, { runId: RUN_B, audience: TO_GROUP });
    return { anonymous, group };
  }

  it('ο ανώνυμος βλέπει μόνο ανώνυμα· ο αγοραστής της ομάδας και τα δύο', async () => {
    const { anonymous, group } = await shelfOfThree();
    mockViewers.set('buyer', { kind: 'signedIn', customerGroupId: GROUP, parties: [] });
    expect((await readCatalogEditionsFor(SUPPLIER, { kind: 'anonymous' })).map((view) => view.id)).toEqual([anonymous.id]);
    const buyerIds = (await readCatalogEditionsFor(SUPPLIER, { kind: 'buyer', buyerCompanyId: 'buyer' })).map((view) => view.id);
    expect(buyerIds.sort()).toEqual([anonymous.id, group.id].sort());
  });

  it('🔒 ανακλημένη βιτρίνα ⇒ κανένα ανώνυμο έντυπο για κανέναν· της ομάδας μένει', async () => {
    const { group } = await shelfOfThree();
    mockShowcaseLive = false;
    mockViewers.set('buyer', { kind: 'signedIn', customerGroupId: GROUP, parties: [] });
    expect(await readCatalogEditionsFor(SUPPLIER, { kind: 'anonymous' })).toEqual([]);
    expect((await readCatalogEditionsFor(SUPPLIER, { kind: 'buyer', buyerCompanyId: 'buyer' })).map((view) => view.id)).toEqual([group.id]);
  });

  it('🔒 η άδεια μόνο μετά την κρίση: κρυφό, αποσυρμένο, άκυρο id ⇒ null', async () => {
    const { anonymous, group } = await shelfOfThree();
    expect(await signCatalogEditionFile(SUPPLIER, { kind: 'anonymous' }, anonymous.id)).toEqual({ url: `signed://${screenPath(RUN_A)}`, expiresAt: 1 });
    expect(await signCatalogEditionFile(SUPPLIER, { kind: 'anonymous' }, group.id)).toBeNull();
    expect(await signCatalogEditionFile(SUPPLIER, { kind: 'anonymous' }, 'not-an-id')).toBeNull();
    expect(await signCatalogEditionFile('other', { kind: 'anonymous' }, anonymous.id)).toBeNull();
    await withdrawCatalogEdition(ctx, anonymous.id);
    expect(await signCatalogEditionFile(SUPPLIER, { kind: 'anonymous' }, anonymous.id)).toBeNull();
  });

  it('το ισχύον του ραφιού: ο αγοραστής παίρνει το πιο ειδικό κοινό, ο ανώνυμος το δικό του', async () => {
    const { anonymous, group } = await shelfOfThree();
    mockViewers.set('buyer', { kind: 'signedIn', customerGroupId: GROUP, parties: [] });
    expect(await resolveLatestCatalogEdition(SUPPLIER, { kind: 'anonymous' }, 'cpubr_1')).toBe(anonymous.id);
    expect(await resolveLatestCatalogEdition(SUPPLIER, { kind: 'buyer', buyerCompanyId: 'buyer' }, 'cpubr_1')).toBe(group.id);
  });

  it('η λίστα σημαδεύει το ισχύον με τον ΙΔΙΟ κριτή με τον σταθερό σύνδεσμο (§5.15.3)', async () => {
    const { anonymous, group } = await shelfOfThree();
    mockViewers.set('buyer', { kind: 'signedIn', customerGroupId: GROUP, parties: [] });
    const currentOf = async (source: Parameters<typeof readCatalogEditionsFor>[1]) =>
      (await readCatalogEditionsFor(SUPPLIER, source)).filter((view) => view.current).map((view) => view.id);
    expect(await currentOf({ kind: 'anonymous' })).toEqual([anonymous.id]);
    expect(await currentOf({ kind: 'buyer', buyerCompanyId: 'buyer' })).toEqual([group.id]);
    expect((await readCatalogEditionsFor(SUPPLIER, { kind: 'anonymous' }))[0]?.shelfKey).toBe('cpubr_1');
  });

  it('🔒 πόρτα ιδιοκτήτη: μόνο ο δικός του χώρος, όχι αποσυρμένη, όχι άκυρο id (§5.15.3)', async () => {
    const { anonymous, group } = await shelfOfThree();
    expect(await signOwnedCatalogEditionFile(ctx, group.id)).toEqual({ url: `signed://${screenPath(RUN_B)}`, expiresAt: 1 });
    const stranger = { companyId: 'other', uid: 'u9' } as unknown as AuthContext;
    expect(await signOwnedCatalogEditionFile(stranger, anonymous.id)).toBeNull();
    expect(await signOwnedCatalogEditionFile(ctx, 'not-an-id')).toBeNull();
    await withdrawCatalogEdition(ctx, anonymous.id);
    expect(await signOwnedCatalogEditionFile(ctx, anonymous.id)).toBeNull();
  });
});
