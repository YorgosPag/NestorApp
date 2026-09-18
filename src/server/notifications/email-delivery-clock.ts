/**
 * =============================================================================
 * ΤΟ ΡΟΛΟΪ ΤΟΥ ΠΑΡΑΛΗΠΤΗ — «τι ώρα είναι ΕΚΕΙ;» (ADR-777 §8.23 · §8.28)
 * =============================================================================
 *
 * **Καθαρή αριθμητική χρόνου σε ζώνη.** Καμία Firestore, κανένα ρολόι — κάθε στιγμή δίνεται.
 * Ζούσε μέσα στο `email-delivery-window.ts`· χωρίστηκε (ADR-867 Β6, N.7.1) ώστε εκείνο να κρατά
 * **μόνο την πολιτική** («πότε επιτρέπεται να διακόψω;») και αυτό **μόνο τη μέτρηση**
 * («είναι 22:00 στην Αθήνα;» · «πότε ξημερώνει 08:00 εκεί;»).
 *
 * @module server/notifications/email-delivery-clock
 * @see server/notifications/email-delivery-window — ο μόνος καταναλωτής
 */

import type { UserNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

/** Τα μέρη μιας στιγμής, **στη ζώνη του παραλήπτη**. */
interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 = Κυριακή, όπως το `Date#getDay`. */
  readonly weekday: number;
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Ανάλυση μιας στιγμής στα μέρη της, στη ζώνη `NOTIFICATION_TIMEZONE`.
 *
 * ⚠️ **Μέσω `Intl`, ΠΟΤΕ μέσω `getHours()`.** Το `getHours()` απαντά στη ζώνη του
 * **διακομιστή** — και ο διακομιστής είναι ένα container Docker που τρέχει σε
 * UTC. Οι «ώρες ησυχίας 22:00–08:00» θα ίσχυαν τότε 01:00–11:00 τοπικά τον
 * χειμώνα και 00:00–10:00 το καλοκαίρι: λάθος, **και διαφορετικά λάθος δύο φορές
 * τον χρόνο**.
 */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(instant);

  const value = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  // Το `hour12: false` αποδίδει μεσάνυχτα ως «24» σε ορισμένες εκδόσεις ICU.
  const rawHour = Number(value('hour'));

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(value('minute')),
    weekday: WEEKDAY_INDEX[value('weekday')] ?? 0,
  };
}

/** `"HH:MM"` → λεπτά από τα μεσάνυχτα· `null` όταν η μορφή δεν είναι έγκυρη. */
function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

/**
 * Η στιγμή που αντιστοιχεί σε τοπική ώρα `hour:00`, `dayOffset` μέρες μετά το
 * `from` — υπολογισμένη **αναζητητικά**, γιατί η αντίστροφη απεικόνιση
 * (τοπική ώρα → στιγμή) δεν είναι συνάρτηση: την ημέρα αλλαγής ώρας μια τοπική
 * ώρα μπορεί να **μην υπάρχει** ή να υπάρχει **δύο φορές**.
 *
 * Ξεκινά από την εκτίμηση UTC και διορθώνει με τη μετρημένη απόκλιση. Δύο
 * περάσματα αρκούν: η πρώτη διόρθωση φέρνει μέσα στη σωστή μέρα, η δεύτερη
 * απορροφά την αλλαγή ζώνης αν η πρώτη πέρασε το σύνορό της.
 */
export function instantAtLocalHour(
  from: Date,
  dayOffset: number,
  hour: number,
  timeZone: string,
): Date {
  const base = zonedParts(from, timeZone);
  let candidate = new Date(
    Date.UTC(base.year, base.month - 1, base.day + dayOffset, hour, 0, 0, 0),
  );

  for (let pass = 0; pass < 2; pass += 1) {
    const got = zonedParts(candidate, timeZone);
    const wantedMinutes = hour * 60;
    const gotMinutes = got.hour * 60 + got.minute;
    // Η διαφορά μέρας μετριέται σε λεπτά μέσω της ίδιας της υποψηφιότητας.
    const dayDrift =
      Date.UTC(got.year, got.month - 1, got.day) -
      Date.UTC(base.year, base.month - 1, base.day + dayOffset);
    const driftMinutes = gotMinutes - wantedMinutes + dayDrift / 60_000;
    if (driftMinutes === 0) break;
    candidate = new Date(candidate.getTime() - driftMinutes * 60_000);
  }

  return candidate;
}

/** Είναι η στιγμή μέσα στο παράθυρο ησυχίας; */
export function insideQuietHours(
  instant: Date,
  quietHours: UserNotificationSettings['quietHours'],
  timeZone: string,
): boolean {
  if (!quietHours.enabled) return false;

  const start = minutesOfDay(quietHours.startTime);
  const end = minutesOfDay(quietHours.endTime);
  // Άκυρη μορφή ⇒ **καμία** ησυχία, όχι μόνιμη ησυχία: μια κακογραμμένη ρύθμιση
  // δεν επιτρέπεται να αποκλείσει σιωπηλά κάθε email για πάντα.
  if (start === null || end === null || start === end) return false;

  const parts = zonedParts(instant, timeZone);
  const nowMinutes = parts.hour * 60 + parts.minute;

  // ⚠️ Το παράθυρο **συνήθως περνά τα μεσάνυχτα** (η προεπιλογή είναι 22:00→08:00).
  // Ένας αφελής έλεγχος `start <= now && now < end` είναι ΠΑΝΤΑ ψευδής εκεί —
  // δηλαδή θα ανέφερε «ποτέ ησυχία» ακριβώς στη ρύθμιση που έχουν όλοι.
  return start < end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;
}

/** Η επόμενη στιγμή που κλείνει το παράθυρο ησυχίας. */
export function quietHoursEnd(
  instant: Date,
  quietHours: UserNotificationSettings['quietHours'],
  timeZone: string,
): Date {
  const end = minutesOfDay(quietHours.endTime) ?? 0;
  const endHour = Math.floor(end / 60);
  const parts = zonedParts(instant, timeZone);
  const nowMinutes = parts.hour * 60 + parts.minute;

  // Αν η ώρα λήξης έχει ήδη περάσει σήμερα, το παράθυρο κλείνει **αύριο**.
  const sameDay = nowMinutes < end;
  const candidate = instantAtLocalHour(instant, sameDay ? 0 : 1, endHour, timeZone);

  // Τα λεπτά της ώρας λήξης προστίθενται χωριστά: το `instantAtLocalHour` δουλεύει
  // σε ακέραιες ώρες, και μια ρύθμιση «08:30» δεν επιτρέπεται να στρογγυλοποιηθεί
  // σιωπηλά σε 08:00 — θα ήταν email μέσα στην ησυχία που ο χρήστης ζήτησε.
  return new Date(candidate.getTime() + (end % 60) * 60_000);
}
