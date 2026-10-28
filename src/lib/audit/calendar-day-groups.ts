/**
 * **Ομαδοποίηση εγγραφών ανά ΗΜΕΡΟΛΟΓΙΑΚΗ ημέρα του θεατή** — ΜΙΑ υλοποίηση για κάθε χρονολόγιο.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-327, μετρημένο 2026-10-28): η ίδια ομαδοποίηση ζούσε σε **τρία** σημεία με **τρεις**
 * συμπεριφορές — `activity-tab-helpers.groupEntriesByDate` και `RfqHistoryTab.groupByDate` με **σκληροκωδικοποιημένα**
 * «Σήμερα»/«Χθες» (N.11: ένας Άγγλος χρήστης έβλεπε ελληνικά), και το `AuditTimeline` της διαχείρισης ρόλων που
 * χώριζε ημέρες σε **UTC** (`toISOString().slice(0, 10)`) ⇒ στην Ελλάδα (UTC+2/+3) μια εγγραφή στις 01:00 έπεφτε
 * στην **προηγούμενη** ημέρα.
 *
 * 🔑 Καθαρή, χωρίς κείμενο: επιστρέφει **είδος** ημέρας (`today`/`yesterday`/`earlier`/`unknown`) + την ημερομηνία.
 * Την ετικέτα τη φτιάχνει ο καλών με τον δικό του μεταφραστή — η ομαδοποίηση δεν ξέρει γλώσσα.
 * Η σειρά των ομάδων ακολουθεί τη σειρά των εγγραφών (οι καλούντες τις δίνουν ήδη ταξινομημένες).
 *
 * @module lib/audit/calendar-day-groups
 */

export type CalendarDayKind = 'today' | 'yesterday' | 'earlier' | 'unknown';

export interface CalendarDayGroup<T> {
  /** `YYYY-MM-DD` στην τοπική ώρα του θεατή · `unknown` χωρίς χρονοσφραγίδα. */
  readonly dateKey: string;
  readonly kind: CalendarDayKind;
  /** Τοπικά μεσάνυχτα της ημέρας · `null` όταν `kind === 'unknown'`. */
  readonly date: Date | null;
  readonly entries: T[];
}

export interface CalendarDayLabels {
  readonly today: string;
  readonly yesterday: string;
  readonly unknown: string;
}

const UNKNOWN_KEY = 'unknown';

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function kindOf(dateKey: string, todayKey: string, yesterdayKey: string): CalendarDayKind {
  if (dateKey === UNKNOWN_KEY) return 'unknown';
  if (dateKey === todayKey) return 'today';
  return dateKey === yesterdayKey ? 'yesterday' : 'earlier';
}

export function groupByCalendarDay<T>(
  entries: readonly T[],
  timestampOf: (entry: T) => string | number | Date | null | undefined,
  now: Date = new Date(),
): CalendarDayGroup<T>[] {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const todayKey = localDateKey(now);
  const yesterdayKey = localDateKey(yesterday);
  const groups = new Map<string, { date: Date | null; entries: T[] }>();

  for (const entry of entries) {
    const at = toDate(timestampOf(entry));
    const key = at ? localDateKey(at) : UNKNOWN_KEY;
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { date: at ? new Date(at.getFullYear(), at.getMonth(), at.getDate()) : null, entries: [entry] });
  }

  return Array.from(groups, ([dateKey, group]) => ({
    dateKey,
    kind: kindOf(dateKey, todayKey, yesterdayKey),
    date: group.date,
    entries: group.entries,
  }));
}

/** Η ετικέτα μιας ομάδας: οι σχετικές ημέρες από τον καλούντα (i18n), οι υπόλοιπες από τον μορφοποιητή του. */
export function calendarDayLabel<T>(
  group: CalendarDayGroup<T>,
  labels: CalendarDayLabels,
  formatEarlier: (date: Date) => string,
): string {
  if (group.kind === 'earlier' && group.date) return formatEarlier(group.date);
  return group.kind === 'earlier' ? labels.unknown : labels[group.kind];
}
