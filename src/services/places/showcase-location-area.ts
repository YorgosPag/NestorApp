import 'server-only';

/**
 * @fileoverview **Ο ΔΗΜΟΣ ΕΝΟΣ ΚΑΤΑΣΤΗΜΑΤΟΣ «ΜΟΝΟ ΠΕΡΙΟΧΗ»** — η μόνη δημόσια πληροφορία τόπου του (ADR-896 §6).
 * @related lib/geo/admin-area-of-point.ts (ο κριτής) · services/places/admin-boundaries.reader.ts (η πηγή) ·
 *   app/api/agency-profile/card/card-request.ts · services/mandate/showcase-card-custody.ts (η μετάπτωση)
 * @module services/places/showcase-location-area
 *
 * 🔑 **Ο ΙΔΙΟΣ ΚΡΙΤΗΣ ΜΕ ΤΙΣ ΑΓΓΕΛΙΕΣ** (ADR-890 Φ0): `assignAdminArea` πάνω στα **ίδια** απλοποιημένα όρια που
 * ζωγραφίζει ο χάρτης — ο δήμος που γράφεται είναι αυτός που ο επισκέπτης **βλέπει** να περιέχει το σημείο.
 *
 * 🔴 **«ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ» ≠ «ΔΕΝ ΠΕΦΤΕΙ ΣΕ ΔΗΜΟ»**: το πρώτο (ευρετήριο που δεν διαβάστηκε) είναι
 * `'unavailable'` και η πόρτα απαντά «ξαναδοκίμασε» — αλλιώς ένα παροδικό σφάλμα θα γραφόταν **μόνιμα** ως
 * `area: null`. Το δεύτερο (σημείο στη θάλασσα, εκτός Ελλάδας) είναι `{ area: null }`, απάντηση.
 */

import { assignAdminArea } from '@/lib/geo/admin-area-of-point';
import { ADMIN_LEVEL } from '@/lib/geo/admin-area-index-file';
import { readAdminAreaLookup } from '@/services/places/admin-boundaries.reader';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { ShowcaseLocationArea } from '@/types/showcase-card';

export type ShowcaseLocationAreaResult = { readonly area: ShowcaseLocationArea | null } | 'unavailable';

/**
 * **Σε ποιον δήμο πέφτει ο τόπος** — ποτέ βαθύτερα (k-ανωνυμία: η κοινότητα ενός χωριού είναι σχεδόν η κατοικία).
 * `position === null` (γη χωρίς γνωστή θέση) ⇒ `{ area: null }`: δεν υπάρχει τίποτα να κριθεί.
 */
export async function showcaseLocationArea(position: GeoPoint | null): Promise<ShowcaseLocationAreaResult> {
  if (position === null) return { area: null };
  const lookup = await readAdminAreaLookup();
  if (lookup === null) return 'unavailable';
  const assigned = await assignAdminArea(position, ADMIN_LEVEL.municipality, lookup);
  const adminId = assigned?.municipalityId ?? null;
  return { area: adminId === null ? null : { adminId } };
}
