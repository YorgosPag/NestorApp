/**
 * Άγκυρες: **ΤΟ ΠΕΡΑΣΜΑ ΤΩΝ ΑΛΛΑΓΩΝ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ** (ADR-919 §10).
 *
 * Η μηχανή ταιριάσματος, η κρίση και τα κείμενα τρέχουν **πραγματικά**. Mocks: ο orchestrator, το καθολόγιο και οι
 * γλώσσες παραληπτών. Ελέγχεται «ποιος ακούει τι, και πόσες φορές».
 */

const dispatchNotification = jest.fn();
const readRecipientLedger = jest.fn();

jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
}));
jest.mock('@/server/notifications/user-notification-settings-store', () => ({
  loadUserNotificationSettingsMany: async () => new Map(),
}));
jest.mock('@/services/demand/demand-match-ledger', () => ({
  readRecipientLedger: (...args: unknown[]) => readRecipientLedger(...args),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { MS_PER_DAY } from '@/lib/date-local';
import { knowledgeFromListings } from '@/lib/demand/demand-answer';
import { recipientAvailabilityChangeEventId } from '@/lib/demand/demand-announcement';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import { demand, listing, TODAY } from '@/lib/demand/__tests__/demand-fixtures';
import { announceAvailabilityChanges } from '@/services/demand/availability-change-pass';
import type { TopicKnowledge } from '@/services/demand/demand-match-ledger';
import { listingMatchDestination } from '@/services/demand/listing-match-notifier.service';
import type { AvailabilityChange } from '@/types/availability-history';
import type { PublicListing } from '@/types/public-listing';

const CHANGED_AT = '2026-08-10T09:00:00.000Z';
const CHANGED_MS = Date.parse(CHANGED_AT);
const NOW_MS = CHANGED_MS + MS_PER_DAY;

const Q3_2027 = scheduledAvailability('quarter', '2027-08-01');
const Q1_2028 = scheduledAvailability('quarter', '2028-02-01');
const CHANGE: AvailabilityChange = { kind: 'slipped', from: Q3_2027, at: CHANGED_AT };

const WINDOW = { kind: 'window', fromDate: '2027-06-01', toDate: '2027-12-31' } as const;

/** Αγγελία που μετατέθηκε από Γ΄ τρ. 2027 σε Α΄ τρ. 2028. */
function slipped(id = 'prop_1'): PublicListing {
  const track = { originally: Q3_2027, slips: 1, lastChange: CHANGE };
  return listing({ id, title: `Αγγελία ${id}`, availability: Q1_2028, availabilityTrack: track });
}

const knewBefore: TopicKnowledge = {
  match: { kind: 'announced', atMs: CHANGED_MS - MS_PER_DAY },
  priceDropKnown: false,
  availabilityChangeKnown: false,
};

function run(demands: ReturnType<typeof demand>[], listings: PublicListing[]) {
  return announceAvailabilityChanges({} as never, {
    demands,
    listings,
    knowledge: knowledgeFromListings(listings),
    todayDate: TODAY,
    nowMs: NOW_MS,
    destinationOf: listingMatchDestination,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  dispatchNotification.mockResolvedValue({ success: true, skipped: false, dedupeKey: 'k' });
});

describe('Π — ποιος ακούει τι', () => {
  it('🔴 Π1 — ο άνθρωπος που ΗΞΕΡΕ την αγγελία και τη χάνει ακούει ΜΙΑ είδηση, με τις δύο ζητήσεις του ως λόγους', async () => {
    readRecipientLedger.mockResolvedValue(new Map([['prop_1', knewBefore]]));
    const a = demand({ id: 'dmnd_a', timing: WINDOW, title: 'Σπίτι 2027' });
    const b = demand({ id: 'dmnd_b', timing: WINDOW, title: 'Επένδυση' });

    const tally = await run([a, b], [slipped()]);

    expect(dispatchNotification).toHaveBeenCalledTimes(1);
    const request = dispatchNotification.mock.calls[0][0];
    expect(request.eventType).toBe(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_AVAILABILITY_CHANGE);
    expect(request.eventId).toBe(recipientAvailabilityChangeEventId('prop_1', CHANGE));
    expect(request.reasons).toEqual(['dmnd_a', 'dmnd_b']);
    expect(request.titleKey).toBe('demandAvailabilityChange.lostTitleMany');
    expect(request.body).toContain('Γ΄ τρίμηνο 2027');
    expect(request.body).toContain('Α΄ τρίμηνο 2028');
    expect(request.body).toContain('Δεν ταιριάζει πια');
    expect(tally.announced).toBe(1);
  });

  it('🔴 Π2 — ⛔ ιδιωτικότητα: το σώμα λέει μόνο δημόσιες τιμές, ποτέ αιτία ή φάση', async () => {
    readRecipientLedger.mockResolvedValue(new Map([['prop_1', knewBefore]]));

    await run([demand({ id: 'dmnd_a', timing: WINDOW })], [slipped()]);

    expect(dispatchNotification.mock.calls[0][0].body).not.toMatch(/φάση|καθυστέρ|πρόβλεψη|χρονοδιάγραμμα/i);
  });

  it('Π3 — δεν του είπαμε ποτέ για την αγγελία ⇒ σιωπή, μετρημένη', async () => {
    readRecipientLedger.mockResolvedValue(new Map());

    const tally = await run([demand({ id: 'dmnd_a', timing: WINDOW })], [slipped()]);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(tally['never-known']).toBe(1);
  });

  it('Π4 — idempotent: η ίδια αλλαγή ήδη ειπωμένη ⇒ `already-known`, καμία αποστολή', async () => {
    readRecipientLedger.mockResolvedValue(new Map([['prop_1', { ...knewBefore, availabilityChangeKnown: true }]]));

    const tally = await run([demand({ id: 'dmnd_a', timing: WINDOW })], [slipped()]);

    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(tally['already-known']).toBe(1);
  });

  it('Π5 — καμία αλλαγή στην αγορά ⇒ καμία ανάγνωση καθολογίου, καμία αποστολή', async () => {
    const tally = await run([demand({ id: 'dmnd_a', timing: WINDOW })], [listing()]);

    expect(readRecipientLedger).not.toHaveBeenCalled();
    expect(Object.values(tally).every((count) => count === 0)).toBe(true);
  });

  it('Π6 — το καθολόγιο ρωτιέται με την ΑΛΛΑΓΗ, όχι με μείωση', async () => {
    readRecipientLedger.mockResolvedValue(new Map());

    await run([demand({ id: 'dmnd_a', authorUserId: 'usr_x', timing: WINDOW })], [slipped()]);

    expect(readRecipientLedger.mock.calls[0][1]).toBe('usr_x');
    expect(readRecipientLedger.mock.calls[0][2]).toEqual([
      { listingId: 'prop_1', demandIds: ['dmnd_a'], reduction: null, availabilityChange: CHANGE },
    ]);
  });
});
