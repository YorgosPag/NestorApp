/**
 * Column FEM axial — pure SSoT (ADR-497, T3-bridge· mirror του `column-fem-moment.ts`).
 *
 * Γέφυρα ΑΝΑΓΝΩΣΗΣ από το έτοιμο FEM αποτέλεσμα (ADR-481, `AnalysisResultsStore`) προς
 * τον σχεδιασμό **πεδίλου** (και, προαιρετικά, M-N κολώνας): το **αξονικό βάσης** που η
 * κολώνα παραδίδει στο πέδιλό της. Όταν ένα δοκάρι γίνεται **πρόβολος** (ADR-486/495), το
 * πρόσθετο φορτίο φτάνει στις κολώνες ως αντίδραση — ο FEM την υπολογίζει ήδη ως αξονικό
 * του μέλους-κολώνας. Εδώ το **διαβάζουμε** (max-abs ανά συνδυασμό) ώστε το πέδιλο να
 * διαστασιολογηθεί με την πραγματική αντίδραση του φορέα, ΟΧΙ με το grid-tributary proxy.
 *
 * **Single source of truth (Revit + Robot):** όταν ο μηχανικός «παρατηρεί στατικά»
 * (engaged, ADR-488) το FEM **υπερισχύει**· αλλιώς το persisted tributary `appliedLoad`
 * παραμένει το seed/fallback. Μία ιεραρχία, μηδέν παράλληλη διπλή αλήθεια. Το engaged gate
 * + ο store ζουν στο `active-reinforcement` (mirror του `resolveActiveColumnFemMoment`).
 *
 * **SLS vs ULS:** το πέδιλο θέλει χωριστά SLS (έδραση εδάφους) + ULS (κάμψη/διάτρηση)· τα
 * διαβάζουμε ανά combination (`combinationKind` = 'sls'/'uls', `load-cases.ts`). Σεισμικός
 * = DEFER (διπλώνεται μελλοντικά στο ULS envelope). Μη-ευσταθής φορέας / μέλος εκτός
 * αποτελέσματος / μηδέν αξονικό → `undefined` ⇒ μηδέν override ⇒ καμία regression.
 *
 * **Mapping:** `memberId === AnalyticalMember.id === entityId` (1:1) → απευθείας lookup.
 * Pure — zero React/DOM/store/Firestore (δέχεται `AnalysisResult` ως arg) ⇒ unit-testable.
 *
 * @see ./column-fem-moment.ts — ο αδελφός reader (ροπή, ADR-491) — ίδιο pattern
 * @see ./engaged-analysis-result.ts — το engaged gate (κοινό SSoT)
 * @see ../footing-design/footing-design-input.ts — ο καταναλωτής (femAxialOverride)
 * @see docs/centralized-systems/reference/adrs/ADR-497-fem-authoritative-axial-footing.md
 */

import type { AnalysisResult, CombinationResult } from './solver/solver-types';

/** FEM αξονικό σχεδιασμού (kN) βάσης κολώνας — SLS (έδραση) + ULS (αντοχή). */
export interface ColumnFemAxial {
  readonly slsKn: number;
  readonly ulsKn: number;
}

/** Max-abs αξονικό (kN) μιας κολώνας σε έναν συνδυασμό, ή `undefined` (singular/εκτός). */
function columnAxialInCombination(combo: CombinationResult, columnId: string): number | undefined {
  if (combo.singular) return undefined;
  const member = combo.memberForces.find((m) => m.memberId === columnId);
  return member ? member.extrema.maxAbsAxialN : undefined;
}

/**
 * Το FEM αξονικό σχεδιασμού (SLS/ULS, kN) μιας κολώνας από τους συνδυασμούς, ή `undefined`
 * όταν δεν υπάρχει αξιόπιστο φορτίο: μη-ευσταθής φορέας, μέλος εκτός αποτελέσματος, λείπει
 * SLS ή ULS συνδυασμός, ή μηδενικό αξονικό. `undefined` ⇒ μηδέν override ⇒ tributary fallback.
 */
export function resolveColumnFemAxial(
  result: AnalysisResult,
  columnId: string,
): ColumnFemAxial | undefined {
  if (result.unstable) return undefined;
  let slsKn: number | undefined;
  let ulsKn: number | undefined;
  for (const combo of result.combinations) {
    const axial = columnAxialInCombination(combo, columnId);
    if (axial === undefined) continue;
    const kind = combo.combinationKind.toLowerCase();
    if (kind.includes('sls')) slsKn = Math.max(slsKn ?? 0, axial);
    else if (kind.includes('uls')) ulsKn = Math.max(ulsKn ?? 0, axial);
  }
  if (slsKn === undefined || ulsKn === undefined) return undefined;
  if (slsKn <= 0 && ulsKn <= 0) return undefined;
  return { slsKn, ulsKn };
}

/**
 * Χάρτης `columnId → ColumnFemAxial` για τα δοθέντα ids (μόνο όσα έχουν αξιόπιστο φορτίο).
 * Mirror του `buildColumnFemMomentMap` (ADR-491): ο caller χτίζει τον χάρτη ΜΙΑ φορά και
 * τον περνά (pure → testable).
 */
export function buildColumnFemAxialMap(
  result: AnalysisResult,
  columnIds: Iterable<string>,
): ReadonlyMap<string, ColumnFemAxial> {
  const map = new Map<string, ColumnFemAxial>();
  for (const id of columnIds) {
    const axial = resolveColumnFemAxial(result, id);
    if (axial !== undefined) map.set(id, axial);
  }
  return map;
}
