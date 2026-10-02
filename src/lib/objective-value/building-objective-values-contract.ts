/**
 * @fileoverview **Το συμβόλαιο του πίνακα αντικειμενικής του κτιρίου** (ADR-898 Φ4β · §19) — ό,τι στέλνει το
 * `GET /api/buildings/[buildingId]/objective-values` και διαβάζει η καρτέλα. Ένας τύπος για server **και** πελάτη.
 * @related `services/objective-value/building-objective-values.service.ts` (ο συντάκτης) ·
 *   `hooks/useBuildingObjectiveValues.ts` (ο αναγνώστης)
 * @module lib/objective-value/building-objective-values-contract
 *
 * ⛔ **Υπολογισμένο κατά την ανάγνωση, ΠΟΤΕ αποθηκευμένο** (ADR-889 §10.2): το `valuationDate` λέει **πότε** ισχύει το
 * ποσό — η οθόνη και η εξαγωγή το δείχνουν δίπλα του.
 *
 * 🔑 **Μία γραμμή ανά ακίνητο, μία φορά** (ADR-898 §19): μονάδες **και** χώροι (θέσεις · αποθήκες) στην ίδια λίστα. Ο
 *   χώρος που ανήκει σε μονάδα λέει **ποια** (`space.ownerUnitId`) — η σχέση είναι προβολή, όχι δεύτερη γραμμή.
 */

import type { SpaceInclusionType } from '@/config/domain-constants';
import type { BuildingSpaceReference, OtherBuildingRef } from '@/lib/building-spaces/building-space-contract';

import type { BuildingObjectiveValueTotal, BuildingStage, BuildingUnitObjectiveValue } from './building-objective-value';
import type { BuildingObjectiveValueFacts } from './building-objective-value-facts';
import type { BuildingQuestion } from './building-objective-value-questions';
import type { BuildingSpaceKind, SpaceLawPosition, SpacePosition } from './building-space-objective-value';

/** Η αναφορά σε χώρο άλλου κτιρίου — ο ΙΔΙΟΣ τύπος με τις καρτέλες χώρων (ADR-898 §20). */
export type { BuildingSpaceReference, OtherBuildingRef };

/** Τι είναι η γραμμή: μονάδα (έντυπο 1) ή χώρος (έντυπο 4/5). */
export type BuildingObjectiveValueRowKind = 'unit' | BuildingSpaceKind;

/** Ό,τι έχει μόνο ο χώρος: σε ποια μονάδα ανήκει, και η θέση του κατά τον νόμο. */
export interface BuildingSpaceRowFacts {
  /** Η μονάδα που τον έχει στα `linkedSpaces` (όπου κι αν ζει) · `null` = χωρίς μονάδα. */
  readonly ownerUnitId: string | null;
  /** Το όνομα της μονάδας — χρειάζεται όταν εκείνη **δεν** είναι γραμμή αυτού του πίνακα. */
  readonly ownerUnitName: string | null;
  /**
   * Η μονάδα ζει σε **άλλο** κτίριο (θέση ≠ ανάθεση, ADR-898 §20): ο χώρος μετρά **εδώ**, όπου βρίσκεται· η μονάδα εκεί.
   * `null` = η μονάδα είναι του ίδιου κτιρίου (ή δεν υπάρχει).
   */
  readonly ownerElsewhere: OtherBuildingRef | null;
  readonly inclusion: SpaceInclusionType | null;
  /** Η απάντηση του ανθρώπου γι' αυτόν τον χώρο (`null` = δεν απαντήθηκε) — ό,τι δείχνει η επιλογή του συρταριού. */
  readonly declaredPosition: SpaceLawPosition | null;
  /** Η θέση όπως την έλυσε η μηχανή (και από πού). */
  readonly position: SpacePosition;
}

/** Μία γραμμή του πίνακα: το ακίνητο όπως το γνωρίζει ο εργολάβος, και η αντικειμενική του. */
export interface BuildingObjectiveValueRow {
  readonly id: string;
  readonly kind: BuildingObjectiveValueRowKind;
  readonly name: string | null;
  readonly type: string | null;
  /** Ο όροφος (της αγγελίας για μονάδα · του εγγράφου για χώρο) — για ταξινόμηση/ομαδοποίηση. */
  readonly floor: number | null;
  readonly value: BuildingUnitObjectiveValue;
  /** Μόνο για χώρο. */
  readonly space: BuildingSpaceRowFacts | null;
}

export interface BuildingObjectiveValues {
  /** `YYYY-MM-DD` — η ημέρα αποτίμησης (τιμές ζώνης και παλαιότητα **εκείνης** της ημέρας). */
  readonly valuationDate: string;
  readonly stage: BuildingStage;
  readonly facts: BuildingObjectiveValueFacts;
  readonly rows: readonly BuildingObjectiveValueRow[];
  /** Χώροι μονάδων του κτιρίου που βρίσκονται αλλού — **εκτός** `rows` και `total`. */
  readonly references: readonly BuildingSpaceReference[];
  readonly total: BuildingObjectiveValueTotal;
  /** Ερωτήσεις που απαντά **μία φορά** το κτίριο, με το πλήθος ακινήτων που τις περιμένουν. */
  readonly questions: readonly BuildingQuestion[];
}
