/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΜΕΙΩΣΗΣ ΣΕ ΑΓΓΕΛΙΑ ΠΟΥ ΚΡΑΤΗΘΗΚΕ (ADR-777 §8.74)
 * =============================================================================
 *
 * Ίδιο σχήμα mocks με το `listing-price-drop-notifier.test.ts`: μηχανή ταιριάσματος, orchestrator,
 * καθολόγιο και αναγνώστης αποθηκεύσεων είναι mocks· η **κρίση** (`priceDropVerdict`), η ομαδοποίηση,
 * η συγχώνευση των αποθηκεύσεων και τα κείμενα τρέχουν **πραγματικά**.
 *
 * 🔑 Η κεντρική υπόσχεση: ο άνθρωπος που **και** ζητά **και** κράτησε παίρνει **ΕΝΑ** email ανά μείωση.
 */

const readLiveDemands = jest.fn();
const readLivePublicListings = jest.fn();
const matchDemand = jest.fn();
const dispatchNotification = jest.fn();
const readRecipientLedger = jest.fn();
const readSavesOfListings = jest.fn();

jest.mock('@/services/demand/live-demands.reader', () => ({
  readLiveDemands: (...args: unknown[]) => readLiveDemands(...args),
}));
jest.mock('@/services/listings/live-public-listings.reader', () => ({
  readLivePublicListings: (...args: unknown[]) => readLivePublicListings(...args),
}));
jest.mock('@/lib/demand/demand-answer', () => ({
  knowledgeFromListings: () => 'KNOWLEDGE',
  listingFactsFrom: (listings: unknown[]) => listings,
}));
jest.mock('@/lib/demand/demand-matching', () => ({
  matchDemand: (...args: unknown[]) => matchDemand(...args),
}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}));
jest.mock('@/services/demand/demand-match-ledger', () => ({
  readRecipientLedger: (...args: unknown[]) => readRecipientLedger(...args),
}));
jest.mock('@/services/listings/saved-listing.service', () => ({
  readSavesOfListings: (...args: unknown[]) => readSavesOfListings(...args),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { MS_PER_DAY } from '@/lib/date-local';
import { recipientPriceDropEventId } from '@/lib/demand/demand-announcement';
import { announceListingMatchesToDemandAuthors } from '@/services/demand/listing-match-notifier.service';
import { knownSince } from '@/services/demand/saved-listing-topics';
import type { PriceReduction } from '@/types/price-history';
import type { SavedListing } from '@/types/saved-listing';

const SINCE = '2026-09-10T08:00:00.000Z';
const SINCE_MS = Date.parse(SINCE);
const NOW_MS = SINCE_MS + 2 * MS_PER_DAY;
const SAVER = 'usr_saver';

const REDUCTION: PriceReduction = { role: 'sale', from: 3_490_000, to: 3_200_000, dropBasisPoints: 830, since: SINCE };

function listing(id: string, priceReduction: PriceReduction | null = REDUCTION): Record<string, unknown> {
  return { id, title: `Αγγελία ${id}`, priceReduction, areaSqm: 307 };
}

function saved(listingId: string, savedAtMs: number, saverUserId = SAVER): SavedListing {
  return { id: `svls_${listingId}`, saverUserId, listingId, savedAt: new Date(savedAtMs).toISOString(), priceAtSave: null };
}

function givenPass(demands: unknown[], listings: Array<Record<string, unknown>>, saves: readonly SavedListing[]): void {
  readLiveDemands.mockResolvedValue({ demands, truncated: false });
  readLivePublicListings.mockResolvedValue({ listings, truncated: false });
  matchDemand.mockReturnValue({ matched: listings.map((item) => ({ facts: { listing: item }, match: { metOn: [] } })) });
  readRecipientLedger.mockResolvedValue(new Map());
  readSavesOfListings.mockResolvedValue(saves);
}

const callsOfType = (eventType: string): Array<Record<string, unknown>> =>
  dispatchNotification.mock.calls.map((call) => call[0]).filter((request) => request.eventType === eventType);

const MATCH = NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH;
const DROP = NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  dispatchNotification.mockResolvedValue({ success: true, skipped: false, dedupeKey: 'k' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Σ — η αποθήκευση ως ΓΝΩΣΗ της τιμής', () => {
  it('🏆 Σ1 — κράτησε ΠΡΙΝ τη μείωση ⇒ ΕΝΑ email μείωσης «που αποθηκεύσατε», κανένα ταιριάσματος', async () => {
    givenPass([], [listing('l1')], [saved('l1', SINCE_MS - MS_PER_DAY)]);

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(MATCH)).toHaveLength(0);
    expect(callsOfType(DROP)).toEqual([
      expect.objectContaining({
        recipientId: SAVER,
        eventId: recipientPriceDropEventId('l1', REDUCTION),
        titleKey: 'demandPriceDrop.savedTitle',
        reasons: [],
      }),
    ]);
    expect(report.priceDrops.announced).toBe(1);
    // Το θέμα «μόνο αποθήκευσης» ΔΕΝ μπαίνει στη λογιστική ταιριασμάτων.
    expect(report.considered).toBe(0);
  });

  it('🔴 Σ2 — κράτησε ΜΕΤΑ τη μείωση ⇒ σιωπή (την κράτησε ήδη μειωμένη)', async () => {
    givenPass([], [listing('l1')], [saved('l1', SINCE_MS + 1000)]);

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.priceDrops['predates-match']).toBe(1);
  });

  it('🏆 Σ3 — ζήτηση ΚΑΙ αποθήκευση στην ίδια αγγελία ⇒ ΕΝΑ email, με τη διατύπωση της ζήτησης', async () => {
    givenPass([{ id: 'd1', authorUserId: SAVER, seeks: [] }], [listing('l1')], [saved('l1', SINCE_MS - MS_PER_DAY)]);

    await announceListingMatchesToDemandAuthors({} as never);

    // Η αποθήκευση είναι ΓΝΩΣΗ: ο άνθρωπος ξέρει ήδη την αγγελία ⇒ κανένα «νέα αγγελία ταιριάζει».
    expect(callsOfType(MATCH)).toHaveLength(0);
    expect(callsOfType(DROP)).toEqual([
      expect.objectContaining({ recipientId: SAVER, titleKey: 'demandPriceDrop.notificationTitle', reasons: ['d1'] }),
    ]);
  });

  it('Σ4 — ξένη αποθήκευση δεν αγγίζει τον ζητούντα · ο καθένας τη δική του είδηση', async () => {
    givenPass([{ id: 'd1', authorUserId: 'usr_other', seeks: [] }], [listing('l1', null)], [saved('l2', SINCE_MS - MS_PER_DAY)]);
    readLivePublicListings.mockResolvedValue({ listings: [listing('l1', null), listing('l2')], truncated: false });

    await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(DROP).map((call) => call.recipientId)).toEqual([SAVER]);
  });

  it('Σ5 — ρωτά τις αποθηκεύσεις ΜΟΝΟ για αγγελίες με φρέσκια μείωση · βλάβη ⇒ σιωπή, όχι σφάλμα', async () => {
    givenPass([], [listing('l1'), listing('l2', null)], []);
    readSavesOfListings.mockResolvedValue(null);

    await expect(announceListingMatchesToDemandAuthors({} as never)).resolves.toBeDefined();
    expect(readSavesOfListings).toHaveBeenCalledWith(expect.anything(), ['l1']);
    expect(dispatchNotification).not.toHaveBeenCalled();
  });
});

describe('Γ — knownSince: η νωρίτερη γνώση κερδίζει, η σιωπή δεν ξανανοίγει', () => {
  it('ποτέ ανακοινωμένη + αποθήκευση ⇒ γνωστή από την αποθήκευση', () => {
    expect(knownSince({ kind: 'never-announced' }, 100)).toEqual({ kind: 'announced', atMs: 100 });
  });

  it('η νωρίτερη από ανακοίνωση και αποθήκευση', () => {
    expect(knownSince({ kind: 'announced', atMs: 50 }, 100)).toEqual({ kind: 'announced', atMs: 50 });
    expect(knownSince({ kind: 'announced', atMs: 150 }, 100)).toEqual({ kind: 'announced', atMs: 100 });
  });

  it('🔴 «ανακοινώθηκε, στιγμή άγνωστη» ΜΕΝΕΙ άγνωστη — η αποθήκευση δεν ξανανοίγει τη σιωπή', () => {
    expect(knownSince({ kind: 'announced', atMs: null }, 100)).toEqual({ kind: 'announced', atMs: null });
  });
});
