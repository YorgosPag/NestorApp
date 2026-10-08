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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcileListingMedia, judgeListingMedia } = require('../listing-media-reconciliation.service') as
  typeof import('../listing-media-reconciliation.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mediaFingerprintOf } = require('../listing-media-fingerprint-stamp') as
  typeof import('../listing-media-fingerprint-stamp');

type Sources = Parameters<typeof mediaFingerprintOf>[0];

let fake: FakeFirestore;

function source(id: string): unknown {
  return { privateStoragePath: `companies/c/${id}.jpg`, material: 'photo', sourceFileId: id, focalPoint: null };
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

beforeEach(() => {
  jest.clearAllMocks();
  currentMedia.clear();
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
