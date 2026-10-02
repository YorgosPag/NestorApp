/**
 * @fileoverview **Η αντικειμενική αξία μιας μονάδας ΜΕΣΑ στο κτίριό της** — ο πίνακας του εργολάβου (ADR-898 Φ4):
 * η **ίδια** βάση με την αγγελία, με επικάλυψη των γεγονότων του κτιρίου (στάδιο · άδεια · ΣΑΟ · ανελκυστήρας).
 * @related `listing-objective-value.ts` (`objectiveValueBasisOf`: η ΜΙΑ αντιστοίχιση μονάδα → πρόχειρο) ·
 *   `objective-value-stages.ts` (στάδιο κτιρίου → στάδιο εντύπου) · `building-objective-value-facts.ts` ·
 *   `services/objective-value/building-objective-values.service.ts` (ο καλών, στον server)
 * @module lib/objective-value/building-objective-value
 *
 * 🔑 **Ιεραρχία σταδίου: χρονοδιάγραμμα > δήλωση κτιρίου > «τι λείπει»** ({@link buildingStageOf}). **Ποτέ**
 * τεκμήριο «αποπερατωμένο»: το `INITIAL_DRAFT` του υπολογιστή ξεκινά από «πλήρως», και για κτίριο υπό κατασκευή αυτό
 * θα ήταν η χειρότερη σιωπηλή μαντεψιά — λάθος πίνακας, λάθος ποσό.
 *
 * 🔑 **Ιεραρχία άδειας: δήλωση μονάδας > άδεια κτιρίου > προσέγγιση από το έτος κατασκευής.** Η δήλωση της μονάδας
 * υπάρχει επειδή μπορεί να έχει δική της αναθεώρηση άδειας· η προσέγγιση μένει δηλωμένη υπόθεση, όπως στην αγγελία.
 *
 * 🔑 **Ιεραρχία ανελκυστήρα: χαρακτηριστικό μονάδας > δήλωση μονάδας > γεγονός κτιρίου > «τι λείπει»** — η παράμετρος
 * **τύπου** του Revit με **υπέρβαση** ανά αντίγραφο (ADR-898 §17). Μόνο στην κατοικία: τα έντυπα 4/5 δεν τον ρωτούν.
 *
 * 🔑 **Προέλευση ανά μονάδα** (`inherited`): ποια γεγονότα του κτιρίου μπήκαν **πράγματι** στο πρόχειρο της μονάδας.
 * Ό,τι νίκησε η μονάδα **δεν** αναφέρεται — η οθόνη λέει «από το κτίριο» μόνο όπου είναι αλήθεια.
 *
 * ⛔ Καθαρό: καμία I/O, κανένα κείμενο, **κανένα** αποθηκευμένο ποσό (ADR-889 §10.2).
 */

import type { BuildingObjectiveValueFacts } from './building-objective-value-facts';
import {
  assumptionsOf,
  type ListingObjectiveValueResolution,
  type ObjectiveValueBasis,
  type ObjectiveValueEvaluated,
} from './listing-objective-value';
import { objectiveValueBounds } from './objective-value-bounds';
import type { ObjectiveValueDraft } from './objective-value-draft';
import {
  ancillaryCompletionOf,
  residenceCompletionOf,
  stageReached,
  type BuildingStageReached,
  type StagedPhase,
} from './objective-value-stages';
import type { ObjectiveValueForm } from './objective-value-types';

/** Το στάδιο του κτιρίου και **από πού** ήρθε — η οθόνη το λέει δίπλα στο στάδιο. */
export type BuildingStage =
  | { readonly source: 'schedule'; readonly stage: BuildingStageReached }
  | { readonly source: 'declared'; readonly stage: BuildingStageReached }
  | { readonly source: 'unknown' };

/** Χρονοδιάγραμμα (φάσεις με ετικέτα νόμου) > δήλωση κτιρίου > άγνωστο. */
export function buildingStageOf(phases: readonly StagedPhase[], facts: BuildingObjectiveValueFacts): BuildingStage {
  const fromSchedule = stageReached(phases);
  if (fromSchedule !== null) return { source: 'schedule', stage: fromSchedule };
  if (facts.declaredStage !== null) return { source: 'declared', stage: facts.declaredStage };
  return { source: 'unknown' };
}

/** Ό,τι κοινό φέρνει το κτίριο σε κάθε μονάδα του. */
export interface BuildingObjectiveValueContext {
  readonly stage: BuildingStage;
  readonly facts: BuildingObjectiveValueFacts;
}

export type BuildingUnitObjectiveValue =
  | Exclude<ObjectiveValueBasis, { readonly kind: 'ready' }>
  /**
   * Το κτίριο δεν έφτασε ακόμη σε στάδιο με συντελεστή **γι' αυτό το έντυπο** (κανένα ολοκληρωμένο στάδιο · ή
   * θεμελίωση για αποθήκη/στάθμευση, που ο νόμος δεν βαθμολογεί — άρθ. 6 §8 · 7 §8).
   */
  | { readonly kind: 'beforeStage'; readonly stage: BuildingStageReached }
  | (ObjectiveValueEvaluated & {
      /** Τα γεγονότα του κτιρίου που χρησιμοποιήθηκαν σε **αυτή** τη μονάδα (με τη σειρά της λίστας-πηγής). */
      readonly inherited: readonly BuildingInheritedFact[];
    });

/** Από πού μπορεί να κληρονομήσει η μονάδα: τα γεγονότα του κτιρίου **και** το στάδιο (χρονοδιάγραμμα ή δήλωση). */
export type BuildingInheritedFact = 'stage' | 'permitDate' | 'plotUtilisation' | 'hasElevator';

const INHERITED_ORDER: readonly BuildingInheritedFact[] = ['stage', 'permitDate', 'plotUtilisation', 'hasElevator'];

type StagePatch = Pick<ObjectiveValueDraft, 'residenceCompletion' | 'ancillaryCompletion'>;

type StageOverlay =
  | { readonly kind: 'ok'; readonly patch: StagePatch }
  | { readonly kind: 'beforeStage'; readonly stage: BuildingStageReached };

/** Στάδιο κτιρίου → στάδιο εντύπου. Άγνωστο ⇒ `null` (η μηχανή το ζητά)· γνωστό χωρίς συντελεστή ⇒ `beforeStage`. */
function stageOverlay(stage: BuildingStage, form: ObjectiveValueForm): StageOverlay {
  if (stage.source === 'unknown') return { kind: 'ok', patch: { residenceCompletion: null, ancillaryCompletion: null } };
  if (form === 'residence') {
    const residenceCompletion = residenceCompletionOf(stage.stage);
    if (residenceCompletion === null) return { kind: 'beforeStage', stage: stage.stage };
    return { kind: 'ok', patch: { residenceCompletion, ancillaryCompletion: null } };
  }
  const ancillaryCompletion = ancillaryCompletionOf(stage.stage);
  if (ancillaryCompletion === null) return { kind: 'beforeStage', stage: stage.stage };
  return { kind: 'ok', patch: { residenceCompletion: null, ancillaryCompletion } };
}

/** Η άδεια του κτιρίου καλύπτει **μόνο** την απουσία δήλωσης της μονάδας — και καταργεί την προσέγγιση από το έτος. */
function withBuildingPermit(
  resolution: ListingObjectiveValueResolution,
  facts: BuildingObjectiveValueFacts,
): ListingObjectiveValueResolution | null {
  if (resolution.used.includes('permitDate') || facts.permitDate === null) return null;
  return { ...resolution, draft: { ...resolution.draft, permitDate: facts.permitDate }, approximatedFrom: null };
}

/** Ο ανελκυστήρας του κτιρίου καλύπτει **μόνο** το κενό της μονάδας (χαρακτηριστικό ή δήλωση νικούν) — κατοικία μόνο. */
function withBuildingElevator(
  resolution: ListingObjectiveValueResolution,
  facts: BuildingObjectiveValueFacts,
  form: ObjectiveValueForm,
): ListingObjectiveValueResolution | null {
  if (form !== 'residence' || resolution.draft.hasElevator !== null || facts.hasElevator === null) return null;
  return { ...resolution, draft: { ...resolution.draft, hasElevator: facts.hasElevator } };
}

/** Ο ΣΑΟ μετρά **μόνο** σε ημιτελή κατοικία (άρθ. 3 §9 — `objective-value-residence.ts`). */
function usesPlotUtilisation(patch: StagePatch): boolean {
  return patch.residenceCompletion !== null && patch.residenceCompletion !== 'complete';
}

/** Τα γεγονότα του κτιρίου πάνω στην επίλυση της μονάδας — και **ποια** από αυτά μπήκαν πράγματι. */
function overlayFacts(
  base: ListingObjectiveValueResolution,
  context: BuildingObjectiveValueContext,
  form: ObjectiveValueForm,
  patch: StagePatch,
): { readonly resolution: ListingObjectiveValueResolution; readonly inherited: readonly BuildingInheritedFact[] } {
  const inherited = new Set<BuildingInheritedFact>();
  if (context.stage.source !== 'unknown') inherited.add('stage');
  const permitted = withBuildingPermit(base, context.facts);
  if (permitted !== null) inherited.add('permitDate');
  const elevated = withBuildingElevator(permitted ?? base, context.facts, form);
  if (elevated !== null) inherited.add('hasElevator');
  if (context.facts.plotUtilisation !== null && usesPlotUtilisation(patch)) inherited.add('plotUtilisation');
  const merged = elevated ?? permitted ?? base;
  const resolution = { ...merged, draft: { ...merged.draft, ...patch, plotUtilisation: context.facts.plotUtilisation } };
  return { resolution, inherited: INHERITED_ORDER.filter((fact) => inherited.has(fact)) };
}

/**
 * **Η αντικειμενική αξία μιας μονάδας στο κτίριο** — η βάση της ({@link objectiveValueBasisOf}) με την επικάλυψη του
 * κτιρίου. `today` = ημερομηνία αποτίμησης (`YYYY-MM-DD`).
 */
export function buildingUnitObjectiveValue(
  basis: ObjectiveValueBasis,
  context: BuildingObjectiveValueContext,
  today: string,
): BuildingUnitObjectiveValue {
  if (basis.kind !== 'ready') return basis;
  const { form, zonePrices } = basis;
  const overlay = stageOverlay(context.stage, form);
  if (overlay.kind === 'beforeStage') return overlay;
  const { resolution, inherited } = overlayFacts(basis.resolution, context, form, overlay.patch);
  return {
    kind: 'evaluated',
    bounds: objectiveValueBounds(resolution.draft, today, zonePrices),
    levelBasis: resolution.levelBasis,
    assumptions: assumptionsOf(resolution, form),
    inherited,
  };
}

/**
 * **Το σύνολο του κτιρίου — μόνο όταν είναι ΑΛΗΘΙΝΟ**: κάθε μονάδα με έντυπο έχει **ένα** ποσό. Αλλιώς πόσες λείπουν
 * — ποτέ μερικό άθροισμα παρουσιασμένο ως σύνολο (θα έλεγε ψέματα με αριθμούς, ADR-898 §4.2).
 */
export type BuildingObjectiveValueTotal =
  | { readonly kind: 'exact'; readonly value: number; readonly units: number }
  | { readonly kind: 'incomplete'; readonly pending: number; readonly units: number };

/** Μονάδες εκτός εντύπων (κατάστημα, γραφείο, §7) δεν μετρούν ούτε ως εκκρεμείς. */
export function buildingObjectiveValueTotal(results: readonly BuildingUnitObjectiveValue[]): BuildingObjectiveValueTotal {
  const valued = results.filter((result) => result.kind !== 'unsupported');
  const exact = valued.flatMap((result) =>
    result.kind === 'evaluated' && result.bounds.kind === 'exact' ? [result.bounds.result.value] : [],
  );
  if (exact.length < valued.length) return { kind: 'incomplete', pending: valued.length - exact.length, units: valued.length };
  const cents = exact.reduce((sum, value) => sum + Math.round(value * 100), 0);
  return { kind: 'exact', value: cents / 100, units: valued.length };
}
