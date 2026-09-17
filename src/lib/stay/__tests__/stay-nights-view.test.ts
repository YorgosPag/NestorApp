/**
 * @fileoverview **ΤΟ ΔΗΜΟΣΙΟ ΗΜΕΡΟΛΟΓΙΟ ΔΕΝ ΛΕΕΙ ΠΟΤΕ ΚΑΤΙ ΑΛΛΟ ΑΠΟ ΤΗ ΜΗΧΑΝΗ** (ADR-835 §21).
 *
 * 🔴 Η άγκυρα ισοδυναμίας ελέγχει **κάθε** ζεύγος (άφιξη, αναχώρηση) σε 60 ημέρες πάνω σε
 * ημερολόγιο με **όλους** τους κανόνες μαζί. Αν το πλέγμα επέτρεπε επιλογή που η μηχανή
 * απορρίπτει (ή το αντίθετο), ο επισκέπτης θα έβλεπε ψέμα — και το ζεύγος το ονομάζει.
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { stayAvailabilityFor } from '@/lib/stay/stay-availability';
import { isStayable } from '@/lib/stay/stay-availability-vocabulary';
import { publicNightsOf, stayableInView, type StayPublicNight } from '@/lib/stay/stay-nights-view';

import {
  blockEntry,
  bookingEntry,
  calendarOf,
  listingOf,
  rulesInput,
} from './stay-rules-fixtures';

const FROM = '2026-09-01';
const TO = '2026-10-31';

const LISTING = listingOf({ minNights: 3, maxGuests: 4, nextAvailableFrom: null });
const ENTRIES = [
  bookingEntry('stay_a', '2026-09-08', '2026-09-12'),
  bookingEntry('stay_b', '2026-09-15', '2026-09-20'),
  blockEntry('sblk_x', '2026-09-24', '2026-09-26', 'external'),
  blockEntry('sblk_o', '2026-10-05', '2026-10-07', 'owner'),
];
const RULES = rulesInput(
  {
    maxNights: 9,
    advanceNotice: { days: 2, sameDayCutoffHour: null },
    preparationNights: 1,
    availabilityWindowMonths: 3,
    departureWeekdays: [1, 2, 3, 4, 5, 6],
    orphanGap: { maxNights: 2 },
  },
  {
    '2026-09-21': { closedToArrival: true },
    '2026-09-30': { closedToDeparture: true },
    '2026-10-10': { minNights: 5, maxNights: 6 },
  },
);
const CALENDAR = calendarOf(ENTRIES, RULES);

function declaredNights(): readonly StayPublicNight[] {
  const view = publicNightsOf(LISTING, CALENDAR, null, FROM, TO);
  if (view.kind !== 'declared') throw new Error(`αναμενόταν δηλωμένο, ήρθε ${view.kind}`);
  return view.nights;
}

describe('Α — ισοδυναμία πλέγματος ⇔ μηχανής, ΚΑΘΕ ζεύγος', () => {
  it('καμία διαφωνία σε 60 × 60 ζεύγη — και υπάρχουν ΚΑΙ ναι ΚΑΙ όχι', () => {
    const nights = declaredNights();
    const disagreements: string[] = [];
    let yes = 0;
    for (let i = 0; i < nights.length; i += 1) {
      for (let n = 1; i + n < nights.length; n += 1) {
        const checkIn = nights[i].date;
        const checkOut = nights[i + n].date;
        const engine = isStayable(
          stayAvailabilityFor(LISTING, { checkIn, checkOut, guests: null }, CALENDAR, null).kind,
        );
        const grid = stayableInView(nights, checkIn, checkOut);
        if (engine) yes += 1;
        if (engine !== grid) disagreements.push(`${checkIn}→${checkOut}: μηχανή ${engine} · πλέγμα ${grid}`);
      }
    }
    expect(disagreements).toEqual([]);
    // Παρονομαστής: ένα «όλα όχι» θα συμφωνούσε κενά.
    expect(yes).toBeGreaterThan(20);
  });
});

describe('Β — τι βλέπει ο επισκέπτης', () => {
  const byDate = (date: string) => declaredNights().find((night) => night.date === date);

  it('νύχτες προ ειδοποίησης και κρατημένες είναι κλειστές· η νύχτα προετοιμασίας επίσης', () => {
    expect(byDate('2026-09-02')?.state).toBe('closed');
    expect(byDate('2026-09-09')?.state).toBe('closed');
    expect(byDate('2026-09-12')?.state).toBe('closed');
  });

  it('🔴 «μόνο αναχώρηση»: η μέρα που ξεκινά η κράτηση δέχεται αναχώρηση αλλά όχι άφιξη', () => {
    // Η 07/09 είναι νύχτα προετοιμασίας πριν την κράτηση 08/09 ⇒ κλειστή· η 06/09 ανοιχτή.
    const night = byDate('2026-09-07');
    expect(night?.state).toBe('closed');
    expect(night?.checkOutAllowed).toBe(true);
    expect(night?.checkInAllowed).toBe(false);
  });

  it('🔴 ορφανή νύχτα 13/09 (ανάμεσα σε προετοιμασίες) δείχνει ελάχιστο 1 — η χαλάρωση ΟΡΑΤΗ ανά μέρα', () => {
    // stay_a [08,12) + προετοιμασία 12 · stay_b [15,20) + προετοιμασία 14 ⇒ κενό = μόνο η 13.
    expect(byDate('2026-09-13')?.minNights).toBe(1);
    expect(byDate('2026-09-13')?.checkInAllowed).toBe(true);
    expect(byDate('2026-09-27')?.minNights).toBe(3);
  });

  it('🔴 ποτέ ποιος ή γιατί — μόνο τα έξι πεδία', () => {
    expect(Object.keys(declaredNights()[0]).sort()).toEqual(
      ['checkInAllowed', 'checkOutAllowed', 'date', 'maxNights', 'minNights', 'state'],
    );
  });

  it('η πρώτη μέρα του εύρους κρίνει αναχώρηση με τη ΧΘΕΣΙΝΗ νύχτα', () => {
    const view = publicNightsOf(LISTING, CALENDAR, null, '2026-09-13', '2026-09-20');
    expect(view.kind === 'declared' && view.nights[0].checkOutAllowed).toBe(false);
    const next = addDaysToDateKey('2026-09-13', 1) ?? '';
    expect(view.kind === 'declared' && view.nights.find((n) => n.date === next)?.checkOutAllowed).toBe(true);
  });
});

describe('Γ — ό,τι δεν είναι δηλωμένο, δεν ζωγραφίζεται', () => {
  it('αδήλωτο και αδιάβαστο περνούν αυτούσια', () => {
    expect(publicNightsOf(LISTING, { kind: 'undeclared' }, null, FROM, TO).kind).toBe('undeclared');
    expect(publicNightsOf(LISTING, { kind: 'unreadable' }, null, FROM, TO).kind).toBe('unreadable');
  });

  it('🔴 ΚΑΝΑΛΙ ΠΟΥ ΣΩΠΑΣΕ (§22): ελεύθερες → `unsynced`, κλειστές ΜΕΝΟΥΝ κλειστές, καμία επιλογή', () => {
    const stale = calendarOf(ENTRIES, RULES, 'stale');
    const view = publicNightsOf(LISTING, stale, null, FROM, TO);
    if (view.kind !== 'declared') throw new Error('δηλωμένο');
    const byDay = (date: string) => view.nights.find((night) => night.date === date);

    expect(byDay('2026-09-27')?.state).toBe('unsynced');
    expect(byDay('2026-09-09')?.state).toBe('closed');
    // 🔑 Η ισοδυναμία με τη μηχανή κρατά: εκείνη απαντά `unsynced` (μη-`stayable`), και το
    //    πλέγμα **δεν δέχεται** άφιξη ⇒ ο επισκέπτης δεν μπορεί να επιλέξει ό,τι θα του
    //    απορριπτόταν.
    expect(byDay('2026-09-27')?.checkInAllowed).toBe(false);
    expect(view.nights.every((night) => !night.checkInAllowed)).toBe(true);
    expect(stayableInView(view.nights, '2026-09-27', '2026-09-30')).toBe(false);
  });

  it('🔴 υπό αίρεση πώληση: ελεύθερες νύχτες γίνονται `conditional`, οι κλειστές μένουν κλειστές', () => {
    const view = publicNightsOf(LISTING, CALENDAR, { conditionalFrom: '2026-10-01' }, FROM, TO);
    if (view.kind !== 'declared') throw new Error('δηλωμένο');
    expect(view.nights.find((n) => n.date === '2026-09-27')?.state).toBe('free');
    expect(view.nights.find((n) => n.date === '2026-10-02')?.state).toBe('conditional');
    expect(view.nights.find((n) => n.date === '2026-09-09')?.state).toBe('closed');
  });
});
