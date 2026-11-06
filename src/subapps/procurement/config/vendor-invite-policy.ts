/**
 * @fileoverview **Οι κανόνες της φόρμας πρόσκλησης — ΕΝΑ σημείο για browser ΚΑΙ server** (ADR-327 §7.5).
 * @module subapps/procurement/config/vendor-invite-policy
 *
 * 🔴 **Γιατί υπάρχει (Ε1β)**: η φόρμα είχε «Προσαρμοσμένη» προθεσμία **χωρίς** πεδίο, και ο κώδικας έστελνε
 * σιωπηλά 7 ημέρες. Η προθεσμία είναι πλέον πάντα **ημερομηνία** (όπως Procore / BuildingConnected): τα
 * presets είναι συντομεύσεις προς ημερομηνία, και ο σύνδεσμος ισχύει ως το **τέλος** εκείνης της ημέρας στην
 * ώρα του φορέα (`endOfCalendarDay`) — «έως 14/11» σημαίνει ολόκληρη την 14/11.
 *
 * Καθαρός κώδικας χωρίς `server-only`: τον διαβάζουν το ημερολόγιο της φόρμας (όρια) και το zod του route.
 */

import { MAX_PERSONAL_MESSAGE_LENGTH } from '@/config/personal-message-policy';
import { calendarDayOf, endOfCalendarDay, type CalendarDay } from '@/constants/platform-operator';
import { addDaysToDateKey, daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';

/** Οι συντομεύσεις της φόρμας — ημέρες από σήμερα. */
export const VENDOR_INVITE_EXPIRY_PRESET_DAYS = [3, 5, 7, 14] as const;
export type VendorInviteExpiryPresetDays = (typeof VENDOR_INVITE_EXPIRY_PRESET_DAYS)[number];

/** Η προεπιλεγμένη συντόμευση όταν το RFQ δεν έχει προθεσμία. */
export const VENDOR_INVITE_DEFAULT_PRESET_DAYS: VendorInviteExpiryPresetDays = 5;

/** Το πλησιέστερο και το μακρύτερο τέλος ισχύος, σε ημέρες από σήμερα (ίδια όρια με το παλιό `expiresInDays`). */
export const VENDOR_INVITE_MIN_LIFETIME_DAYS = 1;
export const VENDOR_INVITE_MAX_LIFETIME_DAYS = 90;

/** Το όριο του προσωπικού σημειώματος — ο ΙΔΙΟΣ αριθμός με το `PersonalMessageField`. */
export const VENDOR_INVITE_NOTE_MAX_LENGTH = MAX_PERSONAL_MESSAGE_LENGTH;

/** Τα όρια του ημερολογίου, ως ημέρες `YYYY-MM-DD` στη ζώνη του φορέα. */
export interface InviteExpiryBounds {
  readonly today: CalendarDay;
  readonly first: CalendarDay;
  readonly last: CalendarDay;
}

export function inviteExpiryBounds(now: Date): InviteExpiryBounds {
  const today = calendarDayOf(now);
  return {
    today,
    first: addDaysToDateKey(today, VENDOR_INVITE_MIN_LIFETIME_DAYS) ?? today,
    last: addDaysToDateKey(today, VENDOR_INVITE_MAX_LIFETIME_DAYS) ?? today,
  };
}

/** Η ημέρα που αντιστοιχεί σε μια συντόμευση. */
export function presetExpiryDay(days: VendorInviteExpiryPresetDays, now: Date): CalendarDay {
  const { today } = inviteExpiryBounds(now);
  return addDaysToDateKey(today, days) ?? today;
}

export type InviteExpiryVerdict =
  | { readonly kind: 'ok'; readonly expiresAtMs: number }
  | { readonly kind: 'invalid' | 'too_soon' | 'too_far' };

/** **Η μία κρίση** της ημερομηνίας λήξης — η φόρμα δείχνει, ο server επιβάλλει. */
export function judgeInviteExpiryDay(day: unknown, now: Date): InviteExpiryVerdict {
  if (!isDateKey(day)) return { kind: 'invalid' };
  const ahead = daysBetweenDateKeys(calendarDayOf(now), day);
  if (ahead === null) return { kind: 'invalid' };
  if (ahead < VENDOR_INVITE_MIN_LIFETIME_DAYS) return { kind: 'too_soon' };
  if (ahead > VENDOR_INVITE_MAX_LIFETIME_DAYS) return { kind: 'too_far' };
  return { kind: 'ok', expiresAtMs: endOfCalendarDay(day).getTime() };
}

/**
 * Η αρχική ημέρα της φόρμας: η **προθεσμία του RFQ** όταν υπάρχει και χωρά στα όρια (ο σύνδεσμος ισχύει όσο το
 * αίτημα δέχεται προσφορές), αλλιώς η προεπιλεγμένη συντόμευση.
 */
export function initialInviteExpiryDay(rfqDeadlineMs: number | null, now: Date): CalendarDay {
  if (rfqDeadlineMs !== null) {
    const deadlineDay = calendarDayOf(new Date(rfqDeadlineMs));
    if (judgeInviteExpiryDay(deadlineDay, now).kind === 'ok') return deadlineDay;
  }
  return presetExpiryDay(VENDOR_INVITE_DEFAULT_PRESET_DAYS, now);
}
