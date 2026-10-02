/**
 * @fileoverview **Ποιες ερωτήσεις κάνει η οθόνη «Βελτίωσε την αγγελία σου», και με ποια σειρά** (ADR-898 Φ3β-2 ·
 * ADR-842 Φ4) — καθαρές συναρτήσεις, χωρίς React.
 * @related `listing-objective-value.ts` (η ΜΙΑ αντιστοίχιση αγγελίας → πρόχειρο) · `objective-value-draft.ts`
 *   (`relevantQuestions`: η μηχανή κρίνει τι μετρά) · `objective-value-bounds.ts` (ποσό ή όρια) ·
 *   `components/owner-property/improve/` (η οθόνη)
 * @module lib/objective-value/objective-value-improve
 *
 * 🔑 **Η μηχανή κρίνει ΚΑΙ εδώ.** Ποια ερώτηση μετρά το λέει το `relevantQuestions` πάνω σε πρόχειρο **χωρίς τις
 * δηλώσεις** — ώστε μια απαντημένη ερώτηση να μένει ορατή και διορθώσιμη. Καμία δεύτερη λίστα «τι ρωτάμε».
 *
 * 🏆 **Σειρά κατά το πόσο στενεύει το εύρος** (εξυπνότερο από το «Edit facts» της Zillow, που απλώς απαριθμεί πεδία):
 * για κάθε ανοιχτή ερώτηση, η μηχανή υπολογίζει τα όρια **μετά από κάθε πιθανή απάντηση**, και κέρδος =
 * «πλάτος τώρα − το **χειρότερο** πλάτος μετά» (minimax). Καμία πιθανότητα, καμία εφευρεμένη κατανομή: το κέρδος είναι
 * **εγγυημένο** όποια κι αν είναι η απάντηση. Ερώτηση χωρίς την οποία δεν βγαίνει ούτε εύρος ⇒ πρώτη απ' όλες.
 *
 * ⚠️ **Δέχεται αγγελία με ΕΜΦΑΝΗ αντικειμενική.** Ο κάτοχος βελτιώνει και όταν έχει επιλέξει απόκρυψη, άρα ο καλών
 * προβάλλει την αγγελία με `display: 'shown'`· η κρυμμένη μορφή δεν κρατά καν τα στοιχεία (ADR-898 §12.1).
 */

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { PublicListing } from '@/types/public-listing';

import { objectiveValueBounds, type ObjectiveValueBounds, type OpenQuestion } from './objective-value-bounds';
import {
  OBJECTIVE_VALUE_DECLARED_FIELDS,
  UNDECLARED_LISTING_OBJECTIVE_VALUE,
  type ObjectiveValueDeclarations,
  type ObjectiveValueDeclarationsPatch,
  type ObjectiveValueDeclaredField,
} from './objective-value-declarations';
import { INITIAL_DRAFT, relevantQuestions, type ConditionalQuestion, type ObjectiveValueDraft } from './objective-value-draft';
import {
  listingObjectiveValueBasis,
  type ListingLevelBasis,
  type ListingObjectiveValueBasis,
  type ListingObjectiveValueResolution,
} from './listing-objective-value';
import { RESIDENCE_FRONTAGES } from './objective-value-types';
import { declaredZonePriceCandidates, zoneFrontAnswers, zonePriceCandidates } from './objective-value-zone';

/** Πόσες ανοιχτές ερωτήσεις προτείνονται **ταυτόχρονα** — coaching, όχι κατηγορητήριο (ADR-842 §6 #7). */
export const IMPROVE_QUESTIONS_AT_A_TIME = 3;

export type ImproveQuestionState =
  /** Αναπάντητη, και η μηχανή τη χρειάζεται. */
  | 'open'
  /** Η δήλωση του κατόχου μπήκε στον υπολογισμό. */
  | 'answered'
  /** Το κρίνει ήδη γενικό χαρακτηριστικό της αγγελίας (ιεραρχία ADR-898 §12.2) — η δήλωση δεν θα μετρούσε. */
  | 'byAttribute'
  /** Ο υπολογισμός στηρίζεται σε **δηλωμένη υπόθεση** (άδεια από το έτος κατασκευής · εμβαδόν χωρίς κοινόχρηστους). */
  | 'assumed';

export type ImproveQuestionImpact =
  /** Χωρίς αυτή την απάντηση δεν βγαίνει ούτε ποσό ούτε εύρος. */
  | { readonly kind: 'unblocks' }
  /** Το εύρος στενεύει **τουλάχιστον** κατά `amount` €, όποια κι αν είναι η απάντηση. */
  | { readonly kind: 'narrows'; readonly amount: number }
  | { readonly kind: 'none' };

export interface ImproveQuestion {
  readonly field: ObjectiveValueDeclaredField;
  readonly state: ImproveQuestionState;
  readonly impact: ImproveQuestionImpact;
}

export type ObjectiveValueImprovement =
  | Exclude<ListingObjectiveValueBasis, { readonly kind: 'ready' }>
  | {
      readonly kind: 'ready';
      /** Τα όρια τώρα, με όσα ξέρουμε. */
      readonly bounds: ObjectiveValueBounds;
      /** `missing` ⇒ πολυεπίπεδο χωρίς εμβαδόν ανά όροφο: δεν απαντιέται εδώ, αλλά στα στοιχεία του ακινήτου. */
      readonly levelBasis: ListingLevelBasis;
      /** Πρώτες οι ανοιχτές (κατά κέρδος), μετά οι υπόλοιπες με τη σειρά της λίστας-πηγής. */
      readonly questions: readonly ImproveQuestion[];
    };

/** Το όνομα της ερώτησης στη μηχανή, για όσα δηλώσιμα έχουν ένα (τα ίδια χειριστήρια με τον υπολογιστή). */
export const ENGINE_QUESTION_OF: Readonly<Partial<Record<ObjectiveValueDeclaredField, ConditionalQuestion>>> = {
  frontage: 'frontage',
  hasCentralHeating: 'hasCentralHeating',
  hasElevator: 'hasElevator',
  permitDate: 'ageYears',
};

/** Το πλάτος των ορίων· `null` όταν δεν βγαίνει ούτε εύρος. */
export function boundsWidth(bounds: ObjectiveValueBounds): number | null {
  if (bounds.kind === 'exact') return 0;
  return bounds.kind === 'range' ? bounds.high - bounds.low : null;
}

/** Ποια δηλώσιμα μετρούν για ΑΥΤΟ το ακίνητο — η μηχανή κρίνει, πάνω σε πρόχειρο χωρίς δηλώσεις. */
function relevantFields(listing: PublicListing, verdict: ValueZoneVerdict, today: string): readonly ObjectiveValueDeclaredField[] {
  const undeclared = { ...listing, frontage: null, objectiveValueDeclarations: UNDECLARED_LISTING_OBJECTIVE_VALUE };
  const basis = listingObjectiveValueBasis(undeclared, verdict);
  if (basis.kind !== 'ready') return [];
  const [zonePrice = null] = basis.zonePrices;
  const asked = relevantQuestions({ ...basis.resolution.draft, zonePrice }, today);
  return OBJECTIVE_VALUE_DECLARED_FIELDS.filter((field) => {
    if (field === 'zoneFront') return zonePriceCandidates(verdict).length > 1;
    if (field === 'areaIncludesCommon') return basis.form === 'residence';
    const question = ENGINE_QUESTION_OF[field];
    return question !== undefined && asked.includes(question);
  });
}

function stateOf(field: ObjectiveValueDeclaredField, resolution: ListingObjectiveValueResolution): ImproveQuestionState {
  if (resolution.used.includes(field)) return 'answered';
  const { draft } = resolution;
  switch (field) {
    case 'hasCentralHeating':
    case 'hasElevator':
      return draft[field] === null ? 'open' : 'byAttribute';
    case 'permitDate':
      return draft.permitDate === null ? 'open' : 'assumed';
    case 'areaIncludesCommon':
      return 'assumed';
    case 'frontage':
    case 'zoneFront':
      return 'open';
  }
}

/** Οι πιθανές απαντήσεις μιας ερώτησης που απαριθμείται, ως (πρόχειρο, τιμές ζώνης) για τη μηχανή. */
function scenariosOf(
  question: OpenQuestion,
  draft: ObjectiveValueDraft,
  zonePrices: readonly number[],
  verdict: ValueZoneVerdict,
): readonly (readonly [ObjectiveValueDraft, readonly number[]])[] {
  switch (question) {
    case 'zoneFront':
      return zoneFrontAnswers(verdict).map((answer) => [draft, declaredZonePriceCandidates(verdict, answer)] as const);
    case 'frontage':
      return RESIDENCE_FRONTAGES.map((frontage) => [{ ...draft, frontage }, zonePrices] as const);
    case 'hasCentralHeating':
      return [true, false].map((hasCentralHeating) => [{ ...draft, hasCentralHeating }, zonePrices] as const);
    case 'hasElevator':
      return [true, false].map((hasElevator) => [{ ...draft, hasElevator }, zonePrices] as const);
    case 'position':
      return [];
  }
}

/** Minimax: «πλάτος τώρα − το χειρότερο πλάτος μετά την απάντηση». `null` όταν κάποιο σενάριο δεν δίνει εύρος. */
function narrowing(width: number, scenarios: ReturnType<typeof scenariosOf>, today: string): number | null {
  let worst = 0;
  for (const [draft, prices] of scenarios) {
    const after = boundsWidth(objectiveValueBounds(draft, today, prices));
    if (after === null) return null;
    worst = Math.max(worst, after);
  }
  return scenarios.length === 0 ? null : width - worst;
}

function isOpenQuestion(field: ObjectiveValueDeclaredField): field is ObjectiveValueDeclaredField & OpenQuestion {
  return field === 'zoneFront' || field === 'frontage' || field === 'hasCentralHeating' || field === 'hasElevator';
}

interface ImpactContext {
  readonly bounds: ObjectiveValueBounds;
  readonly draft: ObjectiveValueDraft;
  readonly zonePrices: readonly number[];
  readonly verdict: ValueZoneVerdict;
  readonly today: string;
}

function impactOf(field: ObjectiveValueDeclaredField, context: ImpactContext): ImproveQuestionImpact {
  const { bounds } = context;
  const engineQuestion = ENGINE_QUESTION_OF[field];
  if (bounds.kind === 'unresolved') {
    // Ξεκλειδώνει ΜΟΝΟ ό,τι δεν απαριθμείται: η μηχανή απαριθμεί ΟΛΑ τα κενά, αλλά όσα έχουν πεπερασμένες απαντήσεις
    // (πρόσοψη, θέρμανση…) θα γίνονταν απλώς όρια — εμποδίζει μόνο το συνεχές άγνωστο (η άδεια).
    const blocking = engineQuestion !== undefined && !isOpenQuestion(field) && bounds.result.missing.includes(engineQuestion);
    return blocking ? { kind: 'unblocks' } : { kind: 'none' };
  }
  if (bounds.kind !== 'range' || !isOpenQuestion(field) || !bounds.open.includes(field)) return { kind: 'none' };
  const scenarios = scenariosOf(field, context.draft, context.zonePrices, context.verdict);
  const amount = narrowing(bounds.high - bounds.low, scenarios, context.today);
  return amount === null || amount <= 0 ? { kind: 'none' } : { kind: 'narrows', amount };
}

/** Βαθμίδα: 2 = ανοιχτή που ξεκλειδώνει · 1 = άλλη ανοιχτή · 0 = απαντημένη/υπόθεση/χαρακτηριστικό. */
function tierOf(question: ImproveQuestion): number {
  if (question.state !== 'open') return 0;
  return question.impact.kind === 'unblocks' ? 2 : 1;
}

function amountOf(question: ImproveQuestion): number {
  return question.impact.kind === 'narrows' ? question.impact.amount : 0;
}

/** Ανοιχτές πρώτες — όσες ξεκλειδώνουν, μετά κατά κέρδος· ίσα κρατούν τη σειρά της λίστας-πηγής. */
function byPriority(a: ImproveQuestion, b: ImproveQuestion): number {
  return tierOf(b) - tierOf(a) || amountOf(b) - amountOf(a);
}

/**
 * **Τι να ρωτήσει η οθόνη, και με ποια σειρά.** `today` = ημέρα αγοράς (`YYYY-MM-DD`). Η αγγελία πρέπει να έχει
 * εμφανή αντικειμενική (δες την κεφαλίδα).
 */
export function objectiveValueImprovement(
  listing: PublicListing,
  verdict: ValueZoneVerdict,
  today: string,
): ObjectiveValueImprovement {
  const basis = listingObjectiveValueBasis(listing, verdict);
  if (basis.kind !== 'ready') return basis;
  const { resolution, zonePrices } = basis;
  const bounds = objectiveValueBounds(resolution.draft, today, zonePrices);
  const context: ImpactContext = { bounds, draft: resolution.draft, zonePrices, verdict, today };
  const questions = relevantFields(listing, verdict, today).map((field) => ({
    field,
    state: stateOf(field, resolution),
    impact: impactOf(field, context),
  }));
  // `sort` είναι σταθερή (ES2019): ίσα βάρη κρατούν τη σειρά της λίστας-πηγής.
  return { kind: 'ready', bounds, levelBasis: resolution.levelBasis, questions: [...questions].sort(byPriority) };
}

// ============================================================================
// ΠΡΟΧΕΙΡΟ ⇄ ΔΗΛΩΣΕΙΣ — ώστε η οθόνη να μιλά με τα ΙΔΙΑ χειριστήρια με τον υπολογιστή (`ObjectiveValueQuestion`)
// ============================================================================

/** Τα πεδία που κοινά έχουν πρόχειρο και δηλώσεις, με το ίδιο όνομα και τον ίδιο τύπο. */
const SHARED_DRAFT_FIELDS = ['frontage', 'hasCentralHeating', 'hasElevator', 'permitDate'] as const satisfies readonly (keyof ObjectiveValueDraft &
  ObjectiveValueDeclaredField)[];

/** Οι δηλώσεις του κατόχου ως πρόχειρο (μόνο τα κοινά πεδία· τα άλλα στην προεπιλογή). */
export function draftOfDeclarations(declarations: ObjectiveValueDeclarations): ObjectiveValueDraft {
  const { frontage, hasCentralHeating, hasElevator, permitDate } = declarations;
  return { ...INITIAL_DRAFT, frontage, hasCentralHeating, hasElevator, permitDate };
}

/** Μια αλλαγή του προχείρου → διόρθωση δηλώσεων, **μόνο** με τα κοινά πεδία που άλλαξαν· `null` αν δεν μένει τίποτα. */
export function patchOfDraft(change: Partial<ObjectiveValueDraft>): ObjectiveValueDeclarationsPatch | null {
  const entries = SHARED_DRAFT_FIELDS.filter((field) => field in change).map((field) => [field, change[field] ?? null] as const);
  return entries.length === 0 ? null : (Object.fromEntries(entries) as ObjectiveValueDeclarationsPatch);
}

/** «Σβήσε την απάντηση» ανά πεδίο — ολικός πίνακας: νέο δηλώσιμο πεδίο ⇒ ο μεταγλωττιστής ρωτά. */
const CLEARED: Readonly<Record<ObjectiveValueDeclaredField, ObjectiveValueDeclarationsPatch>> = {
  frontage: { frontage: null },
  zoneFront: { zoneFront: null },
  areaIncludesCommon: { areaIncludesCommon: null },
  permitDate: { permitDate: null },
  hasCentralHeating: { hasCentralHeating: null },
  hasElevator: { hasElevator: null },
};

export function clearedPatchOf(field: ObjectiveValueDeclaredField): ObjectiveValueDeclarationsPatch {
  return CLEARED[field];
}
