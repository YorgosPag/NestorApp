/**
 * @fileoverview **ΟΙ ΚΑΤΟΨΕΙΣ ΕΝΟΣ ΕΠΙΠΕΔΟΥ** πολυεπίπεδης μονάδας (ADR-236 · ADR-914 §2.20).
 * @module lib/files/level-floorplans
 *
 * Ένας κανόνας για την ερώτηση «ποιες από τις κατόψεις του ακινήτου ανήκουν σε ΑΥΤΟ το επίπεδο;».
 * Τον ρωτούν η προβολή ακινήτου (καρτέλα ανά επίπεδο) και ο επιλογέας «Από την αποθήκη» του
 * οδηγού. Ήταν γραμμένος επιτόπου στην πρώτη και απών από τον δεύτερο, που έδειχνε την κάτοψη
 * του άλλου ορόφου.
 *
 * **Layering**: leaf — καμία εισαγωγή.
 */

/** Ό,τι χρειάζεται ο κανόνας από ένα αρχείο. */
export interface LevelTaggedFile {
  readonly levelFloorId?: string | null;
}

/**
 * @param levelFloorId Ο όροφος του επιπέδου. Απών ⇒ μονοεπίπεδο ακίνητο ⇒ όλες οι κατόψεις.
 * @param untaggedBelongs Αν ένα αρχείο ΧΩΡΙΣ `levelFloorId` (παλιό, ή μονοεπίπεδης εποχής) ανήκει
 *        εδώ. Το αποφασίζει ο καλών: η προβολή το δίνει στο πρώτο επίπεδο, ο επιλογέας παντού
 *        (άγνωστο επίπεδο ⇒ ο άνθρωπος το βλέπει και διαλέγει).
 */
export function floorplansOfLevel<T extends LevelTaggedFile>(
  files: readonly T[],
  levelFloorId: string | null | undefined,
  untaggedBelongs: boolean,
): T[] {
  if (!levelFloorId) return [...files];
  return files.filter((file) => (file.levelFloorId ? file.levelFloorId === levelFloorId : untaggedBelongs));
}
