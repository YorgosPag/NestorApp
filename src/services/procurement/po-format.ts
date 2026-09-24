/**
 * Η γραφή μιας παραγγελίας αγοράς — ΚΟΙΝΗ για email (`po-email-template`) και PDF (`po-pdf-generator`).
 *
 * 🔴 Γιατί υπάρχει (ADR-877 §6 · CHECK 3.28): τα δύο αρχεία κρατούσαν **πανομοιότυπους** κλώνους
 * `formatEuro` + `formatPoDate`, και ο δεύτερος μορφοποιούσε στη ζώνη **του διακομιστή** (UTC).
 * Ο προμηθευτής λαμβάνει email **και** συνημμένο PDF — δύο γραφές θα έγραφαν κάποτε δύο ημερομηνίες.
 *
 * @module services/procurement/po-format
 */

import { formatOperatorDate } from '@/lib/operator-time-format';

export { formatEuro } from '@/lib/number/greek-decimal';

/** Ημερομηνία παραγγελίας στη ζώνη του φορέα· `—` όταν λείπει (π.χ. `dateNeeded`). */
export function formatPoDate(isoDate: string | null, lang: 'el' | 'en'): string {
  return isoDate ? formatOperatorDate(isoDate, lang) : '—';
}
