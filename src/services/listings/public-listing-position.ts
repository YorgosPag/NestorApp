/**
 * @fileoverview **ΠΟΥ ΕΙΝΑΙ ΑΥΤΗ Η ΑΓΓΕΛΙΑ** — και ποιος το ξέρει καλύτερα.
 * @related ADR-841 §14.3 · ADR-777 §8.53 · ./public-listing-projection.ts
 * @module services/listings/public-listing-position
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΟΧΙ «ΚΟΨΙΜΟ ΓΙΑ ΝΑ ΠΕΡΑΣΕΙ ΤΟ ΟΡΙΟ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η προβολή είχε φτάσει **520 γραμμές** και το CHECK 4 τη σταμάτησε. Το όριο όμως
 * είναι **σύμπτωμα**: μέσα στο ίδιο αρχείο ζούσαν **δύο** ερωτήσεις που δεν μιλούν
 * μεταξύ τους — *«τι είναι αυτή η αγγελία;»* (η προβολή) και *«**πού** είναι, και
 * **ποιος** το ξέρει καλύτερα;»* (η θέση).
 *
 * 🔑 **Η δεύτερη έχει δικό της λεξιλόγιο** — προέλευση, ακρίβεια, ισοβαθμία, λόγος
 * άγνοιας — και δικό της κανόνα κατάταξης (`outranksForLocation`). Είναι ακριβώς το
 * είδος γνώσης που, όταν ζει δίπλα σε άσχετη, αντιγράφεται από τον επόμενο που τη
 * χρειάζεται αντί να εισαχθεί.
 *
 * ⚠️ **ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΞΕ ΣΤΗ ΣΥΜΠΕΡΙΦΟΡΑ.** Οι δύο συναρτήσεις μετακόμισαν αυτούσιες,
 * με τα σχόλιά τους: το «γιατί» τους είναι μετρημένο (εύρημα #1 του Β1, και η Α5), και
 * ένα σχόλιο που μένει πίσω στη μετακόμιση είναι σχόλιο που θα ξαναγραφτεί λάθος.
 */

import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import { outranksForLocation } from '@/lib/location/location-provenance';
import type { ListingPosition, UnknownPositionReason } from '@/types/public-listing';

import type {
  ListingPositionCandidate,
  PlaceKnowledge,
  ProjectableProperty,
} from './public-listing-projection-types';

/**
 * Ποια από τις υποψήφιες θέσεις ισχύει.
 *
 * 🔴 **Χρησιμοποιεί `outranksForLocation`, ΠΟΤΕ το σκαλοπάτι της σκάλας** — και αυτό
 * είναι το εύρημα #1 του Β1, γραμμένο εδώ ως κώδικας: το σκαλοπάτι **5** σημαίνει
 * «έγγραφο ναι, **θέση όχι**» ενώ το **4** δίνει σχήμα. Όποιος διαβάσει τον αριθμό ως
 * αξιοπιστία, αφήνει **ανύπαρκτο** στοιχείο θέσης να σβήσει **υπαρκτό**.
 *
 * ⚠️ **Ισοβαθμία ⇒ κρατάει ο πρώτος.** Το `outranksForLocation` επιστρέφει `false` σε
 * ισοβαθμία **επίτηδες**: δύο πηγές ίδιας βαθμίδας που διαφωνούν είναι σύγκρουση προς
 * επίλυση από άνθρωπο, όχι «το τελευταίο νικά».
 */
export function resolveListingPosition(
  place: PlaceKnowledge,
  disclosure: ProjectableProperty['locationDisclosure']
): ListingPosition {
  let winner: ListingPositionCandidate | null = null;

  for (const candidate of place.candidates) {
    if (outranksForLocation(candidate.provenance, winner?.provenance ?? null)) {
      winner = candidate;
    }
  }

  if (winner) return winner;

  const reason: UnknownPositionReason = disclosure === 'declined' ? 'owner-declined' : 'never-asked';
  return { kind: 'unknown', reason };
}

/** Δομική όψη μιας καταχωρημένης διεύθυνσης — όσο χρειάζεται η θέση, τίποτα άλλο. */
export interface AddressLike {
  readonly coordinates?: { readonly lat?: number | null; readonly lng?: number | null } | null;
  readonly geocodingMetadata?: { readonly accuracy?: GeocodingAccuracy | null } | null;
  readonly isPrimary?: boolean | null;
  readonly verifiedAt?: number | null;
}

/**
 * Διεύθυνση → υποψήφια θέση, ή `null` αν δεν κουβαλά συντεταγμένες.
 *
 * 🔑 **Η προέλευση συνάγεται από ΤΑ ΙΔΙΑ ΤΑ ΔΕΔΟΜΕΝΑ, όχι από παραδοχή:**
 *
 *   - υπάρχει `geocodingMetadata` ⇒ **μηχανή** το συμπέρανε από κείμενο ⇒ `geocoded`,
 *     και **κουβαλά την ακρίβειά της** — που είναι ολόκληρη η Α5.
 *   - υπάρχουν συντεταγμένες **χωρίς** μεταδεδομένα geocoder ⇒ κάποιος τις **έβαλε**
 *     ⇒ `manual`.
 *
 * ⚠️ **Η δεύτερη περίπτωση δεν βαφτίζεται `geocoded` με `accuracy: 'center'`** — θα
 * ήταν εύκολο και θα ήταν **ψέμα** προς την ασφαλή κατεύθυνση: θα ζωγράφιζε σκιασμένη
 * πόλη εκεί που άνθρωπος έδειξε ακριβές σημείο, δηλαδή θα **έκρυβε** γνώση που έχουμε.
 * Η Α5 απαιτεί να λέμε **ό,τι ξέρουμε**, όχι το ασφαλέστερο.
 */
export function addressToPositionCandidate(
  address: AddressLike,
  locatedAt: string
): ListingPositionCandidate | null {
  const lat = address.coordinates?.lat;
  const lng = address.coordinates?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const accuracy = address.geocodingMetadata?.accuracy ?? null;
  const point = { lat, lng } as const;

  if (accuracy) {
    return { kind: 'known', provenance: 'geocoded', point, locatedAt, accuracy };
  }
  return { kind: 'known', provenance: 'manual', point, locatedAt };
}
