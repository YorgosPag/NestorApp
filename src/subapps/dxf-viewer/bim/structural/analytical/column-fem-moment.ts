/**
 * Column FEM moment — pure SSoT (ADR-491, T3-bridge).
 *
 * Γέφυρα ΑΝΑΓΝΩΣΗΣ από το έτοιμο FEM αποτέλεσμα (ADR-481, `AnalysisResultsStore`) προς
 * τον M-N σχεδιασμό οπλισμού κολόνας (ADR-472 S4, `designMomentKnm`). Όταν ένα δοκάρι
 * γίνεται **πρόβολος** (ADR-486 §C), μεταφέρει ροπή `M = wL²/2` στην κολώνα στήριξης·
 * ο FEM την υπολογίζει ήδη ως end-moment του μέλους-κολόνας. Εδώ απλώς τη **διαβάζουμε**
 * (envelope = max-abs ανά συνδυασμό) ώστε ο υπάρχων suggester να οπλίσει σωστά.
 *
 * **ΜΗΔΕΝ νέος engine, ΜΗΔΕΝ επίλυση:** καθαρό read του `AnalysisResult` — ο FEM (ADR-481)
 * λύνει, ο engine (ADR-472) οπλίζει, αυτό το module τα **ενώνει** (ένα source of truth ανά
 * concern, μηδέν διπλομέτρηση).
 *
 * **Mapping:** `memberId === AnalyticalMember.id === entityId` (1:1, analytical-model-types.ts)
 * → `envelopeByMember.get(columnId)` δίνει απευθείας τα extrema της κολόνας.
 *
 * **Uniaxial (conservative):** ο `ColumnSectionContext.designMomentKnm` είναι scalar (ADR-472 §4
 * biaxial = DEFER)· παίρνουμε το `maxAbsMoment` (max-abs My/Mz σε όλους τους σταθμούς &
 * συνδυασμούς) — η δυσμενέστερη μονοαξονική ροπή. Άξονες/μετατροπές μονάδων: kNm (ίδια με
 * τον engine — μηδέν conversion).
 *
 * Pure — zero React/DOM/store/Firestore (δέχεται `AnalysisResult` ως arg) ⇒ unit-testable.
 * Ο store-coupled + engaged-gated wrapper ζει στο `active-reinforcement.ts`.
 *
 * @see ./solver/analysis-results-store.ts — η πηγή (AnalysisResult)
 * @see ../codes/suggest-reinforcement.ts — asMomentColumnMm2 (ο καταναλωτής της ροπής)
 * @see ../active-reinforcement.ts — resolveActiveColumnFemMoment (store + engaged gate)
 * @see docs/centralized-systems/reference/adrs/ADR-491-fem-driven-column-mn-reinforcement.md
 */

import type { AnalysisResult } from './solver/solver-types';

/**
 * Η δυσμενέστερη FEM ροπή σχεδιασμού (kNm) μιας κολόνας από το envelope, ή `undefined`
 * όταν δεν υπάρχει αξιόπιστη ροπή: μη-ευσταθής φορέας (μηχανισμός → οι τιμές άκυρες),
 * μέλος εκτός αποτελέσματος, ή μηδενική ροπή (αμφιέρειστο/συμμετρικό → ο engine μένει
 * στην ονομαστική e₀). `undefined` ⇒ μηδέν override ⇒ καμία regression.
 */
export function resolveColumnFemMomentKnm(
  result: AnalysisResult,
  columnId: string,
): number | undefined {
  if (result.unstable) return undefined;
  const extrema = result.envelopeByMember.get(columnId);
  if (!extrema) return undefined;
  const momentKnm = extrema.maxAbsMoment;
  return momentKnm > 0 ? momentKnm : undefined;
}

/**
 * Χάρτης `columnId → FEM ροπή σχεδιασμού (kNm)` για τα δοθέντα ids (μόνο όσα έχουν
 * αξιόπιστη μη-μηδενική ροπή). Mirror του `buildBeamSupportTypeMap` (ADR-486): ο
 * proactive core χτίζει τον χάρτη ΜΙΑ φορά και τον περνά στο command (pure → testable).
 */
export function buildColumnFemMomentMap(
  result: AnalysisResult,
  columnIds: Iterable<string>,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const id of columnIds) {
    const momentKnm = resolveColumnFemMomentKnm(result, id);
    if (momentKnm !== undefined) map.set(id, momentKnm);
  }
  return map;
}
