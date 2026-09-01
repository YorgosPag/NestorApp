/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΕΙΔΟΠΟΙΗΤΗ ΤΑΙΡΙΑΣΜΑΤΟΣ — «βγήκε αγγελία που ταιριάζει στη ζήτησή σου»
 * =============================================================================
 *
 * Η μηχανή ταιριάσματος (`matchDemand`) και η αλυσίδα γεγονότων (`demand-answer.ts`)
 * είναι **mocks**: εδώ δοκιμάζεται η **ορχήστρωση** — το ζεύγος ταυτότητας ως κλειδί
 * idempotency (και ΟΧΙ ζώνη), ο φραγμός ανά ζήτηση, και η κλειστή λογιστική. Καμία
 * άγκυρα δεν στέλνει πραγματικό email: το `dispatchNotification` είναι mock.
 */

const readLiveDemands = jest.fn();
const readLivePublicListings = jest.fn();
const knowledgeFromListings = jest.fn();
const listingFactsFrom = jest.fn();
const matchDemand = jest.fn();
const dispatchNotification = jest.fn();

jest.mock('@/services/demand/live-demands.reader', () => ({
  readLiveDemands: (...args: unknown[]) => readLiveDemands(...args),
}));
jest.mock('@/services/listings/live-public-listings.reader', () => ({
  readLivePublicListings: (...args: unknown[]) => readLivePublicListings(...args),
}));
jest.mock('@/lib/demand/demand-answer', () => ({
  knowledgeFromListings: (...args: unknown[]) => knowledgeFromListings(...args),
  listingFactsFrom: (...args: unknown[]) => listingFactsFrom(...args),
}));
jest.mock('@/lib/demand/demand-matching', () => ({
  matchDemand: (...args: unknown[]) => matchDemand(...args),
}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}));
jest.mock('@/lib/date-local', () => ({
  todayLocalDate: () => '2026-09-01',
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import {
  announceListingMatchesToDemandAuthors,
  listingMatchReportBalances,
  MAX_NEW_MATCHES_PER_DEMAND,
  type ListingMatchReport,
} from '@/services/demand/listing-match-notifier.service';
import { demandListingMatchEventId } from '@/lib/demand/demand-announcement';

function demand(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, authorUserId: `usr_${id}`, ...overrides };
}

function listing(id: string, title = `Αγγελία ${id}`): Record<string, unknown> {
  return { id, title };
}

/** Το `matchDemand` επιστρέφει `matched: ListingMatchFacts[]` — το ελάχιστο σχήμα. */
function matchedFactsOf(listings: ReadonlyArray<Record<string, unknown>>): {
  matched: Array<{ listing: Record<string, unknown> }>;
  nearMissed: never[];
  rejected: never[];
  considered: number;
} {
  return {
    matched: listings.map((item) => ({ listing: item })),
    nearMissed: [],
    rejected: [],
    considered: listings.length,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  knowledgeFromListings.mockReturnValue('KNOWLEDGE');
  listingFactsFrom.mockImplementation((listings: unknown[]) => listings);
  readLivePublicListings.mockResolvedValue({ listings: [], truncated: false });
  readLiveDemands.mockResolvedValue({ demands: [], truncated: false });
  dispatchNotification.mockResolvedValue({ success: true, skipped: false, dedupeKey: 'k' });
});

// =============================================================================
// Ι — ΤΑΥΤΟΤΗΤΑ ΖΕΥΓΟΥΣ, ΠΟΤΕ ΖΩΝΗ
// =============================================================================

describe('Ι — το κλειδί idempotency είναι το ζεύγος (ζήτηση, αγγελία)', () => {
  it('Ι1 🔑 — δύο περάσματα, ΙΔΙΟ ζεύγος ⇒ ΕΝΑ email', async () => {
    readLiveDemands.mockResolvedValue({ demands: [demand('d1')], truncated: false });
    readLivePublicListings.mockResolvedValue({ listings: [listing('l1')], truncated: false });
    matchDemand.mockReturnValue(matchedFactsOf([listing('l1')]));

    // ── Πέρασμα 1: η αγγελία είναι ΝΕΑ ──
    dispatchNotification.mockResolvedValueOnce({ success: true, skipped: false, dedupeKey: 'k1' });
    const pass1 = await announceListingMatchesToDemandAuthors({} as never);

    expect(pass1.announced).toBe(1);
    expect(pass1.alreadyKnown).toBe(0);
    expect(dispatchNotification.mock.calls[0][0]).toMatchObject({
      eventId: demandListingMatchEventId('d1', 'l1'),
      recipientId: 'usr_d1',
      tenantId: 'usr_d1',
    });

    // ── Πέρασμα 2: το ίδιο ζεύγος ξαναφαίνεται — ο orchestrator το ξέρει ήδη ──
    dispatchNotification.mockResolvedValueOnce({
      success: true,
      skipped: true,
      reason: 'Duplicate notification',
      dedupeKey: 'k1',
    });
    const pass2 = await announceListingMatchesToDemandAuthors({} as never);

    expect(pass2.announced).toBe(0);
    expect(pass2.alreadyKnown).toBe(1);
    // 🔑 Το ΙΔΙΟ eventId και στα δύο περάσματα — αυτό, και μόνο αυτό, είναι που
    // κάνει την επανάληψη δομικά αδύνατη.
    expect(dispatchNotification.mock.calls[1][0].eventId).toBe(
      dispatchNotification.mock.calls[0][0].eventId,
    );
  });

  it('Ι2 🔴 — δεύτερη ΔΙΑΦΟΡΕΤΙΚΗ αγγελία ⇒ ΔΕΥΤΕΡΟ email, ΟΧΙ σιωπή', async () => {
    // Η άγκυρα που αποδεικνύει ότι ΔΕΝ κάναμε το λάθος των ζωνών: με ζώνη
    // πλήθους, το ταίριασμα #2 (1→2) δεν θα διέσχιζε καμία ζώνη και θα σιωπούσε
    // ΓΙΑ ΠΑΝΤΑ — ακόμη κι αν είναι εντελώς άλλη αγγελία.
    readLiveDemands.mockResolvedValue({ demands: [demand('d1')], truncated: false });
    readLivePublicListings.mockResolvedValue({
      listings: [listing('l1'), listing('l2')],
      truncated: false,
    });

    // Πέρασμα 1: μόνο η l1 ταιριάζει.
    matchDemand.mockReturnValueOnce(matchedFactsOf([listing('l1')]));
    dispatchNotification.mockResolvedValueOnce({ success: true, skipped: false, dedupeKey: 'k1' });
    await announceListingMatchesToDemandAuthors({} as never);

    // Πέρασμα 2: εμφανίστηκε ΚΑΙ η l2 — η l1 είναι πλέον «ήδη γνωστή».
    matchDemand.mockReturnValueOnce(matchedFactsOf([listing('l1'), listing('l2')]));
    dispatchNotification.mockResolvedValueOnce({
      success: true,
      skipped: true,
      reason: 'Duplicate notification',
      dedupeKey: 'k1',
    });
    dispatchNotification.mockResolvedValueOnce({ success: true, skipped: false, dedupeKey: 'k2' });

    const pass2 = await announceListingMatchesToDemandAuthors({} as never);

    expect(pass2.announced).toBe(1);
    expect(pass2.alreadyKnown).toBe(1);
    expect(pass2.considered).toBe(2);
    const eventIds = dispatchNotification.mock.calls.slice(1).map((call) => call[0].eventId);
    expect(new Set(eventIds).size).toBe(2);
  });
});

// =============================================================================
// Φ — ΦΡΑΓΜΟΣ ΑΝΑ ΖΗΤΗΣΗ
// =============================================================================

describe('Φ — ο φραγμός ανά ζήτηση δηλώνεται, ποτέ σιωπηλό κόψιμο', () => {
  it('Φ1 🔴 — παραπάνω ταιριάσματα από το όριο ⇒ κόβεται ΚΑΙ σημαίνεται', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_DEMAND + 5 }, (_, i) =>
      listing(`l${i}`),
    );
    readLiveDemands.mockResolvedValue({ demands: [demand('d1')], truncated: false });
    readLivePublicListings.mockResolvedValue({ listings, truncated: false });
    matchDemand.mockReturnValue(matchedFactsOf(listings));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).toHaveBeenCalledTimes(MAX_NEW_MATCHES_PER_DEMAND);
    expect(report.considered).toBe(MAX_NEW_MATCHES_PER_DEMAND);
    expect(report.demandsTruncated).toBe(1);
    expect(listingMatchReportBalances(report)).toBe(true);
  });

  it('Φ2 — ΚΑΤΩ από το όριο δεν σημειώνεται κόψιμο', async () => {
    const listings = [listing('l1'), listing('l2')];
    readLiveDemands.mockResolvedValue({ demands: [demand('d1')], truncated: false });
    readLivePublicListings.mockResolvedValue({ listings, truncated: false });
    matchDemand.mockReturnValue(matchedFactsOf(listings));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(report.demandsTruncated).toBe(0);
    expect(dispatchNotification).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// Μ — ΜΗΔΕΝ ΤΑΙΡΙΑΣΜΑΤΑ
// =============================================================================

describe('Μ — ζήτηση χωρίς ταιριάσματα δεν στέλνει τίποτα', () => {
  it('Μ1 — μηδέν matched ⇒ μηδέν αποστολές, λογιστική κλείνει', async () => {
    readLiveDemands.mockResolvedValue({ demands: [demand('d1')], truncated: false });
    readLivePublicListings.mockResolvedValue({ listings: [listing('l1')], truncated: false });
    matchDemand.mockReturnValue(matchedFactsOf([]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.considered).toBe(0);
    expect(report.announced).toBe(0);
    expect(report.demandsConsidered).toBe(1);
    expect(listingMatchReportBalances(report)).toBe(true);
  });

  it('Μ2 — άδεια δεξαμενή ζητήσεων ⇒ όλα μηδέν', async () => {
    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(report.considered).toBe(0);
    expect(report.demandsConsidered).toBe(0);
    expect(report.truncated).toBe(false);
    expect(listingMatchReportBalances(report)).toBe(true);
  });
});

// =============================================================================
// Τ — Η ΣΗΜΑΙΑ `truncated` ΤΑΞΙΔΕΥΕΙ
// =============================================================================

describe('Τ — το κόψιμο της δεξαμενής ταξιδεύει ρητά στην αναφορά', () => {
  it('Τ1 — αγγιγμένο όριο αγγελιών ⇒ report.truncated', async () => {
    readLiveDemands.mockResolvedValue({ demands: [], truncated: false });
    readLivePublicListings.mockResolvedValue({ listings: [], truncated: true });

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(report.truncated).toBe(true);
  });

  it('Τ2 — αγγιγμένο όριο ζητήσεων ⇒ report.truncated', async () => {
    readLiveDemands.mockResolvedValue({ demands: [], truncated: true });
    readLivePublicListings.mockResolvedValue({ listings: [], truncated: false });

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(report.truncated).toBe(true);
  });
});

// =============================================================================
// Λ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ (μονάδα)
// =============================================================================

describe('Λ — listingMatchReportBalances', () => {
  it('Λ1 — ισοζυγίζει όταν το άθροισμα ταιριάζει', () => {
    const base: ListingMatchReport = {
      announced: 2,
      alreadyKnown: 1,
      optedOut: 0,
      considered: 3,
      demandsConsidered: 1,
      demandsTruncated: 0,
      truncated: false,
    };
    expect(listingMatchReportBalances(base)).toBe(true);
    expect(listingMatchReportBalances({ ...base, considered: 9 })).toBe(false);
  });
});
