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
import { samePlaceName } from '@/utils/address/place-name';
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

function sameValue(field: ComparableAddressField, a: string, b: string): boolean {
  if (field === 'postalCode') return toCanonicalGreekPostalCode(a) === toCanonicalGreekPostalCode(b);
  return normalizeGreekText(a) === normalizeGreekText(b);
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
  if (found !== '' && sameValue(field, user, found)) return 'match';
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
