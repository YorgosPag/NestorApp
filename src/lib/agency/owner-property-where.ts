/**
 * @fileoverview **«ΠΟΙΟΣ ΚΑΛΥΠΤΕΙ ΤΟ ΑΚΙΝΗΤΟ ΜΟΥ;»** — ένα ακίνητο του κατόχου → περιοχή φίλτρου (ADR-896 §7.2).
 * @related lib/agency/presence-admin-ids.ts (`deepestContainingEntity`) · lib/listings/listing-map-shape.ts
 *   (ο ΕΝΑΣ πίνακας αβεβαιότητας) · components/mandate/MyPropertyFilter.tsx
 * @module lib/agency/owner-property-where
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΠΕΡΑ ΑΠΟ ΤΟ ZILLOW — «ΤΟ ΚΕΛΙ ΠΟΥ ΠΕΡΙΕΧΕΙ ΟΛΗ ΤΗΝ ΑΒΕΒΑΙΟΤΗΤΑ», ΟΧΙ «ΤΟ ZIP ΤΟΥ ΣΗΜΕΙΟΥ»
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Ο Zillow Agent Finder ψάχνει ανά γειτονιά / ZIP / πόλη. Ένα σπίτι γεωκωδικοποιημένο σε **κέντρο συνοικίας** μπαίνει
 * σε ZIP «στα τυφλά» — και αν το σημείο πέσει στο διπλανό, ο ιδιοκτήτης βλέπει επαγγελματίες **άλλης** γειτονιάς.
 * Εδώ ο κύκλος αβεβαιότητας είναι ο **ίδιος** με της αγγελίας (`LISTING_UNCERTAINTY_KM`), και διαλέγεται το
 * **βαθύτερο κελί Καλλικράτη που τον περιέχει ΟΛΟ, αποδεδειγμένα** (ADR-846 — ο ίδιος κριτής με την παρουσία).
 * Ακριβής πινέζα ⇒ η κοινότητά της· «μόνο πόλη» ⇒ ο δήμος. **Ποτέ πιο στενό απ' όσο ξέρουμε.**
 *
 * 🔒 **Καμία συντεταγμένη δεν βγαίνει**: το αποτέλεσμα είναι **ταυτότητα περιοχής**, που γράφεται στη διεύθυνση (`?area=`)
 * και μοιράζεται χωρίς να προδίδει το σπίτι. Και το διοικητικό φίλτρο **δεν ταξινομεί** (ADR-843) — μόνο φιλτράρει.
 *
 * ⚠️ `null` = «δεν ξέρω», ποτέ «πουθενά»: θέση που δεν δηλώθηκε (`declined`) · αποτυπώματα που δεν φόρτωσαν · κύκλος
 * που δεν χωρά αποδεδειγμένα σε κανένα κελί.
 */

import type { LineageResolver } from '@/lib/agency/coverage-match';
import { deepestContainingEntity, type FootprintEntries } from '@/lib/agency/presence-admin-ids';
import { LISTING_UNCERTAINTY_KM, mapShapeOfGeocodingAccuracy } from '@/lib/listings/listing-map-shape';
import type { ShowcaseWhere } from '@/types/agency-coverage';
import type { GeoCircle } from '@/types/geo/coordinates';
import type { OwnerPropertyPlace } from '@/types/owner-property';

/**
 * **Πού μπορεί να βρίσκεται το ακίνητο** — ο ίδιος κύκλος που θα ζωγράφιζε ο δημόσιος χάρτης.
 * Χωρίς ακρίβεια geocoder (`accuracy: null`) το σημείο το **έβαλε άνθρωπος** ⇒ πινέζα (δες `OwnerPropertyPlace`).
 */
export function ownerPropertyUncertainty(place: OwnerPropertyPlace): GeoCircle | null {
  if (place.kind !== 'declared') return null;
  const shape = place.accuracy === null ? 'pin' : mapShapeOfGeocodingAccuracy(place.accuracy);
  const radiusKm = LISTING_UNCERTAINTY_KM[shape];
  return radiusKm === null ? null : { center: place.point, radiusKm };
}

/** **Το ακίνητο → το φίλτρο του καταλόγου** — ή `null` («η περιοχή του δεν αποδεικνύεται»). */
export function ownerPropertyWhere(
  place: OwnerPropertyPlace,
  footprints: FootprintEntries,
  lineageOf: LineageResolver,
): ShowcaseWhere | null {
  const circle = ownerPropertyUncertainty(place);
  if (circle === null) return null;
  const adminId = deepestContainingEntity(circle, footprints, lineageOf);
  return adminId === null ? null : { adminId };
}
