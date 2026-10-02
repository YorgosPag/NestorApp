/**
 * @fileoverview **Το σχήμα της αναφοράς σε χώρο άλλου κτιρίου** (ADR-898 §20 · ADR-184) — ένας τύπος για server και
 * πελάτη, για τον πίνακα αντικειμενικής **και** τις καρτέλες θέσεων/αποθηκών.
 * @module lib/building-spaces/building-space-contract
 *
 * ⛔ Καμία αναφορά δεν έχει ποσό, εμβαδόν ή τιμή: δεν μετρά εδώ — μετρά στο κτίριο όπου βρίσκεται. Ο τύπος το
 *   εγγυάται δομικά (διπλομέτρηση αδύνατη).
 */

import type { BuildingSpaceKind } from './building-space-membership';

/** Ένα **άλλο** κτίριο του έργου — ετικέτα έτοιμη (`formatBuildingLabel`) και ταυτότητα για τον σύνδεσμο. */
export interface OtherBuildingRef {
  readonly buildingId: string;
  /** `null` = το κτίριο δεν διαβάστηκε (π.χ. διαγράφηκε) — η οθόνη δείχνει τη γενική λέξη. */
  readonly label: string | null;
}

/** Ο χώρος και η μονάδα του κτιρίου που τον έχει — ό,τι δείχνει μια γραμμή χωρίς ποσό. */
export interface BuildingSpaceMention {
  readonly id: string;
  readonly kind: BuildingSpaceKind;
  readonly name: string | null;
  /** Η μονάδα **αυτού** του κτιρίου που τον έχει. */
  readonly ownerUnitId: string;
  readonly ownerUnitName: string | null;
}

/** Χώρος μονάδας αυτού του κτιρίου που **βρίσκεται σε άλλο**: φαίνεται εδώ, μετρά εκεί. */
export interface BuildingSpaceReference extends BuildingSpaceMention {
  readonly locatedIn: OtherBuildingRef;
}

/**
 * Οι χώροι που οι καρτέλες χώρων δείχνουν **δίπλα** στη λίστα τους (`GET /api/buildings/[buildingId]/spaces`):
 * - `references`: της μονάδας μας, σε άλλο κτίριο — μόνο αναφορά.
 * - `unplaced`: της μονάδας μας, **χωρίς** κτίριο — **μετρούν εδώ** (κανόνας), αλλά λείπουν από τη λίστα γιατί η
 *   λίστα είναι «`buildingId` = κτίριο». Δείχνονται με επιδιόρθωση ενός κλικ («σύνδεση με το κτίριο»).
 */
export interface BuildingSpaceRelations {
  readonly references: readonly BuildingSpaceReference[];
  readonly unplaced: readonly BuildingSpaceMention[];
}
