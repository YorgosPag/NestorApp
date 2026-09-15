/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΜΕΙΩΣΗΣ ΤΙΜΗΣ — του ορίου που μετρά μόνο τα ΝΕΑ (ADR-777 §8.69) — και
 * της ΣΥΜΠΤΥΞΗΣ ανά (παραλήπτη, αγγελία) (§8.69.12)
 * =============================================================================
 *
 * Ίδιο σχήμα mocks με το `listing-match-notifier.test.ts`: η μηχανή ταιριάσματος και ο
 * orchestrator είναι mocks, ενώ το **καθολόγιο** («τι ξέρει ήδη ο άνθρωπος») ελέγχεται ρητά
 * ανά άγκυρα. Η κρίση μείωσης (`price-history.ts`), η ομαδοποίηση και τα κείμενα τρέχουν
 * **πραγματικά**. Οι legacy κλειδιές του καθολογίου έχουν δική τους σουίτα
 * (`demand-match-ledger.test.ts`).
 */

const readLiveDemands = jest.fn();
const readLivePublicListings = jest.fn();
const matchDemand = jest.fn();
const dispatchNotification = jest.fn();
const readRecipientLedger = jest.fn();

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

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { MS_PER_DAY } from '@/lib/date-local';
import { recipientListingMatchEventId, recipientPriceDropEventId } from '@/lib/demand/demand-announcement';
import { formatEuro } from '@/services/email-templates/base-email-template';
import {
  announceListingMatchesToDemandAuthors,
  listingMatchReportBalances,
  MAX_NEW_MATCHES_PER_RECIPIENT,
} from '@/services/demand/listing-match-notifier.service';
import type { TopicKnowledge } from '@/services/demand/demand-match-ledger';
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

function demand(id: string, priceMax: number | null = null, author = `usr_${id}`): Record<string, unknown> {
  return { id, authorUserId: author, features: { priceMax } };
}

function listing(id: string, priceReduction: PriceReduction | null = null): Record<string, unknown> {
  return { id, title: `Αγγελία ${id}`, priceReduction, areaSqm: 307 };
}

function announcedAt(atMs: number | null, priceDropKnown = false): TopicKnowledge {
  return { match: { kind: 'announced', atMs }, priceDropKnown };
}

function givenPass(demands: unknown[], listings: Array<Record<string, unknown>>, ledger: Map<string, TopicKnowledge>): void {
  readLiveDemands.mockResolvedValue({ demands, truncated: false });
  readLivePublicListings.mockResolvedValue({ listings, truncated: false });
  matchDemand.mockReturnValue({ matched: listings.map((item) => ({ listing: item })) });
  readRecipientLedger.mockResolvedValue(ledger);
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

describe('Μ — η μείωση τιμής σε αγγελία που ο ζητών ΗΔΗ ξέρει', () => {
  it('🏆 Μ1 — ταίριασμα ανακοινωμένο ΠΡΙΝ τη μείωση ⇒ email μείωσης, ΚΑΝΕΝΑ δεύτερο ταιριάσματος', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', announcedAt(SINCE_MS - MS_PER_DAY)]]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(MATCH)).toHaveLength(0);
    const [drop] = callsOfType(DROP);
    expect(drop).toMatchObject({
      eventId: recipientPriceDropEventId('l1', REDUCTION),
      recipientId: 'usr_d1',
      titleKey: 'demandPriceDrop.notificationTitle',
      reasons: ['d1'],
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
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', announcedAt(SINCE_MS + 1000)]]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.priceDrops['predates-match']).toBe(1);
  });

  it('Μ3 — μείωση που έληξε (30+ ημέρες) ⇒ σιωπή, μετρημένη ως `stale`', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(SINCE_MS + 31 * MS_PER_DAY);
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', announcedAt(SINCE_MS - MS_PER_DAY)]]));

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.priceDrops.stale).toBe(1);
  });

  it('Μ4 — δεύτερο πέρασμα με την ΙΔΙΑ μείωση ⇒ ΙΔΙΟ κλειδί (ο orchestrator τη σιωπά)', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map([['l1', announcedAt(SINCE_MS - MS_PER_DAY)]]));
    await announceListingMatchesToDemandAuthors({} as never);
    dispatchNotification.mockResolvedValue({ success: true, skipped: true, reason: 'Duplicate notification', dedupeKey: 'k' });

    const second = await announceListingMatchesToDemandAuthors({} as never);

    const ids = callsOfType(DROP).map((call) => call.eventId);
    expect(new Set(ids).size).toBe(1);
    expect(second.priceDrops['already-known']).toBe(1);
  });
});

describe('Ν — νέο ταίριασμα που ΗΔΗ κουβαλά μείωση: ΕΝΑ email, με τη μείωση μέσα', () => {
  it('🔴 Ν1 — μόνο email ταιριάσματος, με «μειωμένη τιμή» και σώμα με τα ποσά', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION)], new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(DROP)).toHaveLength(0);
    const [match] = callsOfType(MATCH);
    expect(match.titleKey).toBe('demandListingMatch.reducedTitle');
    expect(match.body).toContain(formatEuro(3_200_000));
    expect(report.announced).toBe(1);
  });

  it('🏆 Ν2 — ξεπερνούσε το όριο της ζήτησης και τώρα χωράει ⇒ «Μπήκε στον προϋπολογισμό σας»', async () => {
    givenPass([demand('d1', 3_300_000)], [listing('l1', REDUCTION)], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    const [match] = callsOfType(MATCH);
    expect(match.titleKey).toBe('demandListingMatch.intoBudgetTitle');
    expect(match.title).toContain('Μπήκε στον προϋπολογισμό σας');
    expect(match.body).toContain(formatEuro(100_000));
  });

  it('Ν3 — χωρίς μείωση ⇒ το email ταιριάσματος μένει ΑΚΡΙΒΩΣ όπως πριν (χωρίς σώμα)', async () => {
    givenPass([demand('d1')], [listing('l1')], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    const [match] = callsOfType(MATCH);
    expect(match.titleKey).toBe('demandListingMatch.notificationTitle');
    expect(match.body).toBeUndefined();
  });
});

describe('Κ — κλειστός διακόπτης ταιριάσματος ΔΕΝ κλείνει τις μειώσεις', () => {
  it('Κ1 — ταίριασμα `opted-out` ⇒ η μείωση κρίνεται ως «δεν ανακοινώθηκε ποτέ» και στέλνεται', async () => {
    givenPass([demand('d1')], [listing('l1', REDUCTION), listing('l2', REDUCTION)], new Map());
    dispatchNotification.mockImplementation(async (request: Record<string, unknown>) =>
      request.eventType === MATCH
        ? { success: true, skipped: true, reason: 'Category disabled', dedupeKey: 'k' }
        : { success: true, skipped: false, dedupeKey: 'k' },
    );

    const report = await announceListingMatchesToDemandAuthors({} as never);

    // 🔑 Μία απόπειρα ταιριάσματος (ίδιος παραλήπτης ⇒ ίδια απάντηση), δύο μειώσεις.
    expect(callsOfType(MATCH)).toHaveLength(1);
    expect(callsOfType(DROP)).toHaveLength(2);
    expect(report.optedOut).toBe(1);
    expect(listingMatchReportBalances(report)).toBe(true);
  });
});

describe('Δ — το όριο μετρά ΜΟΝΟ ΝΕΕΣ ανακοινώσεις (το ελάττωμα που βρέθηκε 2026-09-15)', () => {
  it('🔴 Δ1 — τα πρώτα 10 ΓΝΩΣΤΑ δεν τρώνε το όριο: η 11η και η 12η αγγελία ανακοινώνονται', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_RECIPIENT + 2 }, (_, i) => listing(`l${i}`));
    const known = new Map<string, TopicKnowledge>(
      listings.slice(0, MAX_NEW_MATCHES_PER_RECIPIENT).map((item) => [String(item.id), announcedAt(SINCE_MS)]),
    );
    givenPass([demand('d1')], listings, known);

    const report = await announceListingMatchesToDemandAuthors({} as never);

    // Πριν τη διόρθωση: `slice(0, 10)` ⇒ τα 10 γνωστά ⇒ ΜΗΔΕΝ αποστολές, για πάντα.
    expect(callsOfType(MATCH).map((c) => c.entityId)).toEqual([
      `l${MAX_NEW_MATCHES_PER_RECIPIENT}`,
      `l${MAX_NEW_MATCHES_PER_RECIPIENT + 1}`,
    ]);
    expect(report.announced).toBe(2);
    expect(report.alreadyKnown).toBe(MAX_NEW_MATCHES_PER_RECIPIENT);
    expect(report.recipientsTruncated).toBe(0);
  });

  it('Δ2 — πάνω από το όριο ΝΕΑ ⇒ κόβεται στα 10 και σημαίνεται', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_RECIPIENT + 3 }, (_, i) => listing(`l${i}`));
    givenPass([demand('d1')], listings, new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(report.announced).toBe(MAX_NEW_MATCHES_PER_RECIPIENT);
    expect(report.recipientsTruncated).toBe(1);
  });

  it('🔴 Δ2β — το όριο είναι ανά ΑΝΘΡΩΠΟ: δύο πλατιές ζητήσεις του ίδιου ⇒ 10, όχι 20', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_RECIPIENT + 2 }, (_, i) => listing(`l${i}`));
    givenPass([demand('d1', null, 'usr_x'), demand('d2', null, 'usr_x')], listings, new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(MATCH)).toHaveLength(MAX_NEW_MATCHES_PER_RECIPIENT);
    expect(report.recipientsTruncated).toBe(1);
  });

  it('Δ3 — αγγελία που περιμένει το όριο ΔΕΝ παίρνει email μείωσης (δεν της συστήθηκε ποτέ)', async () => {
    const listings = Array.from({ length: MAX_NEW_MATCHES_PER_RECIPIENT + 1 }, (_, i) => listing(`l${i}`, REDUCTION));
    givenPass([demand('d1')], listings, new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(DROP)).toHaveLength(0);
  });

  it('Δ4 — ζήτηση χωρίς ταιριάσματα δεν διαβάζει καν το καθολόγιο', async () => {
    givenPass([demand('d1')], [], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    expect(readRecipientLedger).not.toHaveBeenCalled();
  });
});

describe('Σ — §8.69.12: ΕΝΑΣ άνθρωπος, ΜΙΑ αγγελία, ΜΙΑ είδηση — οι ζητήσεις είναι λόγοι', () => {
  it('🔴 Σ1 — δύο ζητήσεις του ίδιου × μία ΝΕΑ αγγελία ⇒ ΜΙΑ ειδοποίηση ταιριάσματος με 2 λόγους', async () => {
    givenPass([demand('d1', null, 'usr_x'), demand('d2', null, 'usr_x')], [listing('l1')], new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    const matches = callsOfType(MATCH);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      recipientId: 'usr_x',
      eventId: recipientListingMatchEventId('l1'),
      reasons: ['d1', 'd2'],
      titleKey: 'demandListingMatch.notificationTitleMany',
      titleParams: { title: 'Αγγελία l1', count: '2' },
    });
    expect(matches[0].title).toContain('σε 2 ζητήσεις σας');
    expect(report.considered).toBe(1);
    expect(report.collapsedReasons).toBe(1);
    expect(listingMatchReportBalances(report)).toBe(true);
  });

  it('🔴 Σ2 — δύο ζητήσεις του ίδιου × μία ΜΕΙΩΣΗ ⇒ ΜΙΑ ειδοποίηση μείωσης (το ζωντανό εύρημα)', async () => {
    givenPass(
      [demand('d1', null, 'usr_x'), demand('d2', null, 'usr_x')],
      [listing('l1', REDUCTION)],
      new Map([['l1', announcedAt(SINCE_MS - MS_PER_DAY)]]),
    );

    const report = await announceListingMatchesToDemandAuthors({} as never);

    const drops = callsOfType(DROP);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({
      eventId: recipientPriceDropEventId('l1', REDUCTION),
      reasons: ['d1', 'd2'],
      titleKey: 'demandPriceDrop.notificationTitleMany',
    });
    expect(report.priceDrops.announced).toBe(1);
  });

  it('🔴 Σ4 — η τρέχουσα μείωση είναι ΗΔΗ γραμμένη (π.χ. με το παλιό κλειδί ανά ζήτηση) ⇒ ΚΑΜΙΑ αποστολή', async () => {
    givenPass(
      [demand('d1', null, 'usr_x'), demand('d2', null, 'usr_x')],
      [listing('l1', REDUCTION)],
      new Map([['l1', announcedAt(SINCE_MS - MS_PER_DAY, true)]]),
    );

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(report.priceDrops['already-known']).toBe(1);
  });

  it('🏆 Σ5 — into-budget για ΚΑΠΟΙΑ ζήτηση ⇒ «Μπήκε στον προϋπολογισμό», με το ΑΥΣΤΗΡΟΤΕΡΟ όριο', async () => {
    givenPass(
      [demand('d1', 4_000_000, 'usr_x'), demand('d2', 3_300_000, 'usr_x'), demand('d3', 3_250_000, 'usr_x')],
      [listing('l1', REDUCTION)],
      new Map([['l1', announcedAt(SINCE_MS - MS_PER_DAY)]]),
    );

    await announceListingMatchesToDemandAuthors({} as never);

    const [drop] = callsOfType(DROP);
    expect(drop.titleKey).toBe('demandPriceDrop.intoBudgetTitle');
    expect(drop.title).toContain('Μπήκε στον προϋπολογισμό σας');
    // 3.250.000 − 3.200.000 — ποτέ το 100.000 του χαλαρότερου ορίου.
    expect(drop.body).toContain(formatEuro(50_000));
    expect(drop.body).toContain(formatEuro(3_250_000));
  });

  it('Σ6 — ΔΙΑΦΟΡΕΤΙΚΟΙ άνθρωποι ΔΕΝ συμπτύσσονται', async () => {
    givenPass([demand('d1'), demand('d2')], [listing('l1')], new Map());

    const report = await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(MATCH).map((call) => call.recipientId)).toEqual(['usr_d1', 'usr_d2']);
    expect(report.collapsedReasons).toBe(0);
  });

  it('Σ7 — οι λόγοι είναι ντετερμινιστικοί: ίδια είσοδος σε άλλη σειρά ⇒ ΙΔΙΟΙ λόγοι', async () => {
    givenPass([demand('d2', null, 'usr_x'), demand('d1', null, 'usr_x')], [listing('l1')], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    expect(callsOfType(MATCH)[0].reasons).toEqual(['d1', 'd2']);
  });

  it('Σ8 — ΜΙΑ ανάγνωση καθολογίου ανά άνθρωπο, με ΟΛΕΣ τις ζητήσεις-λόγους του θέματος', async () => {
    givenPass([demand('d1', null, 'usr_x'), demand('d2', null, 'usr_x')], [listing('l1', REDUCTION)], new Map());

    await announceListingMatchesToDemandAuthors({} as never);

    expect(readRecipientLedger).toHaveBeenCalledTimes(1);
    expect(readRecipientLedger.mock.calls[0][1]).toBe('usr_x');
    expect(readRecipientLedger.mock.calls[0][2]).toEqual([
      { listingId: 'l1', demandIds: ['d1', 'd2'], reduction: REDUCTION },
    ]);
  });
});
