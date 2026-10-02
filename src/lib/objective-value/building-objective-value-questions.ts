/**
 * @fileoverview **«Απάντησε μία φορά για όλο το κτίριο»** (ADR-898 Φ4β) — ποιες ερωτήσεις των μονάδων απαντώνται από
 * ένα γεγονός του κτιρίου, και πόσες μονάδες περιμένουν την καθεμία.
 * @related `building-objective-value.ts` (τα αποτελέσματα ανά μονάδα) · `building-objective-value-facts.ts` (το λεξιλόγιο
 *   των γεγονότων — ο ΜΟΝΟΣ γραφέας τους)
 * @module lib/objective-value/building-objective-value-questions
 *
 * 🔑 **Η μηχανή αποφασίζει τι λείπει, όχι η οθόνη**: διαβάζονται τα `missing` (κενό που σταματά τον υπολογισμό) και τα
 * `open` (κενό με πεπερασμένες απαντήσεις ⇒ όρια) της ίδιας της μηχανής· καμία δεύτερη λίστα «τι χρειάζεται».
 * 🔑 Ό,τι **δεν** απαντά το κτίριο (πρόσοψη, μέτωπο, εμβαδόν, όροφος…) μένει ερώτηση της **μονάδας** — δεν εμφανίζεται εδώ.
 * ⛔ Καθαρό: καμία I/O, κανένα κείμενο.
 */

import type { BuildingUnitObjectiveValue } from './building-objective-value';
import type { BuildingObjectiveValueFacts, BuildingObjectiveValuePatch } from './building-objective-value-facts';
import type { OpenQuestion } from './objective-value-bounds';
import { INITIAL_DRAFT, type ConditionalQuestion, type ObjectiveValueDraft } from './objective-value-draft';
import type { ObjectiveValueMissing } from './objective-value-types';

/** Το γεγονός του κτιρίου που κλείνει μια ερώτηση. */
export type BuildingFactQuestion = keyof BuildingObjectiveValueFacts;

/** Κενό της μηχανής → γεγονός του κτιρίου. Η παλαιότητα μετριέται από την άδεια (άρθ. 2 §20). */
const FACT_OF: Partial<Record<ObjectiveValueMissing | OpenQuestion, BuildingFactQuestion>> = {
  completion: 'declaredStage',
  ageYears: 'permitDate',
  plotUtilisation: 'plotUtilisation',
  hasElevator: 'hasElevator',
  hasCentralHeating: 'hasCentralHeating',
};

/** Σειρά εμφάνισης: πρώτα ό,τι ξεκλειδώνει τα υπόλοιπα (το στάδιο αποφασίζει αν ζητείται ΣΑΟ ή παλαιότητα). */
const ORDER: readonly BuildingFactQuestion[] = ['declaredStage', 'permitDate', 'plotUtilisation', 'hasElevator', 'hasCentralHeating'];

export interface BuildingQuestion {
  readonly fact: BuildingFactQuestion;
  /** Πόσες μονάδες περιμένουν **αυτή** την απάντηση. */
  readonly units: number;
}

/** Τα κενά μιας μονάδας, όπως τα είπε η μηχανή. */
function gapsOf(value: BuildingUnitObjectiveValue): readonly (ObjectiveValueMissing | OpenQuestion)[] {
  if (value.kind !== 'evaluated') return [];
  const { bounds } = value;
  if (bounds.kind === 'range') return bounds.open;
  if (bounds.kind === 'unresolved') return bounds.result.missing;
  return [];
}

function factsOf(value: BuildingUnitObjectiveValue): ReadonlySet<BuildingFactQuestion> {
  const facts = new Set<BuildingFactQuestion>();
  for (const gap of gapsOf(value)) {
    const fact = FACT_OF[gap];
    if (fact !== undefined) facts.add(fact);
  }
  return facts;
}

/** Οι ερωτήσεις του κτιρίου με τουλάχιστον μία μονάδα σε αναμονή — με τη σειρά που ξεκλειδώνουν. */
export function buildingQuestionsOf(values: readonly BuildingUnitObjectiveValue[]): readonly BuildingQuestion[] {
  const counts = new Map<BuildingFactQuestion, number>();
  for (const value of values) {
    for (const fact of factsOf(value)) counts.set(fact, (counts.get(fact) ?? 0) + 1);
  }
  return ORDER.flatMap((fact) => {
    const units = counts.get(fact) ?? 0;
    return units > 0 ? [{ fact, units }] : [];
  });
}

// ============================================================================
// ΤΑ ΙΔΙΑ ΧΕΙΡΙΣΤΗΡΙΑ ΜΕ ΤΟΝ ΥΠΟΛΟΓΙΣΤΗ (ίδια διατύπωση — πρότυπο `objective-value-improve.ts`)
// ============================================================================

/** Γεγονότα κτιρίου που ρωτά **ήδη** ο υπολογιστής — με αυτήν ακριβώς την ερώτηση (το στάδιο έχει δικό του χειριστήριο). */
export const BUILDING_ENGINE_QUESTION_OF = {
  permitDate: 'ageYears',
  plotUtilisation: 'plotUtilisation',
  hasElevator: 'hasElevator',
  hasCentralHeating: 'hasCentralHeating',
} as const satisfies Readonly<Partial<Record<BuildingFactQuestion, ConditionalQuestion>>>;

export type BuildingEngineFact = keyof typeof BUILDING_ENGINE_QUESTION_OF;

/** Τα γεγονότα ως πρόχειρο του υπολογιστή — ώστε τα χειριστήριά του να τα δείχνουν χωρίς δεύτερο λεξιλόγιο. */
export function draftOfBuildingFacts(facts: BuildingObjectiveValueFacts): ObjectiveValueDraft {
  const { permitDate, plotUtilisation, hasElevator, hasCentralHeating } = facts;
  return { ...INITIAL_DRAFT, permitDate, plotUtilisation, hasElevator, hasCentralHeating };
}

/** Τα γεγονότα με χειριστήριο του υπολογιστή, με τη σειρά του πίνακα — η ΜΙΑ λίστα (και της οθόνης «Γεγονότα κτιρίου»). */
export const BUILDING_ENGINE_FACTS = Object.keys(BUILDING_ENGINE_QUESTION_OF) as readonly BuildingEngineFact[];

/** Αλλαγή του προχείρου → διόρθωση γεγονότων, **μόνο** με τα πεδία του κτιρίου που άλλαξαν· `null` αν δεν μένει τίποτα. */
export function buildingPatchOfDraft(change: Partial<ObjectiveValueDraft>): BuildingObjectiveValuePatch | null {
  const patch: { -readonly [K in BuildingEngineFact]?: BuildingObjectiveValueFacts[K] } = {};
  if ('permitDate' in change) patch.permitDate = change.permitDate ?? null;
  if ('plotUtilisation' in change) patch.plotUtilisation = change.plotUtilisation ?? null;
  if ('hasElevator' in change) patch.hasElevator = change.hasElevator ?? null;
  if ('hasCentralHeating' in change) patch.hasCentralHeating = change.hasCentralHeating ?? null;
  return BUILDING_ENGINE_FACTS.some((fact) => fact in patch) ? patch : null;
}

/** «Σβήσε την απάντηση» ανά γεγονός — ολικός πίνακας: νέο γεγονός ⇒ ο μεταγλωττιστής ρωτά. */
const CLEARED: Readonly<Record<BuildingFactQuestion, BuildingObjectiveValuePatch>> = {
  declaredStage: { declaredStage: null },
  permitDate: { permitDate: null },
  plotUtilisation: { plotUtilisation: null },
  hasElevator: { hasElevator: null },
  hasCentralHeating: { hasCentralHeating: null },
};

export function clearedBuildingFactPatch(fact: BuildingFactQuestion): BuildingObjectiveValuePatch {
  return CLEARED[fact];
}
