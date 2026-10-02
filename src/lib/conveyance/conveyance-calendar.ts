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
