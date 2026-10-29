/**
 * 📅 **Ημερολογιακή ημέρα ως σχήμα zod** — ο κριτής του `calendar-day` στα σύνορα (API · φόρμες · έγγραφα).
 *
 * 🔑 **Γιατί `refine` και όχι το `z.string().date()` του zod**: το zod κρίνει σωστά (regex με δίσεκτα — ίδιες
 * απαντήσεις στις άγκυρες `2027-02-30` ✗ · `2028-02-29` ✓ · `0000-02-29` ✓), αλλά θα ήταν **δεύτερος** κανόνας
 * δίπλα στο {@link isCalendarDay} που κρίνει διευθύνσεις, Firestore και μηχανές. Ένας κανόνας ⇒ μία απάντηση
 * παντού, και οι άγκυρες ζουν σε ένα test.
 *
 * Ξεχωριστό αρχείο ώστε το `calendar-day` να μένει χωρίς εξαρτήσεις (το εισάγουν scripts χωρίς `@/`).
 *
 * @module lib/date/calendar-day-schema
 * @see docs/centralized-systems/reference/adrs/ADR-919-listing-availability-vocabulary.md
 */

import { z } from 'zod';
import { isCalendarDay } from './calendar-day';

/** Το μήνυμα όταν η ημέρα δεν υπάρχει ή δεν είναι `YYYY-MM-DD` — αγγλικά, όπως τα υπόλοιπα μηνύματα σχημάτων API. */
const CALENDAR_DAY_MESSAGE = 'Expected an existing calendar day (YYYY-MM-DD)';

/** `YYYY-MM-DD` που **υπάρχει** στο ημερολόγιο. Κανένα σιωπηλό `trim` — όποιος το θέλει το δηλώνει (βλ. φόρμες). */
export const calendarDaySchema = z.string().refine(isCalendarDay, { message: CALENDAR_DAY_MESSAGE });
