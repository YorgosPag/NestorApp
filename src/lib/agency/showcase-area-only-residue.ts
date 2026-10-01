/**
 * @fileoverview **ΤΙ ΑΠΕΜΕΙΝΕ ΑΠΟ ΤΟΝ ΤΟΠΟ ΤΩΝ ΚΑΤΑΣΤΗΜΑΤΩΝ «ΜΟΝΟ ΠΕΡΙΟΧΗ»** — ο κριτής της μετάπτωσης (ADR-896 §6).
 * @related services/mandate/showcase-card-custody.ts (`moveAreaOnlyPremises`, η πράξη) ·
 *   lib/agency/showcase-read-locations.ts (ο αναγνώστης που ήδη τα αγνοεί) ·
 *   scripts/migrations/migrate-showcase-area-only-premises.ts
 * @module lib/agency/showcase-area-only-residue
 *
 * 🔑 **ΚΑΘΑΡΟ, ΜΗΔΕΝ I/O** — ο ίδιος κριτής απαντά «υπάρχει απόκλιση;» στο ξηρό τρέξιμο **και** «τι γράφω;» μέσα
 * στη συναλλαγή του γραφέα. Δύο κριτές θα μπορούσαν να διαφωνήσουν, και τότε η αναφορά θα έλεγε «0» ενώ η βάση
 * θα κρατούσε ακόμη τη διεύθυνση.
 *
 * 🔑 **ΙΔΕΜΠΟΤΙΑ ΑΠΟ ΚΑΤΑΣΚΕΥΗΣ**: το υπόλειμμα ορίζεται ως «`street` χωρίς οδό **και** παρόν `place` ή `position`».
 * Μετά την αφαίρεση κανένα από τα δύο δεν υπάρχει ⇒ δεύτερο πέρασμα βρίσκει **μηδέν**.
 */

import { readPosition } from '@/lib/agency/showcase-read-geo';
import { readStreetLine } from '@/lib/agency/showcase-read-locations';
import { readPlace, text } from '@/lib/agency/showcase-read-primitives';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef } from '@/types/geo/public-place';
import type { ShowcaseLocationArea } from '@/types/showcase-card';

/** Ένα κατάστημα «μόνο περιοχή» που **ακόμη** δημοσιεύει τόπο. */
export interface AreaOnlyResidue {
  readonly locationId: string;
  /** Ο δεσμός με τη γη — πηγαίνει στο ιδιωτικό μισό (`null` = σκουπίδι, απλώς σβήνεται). */
  readonly place: PlaceRef | null;
  /** Το σημείο από το οποίο αποδίδεται ο δήμος — `null` ⇒ δήμος `null`. */
  readonly position: GeoPoint | null;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

function residueOf(raw: unknown): AreaOnlyResidue | null {
  const entry = asRecord(raw);
  const locationId = entry === null ? null : text(entry.id);
  if (entry === null || locationId === null || readStreetLine(entry.street) !== null) return null;
  if (!('place' in entry) && !('position' in entry)) return null;
  return { locationId, place: readPlace(entry.place), position: readPosition(entry.position) };
}

/** **Ποια καταστήματα «μόνο περιοχή» κουβαλούν ακόμη τόπο** στο ωμό δημόσιο `locations`. */
export function areaOnlyResidue(rawLocations: unknown): readonly AreaOnlyResidue[] {
  if (!Array.isArray(rawLocations)) return [];
  return rawLocations.flatMap((raw) => {
    const residue = residueOf(raw);
    return residue === null ? [] : [residue];
  });
}

/**
 * **Το ωμό `locations` χωρίς τον τόπο των υπολειμμάτων** — με τον δήμο τους στη θέση του. Ό,τι άλλο υπάρχει
 * (ωράριο, κανάλια, άγνωστα πεδία) μένει **αυτούσιο**: η μετάπτωση δεν ξαναγράφει την κάρτα κανενός.
 */
export function stripAreaOnlyResidue(
  rawLocations: readonly unknown[],
  areas: ReadonlyMap<string, ShowcaseLocationArea | null>,
): readonly unknown[] {
  return rawLocations.map((raw) => {
    const residue = residueOf(raw);
    const entry = asRecord(raw);
    if (residue === null || entry === null || !areas.has(residue.locationId)) return raw;
    const { place: _place, position: _position, ...rest } = entry;
    return { ...rest, area: areas.get(residue.locationId) ?? null };
  });
}
