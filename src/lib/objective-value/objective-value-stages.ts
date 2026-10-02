/**
 * @fileoverview **Τα στάδια αποπεράτωσης του νόμου, όπως τα «φτάνει» ένα κτίριο** — το ΕΝΑ λεξιλόγιο που δένει το
 * χρονοδιάγραμμα κατασκευής (ADR-034) με τη μηχανή αντικειμενικής αξίας (ADR-898 Φ4).
 * @related `objective-value-types.ts` (`RESIDENCE_COMPLETIONS` · `ANCILLARY_COMPLETIONS`: οι είσοδοι της μηχανής) ·
 *   `building-objective-value.ts` (η ιεραρχία Gantt > δήλωση > «τι λείπει») · `types/building/construction.ts`
 *   (`ConstructionPhase.legalStage`)
 * @module lib/objective-value/objective-value-stages
 *
 * 🔑 **Επαληθευμένο στο κείμενο της ΠΟΛ.1149/1994** (taxheaven `circulars/570`, 2026-10-02):
 * - άρθ. 3 §9: «θεωρείται ότι βρίσκεται σε ένα στάδιο αποπεράτωσης όταν **έχει ολοκληρωθεί** το στάδιο αυτό» ⇒ ένα
 *   στάδιο **σε εξέλιξη** δεν μετρά· μετρά το τελευταίο **ολοκληρωμένο**.
 * - άρθ. 2 §24: «κτίσματα τα οποία έχουν **παροχή ηλεκτρικού ρεύματος** θεωρούνται αποπερατωμένα» ⇒ το ορόσημο που
 *   κλείνει την αποπεράτωση είναι γεγονός με ημερομηνία, όχι κρίση.
 * - άρθ. 6 §8 · 7 §8: η αποθήκη και η θέση στάθμευσης έχουν **μόνο** σκελετό · τοίχους · επιχρίσματα — **ούτε**
 *   θεμελίωση **ούτε** δάπεδα.
 *
 * 🔑 **Η σειρά της λίστας ΕΙΝΑΙ η σειρά του νόμου** — το «υψηλότερο ολοκληρωμένο» διαβάζεται από τη θέση.
 */

import type { AncillaryCompletion, ResidenceCompletion } from './objective-value-types';

/** Τα στάδια, με τη σειρά του νόμου. `electricity` = παροχή ρεύματος ⇒ αποπερατωμένο (άρθ. 2 §24). */
export const LEGAL_STAGES = ['foundation', 'frame', 'masonry', 'plaster', 'flooring', 'electricity'] as const;
export type LegalStage = (typeof LEGAL_STAGES)[number];

/**
 * Πόσο έχει προχωρήσει το κτίριο κατά τον νόμο: ένα στάδιο, ή `'none'` = δεν ολοκληρώθηκε ούτε η θεμελίωση
 * (κανένας συντελεστής του νόμου δεν ισχύει ακόμη).
 */
export type BuildingStageReached = LegalStage | 'none';

export function isLegalStage(value: unknown): value is LegalStage {
  return typeof value === 'string' && (LEGAL_STAGES as readonly string[]).includes(value);
}

export function isBuildingStageReached(value: unknown): value is BuildingStageReached {
  return value === 'none' || isLegalStage(value);
}

/** Κατοικία (άρθ. 3 §9): ένα προς ένα· η παροχή ρεύματος ⇒ πλήρως αποπερατωμένη. `'none'` ⇒ κανένα έντυπο ακόμη. */
export function residenceCompletionOf(stage: BuildingStageReached): ResidenceCompletion | null {
  if (stage === 'none') return null;
  return stage === 'electricity' ? 'complete' : stage;
}

/**
 * Αποθήκη / θέση στάθμευσης (άρθ. 6 §8 · 7 §8). Τα **δάπεδα** προϋποθέτουν ολοκληρωμένα επιχρίσματα ⇒ `plaster` (ο
 * ψηλότερος βαθμός του νόμου κάτω από το πλήρες). Η **θεμελίωση** ⇒ `null`: ο νόμος δεν δίνει συντελεστή πριν από
 * τον σκελετό — «τι λείπει», ποτέ μαντεψιά.
 */
export function ancillaryCompletionOf(stage: BuildingStageReached): AncillaryCompletion | null {
  switch (stage) {
    case 'none':
    case 'foundation':
      return null;
    case 'flooring':
      return 'plaster';
    case 'electricity':
      return 'complete';
    default:
      return stage;
  }
}

/** Ό,τι χρειάζεται η κρίση από μια φάση του χρονοδιαγράμματος — όχι ολόκληρη η φάση. */
export interface StagedPhase {
  readonly legalStage?: LegalStage | null;
  readonly status: string;
}

const COMPLETED_PHASE_STATUS = 'completed';

/**
 * **Το στάδιο που έφτασε το κτίριο κατά το χρονοδιάγραμμα.** `null` = καμία φάση δεν δηλώνει στάδιο του νόμου (το
 * χρονοδιάγραμμα δεν απαντά). Αλλιώς το **υψηλότερο** στάδιο S για το οποίο **όλες** οι φάσεις με ετικέτα ≤ S είναι
 * ολοκληρωμένες.
 *
 * 🔑 **Συντηρητικό επίτηδες**: ολοκληρωμένα επιχρίσματα με τοιχοποιία ακόμη ανοιχτή ⇒ σκελετός. Ο νόμος θέλει το
 * στάδιο **ολοκληρωμένο**, και μια ανοιχτή προηγούμενη εργασία λέει ότι δεν είναι. Στάδιο χωρίς καμία φάση με
 * ετικέτα δεν κρίνεται (ο εργολάβος δεν το παρακολουθεί ως χωριστή φάση).
 *
 * 🔑 **Η παροχή ρεύματος υπερισχύει** (άρθ. 2 §24 «θεωρούνται αποπερατωμένα»): ολοκληρωμένη ⇒ αποπερατωμένο, όποια
 * κι αν είναι η κατάσταση των άλλων φάσεων — ο νόμος το ορίζει ως τεκμήριο, όχι ως τελευταίο σκαλί.
 */
export function stageReached(phases: readonly StagedPhase[]): BuildingStageReached | null {
  const tagged = phases.filter((phase): phase is StagedPhase & { readonly legalStage: LegalStage } => isLegalStage(phase.legalStage));
  if (tagged.length === 0) return null;
  if (tagged.some((phase) => phase.legalStage === 'electricity' && phase.status === COMPLETED_PHASE_STATUS)) return 'electricity';
  let reached: BuildingStageReached = 'none';
  for (const stage of LEGAL_STAGES) {
    const atStage = tagged.filter((phase) => phase.legalStage === stage);
    if (atStage.length === 0) continue;
    if (!atStage.every((phase) => phase.status === COMPLETED_PHASE_STATUS)) return reached;
    reached = stage;
  }
  return reached;
}
