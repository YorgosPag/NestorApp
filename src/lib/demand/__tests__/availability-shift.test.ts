/**
 * Άγκυρες: **ΠΟΙΟΣ ΧΑΝΕΙ Ή ΚΕΡΔΙΖΕΙ ΤΑΙΡΙ ΑΠΟ ΜΙΑ ΑΛΛΑΓΗ ΤΗΣ ΔΗΜΟΣΙΑΣ ΥΠΟΣΧΕΣΗΣ** (ADR-919 §10).
 *
 * Η μηχανή ταιριάσματος τρέχει **πραγματικά**: αν εδώ μπει δεύτερη κρίση χρόνου, θα διαφωνήσει με το `timingBlockers`
 * στο πρώτο όριο, και αυτές οι άγκυρες θα το δουν.
 */

import { availabilityShiftsOf, judgeableChangeOf } from '../availability-shift';
import { availabilityChangeVerdict, recipientAvailabilityChangeEventId } from '../demand-announcement';
import { demand, facts, listing, TODAY } from './demand-fixtures';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import { MS_PER_DAY } from '@/lib/date-local';
import type { AvailabilityChange, AvailabilityRevisionKind } from '@/types/availability-history';
import {
  LISTING_AVAILABILITY_READY,
  LISTING_AVAILABILITY_UNKNOWN,
  type ListingAvailability,
} from '@/types/listing-availability';

const CHANGED_AT = '2026-08-10T09:00:00.000Z';
const NOW_MS = Date.parse(CHANGED_AT) + MS_PER_DAY;

const Q3_2027 = scheduledAvailability('quarter', '2027-08-01');
const Q1_2028 = scheduledAvailability('quarter', '2028-02-01');
const SEPTEMBER_2027 = scheduledAvailability('month', '2027-09-15');

const WINDOW_2027 = demand({ id: 'dmnd_window', timing: { kind: 'window', fromDate: '2027-06-01', toDate: '2027-12-31' } });
const WHENEVER = demand({ id: 'dmnd_whenever' });

function changed(
  kind: AvailabilityRevisionKind,
  from: ListingAvailability,
  now: ListingAvailability,
  at = CHANGED_AT,
) {
  const lastChange: AvailabilityChange = { kind, from, at };
  const track = { originally: Q3_2027, slips: kind === 'slipped' ? 1 : 0, lastChange };
  return facts({ listing: listing({ availability: now, availabilityTrack: track }), availability: now });
}

const ids = (outcomes: readonly { facts: { listing: { id: string } } }[]) => outcomes.map((o) => o.facts.listing.id);

describe('Χ — η μηχανή ρωτιέται δύο φορές', () => {
  it('🔴 μετάθεση πέρα από το διάστημα ⇒ η ζήτηση «2027» ΧΑΝΕΙ, η «όποτε» δεν αλλάζει', () => {
    const shifts = availabilityShiftsOf([WINDOW_2027, WHENEVER], [changed('slipped', Q3_2027, Q1_2028)], TODAY, NOW_MS);
    expect(shifts.lost.map((s) => s.demand.id)).toEqual(['dmnd_window']);
    expect(ids(shifts.lost[0].matched)).toEqual(['prop_1']);
    expect(shifts.gained).toEqual([]);
  });

  it('επίσπευση μέσα στο διάστημα ⇒ ΚΕΡΔΙΖΕΙ', () => {
    const shifts = availabilityShiftsOf([WINDOW_2027], [changed('advanced', Q1_2028, Q3_2027)], TODAY, NOW_MS);
    expect(shifts.gained.map((s) => s.demand.id)).toEqual(['dmnd_window']);
    expect(shifts.lost).toEqual([]);
  });

  it('απόσυρση της υπόσχεσης ⇒ η μηχανή λέει `availability-unknown`, άρα ΧΑΝΕΙ', () => {
    const shifts = availabilityShiftsOf([WINDOW_2027], [changed('withdrawn', Q3_2027, LISTING_AVAILABILITY_UNKNOWN)], TODAY, NOW_MS);
    expect(shifts.lost.map((s) => s.demand.id)).toEqual(['dmnd_window']);
  });

  it('παράδοση ⇒ όποιος δεν ταίριαζε, ΚΕΡΔΙΖΕΙ (Δ4: το `ready` ταιριάζει παντού)', () => {
    const shifts = availabilityShiftsOf([WINDOW_2027], [changed('delivered', Q1_2028, LISTING_AVAILABILITY_READY)], TODAY, NOW_MS);
    expect(shifts.gained.map((s) => s.demand.id)).toEqual(['dmnd_window']);
  });

  it('μετάθεση που μένει μέσα στο διάστημα ⇒ καμία είδηση (δεν άλλαξε η απάντηση)', () => {
    const later2027 = scheduledAvailability('quarter', '2027-11-01');
    const shifts = availabilityShiftsOf([WINDOW_2027], [changed('slipped', Q3_2027, later2027)], TODAY, NOW_MS);
    expect(shifts).toEqual({ lost: [], gained: [] });
  });

  it('εξειδίκευση, παλιά αλλαγή ή καμία αλλαγή ⇒ η μηχανή ΔΕΝ ρωτιέται καν', () => {
    const stale = changed('slipped', Q3_2027, Q1_2028, '2026-06-01T00:00:00.000Z');
    const refined = changed('refined', Q3_2027, SEPTEMBER_2027);
    const shifts = availabilityShiftsOf([WINDOW_2027], [stale, refined, facts()], TODAY, NOW_MS);
    expect(shifts).toEqual({ lost: [], gained: [] });
    expect(judgeableChangeOf(null, NOW_MS)).toBeNull();
  });

  it('ό,τι άλλο εμπόδιζε το ταίρι δεν χρεώνεται στη μετάθεση (τιμή εκτός ορίου ⇒ καμία είδηση)', () => {
    const tooCheap = demand({ ...WINDOW_2027, id: 'dmnd_cheap', seeks: [{ kind: 'sell', price: { min: null, max: 1000 } }] });
    const shifts = availabilityShiftsOf([tooCheap], [changed('slipped', Q3_2027, Q1_2028)], TODAY, NOW_MS);
    expect(shifts).toEqual({ lost: [], gained: [] });
  });
});

describe('Ε — η ετυμηγορία', () => {
  const change: AvailabilityChange = { kind: 'slipped', from: Q3_2027, at: CHANGED_AT };
  const changedMs = Date.parse(CHANGED_AT);
  const before = { kind: 'announced', atMs: changedMs - MS_PER_DAY } as const;
  const after = { kind: 'announced', atMs: changedMs + 1 } as const;
  const never = { kind: 'never-announced' } as const;

  it.each([
    ['ξέρει την αγγελία από ΠΡΙΝ ⇒ λέγεται', 'lost', before, 'announce'],
    ['κερδίζει, την ήξερε ⇒ λέγεται («ταιριάζει ξανά»)', 'gained', before, 'announce'],
    ['🔴 χάνει κάτι που δεν του είπαμε ποτέ ⇒ σιωπή', 'lost', never, 'never-known'],
    ['🔴 κερδίζει κάτι άγνωστο ⇒ το λέει το email ταιριάσματος, ΜΙΑ φορά', 'gained', never, 'left-to-match'],
    ['το έμαθε ΜΕΤΑ την αλλαγή ⇒ το ήξερε ήδη', 'gained', after, 'predates-change'],
    ['άγνωστη στιγμή ανακοίνωσης ⇒ σιωπή', 'lost', { kind: 'announced', atMs: null }, 'predates-change'],
  ] as const)('%s', (_name, direction, match, verdict) => {
    expect(availabilityChangeVerdict(change, direction, match, NOW_MS)).toBe(verdict);
  });

  it('παλιά αλλαγή ⇒ `stale` (φράχτης backfill)', () => {
    expect(availabilityChangeVerdict(change, 'lost', before, changedMs + 31 * MS_PER_DAY)).toBe('stale');
  });

  it('το κλειδί είναι η έκδοση της δήλωσης: ίδια αλλαγή ⇒ ίδιο κλειδί, νέα αλλαγή ⇒ νέο', () => {
    expect(recipientAvailabilityChangeEventId('prop_1', change)).toBe(`listing:prop_1:availability:${CHANGED_AT}`);
    expect(recipientAvailabilityChangeEventId('prop_1', { at: '2026-09-01T00:00:00.000Z' })).not.toBe(
      recipientAvailabilityChangeEventId('prop_1', change),
    );
  });
});
