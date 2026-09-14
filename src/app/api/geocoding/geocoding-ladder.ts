/**
 * @fileoverview **Η ΣΚΑΛΑ ΤΩΝ ΠΑΡΑΛΛΑΓΩΝ** — τι ρωτάμε, με ποια σειρά, και τι δεχόμαστε ως απάντηση.
 * @related ADR-332 D12 · D13 · D28 · geocoding-engine · geocoding-query-variants
 * @module app/api/geocoding/geocoding-ladder
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΗΛΩΜΕΝΗ ΛΙΣΤΑ ΚΑΙ ΟΧΙ ΚΩΔΙΚΑΣ ΡΟΗΣ (2026-09-14)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σκάλα ήταν μία συνάρτηση **~110 γραμμών** μέσα στη μηχανή, με οκτώ σχεδόν ταυτόσημα μπλοκ
 * «φτιάξε URL → περίμενε → ρώτα → κατέγραψε → αν βρήκες, τελείωσε». Η προσθήκη βαθμίδας σήμαινε
 * **ένατο αντίγραφο** του ίδιου μπλοκ.
 *
 * ⚠️ **Η μετατροπή είναι ασφαλής για ΜΕΤΡΗΣΙΜΟ λόγο**: **κάθε** συνθήκη εφαρμογής εξαρτάται μόνο
 * από το **ερώτημα**, ποτέ από προηγούμενη απάντηση. Άρα ολόκληρη η σκάλα είναι γνωστή πριν από
 * την πρώτη κλήση. Το ημερολόγιο προσπαθειών μένει ταυτόσημο: οι 7 σουίτες της μηχανής είναι η απόδειξη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ — ΑΡΙΘΜΟΣ = ΤΑΥΤΟΤΗΤΑ, ΘΕΣΗ = ΣΕΙΡΑ (ADR-332 D28)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `1–6` πλήρης διεύθυνση σε αναδιατυπώσεις → **`9` χαλάρωση τοπωνυμίου με άγκυρα τον Τ.Κ.** →
 * `7–8` χαλάρωση χώρας. Το ίδιο δόγμα με το Pelias: **εξάντλησε το συγκεκριμένο πριν ρίξεις
 * πεδίο**, και ρίξε πρώτα το λιγότερο αξιόπιστο. Η χώρα φεύγει τελευταία γιατί η απώλειά της
 * έχει μετρηθεί να φέρνει Ουισκόνσιν για ελληνική διεύθυνση (D12).
 */

import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import type {
  GeocodingLocalityField,
  GeocodingRelaxation,
  GeocodingRequestBody,
  GeocodingVariant,
} from '@/lib/geocoding/geocoding-types';
import type { NominatimResult } from './geocoding-engine-helpers';
import { buildFreeformUrl, buildStructuredUrl } from './geocoding-nominatim-client';
import {
  createAccentStrippedVariant,
  createGreeklishVariant,
  toFreeformQuery,
  toOsmStyleQuery,
  toPostcodeAnchoredQuery,
} from './geocoding-query-variants';

export interface LadderStep {
  readonly variant: GeocodingVariant;
  /** `null` ⇒ η παραλλαγή **δεν εφαρμόζεται** σε αυτό το ερώτημα — καταγράφεται `skipped`. */
  readonly url: string | null;
  /**
   * **Κριτήριο αποδοχής υποψηφίου.** Απόν ⇒ κάθε υποψήφιος του παρόχου γίνεται δεκτός.
   * Υπάρχει μόνο εκεί όπου το ερώτημα **αφαίρεσε** κάτι: ό,τι κρατήθηκε πρέπει να αποδειχθεί.
   */
  readonly accept?: (candidate: NominatimResult) => boolean;
  /** Τι **δεν** ρωτήθηκε — ταξιδεύει στην απάντηση ώστε κανείς να μη νομίσει ότι επιβεβαιώθηκε. */
  readonly relaxation?: GeocodingRelaxation;
}

/** Η σκάλα ενός ερωτήματος — **ολόκληρη**, πριν από την πρώτη κλήση. */
export function buildGeocodingLadder(
  params: GeocodingRequestBody,
  countryCode: string | null,
): readonly LadderStep[] {
  return [
    ...fullAddressSteps(params, countryCode),
    postcodeAnchoredStep(params, countryCode),
    ...countryRelaxedSteps(params, countryCode),
  ];
}

/** `1–6` — η διεύθυνση όπως τη δήλωσε ο άνθρωπος, σε διαφορετικές γραφές. */
function fullAddressSteps(params: GeocodingRequestBody, cc: string | null): LadderStep[] {
  const osm = toOsmStyleQuery(params);
  const freeform = toFreeformQuery(params);
  const hyphenated = Boolean(params.city?.includes('-') || params.neighborhood?.includes('-'));
  const greeklish = !params.country || cc === 'gr' ? createGreeklishVariant(params) : null;
  return [
    { variant: 1, url: osm.trim() ? buildFreeformUrl(osm, cc) : null },
    { variant: 2, url: buildStructuredUrl(params, cc) },
    { variant: 3, url: hyphenated ? buildStructuredUrl(dehyphenate(params), cc) : null },
    { variant: 4, url: buildStructuredUrl(createAccentStrippedVariant(params), cc) },
    { variant: 5, url: greeklish ? buildStructuredUrl(greeklish, cc) : null },
    { variant: 6, url: freeform.trim() && freeform !== osm ? buildFreeformUrl(freeform, cc) : null },
  ];
}

function dehyphenate(params: GeocodingRequestBody): GeocodingRequestBody {
  return {
    ...params,
    city: params.city?.replace(/-/g, ' '),
    neighborhood: params.neighborhood?.replace(/-/g, ' '),
  };
}

/**
 * **`9` — ΤΟ ΤΟΠΩΝΥΜΙΟ ΦΕΥΓΕΙ, Ο Τ.Κ. ΜΕΝΕΙ ΚΑΙ ΑΠΟΔΕΙΚΝΥΕΤΑΙ** (ADR-332 D28).
 *
 * 🔴 Μετρημένο ζωντανά 2026-09-14: «Σαμοθράκης 16, 56334, Θεσσαλονίκη» ⇒ **όλες** οι παραλλαγές
 * κενές. Ο Τ.Κ. 56334 ανήκει στον Δήμο Κορδελιού-Ευόσμου· η «Θεσσαλονίκη» είναι η **μητροπολιτική**
 * περιοχή, και ο Nominatim τη διαβάζει ως **δήμο** — τα πεδία του είναι αυστηρό AND.
 *
 * 🔑 **Το βήμα πέρα από το Pelias**: εκείνο ρίχνει πεδίο **τυφλά**. Στη Θεσσαλονίκη υπάρχουν
 * **τέσσερις** οδοί «Σαμοθράκης»· μια χαλάρωση που δέχεται τον πρώτο υποψήφιο θα έδινε σωστό δρόμο
 * σε λάθος γειτονιά. Εδώ γίνεται δεκτός **μόνο** υποψήφιος που φέρει **τον ίδιο Τ.Κ.**.
 */
function postcodeAnchoredStep(params: GeocodingRequestBody, cc: string | null): LadderStep {
  const query = toPostcodeAnchoredQuery(params);
  if (query === null) return { variant: 9, url: null };
  return {
    variant: 9,
    url: buildFreeformUrl(query, cc),
    accept: (candidate) => provesPostalCode(candidate, params.postalCode),
    relaxation: { dropped: droppedLocalities(params), anchor: 'postalCode' },
  };
}

/**
 * **Φέρει ο υποψήφιος τον δηλωμένο Τ.Κ.;**
 *
 * ⚠️ Απών Τ.Κ. στην απάντηση = **καμία απόδειξη**, όχι «δεν αντιφάσκει». Ο λόγος ύπαρξης της
 * βαθμίδας είναι ότι ο Τ.Κ. αντικαθιστά το τοπωνύμιο που αφαιρέθηκε· χωρίς αυτόν δεν μένει τίποτα.
 * ⚠️ Σύγκριση σε κανονική μορφή: το OSM Ελλάδας γράφει «563 34» (D16).
 */
function provesPostalCode(candidate: NominatimResult, declared: string | undefined): boolean {
  const resolved = candidate.address?.postcode;
  if (!resolved || !declared) return false;
  return toCanonicalGreekPostalCode(resolved) === toCanonicalGreekPostalCode(declared);
}

/** Η σειρά είναι από το στενότερο στο ευρύτερο — όπως διαβάζει ο άνθρωπος μια διεύθυνση. */
const LOCALITY_FIELDS: readonly GeocodingLocalityField[] = [
  'neighborhood',
  'city',
  'municipality',
  'county',
  'region',
];

function droppedLocalities(params: GeocodingRequestBody): readonly GeocodingLocalityField[] {
  return LOCALITY_FIELDS.filter((field) => Boolean(params[field]));
}

/** `7–8` — χωρίς περιορισμό χώρας· μόνο όταν ο άνθρωπος **δήλωσε** χώρα που αναγνωρίζουμε. */
function countryRelaxedSteps(params: GeocodingRequestBody, cc: string | null): LadderStep[] {
  const osm = toOsmStyleQuery(params);
  const global = toFreeformQuery(params);
  const cityOnly = params.city || params.neighborhood;
  const declared = cc !== null;
  return [
    { variant: 7, url: declared && global.trim() && global !== osm ? buildFreeformUrl(global, null) : null },
    { variant: 8, url: declared && cityOnly ? buildFreeformUrl(cityOnly, null) : null },
  ];
}
