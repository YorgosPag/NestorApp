/**
 * @fileoverview **Η ΜΟΝΑΔΑ ΤΟΥ ΕΠΙΠΕΔΟΥ Α — γέννηση και συγχώνευση** (ADR-900 §8 #2, 2β.4). Καθαρό, χωρίς Firestore.
 * @related SPEC-777A §14.2 · §14.3 · §14.4 · `place-facts.ts` (τα αδέλφια: γη, κτίριο)
 * @module lib/places/public-unit-facts
 *
 * 🔑 **Είσοδος = `PlaceUnitRef` με ΚΑΕΚ ιδιοκτησίας** (`composePlaceUnitRef`, απόδειξη `verified`). Έξοδος = μόνο
 * ό,τι είναι **φυσικό γεγονός**: γη, κτίριο, στάθμη. Ο αριθμός μονάδας (πόρτα) και ο ΚΑΕΚ **πέφτουν εδώ**, ρητά —
 * όχι με spread που θα τα κουβαλούσε σιωπηλά (Ε2 · §14.4 κανόνας 4).
 *
 * 🔑 **Κύκλος UPRN**: ίδιος ΚΑΕΚ ⇒ ίδια μονάδα. Νέα βεβαίωση (ξανα-επαλήθευση ή **νέος κάτοχος**) ανανεώνει μόνο
 * το `lastAttestedAt` και επαναφέρει `approved`. Η στάθμη αλλάζει **μόνο** με ισχυρότερη πηγή (`outranksForFact`,
 * ισοβαθμία ⇒ όχι): ο δεύτερος κάτοχος που δηλώνει άλλο όροφο **δεν** ξαναγράφει την πραγματικότητα για όλους.
 * Ο δεσμός κτιρίου δεν ξαναγράφεται ποτέ από δήλωση — διαφωνία = **σήμα** για τον θεματοφύλακα.
 */

import { outranksForFact, type Attested } from '@/lib/location/location-provenance';
import type { FloorRef } from '@/lib/floor/floor-ref';
import type { PlaceUnitRef } from '@/lib/geo/place-unit';
import type { PublicUnit } from '@/types/geo/public-place';

/** Ό,τι **επιτρέπεται** να περάσει από τη μονάδα του ιδιοκτήτη στο κοινό επίπεδο — τίποτε άλλο. */
export interface PublicUnitFacts {
  readonly landId: string;
  readonly buildingId: string;
  readonly floor: FloorRef | null;
}

/**
 * Από τη σύνθεση στα γεγονότα. `null` ⇔ **δεν** γεννιέται μονάδα: χωρίς ΚΑΕΚ ιδιοκτησίας (μόνο `verified` με
 * `/Κ/Ο` — το εγγυάται ο `unitKaekOf`) ή χωρίς κτίριο (καμία ψευδο-μονάδα, ADR-900 §8 #2 Α4).
 */
export function publicUnitFactsOf(ref: PlaceUnitRef): PublicUnitFacts | null {
  if (ref.kaek === null || ref.buildingId === null) return null;
  return { landId: ref.landId, buildingId: ref.buildingId, floor: ref.floor };
}

/** Η στάθμη ως γεγονός: σήμερα η **μόνη** πηγή της είναι η δήλωση του επαληθευμένου κατόχου. */
function declaredLevel(floor: FloorRef | null, at: string): Attested<FloorRef> | null {
  return floor === null ? null : { value: floor, source: 'declared', attestedAt: at };
}

export function newPublicUnit(id: string, facts: PublicUnitFacts, at: string): PublicUnit {
  return {
    id,
    landId: facts.landId,
    buildingId: facts.buildingId,
    level: declaredLevel(facts.floor, at),
    existence: { source: 'cadastre', firstAttestedAt: at, lastAttestedAt: at },
    status: 'approved',
    createdAt: at,
    updatedAt: at,
  };
}

export interface PublicUnitMerge {
  readonly unit: PublicUnit;
  /** Η νέα βεβαίωση δείχνει **άλλο** κτίριο από το καταγεγραμμένο — δεν εφαρμόστηκε, είναι σήμα. */
  readonly linkDisagreement: boolean;
}

/**
 * **Απόσυρση** (κύκλος UPRN, logical status 8): η μονάδα **δεν** διαγράφεται και το id της δεν ξαναδίνεται —
 * γίνεται `historical`, κρατώντας ύπαρξη και στάθμη ως ιστορικό. Την καλεί **μόνο** η ανάκληση που ρίχνει την
 * τελευταία έγκυρη βεβαίωση (ADR-900 §8 #2, Β3). Νέα βεβαίωση ⇒ {@link mergeIntoUnit} την ξαναφέρνει `approved`.
 */
export function retireUnit(existing: PublicUnit, at: string): PublicUnit {
  return { ...existing, status: 'historical', updatedAt: at };
}

/** Νέα βεβαίωση της ίδιας μονάδας (§14.3 πεδίο προς πεδίο). */
export function mergeIntoUnit(existing: PublicUnit, facts: PublicUnitFacts, at: string): PublicUnitMerge {
  const candidate = declaredLevel(facts.floor, at);
  const levelWins = candidate !== null && outranksForFact(candidate.source, existing.level?.source ?? null);
  return {
    unit: {
      ...existing,
      level: levelWins ? candidate : existing.level,
      existence: { ...existing.existence, lastAttestedAt: at },
      status: 'approved',
      updatedAt: at,
    },
    linkDisagreement: existing.buildingId !== facts.buildingId || existing.landId !== facts.landId,
  };
}
