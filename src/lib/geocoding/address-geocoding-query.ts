/**
 * **ΤΟ ΕΝΑ ΕΡΩΤΗΜΑ ΜΙΑΣ ΔΙΕΥΘΥΝΣΗΣ ΠΡΟΣ ΤΗ ΜΗΧΑΝΗ ΓΕΩΚΩΔΙΚΟΠΟΙΗΣΗΣ** — ADR-332 D29.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΛΕΙΝΕΙ — μετρημένο ζωντανά 2026-10-04 (`POST /api/projects/list` = 8,4″)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τρεις κατασκευαστές κατέληγαν στο **ίδιο** `geocodeWithVerdict` με **τρία** ερωτήματα για την
 * ίδια διεύθυνση — άρα τρία κλειδιά μνήμης, και η αποθήκευση ξαναπλήρωνε όλη τη σκάλα που ο
 * συντάκτης είχε μόλις τρέξει:
 *
 * | | συντάκτης | χάρτης | αποθήκευση |
 * |---|---|---|---|
 * | αριθμός | χωριστά | **κολλημένος** στην οδό | χωριστά |
 * | Π.Ε. | `county` | `regionalUnit` χωρίς πρόθεμα | `regionalUnit` ⇒ **πετιόταν** (η μηχανή ξέρει `county`) |
 * | χώρα | ό,τι είχε η φόρμα (κενό) | ό,τι είχε (κενό) | `?? 'Greece'` |
 * | Τ.Κ. | ωμός | κανονικός | ωμός |
 *
 * 🔑 **Δεν είναι το `toQuery` του γραφέα θέσης, και η διαφορά είναι σκόπιμη.** Εκείνο καταγράφει
 * *τι είπε ο άνθρωπος* (η **απόδειξη**, `geocodingMetadata.resolvedFor`)· αυτό γράφει *τι ρωτιέται
 * η μηχανή*. Η προειδοποίηση «ΜΗΝ τις ενοποιήσεις» του `address-position-rules` μένει ακέραια.
 *
 * ⚠️ **Καθαρό και χωρίς δίκτυο**: τρέχει και στον περιηγητή (συντάκτης, χάρτης) και στον
 * διακομιστή (αποθήκευση) — γι' αυτό ζει στο `lib/` και όχι δίπλα στη μηχανή.
 *
 * @module lib/geocoding/address-geocoding-query
 */

import { storedCountryCodeOrDefault } from '@/utils/address/country-codes';
import { stripGreekAdminPrefix } from '@/utils/address/place-name';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import type { GeocodingRequestBody } from './geocoding-types';

type Text = string | null | undefined;

/**
 * Μια διεύθυνση όπως τη βλέπει **οποιοσδήποτε** από τους τρεις καλούντες — δομικός τύπος.
 *
 * Η περιφερειακή ενότητα έχει **δύο ονόματα** στο σύστημα: `county` (το λεξιλόγιο του συντάκτη
 * και του Nominatim) και `regionalUnit` (το λεξιλόγιο της αποθηκευμένης διεύθυνσης). Δέχεται
 * και τα δύο ώστε κανένας καλών να μη χρειάζεται δική του μετάφραση.
 */
export interface GeocodableAddress {
  readonly street?: Text;
  readonly number?: Text;
  readonly city?: Text;
  readonly neighborhood?: Text;
  readonly postalCode?: Text;
  readonly municipality?: Text;
  readonly region?: Text;
  readonly county?: Text;
  readonly regionalUnit?: Text;
  readonly country?: Text;
}

/** Κείμενο με περιεχόμενο, ή τίποτα — `''`, `null` και `undefined` είναι η ίδια απουσία. */
function text(value: Text): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

/** Διοικητικό όνομα χωρίς τη βαθμίδα του: ο Nominatim δεν καταλαβαίνει «Δήμος Λαγκαδά». */
function adminName(value: Text): string | undefined {
  const name = text(value);
  return name ? text(stripGreekAdminPrefix(name)) : undefined;
}

/**
 * Το ερώτημα — **μόνο** πεδία με περιεχόμενο, σε **μία** γραφή.
 *
 * 🔑 Η χώρα φεύγει ως **κωδικός**, και η απουσία της ως η δηλωμένη προεπιλογή: «Greece», «Ελλάδα»,
 * «GR» και το κενό είναι **το ίδιο ερώτημα** (η μηχανή τη διαβάζει ούτως ή άλλως μόνο ως
 * `countrycodes`, ποτέ ως κείμενο αναζήτησης).
 */
export function toGeocodingRequest(address: GeocodableAddress): GeocodingRequestBody {
  const request: GeocodingRequestBody = {
    street: text(address.street),
    number: text(address.number),
    city: text(address.city),
    neighborhood: text(address.neighborhood),
    postalCode: text(toCanonicalGreekPostalCode(address.postalCode)),
    county: adminName(address.county) ?? adminName(address.regionalUnit),
    municipality: adminName(address.municipality),
    region: adminName(address.region),
    country: storedCountryCodeOrDefault(address.country),
  };
  return Object.fromEntries(
    Object.entries(request).filter(([, value]) => value !== undefined),
  ) as GeocodingRequestBody;
}
