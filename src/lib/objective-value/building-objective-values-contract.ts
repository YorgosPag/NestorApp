/**
 * @fileoverview **Το συμβόλαιο του πίνακα αντικειμενικής του κτιρίου** (ADR-898 Φ4β) — ό,τι στέλνει το
 * `GET /api/buildings/[buildingId]/objective-values` και διαβάζει η καρτέλα. Ένας τύπος για server **και** πελάτη.
 * @related `services/objective-value/building-objective-values.service.ts` (ο συντάκτης) ·
 *   `hooks/buildings/useBuildingObjectiveValues.ts` (ο αναγνώστης)
 * @module lib/objective-value/building-objective-values-contract
 *
 * ⛔ **Υπολογισμένο κατά την ανάγνωση, ΠΟΤΕ αποθηκευμένο** (ADR-889 §10.2): το `valuationDate` λέει **πότε** ισχύει το
 * ποσό — η οθόνη και η εξαγωγή το δείχνουν δίπλα του.
 */

import type { BuildingObjectiveValueTotal, BuildingStage, BuildingUnitObjectiveValue } from './building-objective-value';
import type { BuildingObjectiveValueFacts } from './building-objective-value-facts';
import type { BuildingQuestion } from './building-objective-value-questions';

/** Μία γραμμή του πίνακα: η μονάδα όπως τη γνωρίζει ο εργολάβος, και η αντικειμενική της. */
export interface BuildingUnitObjectiveValueRow {
  readonly id: string;
  readonly name: string | null;
  readonly type: string | null;
  /** Ο όροφος της αγγελίας (επίπεδο εισόδου) — για ταξινόμηση/ομαδοποίηση. Η ανάλυση ανά επίπεδο ζει στο αποτέλεσμα. */
  readonly floor: number | null;
  readonly value: BuildingUnitObjectiveValue;
}

export interface BuildingObjectiveValues {
  /** `YYYY-MM-DD` — η ημέρα αποτίμησης (τιμές ζώνης και παλαιότητα **εκείνης** της ημέρας). */
  readonly valuationDate: string;
  readonly stage: BuildingStage;
  readonly facts: BuildingObjectiveValueFacts;
  readonly units: readonly BuildingUnitObjectiveValueRow[];
  readonly total: BuildingObjectiveValueTotal;
  /** Ερωτήσεις που απαντά **μία φορά** το κτίριο, με το πλήθος μονάδων που τις περιμένουν. */
  readonly questions: readonly BuildingQuestion[];
}
