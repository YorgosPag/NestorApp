/**
 * @jest-environment node
 *
 * @fileoverview 🌙 **Η ΒΡΑΔΙΝΗ ΣΥΜΦΙΛΙΩΣΗ ΤΩΝ ΜΕΣΩΝ** — ADR-845 §7.17 Α5 (κλάση Ο-35).
 * @related services/listings/listing-media-reconciliation.service.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: η συμφιλίωση **συγκρίνει** αντί να ξαναψήνει. Αν ξαναπροβάλλει ό,τι συμφωνεί,
 * είναι δεύτερη επανασύνθεση κάθε βράδυ· αν **δεν** ξαναπροβάλλει ό,τι διαφέρει, δεν είναι δίχτυ.
 *
 * ⚠️ Το αποτύπωμα (κανονική μορφή + SHA-256) και η κρίση συμφωνίας **ΔΕΝ** γίνονται mock. Mock
 * μόνο οι γείτονες που έχουν δικές τους άγκυρες: ο ΕΝΑΣ γραφέας, ο αναγνώστης των αρχείων, το
 * κριτήριο δημοσίευσης.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('../publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
}));

/** Τι θα έφευγε ΤΩΡΑ, ανά ακίνητο — ο ρόλος του αναγνώστη αρχείων. */
const currentMedia = new Map<string, unknown[]>();
jest.mock('../agency-media.reader', () => ({
  createAgencyMediaResolver: () => async (propertyId: string) => currentMedia.get(propertyId) ?? [],
}));

jest.mock('../agency-media-publication', () => ({ agencyMediaDeclaration: () => ({}) }));
jest.mock('../public-listing-projection', () => ({
  isPubliclyListed: (property: { listed?: boolean }): boolean => property.listed === true,
}));
jest.mock('@/services/company/company-public-name.reader', () => ({
  createAgencyIdentityResolver: () => async () => null,
}));

// 🏠 ADR-920 §14.11 Ζ3c — η οικογένεια του ιδιοκτήτη: ο γραφέας της και ο δρόμος «τι θα δημοσίευε τώρα» έχουν δικές τους
//    άγκυρες· εδώ κρίνεται ΜΟΝΟ ότι η συμφιλίωση τους ρωτά και ξαναπροβάλλει με τον ΣΩΣΤΟ γραφέα.
const ownerMedia = new Map<string, unknown[] | 'unreadable'>();
const republishOwnerProperty = jest.fn(async (..._args: unknown[]) => ({ publish: 'published', property: {} }));
jest.mock('@/services/owner-property/owner-property-publication.service', () => ({
  currentOwnerListingProjection: async (_db: unknown, property: { id: string }) => {
    const media = ownerMedia.get(property.id);
    if (media === 'unreadable') throw new Error('dossier read failed');
    return { publishedMedia: media ?? [] };
  },
  republishOwnerProperty: (...args: unknown[]) => republishOwnerProperty(...args),
}));
jest.mock('@/lib/owner-property/owner-property-from-document', () => ({
  ownerPropertyFromDocument: (raw: unknown, id: string) => (raw === undefined ? null : { ...(raw as object), id }),
}));
jest.mock('@/lib/owner-property/owner-property-projection', () => ({
  projectableFromOwnerProperty: (property: unknown) => property,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcileListingMedia, judgeListingMedia } = require('../listing-media-reconciliation.service') as
  typeof import('../listing-media-reconciliation.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mediaFingerprintOf } = require('../listing-media-fingerprint-stamp') as
  typeof import('../listing-media-fingerprint-stamp');

type Sources = Parameters<typeof mediaFingerprintOf>[0];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LISTING_RECIPE_BACKFILL_PER_RUN } = require('@/lib/listings/listing-recipe-backfill') as
  typeof import('@/lib/listings/listing-recipe-backfill');

let fake: FakeFirestore;

function source(id: string): unknown {
  return { privateStoragePath: `companies/c/${id}.jpg`, material: { kind: 'photo' }, sourceFileId: id, focalPoint: null };
}

/** Ακίνητο δημοσιευμένο, με αγγελία γραμμένη για `published` και τρέχον υλικό `now`. */
function seedListed(propertyId: string, published: unknown[] | 'unstamped' | 'no-listing', now: unknown[]): void {
  fake.seed(COLLECTIONS.PROPERTIES, propertyId, { companyId: 'c_alpha', listed: true });
  currentMedia.set(propertyId, now);
  if (published === 'no-listing') return;
  fake.seed(COLLECTIONS.PUBLIC_LISTINGS, propertyId, {
    id: propertyId,
    ...(published === 'unstamped' ? {} : { mediaFingerprint: mediaFingerprintOf(published as Sources) }),
  });
}

function run() {
  return reconcileListingMedia(fake as unknown as AdminFirestore);
}

function republishedIds(): unknown[] {
  return republishListing.mock.calls.map((args) => args[1]);
}

/** Αγγελία ΙΔΙΟΚΤΗΤΗ δημοσιευμένη, με αγγελία γραμμένη για `published` και τρέχον υλικό `now` (ή φάκελο που δεν διαβάζεται). */
function seedOwnerListed(propertyId: string, published: unknown[] | 'no-listing', now: unknown[] | 'unreadable'): void {
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, propertyId, { listed: true });
  ownerMedia.set(propertyId, now);
  if (published === 'no-listing') return;
  fake.seed(COLLECTIONS.PUBLIC_LISTINGS, propertyId, { id: propertyId, mediaFingerprint: mediaFingerprintOf(published as Sources) });
}

const ownerRepublishedIds = (): unknown[] => republishOwnerProperty.mock.calls.map((args) => (args[1] as { id: string }).id);

beforeEach(() => {
  jest.clearAllMocks();
  currentMedia.clear();
  ownerMedia.clear();
  fake = new FakeFirestore();
});

describe('ADR-845 §7.17 Α5 — η συμφιλίωση ΣΥΓΚΡΙΝΕΙ, δεν ξαναψήνει', () => {
  it('🏆 Σ1 — ό,τι συμφωνεί ΔΕΝ ξαναπροβάλλεται: καμία γραφή', async () => {
    seedListed('prop_ok', [source('a'), source('b')], [source('a'), source('b')]);

    const report = await run();

    expect(report).toMatchObject({ scanned: 1, listed: 1, agreed: 1, drifted: 0, republished: 0 });
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🔴 Σ2 — ΠΟΡΤΑ ΠΟΥ ΞΕΦΥΓΕ: το υλικό άλλαξε, η αγγελία όχι ⇒ μετριέται και ξαναπροβάλλεται ΜΟΝΟ αυτή', async () => {
    seedListed('prop_ok', [source('a')], [source('a')]);
    seedListed('prop_drift', [source('a'), source('b')], [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ listed: 2, agreed: 1, drifted: 1, republished: 1, failed: 0 });
    expect(republishedIds()).toEqual(['prop_drift']);
  });

  it('Σ3 — αγγελία ΧΩΡΙΣ αποτύπωμα ⇒ «δεν ξέρω»: ξαναπροβάλλεται, αλλά ΔΕΝ μετριέται ως απόκλιση', async () => {
    seedListed('prop_old', 'unstamped', [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ unstamped: 1, drifted: 0, republished: 1 });
  });

  it('🔴 Σ4 — δημοσιεύσιμο ακίνητο ΧΩΡΙΣ αγγελία ⇒ `missing`, και ξαναπροβάλλεται', async () => {
    seedListed('prop_lost', 'no-listing', [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ missing: 1, drifted: 0, republished: 1 });
    expect(republishedIds()).toEqual(['prop_lost']);
  });

  it('Σ5 — ακίνητο που ΔΕΝ είναι δημοσιευμένο δεν κρίνεται καν (ούτε ανάγνωση αρχείων)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_draft', { companyId: 'c_alpha', listed: false });

    const report = await run();

    expect(report).toMatchObject({ scanned: 1, listed: 0, agreed: 0, republished: 0 });
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Σ6 — η επαναπροβολή που ΑΠΟΤΥΧΕ μετριέται ως αποτυχία, όχι ως διόρθωση', async () => {
    seedListed('prop_drift', [source('a')], [source('b')]);
    republishListing.mockResolvedValueOnce('failed');

    const report = await run();

    expect(report).toMatchObject({ drifted: 1, republished: 0, failed: 1 });
  });
});

describe('ADR-920 §14.9 Γ — η ΣΥΝΤΑΓΗ στο αποτύπωμα: ξαναψήσιμο με ρυθμό, χωρίς ψευδή συναγερμό', () => {
  /** Το αποτύπωμα όπως θα ήταν γραμμένο ΠΡΙΝ από το v3: ίδιο μέρος πηγών, χωρίς συνταγές. */
  function legacyStamp(sources: unknown[]): string {
    return `v2:${mediaFingerprintOf(sources as Sources).split(':')[1]}`;
  }

  /** Αγγελία σωστή στο υλικό, ψημένη με ΑΛΛΗ συνταγή (π.χ. πριν από νέα αναθεώρηση builder). */
  function seedRecipeOutdated(propertyId: string, sources: unknown[], form: 'v2' | 'v3' = 'v3'): void {
    fake.seed(COLLECTIONS.PROPERTIES, propertyId, { companyId: 'c_alpha', listed: true });
    currentMedia.set(propertyId, sources);
    const [, sourcesHex] = mediaFingerprintOf(sources as Sources).split(':');
    const stamp = form === 'v2' ? legacyStamp(sources) : `v3:${sourcesHex}:${'0'.repeat(64)}`;
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, propertyId, { id: propertyId, mediaFingerprint: stamp });
  }

  it('🏆 Γ1 — παλιά συνταγή ⇒ `agreed` στο υλικό (ΟΧΙ `drifted`, ΟΧΙ `unstamped`) και ξαναπροβάλλεται', async () => {
    seedRecipeOutdated('prop_v3', [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ agreed: 1, drifted: 0, unstamped: 0, recipeOutdated: 1, recipeDeferred: 0, republished: 1 });
    expect(republishedIds()).toEqual(['prop_v3']);
  });

  it('🔑 Γ2 — ένα v2 αποτύπωμα (πριν από τις συνταγές) συγκρίνεται κανονικά στο υλικό: καμία πλημμύρα `unknown`', async () => {
    seedRecipeOutdated('prop_v2', [source('a')], 'v2');
    seedListed('prop_v2_drift', [source('a')], [source('b')]);
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_v2_drift', { id: 'prop_v2_drift', mediaFingerprint: legacyStamp([source('a')]) });

    const report = await run();

    expect(report).toMatchObject({ agreed: 1, drifted: 1, unstamped: 0, recipeOutdated: 1 });
  });

  it('🔑 Γ3 — ρυθμός: ως το όριο ανά πέρασμα · το υπόλοιπο `recipeDeferred` · η απόκλιση υλικού ΔΕΝ μετρά στο όριο', async () => {
    const total = LISTING_RECIPE_BACKFILL_PER_RUN + 5;
    for (let i = 0; i < total; i++) seedRecipeOutdated(`prop_r${String(i).padStart(2, '0')}`, [source(`r${i}`)]);
    seedListed('prop_drift', [source('a')], [source('b')]);

    const report = await reconcileListingMedia(fake as unknown as AdminFirestore, 0);

    expect(report).toMatchObject({ recipeOutdated: total, recipeDeferred: 5, drifted: 1 });
    expect(report.republished).toBe(LISTING_RECIPE_BACKFILL_PER_RUN + 1);
    expect(republishedIds()).toContain('prop_drift');
  });

  it('🏆 Γ4 — το παράθυρο ΚΥΛΑ: το επόμενο βράδυ πιάνει ΑΛΛΕΣ υποψήφιες (καμία μόνιμη αποτυχία δεν μπλοκάρει)', async () => {
    const total = LISTING_RECIPE_BACKFILL_PER_RUN + 5;
    for (let i = 0; i < total; i++) seedRecipeOutdated(`prop_r${String(i).padStart(2, '0')}`, [source(`r${i}`)]);
    republishListing.mockResolvedValue('failed');
    try {
      await reconcileListingMedia(fake as unknown as AdminFirestore, 0);
      const first = new Set(republishedIds());
      republishListing.mockClear();
      await reconcileListingMedia(fake as unknown as AdminFirestore, 86_400_000);

      expect(republishedIds().some((id) => !first.has(id))).toBe(true);
    } finally {
      republishListing.mockResolvedValue('published');
    }
  });

  it('Γ5 — η κρίση της καρτέλας ΔΕΝ βλέπει τη συνταγή: για τον άνθρωπο η αγγελία συμφωνεί με τα αρχεία του', async () => {
    seedRecipeOutdated('prop_v3', [source('a')]);

    expect(await judgeListingMedia(fake as unknown as AdminFirestore, 'prop_v3', 'c_alpha')).toBe('current');
  });
});

describe('ADR-845 §7.17 Α5β — ο ΙΔΙΟΣ κριτής, για ΕΝΑ ακίνητο (η ένδειξη της καρτέλας)', () => {
  function judge(propertyId: string, companyId = 'c_alpha') {
    return judgeListingMedia(fake as unknown as AdminFirestore, propertyId, companyId);
  }

  it('🏆 Κ1 — ό,τι γράφτηκε ΕΙΝΑΙ το τρέχον υλικό ⇒ `current`', async () => {
    seedListed('prop_ok', [source('a')], [source('a')]);

    await expect(judge('prop_ok')).resolves.toBe('current');
  });

  it('🔴 Κ2 — το υλικό άλλαξε, η αγγελία όχι ⇒ `stale`', async () => {
    seedListed('prop_drift', [source('a'), source('b')], [source('a')]);

    await expect(judge('prop_drift')).resolves.toBe('stale');
  });

  it('🔴 Κ3 — αγγελία ΧΩΡΙΣ αποτύπωμα ⇒ `unknown`, ΠΟΤΕ `current`', async () => {
    seedListed('prop_old', 'unstamped', [source('a')]);

    await expect(judge('prop_old')).resolves.toBe('unknown');
  });

  it('Κ4 — ακίνητο που διατίθεται ΧΩΡΙΣ αγγελία ⇒ `missing`', async () => {
    seedListed('prop_lost', 'no-listing', [source('a')]);

    await expect(judge('prop_lost')).resolves.toBe('missing');
  });

  it('Κ5 — ακίνητο που ΔΕΝ διατίθεται ⇒ `unlisted` (η οθόνη σιωπά)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_draft', { companyId: 'c_alpha', listed: false });

    await expect(judge('prop_draft')).resolves.toBe('unlisted');
  });

  it('🔐 Κ6 — ακίνητο ΑΛΛΟΥ μισθωτή, ή ανύπαρκτο ⇒ `unlisted`: τίποτα δικό του να συγκριθεί', async () => {
    seedListed('prop_theirs', [source('a')], [source('b')]);

    await expect(judge('prop_theirs', 'c_beta')).resolves.toBe('unlisted');
    await expect(judge('prop_nowhere')).resolves.toBe('unlisted');
  });

  it('Κ7 — η κρίση ΔΕΝ γράφει και ΔΕΝ ξαναπροβάλλει: μόνο ρωτά', async () => {
    seedListed('prop_drift', [source('a')], [source('b')]);

    await judge('prop_drift');

    expect(republishListing).not.toHaveBeenCalled();
  });
});

describe('ADR-920 §14.11 Ζ3c — και οι αγγελίες ΙΔΙΟΚΤΗΤΗ μπαίνουν στο δίχτυ', () => {
  it('🏆 Ι1 — αγγελία ιδιοκτήτη που συμφωνεί ΔΕΝ ξαναπροβάλλεται — από κανέναν γραφέα', async () => {
    seedOwnerListed('oprop_ok', [source('a')], [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ scanned: 1, listed: 1, agreed: 1, drifted: 0, republished: 0 });
    expect(republishOwnerProperty).not.toHaveBeenCalled();
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🔴 Ι2 — ΠΟΡΤΑ ΠΟΥ ΞΕΦΥΓΕ στον φάκελο (π.χ. φωτογραφία στον κάδο) ⇒ ξαναπροβάλλεται με τον γραφέα του ΙΔΙΟΚΤΗΤΗ', async () => {
    seedOwnerListed('oprop_drift', [source('a'), source('b')], [source('a')]);
    seedListed('prop_ok', [source('a')], [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ scanned: 2, listed: 2, agreed: 1, drifted: 1, republished: 1 });
    expect(ownerRepublishedIds()).toEqual(['oprop_drift']);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Ι3 — αγγελία ιδιοκτήτη που δεν δημοσιεύεται ΔΕΝ κρίνεται (και ο φάκελός της δεν διαβάζεται)', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'oprop_draft', { listed: false });
    ownerMedia.set('oprop_draft', 'unreadable');

    const report = await run();

    expect(report).toMatchObject({ scanned: 1, listed: 0, republished: 0, failed: 0 });
  });

  it('🔴 Ι4 — δημοσιεύσιμη αγγελία ιδιοκτήτη ΧΩΡΙΣ δημόσια αγγελία ⇒ `missing`, ξαναπροβάλλεται', async () => {
    seedOwnerListed('oprop_lost', 'no-listing', [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ missing: 1, republished: 1 });
    expect(ownerRepublishedIds()).toEqual(['oprop_lost']);
  });

  it('🔒 Ι5 — φάκελος που δεν διαβάζεται ⇒ «δεν ξέρω» + επαναπροβολή, ΠΟΤΕ «συμφωνεί» — και το πέρασμα συνεχίζει', async () => {
    seedOwnerListed('oprop_broken', [source('a')], 'unreadable');
    seedOwnerListed('oprop_ok', [source('a')], [source('a')]);

    const report = await run();

    expect(report).toMatchObject({ listed: 2, unstamped: 1, agreed: 1, republished: 1 });
    expect(ownerRepublishedIds()).toEqual(['oprop_broken']);
  });
});
