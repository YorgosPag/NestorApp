/**
 * **Ημερομηνία ISO-8601 μιας τιμής ιστορικού → στη γλώσσα του θεατή** (ADR-195 (ζ)).
 *
 * ΕΝΑ σημείο για τον resolver τιμών (τιμή πρώτου επιπέδου) και τον μορφοποιητή (τιμή **μέσα** σε αντικείμενο, π.χ.
 * `retention.supersededAt` — ADR-923 §23.5 Β1). Καθαρό, χωρίς i18next, ώστε ο μορφοποιητής να μένει ελέγξιμος.
 *
 * Σκέτη ημέρα `YYYY-MM-DD` ⇒ η **ίδια** τοπική ημέρα (`calendarDateOfDateKey`): το `new Date(key)` είναι μεσάνυχτα UTC,
 * δηλαδή η **προηγούμενη** ημέρα για θεατή δυτικά του Greenwich.
 *
 * @module components/shared/audit/audit-iso-date
 */

import { calendarDateOfDateKey } from '@/lib/calendar/date-key';
import { formatDate } from '@/lib/intl-utils';

export function formatAuditIsoDate(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
  const date = calendarDateOfDateKey(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatDate(date);
}
