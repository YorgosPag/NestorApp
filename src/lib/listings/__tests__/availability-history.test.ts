/**
 * Άγκυρες: **ΤΟ ΙΣΤΟΡΙΚΟ ΤΗΣ ΔΗΜΟΣΙΑΣ ΥΠΟΣΧΕΣΗΣ** (ADR-919 §10 · ADR-777 §8.99.4 Δ3).
 *
 * Το «μετατέθηκε N φορές» είναι **δημόσιος ισχυρισμός** για τον κατασκευαστή. Αν εδώ μια εξειδίκευση μετρηθεί
 * ως μετάθεση ή μια σιωπηλή αποτυχία γεννήσει «απόσυρση», ο κόσμος ακούει κάτι που δεν συνέβη.
 */

import {
  AVAILABILITY_HISTORY_MAX_ENTRIES,
  availabilityRevisionOf,
  availabilityTrackForListing,
  availabilityTrackOf,
  isAvailabilityChangeFresh,
  nextAvailabilityHistory,
  publicAvailabilityOf,
  readAvailabilityHistory,
  readStoredAvailabilityTrack,
  slipNoticeOf,
} from '../availability-history';
import { scheduledAvailability } from '../availability-window';
import { MS_PER_DAY } from '@/lib/date-local';
import type { AvailabilityObservation, ScheduledAvailability } from '@/types/availability-history';
import {
  LISTING_AVAILABILITY_READY,
  LISTING_AVAILABILITY_UNKNOWN,
  type ListingAvailability,
} from '@/types/listing-availability';

function scheduled(precision: 'quarter' | 'month' | 'day', anchor: string): ScheduledAvailability {
  const value = scheduledAvailability(precision, anchor);
  if (value.kind !== 'scheduled') throw new Error(`άκυρη άγκυρα ${anchor}`);
  return value;
}

const Q2 = scheduled('quarter', '2027-05-01');
const Q3 = scheduled('quarter', '2027-08-01');
const Q4 = scheduled('quarter', '2027-11-01');
const SEPTEMBER = scheduled('month', '2027-09-10');
const OCTOBER = scheduled('month', '2027-10-10');

/** Ιστορικό με μία παρατήρηση τη μέρα, από 2026-01-01. */
function historyOf(...values: ListingAvailability[]): AvailabilityObservation[] {
  return values.map((availability, index) => ({
    at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    availability,
  }));
}

const LATER = '2027-01-01T00:00:00.000Z';

describe('Τ — τι είδους αλλαγή (κρίνεται το ΤΕΛΟΣ)', () => {
  it.each([
    ['Γ\' → Δ\' τρίμηνο = μετάθεση', Q3, Q4, 'slipped'],
    ['Γ\' τρίμηνο → Οκτώβριος = μετάθεση (το τέλος πάει αργότερα)', Q3, OCTOBER, 'slipped'],
    ['Δ\' → Γ\' τρίμηνο = επίσπευση', Q4, Q3, 'advanced'],
    ['Γ\' τρίμηνο → Σεπτέμβριος = εξειδίκευση, ΟΧΙ μετάθεση', Q3, SEPTEMBER, 'refined'],
  ] as const)('%s', (_name, from, to, kind) => {
    expect(availabilityRevisionOf(from, to)).toBe(kind);
  });

  it('παράδοση, απόσυρση, νέα υπόσχεση', () => {
    expect(availabilityRevisionOf(Q3, LISTING_AVAILABILITY_READY)).toBe('delivered');
    expect(availabilityRevisionOf(Q3, LISTING_AVAILABILITY_UNKNOWN)).toBe('withdrawn');
    expect(availabilityRevisionOf(null, Q3)).toBe('promised');
  });

  it('η ΑΡΧΗ του διαστήματος δεν μετρά: Γ\' τρίμηνο → 1 Ιουλίου είναι επίσπευση, όχι «ίδιο»', () => {
    expect(availabilityRevisionOf(Q3, scheduled('day', '2027-07-01'))).toBe('advanced');
  });
});

describe('Ε — η εγγραφή', () => {
  it('το ιστορικό ξεκινά ΜΟΝΟ με υπόσχεση: έτοιμο ή άγνωστο ακίνητο δεν γράφει τίποτα', () => {
    expect(nextAvailabilityHistory([], LISTING_AVAILABILITY_READY, LATER)).toBeNull();
    expect(nextAvailabilityHistory([], LISTING_AVAILABILITY_UNKNOWN, LATER)).toBeNull();
    expect(nextAvailabilityHistory([], Q3, LATER)).toEqual([{ at: LATER, availability: Q3 }]);
  });

  it('ίδια τιμή ⇒ καμία εγγραφή (η σφραγίδα δεν ανοίγει συναλλαγή)', () => {
    expect(nextAvailabilityHistory(historyOf(Q3), scheduled('quarter', '2027-07-20'), LATER)).toBeNull();
  });

  it('μη δημόσια αγγελία ⇒ τίποτα προς καταγραφή', () => {
    expect(publicAvailabilityOf(Q4, false)).toBeNull();
    expect(nextAvailabilityHistory(historyOf(Q3), publicAvailabilityOf(Q4, false), LATER)).toBeNull();
    expect(publicAvailabilityOf(Q4, true)).toBe(Q4);
  });

  it('μόνο προς τα εμπρός στον χρόνο', () => {
    const history = historyOf(Q3);
    expect(nextAvailabilityHistory(history, Q4, history[0].at)).toBeNull();
    expect(nextAvailabilityHistory(history, Q4, '2025-01-01T00:00:00.000Z')).toBeNull();
  });

  it('όριο εγγραφών: κρατιέται η ΑΡΧΙΚΗ υπόσχεση του επεισοδίου', () => {
    const values: ListingAvailability[] = [Q2];
    for (let index = 0; index < AVAILABILITY_HISTORY_MAX_ENTRIES; index += 1) {
      values.push(index % 2 === 0 ? LISTING_AVAILABILITY_UNKNOWN : Q3);
    }
    const next = nextAvailabilityHistory(historyOf(...values), Q4, LATER);
    expect(next).toHaveLength(AVAILABILITY_HISTORY_MAX_ENTRIES);
    expect(next?.[0].availability).toEqual(Q2);
    expect(availabilityTrackOf(next ?? [])?.originally).toEqual(Q2);
  });
});

describe('Ι — η ιστορία', () => {
  it('«αρχικά Β\' τρ. · μετατέθηκε 2 φορές», οι επισπεύσεις και οι εξειδικεύσεις δεν μετρούν', () => {
    const track = availabilityTrackOf(historyOf(Q2, Q3, SEPTEMBER, Q2, Q4));
    expect(track?.originally).toEqual(Q2);
    expect(track?.slips).toBe(2);
    expect(track?.lastChange).toMatchObject({ kind: 'slipped', from: Q2 });
  });

  it('μετάθεση πάνω από κενό: Β\' τρ. → άγνωστο → Δ\' τρ. = 1 μετάθεση', () => {
    const track = availabilityTrackOf(historyOf(Q2, LISTING_AVAILABILITY_UNKNOWN, Q4));
    expect(track?.slips).toBe(1);
    expect(track?.lastChange).toMatchObject({ kind: 'slipped', from: LISTING_AVAILABILITY_UNKNOWN });
  });

  it('η παράδοση κλείνει το επεισόδιο ΚΑΙ κρατά την αλλαγή (ο ειδοποιητής τη χρειάζεται)', () => {
    const track = availabilityTrackOf(historyOf(Q2, Q3, LISTING_AVAILABILITY_READY));
    expect(track?.slips).toBe(1);
    expect(track?.lastChange).toMatchObject({ kind: 'delivered', from: Q3 });
  });

  it('νέα υπόσχεση μετά την παράδοση = νέο επεισόδιο, χωρίς τις παλιές μεταθέσεις', () => {
    const track = availabilityTrackOf(historyOf(Q2, Q3, LISTING_AVAILABILITY_READY, Q4));
    expect(track).toEqual({ originally: Q4, slips: 0, lastChange: null });
  });

  it('χωρίς υπόσχεση ⇒ καμία ιστορία', () => {
    expect(availabilityTrackOf([])).toBeNull();
  });
});

describe('Δ — το δίχτυ και η οθόνη', () => {
  it('η ιστορία γράφεται μόνο αν λέει την ΙΔΙΑ τιμή με την αγγελία (σφραγίδα που απέτυχε ⇒ σιωπή)', () => {
    const stored = historyOf(Q2, Q3);
    expect(availabilityTrackForListing(stored, Q3)?.slips).toBe(1);
    expect(availabilityTrackForListing(stored, Q4)).toBeNull();
  });

  it('το «μετατέθηκε» λέγεται μόνο όσο υπάρχει υπόσχεση και τουλάχιστον μία μετάθεση', () => {
    const slipped = availabilityTrackOf(historyOf(Q2, Q3));
    expect(slipNoticeOf(slipped, Q3)).toEqual({ originally: Q2, slips: 1 });
    expect(slipNoticeOf(slipped, LISTING_AVAILABILITY_READY)).toBeNull();
    expect(slipNoticeOf(availabilityTrackOf(historyOf(Q3, Q2)), Q2)).toBeNull();
  });

  it('φρεσκάδα της είδησης: 30 ημέρες, το «τώρα» είναι όρισμα', () => {
    const change = { kind: 'slipped' as const, from: Q2, at: '2026-03-01T00:00:00.000Z' };
    const atMs = Date.parse(change.at);
    expect(isAvailabilityChangeFresh(change, atMs + 30 * MS_PER_DAY)).toBe(true);
    expect(isAvailabilityChangeFresh(change, atMs + 31 * MS_PER_DAY)).toBe(false);
  });
});

describe('Μ — το σύνορο του αποθηκευμένου', () => {
  it('ταξινομεί κατά χρόνο', () => {
    const [first, second] = historyOf(Q2, Q3);
    expect(readAvailabilityHistory([second, first])).toEqual([first, second]);
  });

  it('μία κακή εγγραφή ⇒ ΟΛΟ κενό (ποτέ ψεύτικη «απόσυρση»)', () => {
    const [first] = historyOf(Q2);
    expect(readAvailabilityHistory([first, { at: LATER, availability: { kind: 'scheduled' } }])).toEqual([]);
    expect(readAvailabilityHistory('σκουπίδι')).toEqual([]);
    expect(readAvailabilityHistory([{ at: 'όχι στιγμή', availability: Q2 }])).toEqual([]);
  });

  it('κρίκος 27: η αποθηκευμένη ιστορία ξαναβγαίνει ταυτόσημη (Κ3), το σκουπίδι γίνεται `null`', () => {
    const track = availabilityTrackOf(historyOf(Q2, Q3));
    expect(readStoredAvailabilityTrack(JSON.parse(JSON.stringify(track)))).toEqual(track);
    expect(readStoredAvailabilityTrack({ originally: LISTING_AVAILABILITY_READY, slips: 0, lastChange: null })).toBeNull();
    expect(readStoredAvailabilityTrack({ originally: Q2, slips: -1, lastChange: null })).toBeNull();
    expect(readStoredAvailabilityTrack(undefined)).toBeNull();
  });
});
