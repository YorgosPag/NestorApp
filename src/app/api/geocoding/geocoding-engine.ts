/**
 * Nominatim geocoding engine — multi-variant search strategy with full
 * transparency reporting (ADR-332 Phase 0).
 *
 * Returns top result + up to 4 alternatives from the winning variant,
 * per-field match matrix, attempts log, confidence breakdown, source
 * provenance. Pure helpers (formatters, extractors) live in
 * `geocoding-engine-helpers.ts` to keep this file under 500 LOC.
 *
 * 🔑 **Τρία αρχεία, τρεις ερωτήσεις** (ADR-332 D28, 2026-09-14): `geocoding-nominatim-client`
 * = *πώς ρωτάμε* · `geocoding-ladder` = *τι και με ποια σειρά* · **εδώ** = *τι δεχόμαστε και τι
 * σημαίνει η σιωπή*.
 *
 * Backward compatibility: top-level fields (lat, lng, accuracy, confidence,
 * displayName, resolvedCity) preserved for legacy AddressMap consumers.
 *
 * @see ADR-332 §3.2 (type contracts), §3.4 (suggestion triggers), D28 (postcode-anchored rung)
 * @see geocoding-engine-helpers.ts — formatters and result extractors
 * @see geocoding-types.ts — shared types
 */

import { sleep } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import { countryNameToCode } from '@/utils/address/country-codes';
import { cachedGeocode } from './geocoding-cache';
import type {
  GeocodingRequestBody,
  GeocodingApiResponse,
  GeocodingAttempt,
  GeocodingVariant,
} from '@/lib/geocoding/geocoding-types';
import {
  formatTopResult,
  type NominatimResult,
} from './geocoding-engine-helpers';
import { fetchNominatim, skippedAttempt } from './geocoding-nominatim-client';
import { buildGeocodingLadder, type LadderStep } from './geocoding-ladder';

const logger = createModuleLogger('geocoding-api');

// Re-export shared types so existing route.ts barrel re-export keeps working.
export type { GeocodingRequestBody, GeocodingApiResponse } from '@/lib/geocoding/geocoding-types';

const { GEOCODING } = GEOGRAPHIC_CONFIG;

/**
 * Ο χάρτης χωρών + το accent-insensitive ευρετήριο μετακόμισαν στο
 * `@/utils/address/country-codes`.
 *
 * ΓΙΑΤΙ: το ίδιο ερώτημα το έκανε και το UI (`AddressWithHierarchy`) με **inline
 * αλυσίδα `||`** έξι τιμών. Δύο απαντήσεις για το «είναι ελληνική;» σημαίνει ότι
 * μια νέα ορθογραφία («ΕΛΛΑΣ», NFD από clipboard) διορθωνόταν στη μία πλευρά και
 * όχι στην άλλη — ο engine περιόριζε τη χώρα, το UI όχι.
 *
 * Η αστοχία δεν ήταν καλλωπιστική: ένα άλυτο όνομα έριχνε το `countrycodes` από
 * κάθε variant, και μια ανεξέλεγκτη αναζήτηση απαντούσε ελληνική διεύθυνση με
 * ξένη — μετρημένο 2026-07-26: «Τσιμισκή 43, Θεσσαλονίκη, 54623» επέστρεφε Viale
 * Ungheria, Μιλάνο χωρίς τον περιορισμό.
 */

// =============================================================================
// SANITIZATION
// =============================================================================

function sanitizeStr(v: string | undefined): string | undefined {
  return !v || v === 'null' || v === 'undefined' ? undefined : v;
}

export function sanitizeQuery(body: GeocodingRequestBody): GeocodingRequestBody {
  return {
    street: sanitizeStr(body.street), number: sanitizeStr(body.number),
    city: sanitizeStr(body.city),
    neighborhood: sanitizeStr(body.neighborhood), postalCode: sanitizeStr(body.postalCode),
    county: sanitizeStr(body.county), municipality: sanitizeStr(body.municipality),
    region: sanitizeStr(body.region), country: sanitizeStr(body.country),
  };
}

// =============================================================================
// RESULT FINALIZATION — country integrity (ADR-332 D12)
// =============================================================================

/**
 * The late variants drop the country restriction to rescue typo'd input, which
 * can surface a same-named place on another continent. Measured (2026-07-26):
 * `{street: "Ονειροπόλων", postalCode: "54624", country: "Ελλάδα"}` returned
 * Town of Wheatland, Wisconsin, USA at confidence 0.55.
 *
 * Such a candidate is still worth showing — it explains what the provider
 * matched — but it must never read as verified, so it is flagged and its
 * confidence is zeroed.
 */
/**
 * Η μία ερώτηση, ρωτημένη σε ένα σημείο: **βρίσκεται αυτός ο υποψήφιος στη χώρα που
 * δήλωσε ο άνθρωπος;** Την κάνουν δύο καλούντες με **αντίθετη** αντίδραση, και γι' αυτό
 * ζει χωριστά — δύο αντίγραφα της σύγκρισης είναι ακριβώς το σημείο όπου η μία πλευρά
 * θα μάθαινε για ένα νέο `country_code` και η άλλη όχι.
 */
function withinDeclaredCountry(
  result: NominatimResult,
  declaredCountryCode: string | null,
): boolean {
  if (!declaredCountryCode) return true;
  const resolved = result.address?.country_code?.toLowerCase();
  return !resolved || resolved === declaredCountryCode;
}

function enforceCountryIntegrity(
  response: GeocodingApiResponse,
  result: NominatimResult,
  declaredCountryCode: string | null,
): GeocodingApiResponse {
  if (withinDeclaredCountry(result, declaredCountryCode)) return response;
  logger.warn('Geocoding result outside declared country', {
    data: {
      declared: declaredCountryCode,
      resolved: result.address?.country_code?.toLowerCase(),
      variant: response.source.variantUsed,
    },
  });
  return { ...response, outOfDeclaredCountry: true, confidence: 0 };
}

/**
 * Single exit path for every variant — one place that formats and validates.
 *
 * 🔴 **Οι εναλλακτικές εκτός δηλωμένης χώρας ΦΕΥΓΟΥΝ, δεν σημαιοδοτούνται** — και η
 * ασυμμετρία με τον κορυφαίο είναι σκόπιμη, γιατί οι δύο απαντούν σε **διαφορετική
 * ερώτηση**:
 *
 * - Ο **κορυφαίος** μένει επισημασμένος με `confidence: 0`, επειδή είναι η **εξήγηση**
 *   του τι ταίριαξε ο πάροχος. Χωρίς αυτόν ο άνθρωπος βλέπει «δεν βρέθηκε» και δεν μαθαίνει
 *   ποτέ ότι η ορθογραφία του ταιριάζει σε δρόμο του Ουισκόνσιν (μετρημένο, ADR-332 D12).
 * - Μια **εναλλακτική** δεν εξηγεί τίποτα — είναι **επιλογή σε κατάλογο**. «Μήπως
 *   εννοούσες Town of Wheatland, Wisconsin;» για ελληνική διεύθυνση είναι ακριβώς ο
 *   θόρυβος που αυτή η δουλειά αφαιρεί.
 *
 * ⚠️ **Το φίλτρο ήταν αόρατο ως τις 02/09 και έγινε αναγκαίο με το `limit=5`**: οι
 * παραλλαγές 7 και 8 **σηκώνουν επίτηδες** τον περιορισμό χώρας για να σώσουν
 * τυπογραφικά, οπότε μπορούν κάλλιστα να επιστρέψουν **πέντε** ξένα αποτελέσματα. Με
 * `limit=1` δεν υπήρχε ποτέ δεύτερο· τώρα υπάρχει, και θα ταξίδευε με **πλήρη**
 * εμπιστοσύνη και **χωρίς** σημαία, γιατί ο έλεγχος έβλεπε μόνο τη θέση 0.
 *
 * ⚠️ **Χωρίς άνω όριο εδώ**: η κοπή στις 4 γίνεται στο `formatTopResult` **μετά** τη
 * σύμπτυξη ταυτόσημων επιλογών. Ένα `slice(1, 5)` εδώ θα άφηνε τέσσερα POI της ίδιας
 * πόρτας να φάνε τη θέση μιας γνήσιας εναλλακτικής.
 */
function finishWith(
  results: NominatimResult[],
  params: GeocodingRequestBody,
  attempts: GeocodingAttempt[],
  variant: GeocodingVariant,
  declaredCountryCode: string | null,
): GeocodingApiResponse {
  const top = results[0];
  const alternatives = results
    .slice(1)
    .filter((candidate) => withinDeclaredCountry(candidate, declaredCountryCode));
  return enforceCountryIntegrity(
    formatTopResult(top, params, attempts, alternatives, variant),
    top,
    declaredCountryCode,
  );
}

/**
 * Η απάντηση ενός βήματος — **μαζί με ό,τι δεν ρωτήθηκε** (ADR-332 D28).
 *
 * 🔑 Το `relaxation` είναι το `replaced`/`inferred` της Google Address Validation: μια απάντηση
 * που βρέθηκε **χωρίς** το τοπωνύμιο δεν επιτρέπεται να διαβαστεί σαν να το επιβεβαίωσε.
 */
function finishStep(
  results: NominatimResult[],
  step: LadderStep,
  params: GeocodingRequestBody,
  attempts: GeocodingAttempt[],
  declaredCountryCode: string | null,
): GeocodingApiResponse {
  const response = finishWith(results, params, attempts, step.variant, declaredCountryCode);
  if (!step.relaxation) return response;
  return { ...response, reasoning: { ...response.reasoning, relaxation: step.relaxation } };
}

// =============================================================================
// MAIN — multi-variant geocoding (instrumented)
// =============================================================================

/**
 * Geocode a structured address using the variant ladder (`geocoding-ladder.ts`). Returns the
 * top result with up to 4 alternatives + per-field match matrix + attempts log.
 *
 * 🔑 **Ρωτά τη μηχανή μόνο αν χρειάζεται** (ADR-332 D27 Ζ5): η πολιτική του Nominatim **απαιτεί** μνήμη
 * (*«Results must be cached on your side»*), και επειδή η πληκτρολόγηση (`/api/geocoding`) και η αποθήκευση
 * (`address-place-writeback`) καταλήγουν **και οι δύο** εδώ, η μνήμη στο σημείο αυτό τις εξυπηρετεί μαζί:
 * ό,τι έλυσε ο συντάκτης όσο πληκτρολογούσε ο άνθρωπος, η αποθήκευση το βρίσκει **δωρεάν**.
 *
 * @returns `absent` όταν όλες οι παραλλαγές απάντησαν «δεν υπάρχει»· `unavailable` όταν καμία δεν απάντησε.
 */
export async function geocodeWithVerdict(rawParams: GeocodingRequestBody): Promise<GeocodeVerdict> {
  const params = sanitizeQuery(rawParams);
  return cachedGeocode(params, () => askNominatim(params));
}

/** Εκτελεί τη σκάλα **μέχρι την πρώτη αποδεκτή απάντηση** — μόνο σε αστοχία μνήμης. */
async function askNominatim(params: GeocodingRequestBody): Promise<GeocodeVerdict> {
  const cc = countryNameToCode(params.country);
  const attempts: GeocodingAttempt[] = [];
  const steps = buildGeocodingLadder(params, cc);

  for (const [index, step] of steps.entries()) {
    const accepted = await runStep(step, index, attempts);
    if (accepted.length > 0) return hit(finishStep(accepted, step, params, attempts, cc));
  }

  logger.warn('All geocoding variants failed', { data: { params, attemptsCount: attempts.length } });
  return classifyFailure(attempts);
}

/**
 * Ένα βήμα: ρώτα, κράτα **μόνο** τους αποδεκτούς, κατέγραψε τι έμαθες.
 *
 * ⚠️ **Η ευγένεια προς τον πάροχο ισχύει πριν από κάθε ΕΚΤΕΛΕΣΜΕΝΟ βήμα εκτός του πρώτου της
 * σκάλας** — ακριβώς η προηγούμενη συμπεριφορά (η 2 περίμενε ακόμη κι αν η 1 παραλείφθηκε).
 *
 * 🔴 **Απάντηση που απορρίφθηκε ολόκληρη καταγράφεται `no-results`, όχι `success`.** Ο πάροχος
 * απάντησε, αλλά τίποτα δεν αποδείχθηκε — δηλαδή *γνώση* («δεν υπάρχει εκεί που το ζητήσαμε»).
 * Ένα `success` χωρίς αποτέλεσμα θα έλεγε ψέματα στο ημερολόγιο που βλέπει ο άνθρωπος.
 */
async function runStep(
  step: LadderStep,
  index: number,
  attempts: GeocodingAttempt[],
): Promise<NominatimResult[]> {
  if (step.url === null) {
    attempts.push(skippedAttempt(step.variant));
    return [];
  }
  if (index > 0) await sleep(GEOCODING.NOMINATIM_DELAY_MS);
  logger.info('Geocoding attempt', { data: { variant: step.variant } });

  const out = await fetchNominatim(step.url, step.variant);
  const accepted = step.accept ? out.results.filter(step.accept) : out.results;
  const rejectedAll = out.results.length > 0 && accepted.length === 0;
  attempts.push(rejectedAll ? { ...out.attempt, status: 'no-results' } : out.attempt);
  return accepted;
}

// =============================================================================
// ΕΤΥΜΗΓΟΡΙΑ — «δεν υπάρχει» ΔΕΝ είναι «δεν μπόρεσα να ρωτήσω»
// =============================================================================

/**
 * Τι έμαθε πραγματικά η μηχανή.
 *
 * 🔴 **Η διάκριση υπήρχε στα δεδομένα και χανόταν στην έξοδο.** Ο `fetchNominatim`
 * καταπίνει κάθε σφάλμα δικτύου και επιστρέφει `results: []`, οπότε το ιστορικό
 * συμβόλαιο `GeocodingApiResponse | null` απαντούσε **`null` και στις δύο**
 * περιπτώσεις. Το ίδιο το `geocodeAddressDetailed` το ονομάζει στην τεκμηρίωσή του:
 * *«the boolean-ish `null` contract cannot distinguish "no such address" from "rate
 * limited"»* — αλλά εκείνο είναι ο **πελάτης HTTP**, και ο διακομιστής δεν περνά από
 * εκεί.
 *
 * ⚠️ **Γιατί έχει σημασία, συγκεκριμένα:** ο γραφέας θέσης
 * (`lib/geocoding/address-position.ts`) **σβήνει** τη θέση όταν μια αλλαγμένη
 * διεύθυνση δεν λύνεται — γιατί η παλιά συντεταγμένη θα έδειχνε το **προηγούμενο**
 * κτίριο. Αν μια διακοπή του Nominatim ερχόταν ως «δεν υπάρχει», μια αποθήκευση κατά
 * τη διάρκειά της θα **έσβηνε σωστές θέσεις** — σιωπηλά, και για όλους.
 *
 * 🔑 **Το κριτήριο βγαίνει από τα ίδια τα `attempts`, δεν προστίθεται μηχανισμός:**
 * αν **κάθε** προσπάθεια που όντως ρώτησε γύρισε `'error'`, δεν μάθαμε τίποτα. Αν
 * έστω μία γύρισε καθαρό `'no-results'`, η διεύθυνση όντως δεν βρέθηκε.
 */
export type GeocodeVerdict =
  | { readonly kind: 'hit'; readonly result: GeocodingApiResponse }
  /** Ρωτήθηκε καθαρά και **δεν υπάρχει**. */
  | { readonly kind: 'absent' }
  /** **Δεν μπόρεσε να ρωτηθεί** — δίκτυο, χρονικό όριο, ή ρυθμιστής. */
  | { readonly kind: 'unavailable' };

/** Επιτυχία, τυλιγμένη μία φορά. */
function hit(result: GeocodingApiResponse): GeocodeVerdict {
  return { kind: 'hit', result };
}

/**
 * Ταξινομεί την ολική αποτυχία.
 *
 * ⚠️ Οι `'skipped'` προσπάθειες **δεν μετράνε**: μια παραλλαγή που δεν εκτελέστηκε
 * (π.χ. greeklish σε ελληνικό κείμενο) δεν είναι ούτε απάντηση ούτε αποτυχία, και
 * μετρώντας την θα κάναμε το `unavailable` **δομικά ανέφικτο**.
 */
function classifyFailure(attempts: readonly GeocodingAttempt[]): GeocodeVerdict {
  const asked = attempts.filter((a) => a.status !== 'skipped');
  if (asked.length === 0) return { kind: 'absent' };
  return asked.every((a) => a.status === 'error') ? { kind: 'unavailable' } : { kind: 'absent' };
}

/**
 * Ιστορικό συμβόλαιο, **αμετάβλητο** — και τα τρία υπάρχοντα σημεία κλήσης το κρατούν.
 *
 * ⚠️ **ΜΗΝ το χρησιμοποιήσεις σε νέο κώδικα που ΓΡΑΦΕΙ.** Ισοπεδώνει το «δεν υπάρχει»
 * με το «δεν ρώτησα», και μια γραφή που βασίζεται σε αυτό μπορεί να σβήσει δεδομένα σε
 * διακοπή δικτύου. Χρησιμοποίησε το {@link geocodeWithVerdict}.
 */
export async function geocode(
  rawParams: GeocodingRequestBody,
): Promise<GeocodingApiResponse | null> {
  const verdict = await geocodeWithVerdict(rawParams);
  return verdict.kind === 'hit' ? verdict.result : null;
}
