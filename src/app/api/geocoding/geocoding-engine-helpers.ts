/**
 * Pure helpers for `geocoding-engine.ts`. Extracted to keep the main engine
 * file under the 500-line Google SRP threshold (CLAUDE.md N.7.1).
 *
 * Contains:
 *   - Internal Nominatim DTO shapes (NominatimAddress, NominatimResult)
 *   - Result extraction: accuracy, resolvedFields, confidenceBreakdown,
 *     fieldMatches, partialMatch
 *   - Formatters: formatTopResult, formatAlternative
 *
 * @see ADR-332 §3.2 (type contracts)
 */

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { postalCodeAppearsIn, toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import { distinctAddressChoices } from '@/lib/geocoding/address-candidate-identity';
import type {
  GeocodingRequestBody,
  GeocodingApiResponse,
  GeocodingAlternative,
  GeocodingAttempt,
  GeocodingVariant,
  ResolvedAddressFields,
  FieldMatchKind,
  FieldMatchMap,
  ConfidenceBreakdown,
} from '@/lib/geocoding/geocoding-types';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

const { GEOCODING } = GEOGRAPHIC_CONFIG;

// =============================================================================
// INTERNAL NOMINATIM DTOs (shared between engine + helpers)
// =============================================================================

export interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  /** ISO-3166-1 alpha-2, lowercase. The reliable signal for country integrity. */
  country_code?: string;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  osm_id?: number | string;
  osm_type?: string;
  /**
   * **Η ΕΠΙΣΗΜΗ ΒΑΘΜΙΔΑ ΤΟΥ NOMINATIM** — δες {@link determineAccuracy}.
   * Επιστρέφεται στο προεπιλεγμένο `format=json`· προαιρετικό εδώ γιατί ο τύπος
   * περιγράφει και απαντήσεις δοκιμών που δεν τη δηλώνουν.
   */
  place_rank?: number;
  boundingbox?: string[];
  address?: NominatimAddress;
}

// =============================================================================
// RESULT EXTRACTION
// =============================================================================

/**
 * Οι βαθμίδες του Nominatim — **επίσημη κλίμακα**, όχι δικό μας συμπέρασμα.
 *
 * `≥28` POI/κτίριο/αριθμός · `26–27` δρόμοι · `20–25` συνοικίες/οικισμοί ·
 * `<20` πόλεις και διοικητικά. Τεκμηρίωση: *Nominatim ▸ Customize ▸ Ranking*.
 */
const RANK_ADDRESS = 28;
const RANK_STREET = 26;
const RANK_NEIGHBOURHOOD = 20;

/**
 * Πόσο ακριβές είναι αυτό το αποτέλεσμα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΗΤΑΝ ΛΑΘΟΣ ΩΣ ΤΙΣ 2026-09-02 — μετρημένο σε ζωντανή αναζήτηση
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προηγούμενη εκδοχή ταίριαζε **ονόματα** (`type`), με το `class` μόνο ως εφεδρεία:
 *
 * ```
 * if (type === 'street' || type === 'road')   return 'interpolated';
 * if (type === 'suburb' || 'neighbourhood' || 'residential') return 'approximate';
 * ```
 *
 * **Και το `'residential'` είναι ΤΡΙΠΛΑ ΑΜΦΙΣΗΜΟ στο OSM** — η σημασία του κρίνεται
 * **αποκλειστικά** από το `class`, που η συνθήκη αγνοούσε:
 *
 * | Ετικέτα OSM | Τι είναι | Έδινε | Έπρεπε |
 * |---|---|---|---|
 * | `highway=residential` | **δρόμος** κατοικημένης περιοχής | `approximate` | `interpolated` |
 * | `building=residential` | **κτίριο** κατοικιών | `approximate` | `exact` |
 * | `landuse=residential` | ζώνη κατοικίας | `approximate` | `approximate` ✔ |
 *
 * ⇒ Ο **συνηθέστερος αστικός δρόμος της Ελλάδας** υποβαθμιζόταν κατά μία βαθμίδα, και
 * ένα **κτίριο** κατά δύο. Και τα `'street'`/`'road'` που υποτίθεται ότι έπιαναν τους
 * δρόμους είναι σχεδόν **νεκρά**: το `street` **δεν είναι τιμή OSM** καθόλου, και το
 * `highway=road` σημαίνει «άγνωστης κατηγορίας» — σπάνιο. Δηλαδή ο κλάδος
 * `interpolated` δεν έπιανε σχεδόν **τίποτα**, ενώ ήταν ο σωστός για κάθε δρόμο.
 *
 * 🔴 **Και δεν υπήρχε ΚΑΜΙΑ άγκυρα** σε ολόκληρο το repo (`grep` = 0) για τη συνάρτηση
 * που κρίνει την ακρίβεια **κάθε** διεύθυνσης — και της οποίας η έξοδος οδηγεί, μέσω
 * του `listingMapShape`, **το σχήμα στον δημόσιο χάρτη**. Ένατη εμφάνιση του «0 =
 * κανείς δεν κοίταξε».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ✅ ΤΙ ΚΡΙΝΕΙ ΤΩΡΑ — αριθμός, όχι λεξιλόγιο
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔑 **Το `place_rank` είναι το `location_type` της Google, μόνο καλύτερο**: κλίμακα
 * αντί για τέσσερα ονόματα, ορισμένη από τον ίδιο τον πάροχο, **αδιάφορη σε νέες
 * ετικέτες OSM**. Ένα καινούριο `class`/`type` που κανείς μας δεν έχει ακούσει παίρνει
 * **σωστή** βαθμίδα χωρίς να αγγίξουμε γραμμή — ενώ κάθε λίστα ονομάτων παλιώνει.
 *
 * ⚠️ **Ο έλεγχος του αριθμού ΠΡΟΗΓΕΙΤΑΙ όλων**: αν ο πάροχος επέστρεψε
 * `addr:housenumber`, τότε **ξέρουμε τη διεύθυνση** — ανεξάρτητα από βαθμίδα ή ετικέτα.
 * Είναι απόδειξη, όχι ένδειξη.
 *
 * ⚠️ **Το ταίριασμα ονομάτων ΕΠΙΒΙΩΝΕΙ ως τελευταία εφεδρεία**, διορθωμένο ώστε να
 * ρωτά το `class`: το `place_rank` λείπει σε μη τυπικές απαντήσεις, και μια σιωπηλή
 * πτώση στο `'center'` θα μετέτρεπε κάθε τέτοια περίπτωση σε «μόνο πόλη» — υποβάθμιση
 * που μοιάζει με δεδομένο.
 */
export function determineAccuracy(result: NominatimResult): GeocodingApiResponse['accuracy'] {
  // 1. ΑΠΟΔΕΙΞΗ: ο πάροχος γύρισε αριθμό ⇒ ξέρουμε τη διεύθυνση.
  if (result.address?.house_number) return 'exact';

  // 2. Η ΕΠΙΣΗΜΗ ΚΛΙΜΑΚΑ.
  const rank = result.place_rank;
  if (typeof rank === 'number' && Number.isFinite(rank)) {
    if (rank >= RANK_ADDRESS) return 'exact';
    if (rank >= RANK_STREET) return 'interpolated';
    if (rank >= RANK_NEIGHBOURHOOD) return 'approximate';
    return 'center';
  }

  // 3. ΕΦΕΔΡΕΙΑ ΟΝΟΜΑΤΩΝ — τώρα ρωτά το `class`, που ήταν η ρίζα του σφάλματος.
  const klass = result.class ?? '';
  const type = result.type ?? '';
  if (klass === 'building' || type === 'house' || type === 'building') return 'exact';
  if (klass === 'highway') return 'interpolated';
  if (type === 'street' || type === 'road') return 'interpolated';
  if (klass === 'landuse') return 'approximate';
  if (type === 'suburb' || type === 'neighbourhood' || type === 'quarter') return 'approximate';
  return 'center';
}

/**
 * **Η ΕΚΤΑΣΗ ΤΟΥ ΑΠΟΤΕΛΕΣΜΑΤΟΣ** — `boundingbox` του Nominatim → {@link GeoBoundingBox}.
 *
 * 🔴 **Αυτή η τιμή ΕΦΤΑΝΕ ΠΑΝΤΑ ΚΑΙ ΠΕΤΙΟΤΑΝ ΠΑΝΤΑ** (μετρημένο 2026-09-02): το
 * `boundingbox` ήταν δηλωμένο στο {@link NominatimResult} — δηλαδή κάποιος το είχε
 * **δει** — και καμία γραμμή δεν το διάβαζε. Είναι το `viewport` της Google με άλλο
 * όνομα, και χωρίς αυτό κάθε επιφάνεια μαντεύει ζουμ από τον βαθμό ακρίβειας.
 *
 * ⚠️ **Η σειρά του Nominatim είναι `[νότος, βορράς, δύση, ανατολή]` — ΟΧΙ η σειρά που
 * περιμένει κάθε βιβλιοθήκη χάρτη** (`[δ, ν, α, β]`). Η μετάφραση γίνεται **εδώ, μία
 * φορά**, σε **ονομαστικά** πεδία: ένας πίνακας τεσσάρων αριθμών που ταξιδεύει με
 * σιωπηρή σύμβαση σειράς είναι η κλασική διαδρομή προς αντεστραμμένους χάρτες.
 *
 * ⚠️ **Ανθεκτικός σε ό,τι δεν είναι αριθμός**: ο πάροχος δίνει **συμβολοσειρές**, και
 * ένα `parseFloat` που γυρίζει `NaN` θα περνούσε σιωπηλά σε κάθε `fitBounds` και θα
 * έριχνε τον χάρτη. `undefined` σημαίνει «δεν ξέρω την έκταση» — απάντηση που ο
 * καταναλωτής **ξέρει** να χειριστεί.
 */
export function extractExtent(result: NominatimResult): GeoBoundingBox | undefined {
  const box = result.boundingbox;
  if (!box || box.length < 4) return undefined;

  const [south, north, west, east] = box.map((value) => parseFloat(value));
  if (![south, north, west, east].every(Number.isFinite)) return undefined;

  return { south, north, west, east };
}

/**
 * Map Nominatim's `address` block to ELSTAT-friendly keys used across the app.
 * Powers field-level badge logic downstream.
 */
export function extractResolvedFields(addr: NominatimAddress | undefined): ResolvedAddressFields {
  if (!addr) return {};
  return {
    street: addr.road,
    number: addr.house_number,
    // Το OSM Ελλάδας γράφει τον Τ.Κ. στην επίσημη μορφή ΕΛΤΑ («546 24»). Αυτή η
    // τιμή έφτανε αυτούσια στη φόρμα και από εκεί στη βάση. Κανονικοποιείται στο
    // σύνορο, ώστε καμία μορφή παρόχου να μη γίνεται σχήμα δεδομένων (D16).
    postalCode: addr.postcode ? toCanonicalGreekPostalCode(addr.postcode) : addr.postcode,
    neighborhood: addr.suburb,
    city: addr.city || addr.town || addr.village || addr.hamlet,
    county: addr.county,
    region: addr.state,
    country: addr.country,
  };
}

export function computeConfidenceBreakdown(
  result: NominatimResult,
  params: GeocodingRequestBody,
): { breakdown: ConfidenceBreakdown; total: number } {
  const display = normalizeGreekText(result.display_name);
  const breakdown: ConfidenceBreakdown = {
    base: GEOCODING.CONFIDENCE.BASE,
    streetMatch: 0,
    cityMatch: 0,
    postalMatch: 0,
    countyMatch: 0,
    municipalityMatch: 0,
  };

  if (params.street && display.includes(normalizeGreekText(params.street))) {
    breakdown.streetMatch = GEOCODING.CONFIDENCE.STREET_MATCH;
  }
  if (params.neighborhood && display.includes(normalizeGreekText(params.neighborhood))) {
    breakdown.cityMatch = GEOCODING.CONFIDENCE.CITY_MATCH;
  } else if (params.city && display.includes(normalizeGreekText(params.city))) {
    breakdown.cityMatch = GEOCODING.CONFIDENCE.CITY_MATCH;
  }
  if (params.county && display.includes(normalizeGreekText(params.county))) {
    breakdown.countyMatch = GEOCODING.CONFIDENCE.CITY_MATCH * 0.5;
  }
  if (params.municipality && display.includes(normalizeGreekText(params.municipality))) {
    breakdown.municipalityMatch = GEOCODING.CONFIDENCE.CITY_MATCH * 0.3;
  }
  // Ανεξάρτητο μορφής: το `display_name` γράφει «546 24», το ερώτημα στέλνει
  // «54624». Σκέτο `includes` θα έχανε το ταίριασμα ΜΕΤΑ την κανονικοποίηση —
  // παλινδρόμηση εμπιστοσύνης από τη διόρθωση, όχι από τα δεδομένα (D16).
  if (postalCodeAppearsIn(display, params.postalCode)) {
    breakdown.postalMatch = GEOCODING.CONFIDENCE.POSTAL_MATCH;
  }

  const total = Math.min(
    breakdown.base + breakdown.streetMatch + breakdown.cityMatch +
      breakdown.postalMatch + breakdown.countyMatch + breakdown.municipalityMatch,
    1,
  );
  return { breakdown, total };
}

/**
 * Per-field match matrix comparing user input against Nominatim's resolved
 * fields. Case/accent-insensitive comparison.
 */
export function buildFieldMatches(
  params: GeocodingRequestBody,
  resolved: ResolvedAddressFields,
): FieldMatchMap {
  const matchKey = (field: keyof ResolvedAddressFields): FieldMatchKind => {
    const userVal = params[field as keyof GeocodingRequestBody];
    const resolvedVal = resolved[field];
    if (!userVal) return 'not-provided';
    if (!resolvedVal) return 'unknown';
    return normalizeGreekText(String(userVal)) === normalizeGreekText(resolvedVal)
      ? 'match'
      : 'mismatch';
  };

  // Ο Τ.Κ. συγκρίνεται σε κανονική μορφή και από τις δύο πλευρές: μια
  // αποθηκευμένη τιμή «546 24» (πριν τη μετάπτωση) δεν είναι mismatch με «54624».
  const matchPostalCode = (): FieldMatchKind => {
    if (!params.postalCode) return 'not-provided';
    if (!resolved.postalCode) return 'unknown';
    return toCanonicalGreekPostalCode(params.postalCode) === toCanonicalGreekPostalCode(resolved.postalCode)
      ? 'match'
      : 'mismatch';
  };

  return {
    street: matchKey('street'),
    number: matchKey('number'),
    postalCode: matchPostalCode(),
    neighborhood: matchKey('neighborhood'),
    city: matchKey('city'),
    county: matchKey('county'),
    region: matchKey('region'),
    country: matchKey('country'),
  };
}

export function computePartialMatch(matches: FieldMatchMap): boolean {
  return Object.values(matches).some((m) => m === 'mismatch' || m === 'unknown');
}

// =============================================================================
// FORMATTERS — top result + alternatives
// =============================================================================

/**
 * The shape every Nominatim hit turns into — top result and alternative alike.
 *
 * `GeocodingAlternative` is literally `Omit<GeocodingApiResponse, 'alternatives'>`,
 * so the two formatters below differ in exactly two things: whether the attempts
 * log is carried, and whether alternatives are attached. Everything else — the
 * coordinate parsing, the accuracy call, the confidence breakdown, the source
 * provenance — is one computation with one owner.
 *
 * It previously lived twice, verbatim, in the two formatters; a field added to
 * one and forgotten in the other would have silently made alternatives disagree
 * with the top result they are compared against.
 */
function buildBaseResponse(
  result: NominatimResult,
  params: GeocodingRequestBody,
  variantUsed: GeocodingVariant,
  attemptsLog: GeocodingAttempt[],
): GeocodingAlternative {
  const resolvedFields = extractResolvedFields(result.address);
  const fieldMatches = buildFieldMatches(params, resolvedFields);
  const { breakdown, total: confidence } = computeConfidenceBreakdown(result, params);

  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    accuracy: determineAccuracy(result),
    confidence,
    displayName: result.display_name,
    extent: extractExtent(result),
    resolvedCity: resolvedFields.city,
    resolvedFields,
    partialMatch: computePartialMatch(fieldMatches),
    reasoning: {
      fieldMatches,
      attemptsLog,
      confidenceBreakdown: breakdown,
    },
    source: {
      provider: 'nominatim',
      osmType: result.osm_type,
      osmId: result.osm_id != null ? String(result.osm_id) : undefined,
      importance: result.importance,
      variantUsed,
    },
  };
}

/**
 * Πόσες εναλλακτικές ταξιδεύουν στην απάντηση.
 *
 * Φράγμα **ωφέλιμου φορτίου**, όχι σχεδίασης: ο τύπος `GeocodingApiResponse.alternatives`
 * υπόσχεται «up to 4», και μια απάντηση που κουβαλά περισσότερα από όσα υπόσχεται είναι
 * η αρχή της απόκλισης. Εφαρμόζεται **ΜΕΤΑ** τη σύμπτυξη, ποτέ πριν — αλλιώς τέσσερα POI
 * της ίδιας πόρτας θα έτρωγαν τη θέση μιας γνήσιας εναλλακτικής.
 */
const MAX_ALTERNATIVES = 4;

/**
 * Το κορυφαίο αποτέλεσμα **μαζί με τις εναλλακτικές του** — όπου «εναλλακτική» σημαίνει
 * *άλλη διεύθυνση*, όχι *άλλη σειρά*.
 *
 * 🔴 **Η σύμπτυξη γίνεται ΕΔΩ, όχι στην οθόνη.** Μετρημένο 2026-09-02: με `limit=5` ο
 * Nominatim επιστρέφει για «Τσιμισκή 43, Θεσσαλονίκη» **τέσσερα POI της ίδιας πόρτας**
 * (Προξενείο ΗΠΑ · Μασούτης · ODEON · το σπίτι, 0-57 m). Αν αυτά ταξίδευαν ως
 * `alternatives`, **κάθε** καταναλωτής θα έπρεπε να τα ξαναφιλτράρει — και η σκανδάλη
 * `multiple-candidates-similar` (`alternatives.length >= 2`) θα πυροδοτούσε πάνω σε
 * **μηδέν** πραγματική αμφισημία. Το πεδίο πρέπει να σημαίνει αυτό που λέει το όνομά του
 * στο σημείο που γεμίζει.
 *
 * @see lib/geocoding/address-candidate-identity — πότε δύο υποψήφιοι είναι η ίδια επιλογή
 */
export function formatTopResult(
  result: NominatimResult,
  params: GeocodingRequestBody,
  attempts: GeocodingAttempt[],
  alternativeCandidates: NominatimResult[],
  variantUsed: GeocodingVariant,
): GeocodingApiResponse {
  const top = buildBaseResponse(result, params, variantUsed, attempts);
  const formatted = alternativeCandidates.map((alt) =>
    formatAlternative(alt, params, variantUsed),
  );
  // Ο κορυφαίος μπαίνει πρώτος στη σύγκριση ώστε μια εναλλακτική που είναι η ΙΔΙΑ πόρτα
  // με εκείνον να πέφτει — αλλά βγαίνει αμέσως μετά, γιατί δεν είναι εναλλακτική του εαυτού του.
  const distinct = distinctAddressChoices<GeocodingAlternative>([top, ...formatted]);
  return { ...top, alternatives: distinct.slice(1, 1 + MAX_ALTERNATIVES) };
}

/** An alternative carries no attempts log — the log describes the search, not the candidate. */
export function formatAlternative(
  result: NominatimResult,
  params: GeocodingRequestBody,
  variantUsed: GeocodingVariant,
): GeocodingAlternative {
  return buildBaseResponse(result, params, variantUsed, []);
}
