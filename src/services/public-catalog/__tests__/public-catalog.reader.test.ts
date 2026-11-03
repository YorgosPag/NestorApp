/**
 * Ο αναγνώστης της δημόσιας βιτρίνας (ADR-923 §5.13 Δ4, σχέδιο §4.5).
 *
 * 🔑 Η μνήμη εδώ είναι **δουλεύουσα**: κρατά ανά κλειδί και ο `revalidateTag` σβήνει ό,τι φέρει το tag. Έτσι η άγκυρα της
 *    ανάκλησης περνά από τον αληθινό γραφέα και τον αληθινό αναγνώστη. Το jest δεν αποδεικνύει καθαρισμό ISR· αυτό θέλει
 *    ζωντανή δοκιμή. Το ΑΦΜ είναι συνθετικό.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { CompanyTaxDeclarationRead } from '@/services/company/company-legal-identity';
import { decideSupplierVerification, requestSupplierReview, revokeSupplierVerification, type SupplierReviewDeps } from '@/server/catalog/supplier-review.server';
import { publishSupplierShowcase, refreshSupplierShowcaseStanding } from '@/server/catalog/supplier-showcase.server';
import { PUBLIC_CATALOG_SCHEMA_VERSION } from '@/subapps/catalog/public/public-catalog-schema';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { RegistryIdentityReport } from '@/types/company-registry';
import { revalidatePublicCompany, revalidatePublicModel } from '@/server/catalog/public/public-model-revalidate.server';
import { NO_PROVIDER_FACTS } from '@/subapps/catalog/public/public-provider-facts';
import { PUBLIC_MODEL_PAGE_SIZE, readPublicCategoryIndex, readPublicModel, readPublicModelPage, readPublicModelTarget, readPublicProviderFacts, readPublicSitemapPaths, readPublicSupplier, readPublicSupplierBrands, readPublicSupplierProfile } from '../public-catalog.reader';

interface CacheEntry {
  readonly value: unknown;
  readonly tags: readonly string[];
}

const cacheEntries = new Map<string, CacheEntry>();

jest.mock('next/cache', () => ({
  unstable_cache: (load: () => Promise<unknown>, key: readonly string[], options: { readonly tags: readonly string[] }) => async () => {
    const id = key.join('|');
    const hit = cacheEntries.get(id);
    if (hit) return hit.value;
    const value = await load();
    cacheEntries.set(id, { value, tags: options.tags });
    return value;
  },
  revalidateTag: (tag: string) => {
    [...cacheEntries].filter(([, entry]) => entry.tags.includes(tag)).forEach(([id]) => cacheEntries.delete(id));
  },
}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: async () => 'audit-id' } }));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => db, isFirebaseAdminAvailable: () => true }));

const lookupProfile = jest.fn();
const hierarchy = jest.fn();
jest.mock('@/services/mandate/agency-profile.service', () => ({ lookupAgencyProfile: (...args: unknown[]) => lookupProfile(...args) }));
jest.mock('@/services/places/administrative-hierarchy.reader', () => ({ readAdminIdentitySources: () => hierarchy() }));

const COMPANY = 'comp-a';
const OTHER = 'comp-b';
const MODEL = 'cpmod_1';
const MODELS = 'public_catalog_models';
const SHOWCASES = 'public_supplier_showcases';
const T0 = '2026-11-01T10:00:00.000Z';

let fake: FakeFirestore;
let db: Firestore;

const PROFILE: CompanyTaxDeclarationRead = {
  kind: 'present',
  declaration: { entityType: null, businessName: 'ΑΛΦΑ ΑΕ', gemiNumber: '123456789000' },
  taxId: '123456783',
};

function depsWith(overrides: Partial<SupplierReviewDeps> = {}): SupplierReviewDeps {
  return {
    readProfile: async () => PROFILE,
    readReport: async () => ({
      kind: 'report',
      report: { judgment: { state: 'declared', gap: 'not-checked', check: null } } as unknown as RegistryIdentityReport,
    }),
    registryConfigured: () => false,
    fingerprint: () => 'fp-a',
    ...overrides,
  };
}

const modelDoc = (modelId: string, companyId = COMPANY, categoryIds: readonly string[] = []) => ({
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION,
  companyId,
  modelId,
  kind: 'product',
  code: modelId.toUpperCase(),
  familyId: 'fam',
  familyLabels: { el: 'Οικογένεια' },
  listingKind: 'product',
  categoryIds,
  categoryLabels: Object.fromEntries(categoryIds.map((id) => [id, { el: `Κατηγορία ${id}` }])),
  locales: ['el'],
  attributes: [],
  media: [],
  variants: [{ variantId: 'v', code: 'A', label: 'Προϊόν', attributes: [], media: [] }],
});

const publishedShowcase = (companyId = COMPANY) => ({ companyId, legalName: 'ΑΛΦΑ ΑΕ', basis: 'manual-review', publishedAt: T0, updatedAt: T0 });
const page = (categoryId: string | null = null, after: string | null = null) => readPublicModelPage(COMPANY, { categoryId, after });

async function approveAndPublish(): Promise<void> {
  fake.seed('files', 'file-1', { companyId: COMPANY, entityType: 'supplier_verification', entityId: COMPANY, status: 'ready', storagePath: 'x/y.pdf', contentType: 'application/pdf' });
  await requestSupplierReview(db, { companyId: COMPANY, actorUid: 'user-1', evidenceFileId: 'file-1', nowIso: T0 }, depsWith());
  await decideSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-1', decision: 'approve', note: null, nowIso: T0 }, depsWith());
  await publishSupplierShowcase(db, COMPANY, 'user-1', depsWith());
}

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  cacheEntries.clear();
  lookupProfile.mockReset();
  hierarchy.mockReset();
  hierarchy.mockResolvedValue({ placeOf: (id: string) => (id === 'municipality:1' ? { name: 'ΔΗΜΟΣ ΘΕΡΜΗΣ' } : undefined) });
});

describe('το προφίλ του παρόχου (§22 Υ8)', () => {
  const COVERED = { coverage: { adminIds: ['municipality:1'] }, website: 'https://aries.gr', mark: null };

  it('🔒 πίσω από την ίδια πύλη: χωρίς βιτρίνα προμηθευτή ούτε καν ανάγνωση του προφίλ', async () => {
    lookupProfile.mockResolvedValue({ outcome: 'found', showcase: COVERED });
    await expect(readPublicProviderFacts(COMPANY)).resolves.toEqual(NO_PROVIDER_FACTS);
    expect(lookupProfile).not.toHaveBeenCalled();
  });

  it('με βιτρίνα: η περιοχή παίρνει όνομα από την ιεραρχία', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    lookupProfile.mockResolvedValue({ outcome: 'found', showcase: COVERED });
    await expect(readPublicProviderFacts(COMPANY)).resolves.toEqual({ logo: null, website: 'https://aries.gr', area: { kind: 'areas', names: ['ΔΗΜΟΣ ΘΕΡΜΗΣ'] } });
  });

  it('χωρίς προφίλ επαγγελματία: η σελίδα μένει ανοιχτή, χωρίς στοιχεία', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    lookupProfile.mockResolvedValue({ outcome: 'not-published' });
    await expect(readPublicProviderFacts(COMPANY)).resolves.toEqual(NO_PROVIDER_FACTS);
  });

  it('🔑 βλάβη προφίλ ή ιεραρχίας ρίχνει και δεν μπαίνει στη μνήμη: άγνωστο ≠ κενό', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    lookupProfile.mockResolvedValue({ outcome: 'unavailable' });
    await expect(readPublicProviderFacts(COMPANY)).rejects.toThrow();
    lookupProfile.mockResolvedValue({ outcome: 'found', showcase: COVERED });
    hierarchy.mockResolvedValueOnce(null);
    await expect(readPublicProviderFacts(COMPANY)).rejects.toThrow();
    await expect(readPublicProviderFacts(COMPANY)).resolves.toMatchObject({ website: 'https://aries.gr' });
  });

  it('το tag του χώρου αδειάζει το προφίλ από τη μνήμη', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    lookupProfile.mockResolvedValue({ outcome: 'found', showcase: COVERED });
    await readPublicProviderFacts(COMPANY);
    lookupProfile.mockResolvedValue({ outcome: 'not-published' });
    revalidatePublicCompany(COMPANY);
    await expect(readPublicProviderFacts(COMPANY)).resolves.toEqual(NO_PROVIDER_FACTS);
  });
});

describe('μάρκες (§16)', () => {
  const grant = (validUntil: string) => ({ relation: 'manufacturer', validUntil, grantedAt: T0, grantedBy: 'a' });
  const claim = (id: string, validUntil: string) => ({ id, companyId: COMPANY, brandName: id, relation: 'manufacturer', status: 'approved', grant: grant(validUntil) });

  it('🔒 πίσω από την πύλη · μόνο σε ισχύ · το tag τις αδειάζει', async () => {
    fake.seed('supplier_brand_claims', 'b1', claim('Toshiba', '2999-01-01T00:00:00.000Z'));
    fake.seed('supplier_brand_claims', 'b2', claim('Παλιά', '2001-01-01T00:00:00.000Z'));
    await expect(readPublicSupplierBrands(COMPANY)).resolves.toEqual([]);
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    revalidatePublicCompany(COMPANY);
    await expect(readPublicSupplierBrands(COMPANY)).resolves.toEqual([{ brandName: 'Toshiba', relation: 'manufacturer' }]);
    fake.seed('supplier_brand_claims', 'b1', claim('Toshiba', '2001-01-01T00:00:00.000Z'));
    await expect(readPublicSupplierBrands(COMPANY)).resolves.toHaveLength(1);
    revalidatePublicCompany(COMPANY);
    await expect(readPublicSupplierBrands(COMPANY)).resolves.toEqual([]);
  });
});

describe('περιγραφή και portfolio (§22 Υ8)', () => {
  const PROFILES = 'public_supplier_profiles';
  const PROFILE_DOC = { schemaVersion: 1, companyId: COMPANY, description: { el: 'Κείμενο' }, projects: [] };

  it('🔒 πίσω από την πύλη: έγγραφο χωρίς βιτρίνα δεν βγαίνει', async () => {
    fake.seed(PROFILES, COMPANY, PROFILE_DOC);
    await expect(readPublicSupplierProfile(COMPANY)).resolves.toBeNull();
  });

  it('με βιτρίνα βγαίνει · χαλασμένο έγγραφο δίνει `null` · το tag το αδειάζει', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed(PROFILES, COMPANY, PROFILE_DOC);
    // Έγγραφο έκδοσης 1, γραμμένο πριν από το Ε6β (§5.13): ανοίγει, ως «δεν δέχεται αιτήματα».
    await expect(readPublicSupplierProfile(COMPANY)).resolves.toMatchObject({ description: { el: 'Κείμενο' }, acceptsQuoteRequests: false });
    fake.seed(PROFILES, COMPANY, { ...PROFILE_DOC, taxId: '1' });
    revalidatePublicCompany(COMPANY);
    await expect(readPublicSupplierProfile(COMPANY)).resolves.toBeNull();
  });
});

describe('🔒 η πύλη προηγείται του περιεχομένου', () => {
  beforeEach(() => fake.seed(MODELS, MODEL, modelDoc(MODEL, COMPANY, ['cat_1'])));

  it('χωρίς βιτρίνα δεν βγαίνει τίποτα, ακόμη κι αν τα έγγραφα υπάρχουν', async () => {
    await expect(readPublicSupplier(COMPANY)).resolves.toBeNull();
    await expect(readPublicModel(COMPANY, MODEL)).resolves.toBeNull();
    await expect(page()).resolves.toEqual({ cards: [], nextAfter: null });
    await expect(readPublicCategoryIndex(COMPANY)).resolves.toEqual({});
  });

  it('χαλασμένη βιτρίνα κλείνει τη σελίδα', async () => {
    fake.seed(SHOWCASES, COMPANY, { companyId: COMPANY, legalName: 'ΑΛΦΑ ΑΕ', taxId: '123456783' });
    await expect(readPublicSupplier(COMPANY)).resolves.toBeNull();
  });

  it('🔒 πλήρης βιτρίνα με πεδίο που δεν δηλώνεται κλείνει τη σελίδα: το σχήμα είναι κλειστό', async () => {
    fake.seed(SHOWCASES, COMPANY, { ...publishedShowcase(), taxId: '123456783' });
    await expect(readPublicSupplier(COMPANY)).resolves.toBeNull();
  });

  it('βιτρίνα ξένου χώρου δεν ισχύει', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase(OTHER));
    await expect(readPublicSupplier(COMPANY)).resolves.toBeNull();
  });

  it('με βιτρίνα ⇒ προμηθευτής, μοντέλο, κάρτα, κατηγορία', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    await expect(readPublicSupplier(COMPANY)).resolves.toMatchObject({ legalName: 'ΑΛΦΑ ΑΕ' });
    await expect(readPublicModel(COMPANY, MODEL)).resolves.toMatchObject({ modelId: MODEL });
    await expect(page()).resolves.toMatchObject({ cards: [{ modelId: MODEL, title: 'Προϊόν' }], nextAfter: null });
    await expect(readPublicCategoryIndex(COMPANY)).resolves.toEqual({ cat_1: { el: 'Κατηγορία cat_1' } });
  });

  it('το ψευδώνυμο έρχεται από τον χώρο, όχι από τη βιτρίνα', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed('companies', COMPANY, { alias: 'aries' });
    await expect(readPublicSupplier(COMPANY)).resolves.toMatchObject({ alias: 'aries' });
    expect(fake.getAllDocs(SHOWCASES)[COMPANY]).not.toHaveProperty('alias');
  });

  it('χώρος χωρίς ψευδώνυμο ⇒ `null`, και η σελίδα μένει στην ταυτότητα', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    await expect(readPublicSupplier(COMPANY)).resolves.toMatchObject({ alias: null });
  });

  it('🔒 μοντέλο άλλου χώρου απαντά όπως το ανύπαρκτο', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed(MODELS, 'cpmod_x', modelDoc('cpmod_x', OTHER));
    await expect(readPublicModel(COMPANY, 'cpmod_x')).resolves.toBeNull();
    await expect(page()).resolves.toMatchObject({ cards: [{ modelId: MODEL }] });
  });

  it('χαλασμένο έγγραφο μοντέλου λείπει από τη λίστα και απαντά null', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed(MODELS, 'cpmod_bad', { companyId: COMPANY, modelId: 'cpmod_bad', price: '10.00' });
    await expect(readPublicModel(COMPANY, 'cpmod_bad')).resolves.toBeNull();
    await expect(page()).resolves.toMatchObject({ cards: [{ modelId: MODEL }] });
  });
});

describe('στόχος του QR', () => {
  beforeEach(() => fake.seed(MODELS, MODEL, modelDoc(MODEL)));

  it('🔒 χωρίς βιτρίνα δεν βγαίνει διεύθυνση', async () => {
    await expect(readPublicModelTarget(MODEL)).resolves.toBeNull();
  });

  it('ανύπαρκτο μοντέλο ⇒ null', async () => {
    await expect(readPublicModelTarget('cpmod_none')).resolves.toBeNull();
  });

  it('χωρίς ψευδώνυμο ⇒ ταυτότητα · με ψευδώνυμο ⇒ το ψευδώνυμο', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    await expect(readPublicModelTarget(MODEL)).resolves.toBe(`/suppliers/${COMPANY}/p/proion-${MODEL}`);
    cacheEntries.clear();
    fake.seed('companies', COMPANY, { alias: 'aries' });
    await expect(readPublicModelTarget(MODEL)).resolves.toBe(`/suppliers/aries/p/proion-${MODEL}`);
  });

  it('🔴 το tag του μοντέλου κλείνει το QR μαζί με τη σελίδα', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    await readPublicModelTarget(MODEL);
    await fake.collection(MODELS).doc(MODEL).delete();
    revalidatePublicModel(COMPANY, MODEL);
    await expect(readPublicModelTarget(MODEL)).resolves.toBeNull();
  });
});

describe('sitemap', () => {
  it('🔒 μόνο βιτρίνες που δημοσιεύτηκαν: μοντέλο χωρίς βιτρίνα δεν μπαίνει', async () => {
    fake.seed(MODELS, MODEL, modelDoc(MODEL));
    await expect(readPublicSitemapPaths()).resolves.toEqual([]);
  });

  it('χαλασμένη βιτρίνα και χαλασμένο μοντέλο μένουν έξω', async () => {
    fake.seed(SHOWCASES, COMPANY, { companyId: COMPANY, legalName: 'ΑΛΦΑ ΑΕ' });
    fake.seed(MODELS, MODEL, modelDoc(MODEL));
    await expect(readPublicSitemapPaths()).resolves.toEqual([]);
    cacheEntries.clear();
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed(MODELS, MODEL, { companyId: COMPANY, price: '10.00' });
    await expect(readPublicSitemapPaths()).resolves.toEqual([`/suppliers/${COMPANY}`]);
  });

  it('προμηθευτής, κατηγορία και μοντέλο, κάτω από το ψευδώνυμο', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed('companies', COMPANY, { alias: 'aries' });
    fake.seed(MODELS, MODEL, modelDoc(MODEL, COMPANY, ['cat_1']));
    await expect(readPublicSitemapPaths()).resolves.toEqual([
      '/suppliers/aries',
      '/suppliers/aries/c/katigoria-cat-1-cat_1',
      '/suppliers/aries/p/proion-cpmod_1',
    ]);
  });

  it('χωρίς ψευδώνυμο ⇒ η ταυτότητα · μοντέλο ξένου χώρου δεν μπαίνει', async () => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    fake.seed(MODELS, 'cpmod_x', modelDoc('cpmod_x', OTHER));
    await expect(readPublicSitemapPaths()).resolves.toEqual([`/suppliers/${COMPANY}`]);
  });

  it('🔑 βλάβη ρίχνει: ποτέ κενό sitemap', async () => {
    db = { collection: () => { throw new Error('5xx'); } } as unknown as Firestore;
    await expect(readPublicSitemapPaths()).rejects.toThrow('5xx');
  });
});

describe('σελιδοποίηση', () => {
  const idOf = (index: number) => `cpmod_${String(index).padStart(3, '0')}`;

  beforeEach(() => {
    fake.seed(SHOWCASES, COMPANY, publishedShowcase());
    for (let index = 0; index <= PUBLIC_MODEL_PAGE_SIZE; index += 1) {
      fake.seed(MODELS, idOf(index), modelDoc(idOf(index), COMPANY, index === 0 ? ['cat_1'] : []));
    }
  });

  it('ο δρομέας φέρνει το υπόλοιπο, χωρίς επικάλυψη', async () => {
    const first = await page();
    expect(first.cards).toHaveLength(PUBLIC_MODEL_PAGE_SIZE);
    expect(first.nextAfter).toBe(idOf(PUBLIC_MODEL_PAGE_SIZE - 1));
    const second = await page(null, first.nextAfter);
    expect(second.cards.map((card) => card.modelId)).toEqual([idOf(PUBLIC_MODEL_PAGE_SIZE)]);
    expect(second.nextAfter).toBeNull();
  });

  it('η κατηγορία φιλτράρει', async () => {
    await expect(page('cat_1')).resolves.toMatchObject({ cards: [{ modelId: idOf(0) }], nextAfter: null });
  });

  it('η κατηγορία έχει δικό της κλειδί μνήμης', async () => {
    await page();
    expect((await page('cat_1')).cards).toHaveLength(1);
  });
});

describe('🔴 §4.5: η ανάκληση κλείνει αμέσως τη σελίδα, με αληθινό γραφέα και αναγνώστη', () => {
  const revoke = () => revokeSupplierVerification(db, { companyId: COMPANY, reviewerUid: 'admin-2', note: null, nowIso: T0 });
  const withdraw = () => refreshSupplierShowcaseStanding(db, COMPANY, 'admin-2', depsWith());

  beforeEach(async () => {
    await approveAndPublish();
    fake.seed(MODELS, MODEL, modelDoc(MODEL));
    await readPublicSupplier(COMPANY);
    await readPublicModel(COMPANY, MODEL);
    await page();
  });

  it('η σελίδα έχει μπει στη μνήμη πριν από την ανάκληση', () => {
    expect(cacheEntries.size).toBe(3);
  });

  it('ανάκληση και απόσυρση: η βιτρίνα δεν επιζεί, και ούτε η μνήμη', async () => {
    await revoke();
    await expect(withdraw()).resolves.toBe('withdrawn');
    expect(fake.getAllDocs(SHOWCASES)[COMPANY]).toBeUndefined();
    await expect(readPublicSupplier(COMPANY)).resolves.toBeNull();
    await expect(readPublicModel(COMPANY, MODEL)).resolves.toBeNull();
    await expect(page()).resolves.toEqual({ cards: [], nextAfter: null });
  });

  it('🔑 άνοιγμα ανάμεσα σε ανάκληση και απόσυρση δεν αφήνει τη σελίδα ζωντανή', async () => {
    await revoke();
    await expect(readPublicSupplier(COMPANY)).resolves.not.toBeNull();
    await withdraw();
    await expect(readPublicSupplier(COMPANY)).resolves.toBeNull();
  });

  it('το tag του χώρου αδειάζει και το μοντέλο από τη μνήμη', async () => {
    await revoke();
    await withdraw();
    expect(cacheEntries.size).toBe(0);
  });

  it('αποτυχία του αναγνώστη δεν μπαίνει στη μνήμη: η επόμενη ανάγνωση ξαναρωτά', async () => {
    cacheEntries.clear();
    const realDb = db;
    db = { collection: () => { throw new Error('5xx'); } } as unknown as Firestore;
    await expect(readPublicSupplier(COMPANY)).rejects.toThrow('5xx');
    db = realDb;
    await expect(readPublicSupplier(COMPANY)).resolves.not.toBeNull();
  });
});
