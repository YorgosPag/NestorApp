/**
 * level-floor-representative — **ποιο επίπεδο μιλά για τον όροφο;** (ADR-914 §2.10)
 *
 * ## Γιατί υπάρχει
 *
 * Πέντε aggregators (3Δ όλων των ορόφων, υπόβαθρο DXF, πλάκες κελύφους, ανοίγματα κλιμακοστασίου,
 * σκηνές ορόφων) ζητούσαν «ένα επίπεδο ανά όροφο» με τον ίδιο αντιγραμμένο βρόχο: *το πρώτο
 * επίπεδο με αυτό το `floorId` κερδίζει*. Ίσχυε όσο κάθε όροφος είχε **ένα** επίπεδο. Από το
 * ADR-914 μια **κάτοψη ακινήτου** μοιράζεται τον `floorId` του ορόφου της (κλειδί εμβέλειας των
 * BIM οντοτήτων, ADR-420) χωρίς να **είναι** ο όροφος — και αν προηγείται στη σειρά, το «πρώτο
 * κερδίζει» έδειχνε την κάτοψη ενός διαμερίσματος στη θέση ολόκληρου του ορόφου.
 *
 * ## Ο κανόνας
 *
 * Ένας εκπρόσωπος ανά όροφο: το **επίπεδο του ορόφου** όταν υπάρχει· κάτοψη ακινήτου **μόνο**
 * όταν ο όροφος δεν έχει άλλο επίπεδο (ώστε ένας όροφος που έχει μόνο κάτοψη ακινήτου να μη
 * χαθεί από το 3Δ — η προηγούμενη συμπεριφορά). Η σειρά είναι η σειρά πρώτης εμφάνισης κάθε ορόφου.
 *
 * Pure.
 *
 * @module subapps/dxf-viewer/systems/levels/level-floor-representative
 * @see docs/centralized-systems/reference/adrs/ADR-914-open-create-entry.md
 */

import type { Level } from './config';

/** Το ελάχιστο σχήμα επιπέδου που χρειάζεται ο κανόνας του εκπροσώπου. */
export type FloorKeyedLevel = Pick<Level, 'id' | 'buildingId' | 'floorId' | 'propertyId'>;

/** Επίπεδο με βέβαιο όροφο — ό,τι επιστρέφει ο εκπρόσωπος. */
export type FloorBoundLevel<T extends FloorKeyedLevel> = T & { readonly floorId: string };

function isFloorBound<T extends FloorKeyedLevel>(level: T): level is FloorBoundLevel<T> {
  return typeof level.floorId === 'string' && level.floorId.length > 0;
}

/** Μικρότερο = ισχυρότερος εκπρόσωπος: ανοιχτό επίπεδο · επίπεδο ορόφου · κάτοψη ακινήτου. */
function representativeRank(level: FloorKeyedLevel, activeLevelId: string | null | undefined): number {
  if (activeLevelId && level.id === activeLevelId) return 0;
  return level.propertyId ? 2 : 1;
}

/**
 * Ο εκπρόσωπος κάθε ορόφου του κτηρίου — ένα επίπεδο ανά `floorId`.
 *
 * @param activeLevelId Το **ανοιχτό** επίπεδο μιλά πάντα για τον όροφό του: εκεί δουλεύει ο
 *   άνθρωπος, και οι καταναλωτές διαβάζουν τη ζωντανή σκηνή του με το `levelId` του. Απόν ⇒
 *   κανένα επίπεδο δεν προηγείται ως ανοιχτό.
 */
export function floorRepresentativeLevels<T extends FloorKeyedLevel>(
  levels: readonly T[],
  buildingId: string,
  activeLevelId?: string | null,
): FloorBoundLevel<T>[] {
  const byFloor = new Map<string, FloorBoundLevel<T>>();
  for (const level of levels) {
    if (level.buildingId !== buildingId || !isFloorBound(level)) continue;
    const held = byFloor.get(level.floorId);
    // Ισχυρότερος εκπρόσωπος εκτοπίζει ασθενέστερο που έτυχε να προηγείται· ποτέ το αντίστροφο.
    if (!held || representativeRank(level, activeLevelId) < representativeRank(held, activeLevelId)) {
      byFloor.set(level.floorId, level);
    }
  }
  return [...byFloor.values()];
}
