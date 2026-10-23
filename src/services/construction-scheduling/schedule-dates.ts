/**
 * @module schedule-dates
 * @enterprise ADR-266 (CPM) · ADR-919 βήμα 2 (πρόβλεψη ολοκλήρωσης)
 *
 * Η αριθμητική ημερών του χρονοδιαγράμματος, **σε UTC**. Μοιράζεται ανάμεσα στο CPM και
 * στην πρόβλεψη ολοκλήρωσης, ώστε οι δύο να μετρούν μέρες με τον ίδιο τρόπο.
 *
 * 🔴 **Γιατί UTC**: οι ημερομηνίες των φάσεων είναι `YYYY-MM-DD`, που ο `Date` διαβάζει ως
 * μεσάνυχτα UTC, και το `toISOString` τις ξαναγράφει σε UTC. Το παλιό `setDate` πρόσθετε
 * μέρες σε **τοπική** ώρα. Σε browser ελληνικής ώρας, μια πρόσθεση που περνούσε την αλλαγή
 * ώρας του Μαρτίου έχανε μία ώρα, έπεφτε στις 23:00 UTC της προηγούμενης μέρας, και η
 * ημερομηνία έβγαινε **μία μέρα νωρίτερα**. Ίδιος κανόνας με το `lib/date/calendar-arithmetic.ts`.
 */

const MS_PER_DAY = 86_400_000;

/** Ημέρες από το `a` ως το `b` (στρογγυλεμένες). */
export function daysBetween(a: string | Date, b: string | Date): number {
  const ta = typeof a === 'string' ? new Date(a).getTime() : a.getTime();
  const tb = typeof b === 'string' ? new Date(b).getTime() : b.getTime();
  return Math.round((tb - ta) / MS_PER_DAY);
}

/** Νέα ημερομηνία `days` ημέρες μετά (ή πριν, με αρνητικό), σε UTC. */
export function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** `YYYY-MM-DD` της ημερομηνίας, σε UTC. */
export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `true` αν η συμβολοσειρά διαβάζεται ως ημερομηνία. */
export function isReadableDate(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(new Date(value).getTime());
}

export function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

export function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map(d => d.getTime())));
}
