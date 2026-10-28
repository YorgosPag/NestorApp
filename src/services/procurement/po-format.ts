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

const FILENAME_UNSAFE = /[<>:"/\\|?*]/g;
const SUPPLIER_SUFFIX_MAX = 50;

/**
 * **Το όνομα αρχείου του PDF παραγγελίας** — `PO-0001.pdf`, ή `PO-0001_<προμηθευτής>.pdf` στο συνημμένο email.
 *
 * 🔴 ADR-923 §5.11 «3γ» Α11: η λήψη στον browser έγραφε `<poId>.pdf` (εσωτερικό id) ενώ ο διακομιστής δήλωνε
 * `PO-0001.pdf` — δύο ονόματα για το ίδιο αρχείο. Τώρα ΕΝΑ, για διακομιστή, πελάτη και email.
 */
export function poPdfFilename(poNumber: string, supplierName?: string): string {
  const suffix = supplierName
    ?.replace(FILENAME_UNSAFE, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, SUPPLIER_SUFFIX_MAX);
  return suffix ? `${poNumber}_${suffix}.pdf` : `${poNumber}.pdf`;
}
