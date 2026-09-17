/**
 * @fileoverview **Ο ΜΗΝΑΣ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ ΚΑΤΑΛΥΜΑΤΟΣ** — πλέγμα, κατάσταση νύχτας,
 *   επιλογή εύρους. Καθαρές συναρτήσεις· η οθόνη μόνο ζωγραφίζει.
 * @related ADR-835 §20 (Στάδιο Α) · lib/stay/stay-calendar-view.ts · lib/calendar/date-key.ts ·
 *   components/stay-calendar/*
 * @module lib/stay/stay-calendar-month
 *
 * 🔑 **ΝΥΧΤΕΣ, ΟΧΙ ΜΕΡΕΣ.** Κάθε κελί του πλέγματος είναι **η νύχτα που ξεκινά** εκείνη
 * τη μέρα — το ίδιο ημι-ανοιχτό `[from, to)` με την κράτηση. Γι' αυτό η επιλογή «10 έως
 * 13» σημαίνει νύχτες 10, 11, 12, 13 ⇒ `[10, 14)`: ο άνθρωπος κλικάρει **νύχτες**, ο
 * κριτής βλέπει **διάστημα**, και η μετάφραση γίνεται **εδώ, μία φορά**.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import {
  addDaysToDateKey,
  daysBetweenDateKeys,
  isDateKey,
  isoWeekdayOfDateKey,
} from '@/lib/calendar/date-key';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

/** `YYYY-MM` της ημερομηνίας. */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** Μετατόπιση μήνα· άκυρο κλειδί ⇒ επιστρέφεται αυτούσιο. */
export function addMonthsToMonthKey(monthKey: string, months: number): string {
  const match = MONTH_KEY.exec(monthKey);
  if (match === null) return monthKey;
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** `[πρώτη του μήνα, πρώτη του επόμενου)` — το παράθυρο ανάγνωσης ενός μήνα. */
export function monthWindow(monthKey: string, months = 1): { readonly from: string; readonly to: string } {
  return { from: `${monthKey}-01`, to: `${addMonthsToMonthKey(monthKey, months)}-01` };
}

/**
 * **Το πλέγμα του μήνα**, εβδομάδες Δευτέρα→Κυριακή (ISO 8601 — ελληνική σύμβαση).
 * `null` = κελί εκτός μήνα.
 */
export function monthGrid(monthKey: string): readonly (readonly (string | null)[])[] {
  const first = `${monthKey}-01`;
  const weekday = isDateKey(first) ? isoWeekdayOfDateKey(first) : null;
  if (weekday === null) return [];
  const cells: (string | null)[] = Array.from({ length: weekday - 1 }, () => null);
  for (let day: string | null = first; day !== null && monthKeyOf(day) === monthKey; day = addDaysToDateKey(day, 1)) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Η κατάσταση **μιας νύχτας** — `free`, ή η εγγραφή που την πιάνει. */
export type StayNightState =
  | { readonly kind: 'free' }
  | { readonly kind: 'blocked'; readonly entry: Extract<StayCalendarEntryView, { kind: 'block' }> }
  | { readonly kind: 'booked'; readonly entry: Extract<StayCalendarEntryView, { kind: 'booking' }> };

function occupies(entry: StayCalendarEntryView): boolean {
  return entry.kind === 'block' || entry.occupies;
}

/** Τι πιάνει τη νύχτα `dateKey`. Το `occupies` ήρθε από τον διακομιστή — δεν ξαναγράφεται εδώ. */
export function nightStateOf(dateKey: string, entries: readonly StayCalendarEntryView[]): StayNightState {
  for (const entry of entries) {
    if (!occupies(entry) || !(entry.from <= dateKey && dateKey < entry.to)) continue;
    return entry.kind === 'block' ? { kind: 'blocked', entry } : { kind: 'booked', entry };
  }
  return { kind: 'free' };
}

/** Η επιλογή ως **διάστημα νυχτών** `[from, to)`. */
export interface StayNightSelection {
  readonly from: string;
  readonly to: string;
  readonly nights: number;
}

/** Από δύο κλικ (με οποιαδήποτε σειρά) στο διάστημα: η τελευταία νύχτα **μετράει**. */
export function selectionOf(anchor: string, focus: string): StayNightSelection | null {
  const first = anchor <= focus ? anchor : focus;
  const last = anchor <= focus ? focus : anchor;
  const to = addDaysToDateKey(last, 1);
  const nights = to === null ? null : daysBetweenDateKeys(first, to);
  if (to === null || nights === null || nights < 1) return null;
  return { from: first, to, nights };
}

/**
 * **Τι είναι η επιλογή;** — ορίζει ποιες πράξεις προσφέρει το πάνελ.
 *
 * - `free`: καμία νύχτα πιασμένη ⇒ «κλείσε» / «καταχώρισε κράτηση»
 * - `entry`: **όλες** οι νύχτες ανήκουν σε **μία** εγγραφή ⇒ «άνοιξε» / «ακύρωσε»
 * - `mixed`: οτιδήποτε άλλο ⇒ καμία πράξη, μόνο εξήγηση (ποτέ μερική εκτέλεση)
 */
export type StaySelectionMeaning =
  | { readonly kind: 'free' }
  | { readonly kind: 'entry'; readonly entry: StayCalendarEntryView }
  | { readonly kind: 'mixed' };

export function selectionMeaning(
  selection: StayNightSelection,
  entries: readonly StayCalendarEntryView[],
): StaySelectionMeaning {
  const states: StayNightState[] = [];
  for (let day: string | null = selection.from; day !== null && day < selection.to; day = addDaysToDateKey(day, 1)) {
    states.push(nightStateOf(day, entries));
  }
  if (states.every((state) => state.kind === 'free')) return { kind: 'free' };
  const [head] = states;
  if (head === undefined || head.kind === 'free') return { kind: 'mixed' };
  const same = states.every((state) => state.kind !== 'free' && state.entry.id === head.entry.id);
  return same ? { kind: 'entry', entry: head.entry } : { kind: 'mixed' };
}
