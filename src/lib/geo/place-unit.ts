/**
 * @fileoverview **Η ΜΟΝΑΔΑ** — κτίριο + όροφος + αριθμός μονάδας + ΚΑΕΚ, ως **σύνθεση** · ADR-900 §8 #2 (2β.2).
 * @module lib/geo/place-unit
 *
 * 🔑 Πρότυπο των μεγάλων: UK **UPRN** (η πολυκατοικία έχει UPRN, κάθε διαμέρισμα **UPRN-παιδί**) · Zillow
 * (`zpid` ανά μονάδα + `unit` μέσα σε κτίριο) · idealista (`planta` + `puerta`) · Revit/ArchiCAD (ο χώρος
 * **ανήκει** σε Level/Story). Ελληνικά το ίδιο σχήμα υπάρχει ήδη: ΚΑΕΚ 12 ψηφία = γεωτεμάχιο, `/Κ/Ο` = ιδιοκτησία.
 *
 * ⚠️ **ΣΥΝΘΕΣΗ, ΟΧΙ επέκταση του `PlaceRef`**: ο `PlaceRef` είναι το κλειδί ταιριάσματος σε πέντε τύπους
 * (ζήτηση ↔ προσφορά). Ένα πεδίο ορόφου μέσα του θα άλλαζε **τι σημαίνει** «ίδιος τόπος» για όλους.
 *
 * 🔴 **Ο ΚΑΕΚ ΔΕΝ ΔΗΛΩΝΕΤΑΙ.** Έρχεται **μόνο** από επαλήθευση `verified` (2α, ADR-900 §3.8) και **ποτέ**
 * δεν γράφεται στη δήλωση του ιδιοκτήτη (δόγμα `owner-property-projection`: καμία απόδειξη μέσα στη δήλωση).
 * Γι' αυτό η μονάδα **συντίθεται** τη στιγμή της ανάγνωσης από δύο πηγές: τη δήλωση και την απόδειξη.
 *
 * Καθαρό (χωρίς Firestore) — πελάτης και server. Το **κλειδί** μονάδας ζει στο `place-unit-key.server.ts`.
 */

import type { PlaceRef } from '@/types/geo/public-place';
import type { OwnershipVerificationStatus } from '@/types/ownership-verification';
import type { FloorKind } from '@/utils/floor-naming';
import type { FloorRef } from '@/lib/floor/floor-ref';
import { hostedFloorRef } from '@/lib/floor/hosted-floor';
import { parseKaek } from './kaek';
import { normalizeUnitNumber } from './unit-number';

/** Η μονάδα: τόπος του επιπέδου Α + ό,τι τη χωρίζει από τις γειτονικές της μέσα στο ίδιο κτίριο. */
export type PlaceUnitRef = PlaceRef & {
  readonly floor: FloorRef | null;
  /** RESO `UnitNumber`, κανονικοποιημένος (`normalizeUnitNumber`). **Ποτέ** δημόσιος (Ε2). */
  readonly unitNumber: string | null;
  /** Κανονικός ΚΑΕΚ **ιδιοκτησίας** (με `/Κ/Ο`) — **μόνο** από `verified` επαλήθευση. **Ποτέ** δημόσιος (Ε2). */
  readonly kaek: string | null;
};

/** Ό,τι χρειάζεται από τη δήλωση — το ίδιο σχήμα ορόφου με τα εταιρικά ακίνητα (`floor` + `floorKind`). */
export interface PlaceUnitDeclaration {
  readonly place: { readonly kind: string; readonly link?: PlaceRef | null };
  readonly floor: number | null;
  readonly floorKind: FloorKind | null;
  readonly unitNumber: string | null;
}

/** Ό,τι χρειάζεται από την απόδειξη (`OwnershipVerificationView`). */
export interface PlaceUnitProof {
  readonly status: OwnershipVerificationStatus;
  readonly kaek: string | null;
}

/**
 * Ο ΚΑΕΚ που **μετρά** για μονάδα: απόδειξη `verified` **και** κωδικός **ιδιοκτησίας** (`/Κ/Ο`).
 * ΚΑΕΚ γεωτεμαχίου (χωρίς `/Κ/Ο`) δείχνει όλο το οικόπεδο — **δεν** είναι μονάδα.
 */
export function unitKaekOf(proof: PlaceUnitProof | null): string | null {
  if (proof === null || proof.status !== 'verified' || proof.kaek === null) return null;
  const parsed = parseKaek(proof.kaek);
  if (parsed.kind !== 'parsed' || parsed.kaek.unit === null) return null;
  return proof.kaek;
}

/**
 * Η **μία** σύνθεση. `null` όταν η δήλωση δεν δείχνει σε τόπο του επιπέδου Α (χωρίς δεσμό δεν υπάρχει
 * «ποιο κτίριο», άρα ούτε μονάδα μέσα του).
 */
export function composePlaceUnitRef(
  declaration: PlaceUnitDeclaration,
  proof: PlaceUnitProof | null,
): PlaceUnitRef | null {
  const link = declaration.place.kind === 'declared' ? declaration.place.link ?? null : null;
  if (link === null) return null;
  return {
    landId: link.landId,
    buildingId: link.buildingId,
    floor: hostedFloorRef(declaration),
    unitNumber: normalizeUnitNumber(declaration.unitNumber),
    kaek: unitKaekOf(proof),
  };
}
