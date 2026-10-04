/**
 * Conveyance — «σήμερα» για τις προθεσμίες της υπόθεσης (ADR-901 Σ-5).
 *
 * 🔑 Η ισχύς ενός πιστοποιητικού μετρά **ελληνικές** ημερολογιακές ημέρες: ο server
 *    (UTC) και ένας χρήστης στο εξωτερικό πρέπει να βλέπουν την ΙΔΙΑ μέρα, αλλιώς η
 *    γραμμή θα έλεγε «έληξε» στον έναν και «ισχύει» στον άλλον για το ίδιο έγγραφο.
 *
 * @module lib/conveyance/conveyance-calendar
 */

import { athensClockAt } from '@/lib/calendar/weekly-hours';

/** Η σημερινή ημέρα στην Ελλάδα, `YYYY-MM-DD`. */
export function conveyanceToday(now: Date = new Date()): string {
  return athensClockAt(now).dateKey;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MINUTES = 24 * 60;

/**
 * ADR-901 §14.8 — η στιγμή που αλλάζει η «σήμερα» της Ελλάδας: εκεί αλλάζουν **μόνες τους** οι καταστάσεις λήξης
 * («λήγει σύντομα» · «έληξε»), χωρίς καμία εγγραφή — άρα χωρίς κανένα σήμα. Η όψη τη δηλώνει (`freshUntil`) και ο
 * client ξαναρωτά **ακριβώς** τότε, αντί για polling.
 * 🔑 Ημέρες 23 και 25 ωρών (θερινή ώρα): η υποψήφια διορθώνεται κατά μία ώρα, ρωτώντας το **ίδιο** ρολόι.
 */
export function nextConveyanceDayStart(now: Date = new Date()): Date {
  const clock = athensClockAt(now);
  const minuteStart = now.getTime() - (now.getTime() % MINUTE_MS);
  let candidate = minuteStart + (DAY_MINUTES - clock.minutes) * MINUTE_MS;
  if (athensClockAt(new Date(candidate)).dateKey === clock.dateKey) candidate += HOUR_MS;
  else if (athensClockAt(new Date(candidate - HOUR_MS)).dateKey !== clock.dateKey) candidate -= HOUR_MS;
  return new Date(candidate);
}
