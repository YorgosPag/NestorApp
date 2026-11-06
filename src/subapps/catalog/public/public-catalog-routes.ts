/**
 * **Οι δημόσιες διευθύνσεις του καταλόγου** (ADR-923 §5.13 Σ4, σχέδιο §4.4): μία φορά γραμμένες, καθαρές.
 *
 * 🔑 Το id είναι η ταυτότητα, το slug διακόσμηση. Τα id έχουν `_`, τα slug ποτέ: έτσι το id βγαίνει χωρίς αμφισημία, ακόμη κι
 *    όταν το ίδιο περιέχει παύλες. Η κανονική μορφή την κρίνει η σελίδα, με 308.
 *
 * @module subapps/catalog/public/public-catalog-routes
 */

import { compactUuidOf, uuidOfCompact } from '@/lib/qr/compact-uuid';
import { CATALOG_ID_PREFIXES } from '@/services/enterprise-id-prefixes-catalog';
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
 * Το γράμμα είδους της συμπαγούς σύντομης διεύθυνσης (ADR-923 Ν10 α), ανά πρόθεμα id. **Κλειστό** και **αμετάβλητο**: το
 * γράμμα ζει σε τυπωμένο χαρτί, άρα ένα γράμμα δεν ξαναδίνεται ποτέ σε άλλο είδος.
 */
const SHORT_KIND_LETTER: Readonly<Record<string, string>> = {
  [CATALOG_ID_PREFIXES.CATALOG_PRODUCT]: 'P',
  [CATALOG_ID_PREFIXES.CATALOG_PRODUCT_MODEL]: 'M',
};
const SHORT_KIND_PREFIX: ReadonlyMap<string, string> = new Map(Object.entries(SHORT_KIND_LETTER).map(([prefix, letter]) => [letter, prefix]));

/** Η συμπαγής μορφή του id (`P<26>` / `M<26>`), ή `null` για id που δεν έχει (ξένο πρόθεμα, όχι uuid). */
function compactShortCodeOf(id: string): string | null {
  const separator = id.indexOf('_');
  const letter = SHORT_KIND_LETTER[id.slice(0, separator)];
  const compact = separator === -1 || letter === undefined ? null : compactUuidOf(id.slice(separator + 1));
  return compact === null ? null : `${letter}${compact}`;
}

/**
 * **Ο ΕΝΑΣ builder της διεύθυνσης QR.** Το χαρτί ζει χρόνια, ενώ κωδικός, ψευδώνυμο και slug αλλάζουν: εδώ μένει μόνο το id.
 * Τη χρησιμοποιεί ο εκδότης για το τυπωμένο QR, και δεν τη γράφει δεύτερη φορά κανείς.
 * 🔑 **Ν10 α**: προϊόν και μοντέλο γράφονται `/Q/<είδος><base32>`, ολόκληρη η διαδρομή σε κεφαλαία, ώστε το σύμβολο να βγει σε
 *    αλφαριθμητική λειτουργία (`lib/qr/compact-uuid`). Το `/Q` το στέλνει στο `/q` μια `rewrite` του `next.config.js`, γιατί
 *    φάκελος `Q` δίπλα στον `q` συγκρούεται σε σύστημα αρχείων χωρίς διάκριση πεζών-κεφαλαίων. Κάθε άλλο id κρατά το `/q/<id>`.
 */
export function publicShortRoute(id: string): string {
  const code = compactShortCodeOf(id);
  return code === null ? `/q/${encodeURIComponent(id)}` : `/Q/${code}`;
}

/** Αν η διαδρομή του {@link publicShortRoute} είναι ολόκληρη σε κεφαλαία, ώστε να γραφτεί κεφαλαία και η βάση πριν από αυτήν. */
export function isUppercaseShortRoute(route: string): boolean {
  return route.startsWith('/Q/');
}

/**
 * Το id πίσω από ένα τμήμα σύντομης διεύθυνσης: η συμπαγής μορφή, ή το σκέτο id των τυπωμένων πριν από το Ν10 α (που ισχύουν
 * για πάντα, γιατί το χαρτί δεν ανακαλείται). `null` ⇒ η τιμή δεν μπορεί να είναι id, και η βάση δεν ρωτιέται.
 */
export function publicIdOfShortSegment(segment: string): string | null {
  const prefix = SHORT_KIND_PREFIX.get(segment.slice(0, 1));
  const uuid = prefix === undefined ? null : uuidOfCompact(segment.slice(1));
  if (prefix !== undefined && uuid !== null) return `${prefix}_${uuid}`;
  return publicIdOfSegment(segment) === segment ? segment : null;
}

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
