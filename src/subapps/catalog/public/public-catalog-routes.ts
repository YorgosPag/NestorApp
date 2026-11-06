/**
 * **Οι δημόσιες διευθύνσεις του καταλόγου** (ADR-923 §5.13 Σ4, σχέδιο §4.4): μία φορά γραμμένες, καθαρές.
 *
 * 🔑 Το id είναι η ταυτότητα, το slug διακόσμηση. Τα id έχουν `_`, τα slug ποτέ: έτσι το id βγαίνει χωρίς αμφισημία, ακόμη κι
 *    όταν το ίδιο περιέχει παύλες. Η κανονική μορφή την κρίνει η σελίδα, με 308.
 *
 * @module subapps/catalog/public/public-catalog-routes
 */

import { transliterateGreekToLatin } from '@/utils/greek-text';

const MAX_SLUG_LENGTH = 80;
const STORED_ID = /^[a-z0-9]+_[a-z0-9-]+$/i;

function slugOf(text: string): string {
  return transliterateGreekToLatin(text)
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/** Το τμήμα διεύθυνσης: `<slug>-<id>`, ή σκέτο id όταν το όνομα δεν δίνει slug. */
export function publicSegmentOf(name: string, id: string): string {
  const slug = slugOf(name);
  return slug === '' ? id : `${slug}-${id}`;
}

/** Το id μέσα από ένα τμήμα διεύθυνσης, ή `null` όταν δεν μπορεί να είναι id εγγράφου. */
export function publicIdOfSegment(segment: string): string | null {
  const separator = segment.indexOf('_');
  if (separator === -1) return null;
  const id = segment.slice(segment.lastIndexOf('-', separator) + 1);
  return STORED_ID.test(id) ? id : null;
}

/** Ο δρομέας από τη διεύθυνση. Μόνο μορφή id: τιμή του επισκέπτη γίνεται κλειδί μνήμης, άρα δεν περνά ελεύθερο κείμενο. */
export function publicAfterOf(raw: string | readonly string[] | undefined): string | null {
  return typeof raw === 'string' && STORED_ID.test(raw) ? raw : null;
}

/**
 * **Ο ΕΝΑΣ builder της διεύθυνσης QR.** Το χαρτί ζει χρόνια, ενώ κωδικός, ψευδώνυμο και slug αλλάζουν: εδώ μένει μόνο το id.
 * Τη χρησιμοποιεί ο εκδότης για το τυπωμένο QR, και δεν τη γράφει δεύτερη φορά κανείς.
 */
export const publicShortRoute = (modelId: string): string => `/q/${encodeURIComponent(modelId)}`;

/**
 * Πού πάει QR χωρίς δημόσιο προϊόν. Το `_` δεν είναι έγκυρο ψευδώνυμο, άρα η σελίδα απαντά 404 χωρίς ανάγνωση βάσης, το ίδιο για
 * κρυφό, αποσυρμένο και ανύπαρκτο, και κανείς δεν μπορεί να δεσμεύσει το όνομα.
 */
export const PUBLIC_UNAVAILABLE_ROUTE = '/suppliers/_';

export const publicSupplierRoute = (supplierSegment: string): string => `/suppliers/${encodeURIComponent(supplierSegment)}`;

export const publicCategoryRoute = (supplierSegment: string, categorySegment: string): string =>
  `${publicSupplierRoute(supplierSegment)}/c/${encodeURIComponent(categorySegment)}`;

export const publicModelRoute = (supplierSegment: string, modelSegment: string): string =>
  `${publicSupplierRoute(supplierSegment)}/p/${encodeURIComponent(modelSegment)}`;

/**
 * Ένα έργο του portfolio (ADR-923 Ν11 στ). `w` από το *work* (`CreativeWork`), γιατί το `p` το έχει το προϊόν. Ίδια μορφή
 * `<slug>-<id>` με το μοντέλο: το id (`cprjt_…`) είναι η ταυτότητα, ο τίτλος διακόσμηση.
 */
export const publicProjectRoute = (supplierSegment: string, projectSegment: string): string =>
  `${publicSupplierRoute(supplierSegment)}/w/${encodeURIComponent(projectSegment)}`;
