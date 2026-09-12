/**
 * @fileoverview **Η μνήμη της μηχανής γεωκωδικοποίησης** — ADR-332 D27 Ζ5 · ADR-167.
 * @module app/api/geocoding/geocoding-cache
 *
 * 🔴 **ΔΕΝ είναι βελτιστοποίηση — είναι ΟΡΟΣ ΧΡΗΣΗΣ.** Η πολιτική του Nominatim λέει ρητά:
 * *«Results **must** be cached on your side. Clients sending repeatedly the same query may be classified as
 * faulty and **blocked**»*. Μέχρι το Ζ5 η διαδρομή του διακομιστή δεν είχε καμία μνήμη: κάθε αποθήκευση
 * επαφής ξαναρωτούσε από την αρχή — **έως 8 παραλλαγές** με `sleep(1100ms)` ανάμεσά τους. Μετρημένο
 * ζωντανά: **61,4 δευτερόλεπτα** για μία αποθήκευση.
 *
 * ⚠️ **Η μνήμη υπήρχε ήδη, στη ΛΑΘΟΣ πλευρά του συνόρου.** Το `lib/geocoding/geocoding-service.ts` έχει
 * cache + in-flight dedup, αλλά είναι περιτύλιγμα **πελάτη** γύρω από το `/api/geocoding`. Η αποθήκευση
 * (`address-place-writeback` → `geocodeWithVerdict`) τρέχει **μέσα στη διεργασία** και δεν το βλέπει ποτέ.
 * Επειδή πληκτρολόγηση **και** αποθήκευση καταλήγουν στην ίδια συνάρτηση, μία μνήμη **εδώ** εξυπηρετεί και
 * τις δύο — χωρίς αλλαγή σχήματος και χωρίς να χρειαστεί να εμπιστευτούμε συντεταγμένες από τον πελάτη.
 *
 * ── ΠΟΛΙΤΙΚΗ ΑΝΑ ΕΤΥΜΗΓΟΡΙΑ ──
 * | Ετυμηγορία | Αποθηκεύεται; | Γιατί |
 * |---|---|---|
 * | `hit` | ✅ μεγάλη διάρκεια | η θέση μιας διεύθυνσης είναι πρακτικά στατική |
 * | `absent` | ✅ **σύντομη** (αρνητική μνήμη) | αλλιώς η **χειρότερη** περίπτωση —διεύθυνση που δεν λύνεται— πληρώνει και τις 8 παραλλαγές σε **κάθε** αποθήκευση· σύντομη ώστε μια νέα εγγραφή στο OSM να βρεθεί γρήγορα (πρότυπο DNS negative TTL) |
 * | `unavailable` | ❌ **ποτέ** | «δεν μπόρεσα να ρωτήσω» **δεν είναι γνώση**· ένα παροδικό 429 δεν επιτρέπεται να γίνει μόνιμη αλήθεια (ίδιος κανόνας με το `geocoding-service.ts`) |
 *
 * 🔑 **Κοινή για όλους, επίτηδες**: η γεωκωδικοποίηση **δημόσιας** διεύθυνσης δεν είναι δεδομένο πελάτη.
 * Το κλειδί χτίζεται **μόνο** από τα πεδία διεύθυνσης — καμία ταυτότητα μισθωτή ή χρήστη (άγκυρα Ε4γ).
 * Κατάτμηση ανά χρήστη θα ακύρωνε το νόημα και θα ξαναπαραβίαζε την πολιτική.
 *
 * ⚠️ **Δηλωμένο όριο**: το `EnterpriseAPICache` δεν έχει φράγμα μεγέθους. Οι εγγραφές λήγουν μόνες τους,
 * αλλά σε πολύ μεγάλο πλήθος διαφορετικών διευθύνσεων το αποτύπωμα μνήμης μεγαλώνει ως τη λήξη.
 */

import 'server-only';

import { apiCache } from '@/lib/cache/enterprise-api-cache';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeocodingRequestBody } from '@/lib/geocoding/geocoding-types';
// Μόνο τύπος: η μηχανή εισάγει **αυτό** το module σε χρόνο εκτέλεσης, άρα εδώ δεν επιτρέπεται κύκλος.
import type { GeocodeVerdict } from './geocoding-engine';

const logger = createModuleLogger('GeocodingCache');
const { GEOCODING } = GEOGRAPHIC_CONFIG;

/**
 * Τα πεδία που ταξιδεύουν στο Nominatim — **ακριβώς** όσα επιστρέφει το `sanitizeQuery`.
 * Ο φρουρός Ε5 κρατά τα δύο ίσα: πεδίο που φεύγει προς τη μηχανή αλλά λείπει από το κλειδί θα έκανε
 * δύο **διαφορετικές** διευθύνσεις να μοιραστούν εγγραφή — σιωπηλά λάθος θέση.
 */
const KEY_FIELDS: readonly (keyof GeocodingRequestBody)[] = [
  'street',
  'number',
  'city',
  'neighborhood',
  'postalCode',
  'county',
  'municipality',
  'region',
  'country',
];

/** Έκδοση σχήματος κλειδιού: αλλαγή στην κανονικοποίηση **πρέπει** να ακυρώνει τις παλιές εγγραφές. */
const KEY_PREFIX = 'geocoding:v1';

/**
 * Κεφαλαία και κενά δεν αλλάζουν ερώτημα· **οι τόνοι αλλάζουν**.
 *
 * 🔴 Η μηχανή έχει **δική της** παραλλαγή «χωρίς τόνους» (attempt 4) ακριβώς επειδή το Nominatim απαντά
 * αλλιώς. Κλειδί που ισοπεδώνει τόνους θα επέστρεφε την απάντηση **άλλου** ερωτήματος (άγκυρα Ε4δ).
 */
function normalize(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

/** Το κλειδί μνήμης μιας διεύθυνσης — ντετερμινιστικό, και **μόνο** από πεδία διεύθυνσης. */
export function geocodingCacheKey(params: GeocodingRequestBody): string {
  return [KEY_PREFIX, ...KEY_FIELDS.map((field) => normalize(params[field]))].join('|');
}

/** Πόσο ζει η κάθε ετυμηγορία. `null` ⇒ δεν αποθηκεύεται καθόλου. */
function ttlFor(verdict: GeocodeVerdict): number | null {
  if (verdict.kind === 'hit') return GEOCODING.CACHE_TTL_MS;
  if (verdict.kind === 'absent') return GEOCODING.CACHE_ABSENT_TTL_MS;
  return null; // unavailable — άγνοια, όχι γνώση
}

/**
 * Ταυτόχρονα ίδια ερωτήματα μοιράζονται **μία** υπόσχεση.
 *
 * Δύο διευθύνσεις της ίδιας επαφής με ίδιο κείμενο λύνονται μέσα στην **ίδια** αποθήκευση· χωρίς dedup
 * θα έφευγαν δύο ταυτόσημα αιτήματα — ακριβώς αυτό που η πολιτική χαρακτηρίζει *faulty*.
 */
const inFlight = new Map<string, Promise<GeocodeVerdict>>();

/**
 * Ρωτά τη μηχανή **μόνο αν χρειάζεται**.
 *
 * @param params Το ερώτημα διεύθυνσης (ο καλών έχει ήδη κάνει `sanitizeQuery`· η κανονικοποίηση του
 *               κλειδιού είναι ούτως ή άλλως ανεξάρτητη).
 * @param fetcher Η πραγματική κλήση — εκτελείται μόνο σε αστοχία μνήμης.
 */
export async function cachedGeocode(
  params: GeocodingRequestBody,
  fetcher: () => Promise<GeocodeVerdict>,
): Promise<GeocodeVerdict> {
  const key = geocodingCacheKey(params);

  const cached = apiCache.get<GeocodeVerdict>(key);
  if (cached !== null) return cached;

  const running = inFlight.get(key);
  if (running) return running;

  const promise = fetcher()
    .then((verdict) => {
      const ttl = ttlFor(verdict);
      if (ttl !== null) apiCache.set(key, verdict, ttl);
      else logger.info('Γεωκωδικοποίηση: «δεν μπόρεσα να ρωτήσω» — δεν αποθηκεύεται', { data: { key } });
      return verdict;
    })
    .finally(() => {
      // Και σε αποτυχία: μια κολλημένη κράτηση θα νέκρωνε το κλειδί για όλη τη ζωή της διεργασίας.
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Αδειάζει τη μνήμη γεωκωδικοποίησης — **και μόνο αυτήν** (το `EnterpriseAPICache` είναι κοινό).
 *
 * Χρήσεις: λειτουργική ακύρωση όταν αλλάξει πάροχος ή πολιτική ερωτήματος, και **απομόνωση ελέγχων** —
 * η μνήμη ζει στη διεργασία, οπότε δύο έλεγχοι που ρωτούν την ίδια διεύθυνση θα αλληλοεπηρεάζονταν.
 *
 * @returns πόσες εγγραφές αφαιρέθηκαν.
 */
export function clearGeocodingCache(): number {
  inFlight.clear();
  return apiCache.invalidatePattern(KEY_PREFIX);
}
