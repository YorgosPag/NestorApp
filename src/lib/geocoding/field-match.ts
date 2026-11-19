/**
 * @fileoverview **Η ΜΙΑ ΣΥΓΚΡΙΣΗ ΠΕΔΙΟΥ ΔΙΕΥΘΥΝΣΗΣ** — δηλωμένο ⇄ αυτό που βρήκε ο γεωκωδικοποιητής.
 * @related ADR-332 §3.2 · D16 · D28 · app/api/geocoding/geocoding-engine-helpers · editor/hooks/useAddressFieldStatus
 * @module lib/geocoding/field-match
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: Η ΙΔΙΑ ΚΡΙΣΗ ΗΤΑΝ ΓΡΑΜΜΕΝΗ ΔΥΟ ΦΟΡΕΣ — ΚΑΙ ΕΙΧΕ ΑΠΟΚΛΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πλευρά | Αρχείο | Τ.Κ. «546 24» ⇄ «54624» |
 * |---|---|---|
 * | διακομιστής | `geocoding-engine-helpers.buildFieldMatches` | `match` (κανονικοποιούσε) |
 * | πελάτης | `useAddressFieldStatus.computeStatus` | **`mismatch`** (δεν κανονικοποιούσε) |
 *
 * ⇒ ο ίδιος Τ.Κ. ήταν «επιβεβαιωμένος» στον διακομιστή και «Ασυμφωνία» στο badge του ανθρώπου.
 * Το D16 είχε διορθώσει τη μία πλευρά. Πριν μπει νέο κριτήριο (`broader`), ενοποιήθηκαν — αλλιώς
 * θα γραφόταν **δύο φορές** και θα απέκλινε ξανά.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 `broader` — «ΤΟ ΔΗΛΩΣΑΤΕ ΕΥΡΥΤΕΡΑ», ΟΧΙ «ΤΟ ΔΗΛΩΣΑΤΕ ΛΑΘΟΣ» (ADR-332 D28)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * «Σαμοθράκης 16, 56334, **Θεσσαλονίκη**» βρίσκεται στο Ελευθέριο-Κορδελιό, μέσα στη **Μητροπολιτική
 * Ενότητα Θεσσαλονίκης**. Η «Θεσσαλονίκη» δεν είναι λάθος — είναι **η ευρύτερη περιοχή** που
 * περιέχει την απάντηση. Κανένας από Google/Mapbox/HERE δεν το ξεχωρίζει: δίνουν «unmatched».
 *
 * ⚠️ Κρίνεται από τα **ονόματα** της **ίδιας** απάντησης (`county`/`region`…), γιατί το εμπρός
 * geocoding **δεν** παράγει αποδεδειγμένη ιεραρχία (`admin` υπάρχει μόνο στο reverse). Η ταύτιση
 * ονομάτων είναι το `samePlaceName` — ζεύγη πτώσεων, ποτέ «περιέχει».
 */

import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import { foldPlaceName, samePlaceName } from '@/utils/address/place-name';
import { countryNameToCode } from '@/utils/address/country-codes';
import type { FieldMatchKind, FieldMatchMap, ResolvedAddressFields } from './geocoding-types';

/** Τα πεδία που συγκρίνονται — το `admin` είναι αποδεδειγμένη ιεραρχία, όχι πεδίο σύγκρισης. */
export type ComparableAddressField = Exclude<keyof ResolvedAddressFields, 'admin'>;

export const COMPARABLE_ADDRESS_FIELDS: readonly ComparableAddressField[] = [
  'street',
  'number',
  'postalCode',
  'neighborhood',
  'city',
  'county',
  'region',
  'country',
];

/**
 * **Ποια πεδία της απάντησης είναι ΕΥΡΥΤΕΡΑ από το καθένα.** Μόνο τοπωνύμια — μια οδός δεν
 * «περιέχεται» σε τίποτα με το όνομά της.
 */
const WIDER_THAN: Partial<Record<ComparableAddressField, readonly ComparableAddressField[]>> = {
  neighborhood: ['city', 'county', 'region'],
  city: ['county', 'region'],
};

/**
 * Τα **τοπωνύμια** — συγκρίνονται με την ίδια αρχή που κρίνει το «ευρύτερο» (`samePlaceName`).
 *
 * 🔴 ADR-332 D31 (μετρημένο 2026-11-19): η ευθεία σύγκριση ήταν σκέτο `normalizeGreekText`, οπότε ο
 * οικισμός ΕΛΣΤΑΤ «Ωραιόκαστρον» απέναντι στο «Ωραιόκαστρο» του χάρτη έβγαινε **«Ασυμφωνία»** — για
 * ~21% των οικισμών του μητρώου, που είναι σε καθαρεύουσα.
 */
const PLACE_NAME_FIELDS: ReadonlySet<ComparableAddressField> = new Set(['neighborhood', 'city', 'county', 'region']);

/** Η **γραφή** ως ταυτότητα κειμένου: τόνοι, κεφαλαία, παύλα ⇄ κενό (ADR-332 D27 Β7). */
function sameWriting(a: string, b: string): boolean {
  return normalizeGreekText(foldPlaceName(a)).toLowerCase() === normalizeGreekText(foldPlaceName(b)).toLowerCase();
}

/**
 * **ΕΙΝΑΙ ΟΙ ΔΥΟ ΤΙΜΕΣ ΤΟΥ ΠΕΔΙΟΥ Η ΙΔΙΑ ΤΙΜΗ;** — η ΜΙΑ κρίση, για διακομιστή **και** πελάτη.
 *
 * 🔴 ADR-332 D32 (μετρημένο 2026-11-19): η ίδια ερώτηση ζούσε **και** στο `diffAddressFields` του
 * editor, με άλλους κανόνες. Τρεις αποκλίσεις, όλες ορατές στην ίδια φόρμα:
 * | Ζεύγος | εδώ (ετικέτα πεδίου) | `diffAddressFields` («Συμφωνία Πεδίων») |
 * |---|---|---|
 * | «Ωραιόκαστρον» ⇄ «Ωραιόκαστρο» | ίδιο | **διαφορά** |
 * | «546 24» ⇄ «54624» | ίδιο | **διαφορά** |
 * | «Greece» ⇄ «Ελλάδα» | **διαφορά** | ίδιο |
 * Τώρα ο editor ρωτά **εδώ**· κάθε κανόνας που ήξερε μόνο η μία πλευρά ισχύει και για τις δύο.
 *
 * ⚠️ Δεν κρίνει κενές τιμές — «ο πάροχος δεν το είπε» και «θα σβηστεί» είναι **άλλες** ερωτήσεις,
 * που τις απαντά ο καλών (`compareAddressField` · `diffAddressFields` · `diffAddressReplacement`).
 */
export function sameAddressFieldValue(field: ComparableAddressField, a: string, b: string): boolean {
  if (field === 'postalCode') return toCanonicalGreekPostalCode(a) === toCanonicalGreekPostalCode(b);
  if (field === 'country') {
    // Β9 — η χώρα είναι ταυτότητα ISO 3166-1· άγνωστο όνομα ⇒ σύγκριση γραφής (καμία επινόηση).
    const left = countryNameToCode(a);
    const right = countryNameToCode(b);
    if (left !== null && right !== null) return left === right;
  }
  if (sameWriting(a, b)) return true;
  return PLACE_NAME_FIELDS.has(field) && samePlaceName(a, b);
}

/** Είναι το δηλωμένο όνομα κάποια **ευρύτερη** περιοχή της ίδιας απάντησης; */
function namesWiderArea(field: ComparableAddressField, declared: string, resolved: ResolvedAddressFields): boolean {
  const wider = WIDER_THAN[field] ?? [];
  return wider.some((ancestor) => {
    const name = resolved[ancestor];
    return typeof name === 'string' && name.trim() !== '' && samePlaceName(declared, name);
  });
}

/**
 * Η κρίση για **ένα** πεδίο.
 *
 * ⚠️ Το `broader` ελέγχεται **μόνο αφού** αποτύχει η ευθεία σύγκριση — και **και** όταν ο πάροχος
 * δεν έδωσε τιμή για το πεδίο: «δηλώσατε πόλη, ο πάροχος δεν λέει πόλη, αλλά λέει νομό με το ίδιο
 * όνομα» είναι ευρύτερη περιοχή, όχι άγνοια.
 */
export function compareAddressField(
  field: ComparableAddressField,
  declared: string | undefined,
  resolved: ResolvedAddressFields,
): FieldMatchKind {
  const user = (declared ?? '').trim();
  const found = (resolved[field] ?? '').trim();
  if (user === '') return 'not-provided';
  if (found !== '' && sameAddressFieldValue(field, user, found)) return 'match';
  if (namesWiderArea(field, user, resolved)) return 'broader';
  return found === '' ? 'unknown' : 'mismatch';
}

/** Ο πίνακας ταιριάσματος για ολόκληρη τη διεύθυνση — ό,τι ταξιδεύει στο `reasoning.fieldMatches`. */
export function compareAddressFields(
  declared: Partial<Record<ComparableAddressField, string>>,
  resolved: ResolvedAddressFields,
): FieldMatchMap {
  const match = (field: ComparableAddressField) => compareAddressField(field, declared[field], resolved);
  return {
    street: match('street'),
    number: match('number'),
    postalCode: match('postalCode'),
    neighborhood: match('neighborhood'),
    city: match('city'),
    county: match('county'),
    region: match('region'),
    country: match('country'),
  };
}
