/**
 * @fileoverview **ΤΙ ΘΑ ΓΙΝΕΙ ΑΝ ΖΗΤΗΣΩ;** — η απάντηση της μηχανής ΚΑΙ η προθεσμία, σε μία σύνθεση.
 * @related ADR-835 §23.3 · §23.5 · lib/stay/stay-availability.ts · lib/stay/stay-hold-deadline.ts ·
 *   services/stay-calendar/stay-calendar-public.service.ts · services/stay-calendar/stay-calendar-request-write.ts
 * @module lib/stay/stay-request-preview
 *
 * 🔑 **ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ, ΜΙΑ ΣΥΝΘΕΣΗ — ΚΑΙ ΓΙ' ΑΥΤΟ Η ΥΠΟΣΧΕΣΗ ΤΗΣ ΟΘΟΝΗΣ ΕΙΝΑΙ ΑΛΗΘΙΝΗ.**
 *
 * | Καταναλωτής | Τι κάνει με την απάντηση |
 * |---|---|
 * | η δημόσια απάντηση (`readPublicStayAnswers`) | τη **δείχνει**: «ο οικοδεσπότης θα απαντήσει ως Τρίτη 14:00» |
 * | ο γραφέας (`decideRequest`) | τη **δεσμεύει**, μέσα στη συναλλαγή, πάνω σε φρέσκα δεδομένα |
 *
 * Αν ο καθένας συνέθετε μόνος του, η οθόνη θα υποσχόταν μια ώρα και ο γραφέας θα έγραφε άλλη — ή η
 * οθόνη θα έλεγε «μπορείς» και ο γραφέας «όχι». Η μόνη διαφορά των δύο είναι **η στιγμή** (λίγα
 * δευτερόλεπτα), και αυτή είναι δηλωμένη: η υπόσχεση ξαναϋπολογίζεται στη δέσμευση.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, μηδέν I/O· το ρολόι έρχεται ως είσοδος.
 */

import type { PublicListing } from '@/types/public-listing';
import { STAY_RULES_NONE, type StayClock } from '@/types/stay-rules';

import { saleExposureOf, stayAvailabilityFor } from './stay-availability';
import { isStayable, type StayAvailabilityAnswer, type StayQuery } from './stay-availability-vocabulary';
import { stayCalendarOf, type StayCalendarReading } from './stay-calendar-of';
import { stayHoldDeadline, type StayHoldDeadline } from './stay-hold-deadline';

export interface StayRequestPreview {
  readonly answer: StayAvailabilityAnswer;
  /**
   * Η προθεσμία που **θα** πάρει ένα αίτημα τώρα — **μόνο** όταν η απάντηση επιτρέπει διαμονή·
   * αλλιώς `null` (δεν υπάρχει αίτημα να έχει προθεσμία).
   */
  readonly hold: StayHoldDeadline | null;
}

/** **Η απάντηση και η προθεσμία** για ένα ερώτημα, τη στιγμή `clock`. */
export function stayRequestPreview(
  listing: PublicListing,
  reading: StayCalendarReading,
  clock: StayClock,
  query: StayQuery,
): StayRequestPreview {
  const answer = stayAvailabilityFor(listing, query, stayCalendarOf(reading, clock), saleExposureOf(listing));
  if (!isStayable(answer.kind) || reading.kind !== 'readable') return { answer, hold: null };
  const rules = reading.head?.rules ?? STAY_RULES_NONE;
  return { answer, hold: stayHoldDeadline({ clock, checkIn: query.checkIn, responseHours: rules.responseHours }) };
}
