/**
 * ADR-835 §23.5 (Στάδιο Δ) — **«σε αναμονή ως 14:00»**: το πλέγμα και η μηχανή λένε το ΙΔΙΟ.
 *
 * 🔑 Κάθε άγκυρα έχει τον παρονομαστή της: η ίδια διάταξη **με ληγμένο** αίτημα, ή **με σκληρή**
 * κατάληψη δίπλα — αλλιώς ένα «held» παντού θα περνούσε ως σωστό.
 */

import { isStayable } from '@/lib/stay/stay-availability-vocabulary';
import { stayAvailabilityFor } from '@/lib/stay/stay-availability';
import { publicNightsOf } from '@/lib/stay/stay-nights-view';

import { bookingEntry, calendarOf, listingOf, requestEntry, rulesInput } from './stay-rules-fixtures';

/** Το CLOCK των fixtures είναι 1/9/2026 07:00Z. */
const LIVE = '2026-09-02T12:00:00.000Z';
const DEAD = '2026-09-01T06:59:00.000Z';
const QUERY = { checkIn: '2026-09-20', checkOut: '2026-09-23', guests: null };

const nightsOf = (entries: Parameters<typeof calendarOf>[0], preparation: 0 | 1 = 0) => {
  const view = publicNightsOf(listingOf(), calendarOf(entries, rulesInput({ preparationNights: preparation })), null, '2026-09-18', '2026-09-26');
  if (view.kind !== 'declared') throw new Error(view.kind);
  return new Map(view.nights.map((night) => [night.date, night]));
};

describe('Π — το δημόσιο πλέγμα', () => {
  it('ζωντανό αίτημα ⇒ `held` με την προθεσμία, και ΔΕΝ δέχεται άφιξη', () => {
    const night = nightsOf([requestEntry('stay_r', '2026-09-20', '2026-09-23', LIVE)]).get('2026-09-21');
    expect(night).toMatchObject({ state: 'held', heldUntil: LIVE, checkInAllowed: false });
  });

  it('🔴 ο παρονομαστής: το ίδιο αίτημα ΛΗΓΜΕΝΟ ⇒ ελεύθερη νύχτα, χωρίς cron', () => {
    const night = nightsOf([requestEntry('stay_r', '2026-09-20', '2026-09-23', DEAD)]).get('2026-09-21');
    expect(night).toMatchObject({ state: 'free', heldUntil: null });
  });

  it('σκληρή κατάληψη στην ίδια νύχτα ΚΕΡΔΙΖΕΙ — στο `heldUntil` δεν θα ελευθερωνόταν', () => {
    const night = nightsOf([
      requestEntry('stay_r', '2026-09-20', '2026-09-23', LIVE),
      bookingEntry('stay_b', '2026-09-21', '2026-09-22'),
    ]).get('2026-09-21');
    expect(night).toMatchObject({ state: 'closed', heldUntil: null });
  });

  it('η προετοιμασία γύρω από ζωντανό αίτημα είναι κι αυτή `held` — ανοίγει μαζί του', () => {
    const nights = nightsOf([requestEntry('stay_r', '2026-09-20', '2026-09-23', LIVE)], 1);
    expect(nights.get('2026-09-19')?.state).toBe('held');
    expect(nights.get('2026-09-23')?.state).toBe('held');
  });
});

describe('Μ — η μηχανή', () => {
  it('μόνο ζωντανό αίτημα στη μέση ⇒ `held` με την προθεσμία — ΟΧΙ επιτρεπτή διαμονή', () => {
    const answer = stayAvailabilityFor(listingOf(), QUERY, calendarOf([requestEntry('stay_r', '2026-09-21', '2026-09-22', LIVE)]), null);
    expect(answer).toEqual({ kind: 'held', until: LIVE });
    expect(isStayable(answer.kind)).toBe(false);
  });

  it('🔴 αίτημα ΚΑΙ σκληρή κράτηση ⇒ `occupied` — το «σε αναμονή» θα ήταν ψέμα', () => {
    const answer = stayAvailabilityFor(listingOf(), QUERY, calendarOf([
      requestEntry('stay_r', '2026-09-20', '2026-09-21', LIVE),
      bookingEntry('stay_b', '2026-09-22', '2026-09-23'),
    ]), null);
    expect(answer.kind).toBe('occupied');
  });

  it('ληγμένο αίτημα ⇒ `free` — ο παρονομαστής', () => {
    const answer = stayAvailabilityFor(listingOf(), QUERY, calendarOf([requestEntry('stay_r', '2026-09-21', '2026-09-22', DEAD)]), null);
    expect(answer.kind).toBe('free');
  });
});
