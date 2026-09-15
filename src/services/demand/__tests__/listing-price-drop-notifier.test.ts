/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΜΕΙΩΣΗΣ ΤΙΜΗΣ — και του ορίου που μετρά μόνο τα ΝΕΑ (ADR-777 §8.69)
 * =============================================================================
 *
 * Ίδιο σχήμα mocks με το `listing-match-notifier.test.ts`: η μηχανή ταιριάσματος και ο
 * orchestrator είναι mocks, ενώ το **καθολόγιο** («τι ξέρει ήδη ο ζητών») ελέγχεται ρητά
 * ανά άγκυρα. Η κρίση μείωσης (`price-history.ts`) και τα κείμενα τρέχουν **πραγματικά**.
 */

const readLiveDemands = jest.fn();
const readLivePublicListings = jest.fn();
const matchDemand = jest.fn();
const dispatchNotification = jest.fn();
const readMatchLedger = jest.fn();

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
  readMatchLedger: (...args: unknown[]) => readMatchLedger(...args),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { MS_PER_DAY } from '@/lib/date-local';
import { demandPriceDropEventId } from '@/lib/demand/demand-announcement';
import { formatEuro } from '@/services/email-templates/base-email-template';
import {
  announceListingMatchesToDemandAuthors,
  listingMatchReportBalances,
  MAX_NEW_MATCHES_PER_DEMAND,
} from '@/services/demand/listing-match-notifier.service';
import type { PriceReduction } from '@/types/price-history';

const SINCE = '2026-09-10T08:00:00.000Z';
const SINCE_MS = Date.parse(SINCE);
const NOW_MS = SINCE_MS + 2 * MS_PER_DAY;

const REDUCTION: PriceReduction = {
  role: 'sale',
  from: 3_490_000,
  to: 3_200_000,
  dropBasisPoints: 830,
  since: SINCE,
};

function demand(id: string, priceMax: number | null = null): Record<string, unknown> {
  return { id, authorUserId: `usr_${id}`, features: { priceMax } };
}

function listing(id: string, priceReduction: PriceReduction | null = null): Record<string, unknown> {
  return { id, title: `Αγγελία ${id}`, priceReduction, areaSqm: 307 };
}

function givenPass(demands: unknown[], listings: Array<Record<string, unknown>>, ledger: Map<string, number | null>): void {
  readLiveDemands.mockResolvedValue({ demands, truncated: false });
  readLivePublicListings.mockResolvedValue({ listings, truncated: false });
  matchDemand.mockReturnValue({ matched: listings.map((item) => ({ listing: item })) });
  readMatchLedger.mockResolvedValue(ledger);
}

const callsOfType = (eventType: string): Array<Record<string, unknown>> =>
  dispatchNotification.mock.calls.map((call) => call[0]).filter((request) => request.eventType === eventType);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  dispatchNotification.mockResolvedValue({ success: true, skipped: false, dedupeKey: 'k' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Μ — η μείωση τιμής σε αγγελία που ο ζητών ΗΔΗ ξέρει', () => {
  it('🏆 Μ1 — ταίριασμα ανακοινωμένο ΠΡΙΝ τη μείωση ⇒ email μείωσης, ΚΑΝΕΝΑ δεύτερο ταιριάσματος', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', SINCE_MS - MS_PER_DAY]]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH)).toHaveLength(0);
    const [drop] = callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP);
    expect(drop).toMatchObject({
      eventId: demandPriceDropEventId('d1', 'l1', REDUCTION),
      recipientId: 'usr_d1',
      titleKey: 'demandPriceDrop.notificationTitle',
      entityId: 'l1',
    });
    // Το σώμα λέει τα ΠΟΣΑ με το SSoT των email και ΣΕ ΣΧΕΣΗ ΜΕ ΤΙ.
    expect(drop.body).toContain(formatEuro(3_490_000));
    expect(drop.body).toContain(formatEuro(3_200_000));
    expect(drop.body).toContain('χαμηλότερη τιμή των τελευταίων 30 ημερών');
    expect(report.priceDrops.announced).toBe(1);
    expect(report.alreadyKnown).toBe(1);
    expect(listingMatchReportBalances(report)).toBe(true);
  });

  it('🔴 Μ2 — ταίριασμα ανακοινωμένο ΜΕΤΑ τη μείωση ⇒ σιωπή (το είδε ήδη μειωμένη)', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', SINCE_MS + 1000]]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.priceDrops['predates-match']).toBe(1);
  });

  it('Μ3 — μείωση που έληξε (30+ ημέρες) ⇒ σιωπή, μετρημένη ως `stale`', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(SINCE_MS + 31 * MS_PER_DAY);
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', SINCE_MS - MS_PER_DAY]]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.priceDrops.stale).toBe(1);
  });

  it('Μ4 — δεύτερο πέρασμα με την ΙΔΙΑ μείωση ⇒ ΙΔΙΟ κλειδί (ο orchestrator τη σιωπά)', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', SINCE_MS - MS_PER_DAY]]));
    await announceListingMatchesToDemandAuthors({} as never);
    dispatchNotification.mockResolvedValue({ success: true, skipped: true, reason: 'Duplicate notification', dedupeKey: 'k' });

    const second = await announceListingMatchesToDemandAuthors({} as never);

    const ids = callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP).map((call) => call.eventId);
    expect(new Set(ids).size).toBe(1);
    expect(second.priceDrops['already-known']).toBe(1);
  });
});

describe('Ν — νέο ταίριασμα που ΗΔΗ κουβαλά μείωση: ΕΝΑ email, με τη μείωση μέσα', () => {
  it('🔴 Ν1 — μόνο email ταιριάσματος, με «μειωμένη τιμή» και σώμα με τα ποσά', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP)).toHaveLength(0);
    const [match] = callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH);
    expect(match.titleKey).toBe('demandListingMatch.reducedTitle');
    expect(match.body).toContain(formatEuro(3_200_000));
    expect(report.announced).toBe(1);
  });

  it('🏆 Ν2 — ξεπερνούσε το όριο της ζήτησης και τώρα χωράει ⇒ «Μπήκε στον προϋπολογισμό σας»', async () => {
    givenPass([demand('d1', 3_300_000)], [listing('l1', REDUCTION)], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    const [match] = callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH);
    expect(match.titleKey).toBe('demandListingMatch.intoBudgetTitle');
    expect(match.title).toContain('Μπήκε στον προϋπολογισμό σας');
    expect(match.body).toContain(formatEuro(100_000));
  });

  it('Ν3 — χωρίς μείωση ⇒ το email ταιριάσματος μένει ΑΚΡΙΒΩΣ όπως πριν (χωρίς σώμα)', async () => {
    givenPass([demand('d1')], [listing('l1')], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    const [match] = callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH);
    expect(match.titleKey).toBe('demandListingMatch.notificationTitle');
    expect(match.body).toBeUndefined();
  });
});

describe('Κ — κλειστός διακόπτης ταιριάσματος ΔΕΝ κλείνει τις μειώσεις', () => {
  it('Κ1 — ταίριασμα `opted-out` ⇒ η μείωση κρίνεται ως «δεν ανακοινώθηκε ποτέ» και στέλνεται', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION), listing('l2', REDUCTION)], new Map());
    dispatchNotification.mockImplementation(async (request: Record<string, unknown>) =>
      request.eventType === NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH
        ? { success: true, skipped: true, reason: 'Category disabled', dedupeKey: 'k' }
        : { success: true, skipped: false, dedupeKey: 'k' },
    );

    const report = await announceListingMatchesToDemandAuthors({} as never);

    // 🔑 Μία απόπειρα ταιριάσματος (ίδιος παραλήπτης ⇒ ίδια απάντηση), δύο μειώσεις.
    expect(callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH)).toHaveLength(1);
    expect(callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP)).toHaveLength(2);
    expect(report.optedOut).toBe(1);
    expect(listingMatchReportBalances(report)).toBe(true);
  });
});

describe('Δ — το όριο μετρά ΜΟΝΟ ΝΕΕΣ ανακοινώσεις (το ελάττωμα που βρέθηκε 2026-09-15)', () => {
  it('🔴 Δ1 — τα πρώτα 10 ΓΝΩΣΤΑ δεν τρώνε το όριο: η 11η και η 12η αγγελία ανακοινώνονται', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_DEMAND + 2 }, (_, i) => listing(`l${i}`));
    const known = new Map<string, number | null>(
      listings.slice(0, MAX_NEW_MATCHES_PER_DEMAND).map((item) => [String(item.id), SINCE_MS]),
    );
    givenPass([demand('d1')], listings, known);

    const report = await announceListingMatchesToDemandAuthors({} as never);

    // Πριν τη διόρθωση: `slice(0, 10)` ⇒ τα 10 γνωστά ⇒ ΜΗΔΕΝ αποστολές, για πάντα.
    expect(callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH).map((c) => c.entityId)).toEqual([
      `l${MAX_NEW_MATCHES_PER_DEMAND}`,
      `l${MAX_NEW_MATCHES_PER_DEMAND + 1}`,
    ]);
    expect(report.announced).toBe(2);
    expect(report.alreadyKnown).toBe(MAX_NEW_MATCHES_PER_DEMAND);
    expect(report.demandsTruncated).toBe(0);
  });

  it('Δ2 — πάνω από το όριο ΝΕΑ ⇒ κόβεται στα 10 και σημαίνεται', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_DEMAND + 3 }, (_, i) => listing(`l${i}`));
    givenPass([demand('d1')], listings, new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(report.announced).toBe(MAX_NEW_MATCHES_PER_DEMAND);
    expect(report.demandsTruncated).toBe(1);
  });

  it('Δ3 — αγγελία που περιμένει το όριο ΔΕΝ παίρνει email μείωσης (δεν της συστήθηκε ποτέ)', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_DEMAND + 1 }, (_, i) => listing(`l${i}`, REDUCTION));
    givenPass([demand('d1')], listings, new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP)).toHaveLength(0);
  });

  it('Δ4 — ζήτηση χωρίς ταιριάσματα δεν διαβάζει καν το καθολόγιο', async () => {
    givenPass([demand('d1')], [], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    expect(readMatchLedger).not.toHaveBeenCalled();
  });
});
