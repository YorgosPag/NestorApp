/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΟΥ NOMINATIM ΚΑΙ ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ** — ADR-332 D27 Φάση Β′.
 * @module app/api/geocoding/reverse/nominatim-reverse
 *
 * 🔑 **ΓΙΑΤΙ ΕΙΝΑΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ**: το `route.ts` έφτασε **428 γραμμές** ενώ το όριο μιας
 * διαδρομής API είναι **300** (N.7.1 — CHECK 4). Η τομή **δεν** έγινε στη μέση: εδώ ζει
 * *«τι λέει ο πάροχος και πώς διαβάζεται»*, εκεί *«τι κάνει η διαδρομή με αυτό»*. Ο
 * πάροχος είναι **αντικαταστάσιμος**· η ενορχήστρωση όχι.
 *
 * ⚠️ **ΜΗΝ το ξαναγυρίσεις μέσα στο `route.ts`**: το αρχείο θα ξαναπεράσει το όριο, και η
 * πύλη θα ξαναμπλοκάρει το commit — αυτή τη φορά χωρίς προφανή τομή.
 *
 * @see ADR-332 D27 — «η ετικέτα δηλώνει το επίπεδό της»
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { Deadline } from '@/lib/async-utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import { cleanPlaceName, declaredAdminLevel } from '@/utils/address/place-name';
import type { ReverseGeocodingResult } from '@/lib/geocoding/geocoding-types';

const logger = createModuleLogger('reverse-geocoding-nominatim');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Nominatim reverse response address details.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 **ΗΤΑΝ ΔΕΚΑ ΚΛΕΙΔΙΑ, ΚΑΙ ΕΛΕΙΠΑΝ ΑΚΡΙΒΩΣ ΤΑ ΔΙΟΙΚΗΤΙΚΑ** — ADR-332 D27 Φάση Β′.
 *
 * Το Nominatim στέλνει για την Ελλάδα **ολόκληρη** τη διοικητική αλυσίδα, **με τα
 * προθέματά της**. Μετρημένο ζωντανά σε **14** ελληνικές πόλεις *(2026-09-12)*:
 *
 * | κλειδί | τι είναι | λύθηκε **ακριβώς** στο μητρώο |
 * |---|---|---|
 * | `state` | «Περιφέρεια Κρήτης» | **14/14** |
 * | `county` | «Περιφερειακή / Μητροπολιτική Ενότητα …» | 12/14 |
 * | `municipality` | «**Δήμος** Αθηναίων» | **14/14** |
 * | `city` | «Δημοτική Ενότητα Θεσσαλονίκης» *(ή σκέτο «Λάρισα»)* | 7/14 |
 * | `city_district` | «1η Κοινότητα Αθηνών» | — |
 * | `quarter` | «Κολωνάκι» — **συνοικία, ΟΧΙ οικισμός** | — |
 *
 * ⇒ Ο **δήμος**, δηλαδή **η μία από τις δύο** ταυτότητες που αποθηκεύει το `companyAddress`,
 * ήταν **πάντα στην απάντηση** και **δεν διαβαζόταν ποτέ**. Ό,τι δεν δηλώνεται δεν
 * διαβάζεται, και ό,τι δεν διαβάζεται «δεν υπάρχει».
 *
 * 🏆 **Και είναι εκεί όπου η γεωμετρία σιωπά**: στο Σύνταγμα, στο κέντρο του Ηρακλείου και
 * στη Νέα Μαγνησία **κανένα** εσωτερικό κάλυμμα δήμου δεν περιέχει το σημείο — η ετικέτα
 * όμως φέρνει τον δήμο ονομαστικά.
 * ═════════════════════════════════════════════════════════════════════════════
 */
export interface NominatimReverseAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  /** Συνοικία — το OSM τη λέει έτσι στα αστικά κέντρα («Κολωνάκι»). */
  quarter?: string;
  /** «1η Κοινότητα Αθηνών» — δημοτική κοινότητα, βαθμίδα 7. */
  city_district?: string;
  /** «Δήμος Αθηναίων» — **βαθμίδα 5**, η ταυτότητα που αποθηκεύουμε. */
  municipality?: string;
  /** «Περιφερειακή Ενότητα Ηρακλείου» — βαθμίδα 4. */
  county?: string;
  postcode?: string;
  state?: string;
  country?: string;
}

export interface NominatimReverseResult {
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimReverseAddress;
}

/** Τι είπε το Nominatim — **τρεις** εκβάσεις (ίδιο συμβόλαιο με το `geocodeWithVerdict`). */
export type NominatimLookup =
  | { readonly kind: 'found'; readonly result: NominatimReverseResult }
  /** Απάντησε: σε αυτό το σημείο δεν γράφει τίποτα. */
  | { readonly kind: 'absent' }
  /** Δεν απάντησε (λήξη · όριο ρυθμού · σφάλμα). */
  | { readonly kind: 'unavailable' };

/**
 * 🔴 **ΗΤΑΝ ΔΙΚΟ ΤΟΥ INTERFACE, ΤΑΥΤΟΣΗΜΟ ΜΕ ΤΟΥ ΠΕΛΑΤΗ — ΤΟ ΕΠΙΑΣΕ Ο N.18 (CHECK 3.28).**
 *
 * Ο route δήλωνε **δέκα πεδία** που το `ReverseGeocodingResult` δήλωνε **ίδια**, σε δύο
 * αρχεία: δύο συμβόλαια για **ένα** σύρμα, ελεύθερα να αποκλίνουν σιωπηλά. Η προσθήκη του
 * `admin` έσπρωξε το δίδυμο πάνω από το κατώφλι του jscpd και **φάνηκε** — δηλαδή το
 * εργαλείο βρήκε χρέος που **προϋπήρχε**, και το βρήκε επειδή το άγγιξα.
 *
 * ⚠️ Ένα module **μόνο τύπων** είναι ασφαλές στον διακομιστή: μηδέν εξαρτήσεις, μηδέν React.
 * 🔑 Το όνομα μένει ως **τοπικό ψευδώνυμο** ώστε τα σημεία κλήσης να διαβάζονται ως
 * *«η απάντηση ΑΥΤΗΣ της διαδρομής»* — ένα όνομα, **ένα** σχήμα.
 */
export type ReverseGeocodingApiResponse = ReverseGeocodingResult;

// =============================================================================
// CONFIGURATION
// =============================================================================

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';
const NOMINATIM_TIMEOUT_MS = parseInt(process.env.GEOCODING_TIMEOUT_MS || '8000', 10);
const { GEOCODING } = GEOGRAPHIC_CONFIG;

// =============================================================================
// NOMINATIM REVERSE LOOKUP
// =============================================================================

export function buildReverseUrl(lat: number, lon: number): string {
  const searchParams = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    addressdetails: '1',
    'accept-language': GEOCODING.ACCEPT_LANGUAGE,
  });

  return `${NOMINATIM_BASE_URL}/reverse?${searchParams.toString()}`;
}

export async function fetchNominatimReverse(url: string, deadline: Deadline): Promise<NominatimLookup> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      // Β13: το δικό του όριο, ή λιγότερο αν τελειώνει η προθεσμία του αιτήματος.
      signal: AbortSignal.timeout(Math.min(NOMINATIM_TIMEOUT_MS, deadline.remainingMs())),
    });

    if (!response.ok) {
      logger.warn('Nominatim reverse non-OK response', { data: { status: response.status } });
      return { kind: 'unavailable' };
    }

    const data: NominatimReverseResult = await response.json();

    // Nominatim returns { error: "Unable to geocode" } — μια ΑΠΑΝΤΗΣΗ, όχι βλάβη.
    if (!data.address) {
      logger.warn('Nominatim reverse returned no address');
      return { kind: 'absent' };
    }

    return { kind: 'found', result: data };
  } catch (error) {
    logger.warn('Nominatim reverse fetch error', { error: getErrorMessage(error) });
    return { kind: 'unavailable' };
  }
}

/**
 * **Η ΣΕΙΡΑ ΤΩΝ ΥΠΟΨΗΦΙΩΝ ΓΙΑ «ΟΙΚΙΣΜΟΣ»** — από το ειδικό στο γενικό.
 *
 * 🔴 **ΤΟ `neighbourhood` ΕΦΥΓΕ ΑΠΟ ΑΥΤΗ ΤΗ ΣΕΙΡΑ** *(ADR-332 D27 **Ζ2**)*: μια **γειτονιά
 * δεν είναι οικισμός**, και η παρουσία της εδώ ήταν η ρίζα του «η **Λαδάδικα** ως Πόλη».
 * Μετρημένο: **καμία** από τις συνοικίες Αθήνας/Θεσσαλονίκης *(Λαδάδικα · Κολωνάκι ·
 * Εξάρχεια · Χαριλάου · Άνω Πόλη · Μεταξουργείο · Σεπόλια · Γουδή · Συκιές)* **δεν
 * αντιστοιχεί σε κανέναν** από τους 13.272 οικισμούς ⇒ όσο καταλάμβανε τη θέση της πόλης,
 * η ταυτοποίηση ήταν **δομικά αδύνατη**.
 *
 * ⚠️ Το `suburb` **μένει πρώτο**, και είναι τεκμηριωμένο: στην Ελλάδα το OSM το χρησιμοποιεί
 * για τον **πραγματικό οικισμό** *(«Ελευθέριο Κορδελιό»)*, ενώ το `city`/`town` ανεβαίνει
 * συχνά σε **δημοτική ενότητα** *(«Δημοτική Ενότητα Θεσσαλονίκης»)*.
 */
export const SETTLEMENT_KEYS: readonly (keyof NominatimReverseAddress)[] = [
  'suburb',
  'village',
  'town',
  'city',
];

/**
 * **Η διοικητική αλυσίδα, ΩΜΗ** — με τα προθέματα ακέραια, ώστε κάθε ετικέτα να μπορεί να
 * δηλώσει τη βαθμίδα της.
 *
 * ⚠️ **ΕΜΠΙΣΤΕΥΣΟΥ ΤΟ ΠΡΟΘΕΜΑ, ΟΧΙ ΤΟ ΟΝΟΜΑ ΤΟΥ ΚΛΕΙΔΙΟΥ** — μετρημένο στον **Πύργο**, όπου
 * το `municipality` ήρθε **`null`** και το `city` έγραφε «**Δήμος** Πύργου». Γι' αυτό εδώ
 * μπαίνουν **όλα** τα κλειδιά και ο κριτής ρωτά το καθένα *«ποια βαθμίδα δηλώνεις;»*.
 */
export function adminChainLabels(addr: NominatimReverseAddress): readonly string[] {
  return [
    addr.state ?? '',
    addr.county ?? '',
    addr.municipality ?? '',
    addr.city_district ?? '',
    addr.city ?? '',
    addr.town ?? '',
    addr.village ?? '',
    addr.suburb ?? '',
  ].filter((label) => label.trim() !== '');
}

/** Ο πρώτος υποψήφιος οικισμός που **δεν** δηλώνει βαθμίδα — μια δημοτική ενότητα δεν είναι οικισμός. */
export function settlementLabelOf(addr: NominatimReverseAddress): string {
  for (const key of SETTLEMENT_KEYS) {
    const value = (addr[key] ?? '').trim();
    if (value !== '' && declaredAdminLevel(value) === null) return value;
  }
  return '';
}

export function formatReverseResult(result: NominatimReverseResult): ReverseGeocodingApiResponse {
  const addr = result.address;

  const rawCity = SETTLEMENT_KEYS.map((key) => addr[key] ?? '').find((v) => v !== '') ?? '';
  // 🔴 Ζ2: η συνοικία ζει **μόνο** εδώ. Το `suburb` **δεν** επαναλαμβάνεται ως συνοικία —
  //    όταν υπάρχει, είναι ο οικισμός, και η διπλοεγγραφή του έκανε «πόλη == συνοικία».
  const rawNeighborhood = addr.quarter ?? addr.neighbourhood ?? '';

  return {
    street: addr.road ?? '',
    number: addr.house_number ?? '',
    // ADR-332 D27 Βήμα Β (Β7): ο ΕΝΑΣ κανόνας ονομάτων τόπου (`utils/address/place-name`).
    city: cleanPlaceName(rawCity),
    neighborhood: cleanPlaceName(rawNeighborhood),
    // Κανονική μορφή στο σύνορο του παρόχου — το OSM Ελλάδας γράφει «546 24»
    // και η τιμή κατέληγε αυτούσια στη φόρμα και στη βάση (ADR-332 D16).
    postalCode: toCanonicalGreekPostalCode(addr.postcode),
    region: addr.state ?? '',
    country: addr.country ?? '',
    displayName: result.display_name,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}
