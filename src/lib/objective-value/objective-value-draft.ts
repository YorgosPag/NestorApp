/**
 * @fileoverview **Το πρόχειρο του δημόσιου υπολογιστή** → είσοδος της μηχανής, και **ποιες ερωτήσεις μετρούν** —
 * καθαρές συναρτήσεις, χωρίς React (ADR-898 Φ2).
 * @related `compute-objective-value.ts` (ο ΕΝΑΣ κανόνας) · `components/objective-value/ObjectiveValueContent.tsx` · `listing-objective-value.ts` (ADR-898 Φ3: ο server)
 * @module lib/objective-value/objective-value-draft
 *
 * 🔑 **Η οθόνη ΔΕΝ ξέρει τον νόμο.** Το «ρωτά τον ΣΕ μόνο ως τον Γ' όροφο», «τον ανελκυστήρα μόνο πάνω από τον Β'»,
 * «τον ΣΑΟ μόνο σε ημιτελές» ζουν **μόνο** στη μηχανή. Η οθόνη ρωτά τη μηχανή: για κάθε ερώτηση, **σβήνει** την
 * απάντηση και βλέπει αν εμφανίζεται στο `missing` ({@link relevantQuestions}). Έτσι μια απάντηση που έπαψε να μετρά
 * (ανελκυστήρας, όταν ο όροφος έγινε Α') **κρύβεται** χωρίς δεύτερη υλοποίηση του κανόνα.
 *
 * 🔑 **Παλαιότητα από ημερομηνία άδειας**, με το `legalAgeYears` της μηχανής (άρθ. 2 §20) — ποτέ «έτη» που ο άνθρωπος
 * θα υπολόγιζε μόνος του, συνήθως λάθος (τα δύο πρώτα έτη δεν μετρούν).
 */

import { legalAgeYears } from '@/lib/objective-value/objective-value-common';
import { computeObjectiveValue } from '@/lib/objective-value/compute-objective-value';
import type {
  AncillaryCompletion,
  ConstructionKind,
  LegalEncumbrance,
  ObjectiveValueForm,
  ObjectiveValueInput,
  ObjectiveValueMissing,
  ObjectiveValueResult,
  ParkingPosition,
  ResidenceCompletion,
  ResidenceFrontage,
  StoragePosition,
} from '@/lib/objective-value/objective-value-types';

export interface LevelDraft {
  readonly floor: number | null;
  readonly area: number | null;
}

/** `null` = «δεν απαντήθηκε». Οι σημαίες που μειώνουν έχουν την κανονική προεπιλογή (ADR-898 §4.4). */
export interface ObjectiveValueDraft {
  readonly form: ObjectiveValueForm;
  readonly zonePrice: number | null;
  /** Κατοικία: ένα ή περισσότερα επίπεδα (μεζονέτα). */
  readonly levels: readonly LevelDraft[];
  /** Αποθήκη / θέση στάθμευσης. Στάθμευση: κενό = 20 τ.μ. (άρθ. 7 §5). */
  readonly area: number | null;
  readonly storagePosition: StoragePosition | null;
  readonly parkingPosition: ParkingPosition | null;
  readonly frontage: ResidenceFrontage | null;
  readonly hasCentralHeating: boolean | null;
  readonly hasElevator: boolean | null;
  readonly commercialityFactor: number | null;
  /** Ο ΣΕ = 1,0 μπήκε επειδή ο άνθρωπος είπε «δεν τον ξέρω» — το αποτέλεσμα το λέει. */
  readonly commercialityAssumed: boolean;
  /** `YYYY-MM-DD` — έκδοση ή τελευταία αναθεώρηση της οικοδομικής άδειας. */
  readonly permitDate: string | null;
  readonly residenceCompletion: ResidenceCompletion;
  readonly ancillaryCompletion: AncillaryCompletion;
  readonly plotUtilisation: number | null;
  readonly construction: ConstructionKind;
  readonly lightRoof: boolean;
  readonly thickWalls: boolean;
  readonly areaIncludesCommon: boolean;
  readonly coOwned: boolean;
  readonly encumbrance: LegalEncumbrance;
  /** Ποσοστό κυριότητας σε %, `null` = 100%. */
  readonly ownershipPct: number | null;
  readonly damageRestorationCost: number | null;
}

/**
 * Μια αλλαγή στο πρόχειρο — το συμβόλαιο κάθε χειριστηρίου ερώτησης. Ζει εδώ, δίπλα στο πρόχειρο, και όχι σε
 * component: η εισαγωγή του από component έσερνε τα κείμενα εκείνου του component στο slice i18n κάθε καταναλωτή
 * (μετρημένο στη Φ3β-2: +1,3 KB `property.*` στο `/offers/[offerId]/improve`).
 */
export type UpdateDraft = (patch: Partial<ObjectiveValueDraft>) => void;

export const INITIAL_DRAFT: ObjectiveValueDraft = {
  form: 'residence',
  zonePrice: null,
  levels: [{ floor: null, area: null }],
  area: null,
  storagePosition: null,
  parkingPosition: null,
  frontage: null,
  hasCentralHeating: null,
  hasElevator: null,
  commercialityFactor: null,
  commercialityAssumed: false,
  permitDate: null,
  residenceCompletion: 'complete',
  ancillaryCompletion: 'complete',
  plotUtilisation: null,
  construction: 'frame',
  lightRoof: false,
  thickWalls: false,
  areaIncludesCommon: false,
  coOwned: false,
  encumbrance: 'none',
  ownershipPct: null,
  damageRestorationCost: null,
};

/** Οι ερωτήσεις που εμφανίζονται **μόνο όταν μετρούν** — η θέση και οι επιφάνειες ζητούνται πάντα. */
export const CONDITIONAL_QUESTIONS = [
  'frontage',
  'hasCentralHeating',
  'hasElevator',
  'commercialityFactor',
  'ageYears',
  'plotUtilisation',
] as const satisfies readonly ObjectiveValueMissing[];

export type ConditionalQuestion = (typeof CONDITIONAL_QUESTIONS)[number];

function commonInput(draft: ObjectiveValueDraft, todayIso: string) {
  return {
    zonePrice: draft.zonePrice,
    commercialityFactor: draft.commercialityFactor,
    ageYears: draft.permitDate === null ? null : legalAgeYears(draft.permitDate, todayIso),
    ownershipShare: draft.ownershipPct === null ? 1 : draft.ownershipPct / 100,
    coOwned: draft.coOwned,
    encumbrance: draft.encumbrance,
    damageRestorationCost: draft.damageRestorationCost ?? 0,
    construction: draft.construction,
    lightRoof: draft.lightRoof,
    thickWalls: draft.thickWalls,
  };
}

/** Το πρόχειρο ως είσοδος της μηχανής. `todayIso` = ημερομηνία αποτίμησης (`YYYY-MM-DD`). */
export function draftToInput(draft: ObjectiveValueDraft, todayIso: string): ObjectiveValueInput {
  const common = commonInput(draft, todayIso);
  switch (draft.form) {
    case 'residence':
      return {
        ...common,
        form: 'residence',
        levels: draft.levels,
        areaIncludesCommon: draft.areaIncludesCommon,
        frontage: draft.frontage,
        hasCentralHeating: draft.hasCentralHeating,
        hasElevator: draft.hasElevator,
        completion: draft.residenceCompletion,
        plotUtilisation: draft.plotUtilisation,
      };
    case 'storage':
      return { ...common, form: 'storage', area: draft.area, position: draft.storagePosition, completion: draft.ancillaryCompletion };
    case 'parking':
      return { ...common, form: 'parking', area: draft.area, position: draft.parkingPosition, completion: draft.ancillaryCompletion };
  }
}

/** Τι λείπει, σε **κάθε** κατάσταση (και στο `invalid`, ώστε η φόρμα να μην ξεχνά ερωτήσεις). */
export function missingOf(result: ObjectiveValueResult): readonly ObjectiveValueMissing[] {
  return result.kind === 'computed' ? [] : result.missing;
}

function cleared(draft: ObjectiveValueDraft, question: ConditionalQuestion): ObjectiveValueDraft {
  switch (question) {
    case 'ageYears':
      return { ...draft, permitDate: null };
    case 'commercialityFactor':
      return { ...draft, commercialityFactor: null };
    case 'frontage':
      return { ...draft, frontage: null };
    case 'hasCentralHeating':
      return { ...draft, hasCentralHeating: null };
    case 'hasElevator':
      return { ...draft, hasElevator: null };
    case 'plotUtilisation':
      return { ...draft, plotUtilisation: null };
  }
}

/**
 * **Ποιες ερωτήσεις μετρούν για ΑΥΤΟ το ακίνητο** — με τη σειρά του {@link CONDITIONAL_QUESTIONS}. Η μηχανή είναι ο
 * κριτής: μια ερώτηση μετρά αν, χωρίς απάντηση, η μηχανή θα τη ζητούσε.
 */
export function relevantQuestions(draft: ObjectiveValueDraft, todayIso: string): readonly ConditionalQuestion[] {
  return CONDITIONAL_QUESTIONS.filter((question) =>
    missingOf(computeObjectiveValue(draftToInput(cleared(draft, question), todayIso))).includes(question),
  );
}
