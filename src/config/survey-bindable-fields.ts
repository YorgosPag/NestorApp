/**
 * @related ADR-759 Φ3γ/Φ4 — πού μπορεί να προσγειωθεί μια τιμή του σχεδίου μέσα στην καρτέλα
 *          «Στοιχεία Τοπογραφικού», και με ποιον τρόπο.
 *
 * ## Γιατί υπάρχει αυτό το αρχείο και όχι ένα `switch` στον writer
 *
 * Ο writer θα χρειαζόταν να ξέρει **τρία** πράγματα ανά πεδίο: πού γράφεται μέσα στο
 * `SurveyRecord`, πώς μετατρέπεται το ωμό κείμενο σε τιμή, και **ποιο κλειδί πρώτου
 * επιπέδου** αγγίζει η εγγραφή. Γραμμένα σε `switch`, τα τρία αποκλίνουν σιωπηλά — και η
 * χαρακτηριστική αστοχία **δεν είναι σφάλμα τύπου**, είναι copy-paste που γράφει στο
 * διπλανό πεδίο (ADR-759 §4.3.1, η ίδια αστοχία που ανάγκασε την καρτέλα να γίνει δεδομένα).
 *
 * ## 🔴 Ο κανόνας που κάνει το «γράφτηκε αλλά δεν φαίνεται» αδύνατο
 *
 * Κάθε προδιαγραφή **δείχνει στον ίδιο τον accessor της καρτέλας** — το ίδιο αντικείμενο,
 * όχι δίδυμο (`survey-card-config.ts`). Άρα:
 * - η έγκριση γράφει από την **ίδια** `write` που γράφει το πληκτρολόγιο του μηχανικού·
 * - το `survey-bindable-fields.test.ts` απαιτεί ότι κάθε accessor εδώ είναι **προσβάσιμος**
 *   από το `allSurveyCardFields()`, δηλαδή ότι το πεδίο **αποδίδεται** στην καρτέλα.
 *
 * Χωρίς τον δεύτερο κανόνα, η προφανής υλοποίηση θα έγραφε στο Firestore τιμή που καμία
 * οθόνη δεν δείχνει — ακριβώς το `no-primary-address` (δηλωμένο, μη προσβάσιμο) από την άλλη
 * πλευρά, και ακριβώς η αστοχία που είχε το `surveyDate` πριν από τη Φ3γ.
 *
 * ## 🔴 Τι ΔΕΝ μπαίνει εδώ
 *
 * **Πεδίο χωρίς παραγωγό.** Το λεξιλόγιο μεγαλώνει **μόνο** μαζί με τον κώδικα που το
 * παράγει· το `binding-reason-coverage.test.ts` το επιβάλλει τρέχοντας τους **πραγματικούς**
 * αναγνώστες — και τους **δύο**, πινακίδας και σώματος. Είναι ο κανόνας του ADR-759 §4.4.1
 * («κατάσταση χωρίς παραγωγό δεν είναι κατάσταση — είναι λεξιλόγιο») εφαρμοσμένος στους
 * **στόχους** αντί για τις **αιτίες**.
 *
 * Καθαρό αρχείο: μηδέν I/O, καμία εξάρτηση σε React/Firestore — ο Λ2 το φτάνει και η
 * άγκυρα καθαρότητας (`title-block-purity.test.ts`) το ελέγχει μεταβατικά.
 */
import {
  BUILDABILITY_NOTE_FIELD,
  DECLARED_COVERAGE_PCT_FIELD,
  DECLARED_MAX_HEIGHT_FIELD,
  DECLARED_SD_FIELD,
  HEIGHT_DATUM_FIELD,
  IMPLEMENTATION_ACT_DATE_FIELD,
  IMPLEMENTATION_ACT_DECISION_FIELD,
  IMPLEMENTATION_ACT_ENTRY_FIELD,
  IMPLEMENTATION_ACT_NUMBER_FIELD,
  IMPLEMENTATION_ACT_ORIGINAL_PROPERTIES_FIELD,
  IMPLEMENTATION_ACT_REGISTRY_FIELD,
  IMPLEMENTATION_ACT_URBAN_UNITS_FIELD,
  IMPLEMENTATION_ACT_VOLUME_FIELD,
  IN_SOCIAL_FACTOR_ZONE_FIELD,
  LAND_USE_FIELD,
  MAX_COVERAGE_PCT_FIELD,
  MIN_AREA_FIELD,
  MIN_FRONTAGE_FIELD,
  PLOT_AREA_FIELD,
  PLOT_BOUNDARY_LABELS_FIELD,
  ROAD_PLAN_DEFINITION_FIELD,
  SECTOR_FIELD,
  SETTLEMENT_ACTS_FIELD,
  SOCIAL_FACTOR_SD_FIELD,
  SURVEY_DATE_FIELD,
  TOTAL_SD_FIELD,
  type BooleanFieldAccessor,
  type NumberFieldAccessor,
  type TextFieldAccessor,
  type TextListFieldAccessor,
} from '@/config/survey-card-config';
import { parseSurveyDate } from '@/lib/survey-record/survey-date';
import { parseStrictDecimal } from '@/lib/survey-record/survey-number';
import {
  parseSurveyAffirmation,
  parseSurveyText,
  parseSurveyTextList,
} from '@/lib/survey-record/survey-text-values';
import { surveySourced, type SurveyRecord } from '@/types/project-survey-record';

// ── Το λεξιλόγιο ──────────────────────────────────────────────────────────────

/**
 * Τα πεδία του τοπογραφικού που μπορεί να προτείνει ένα σχέδιο.
 *
 * ⚠️ **Ήταν δύο μέχρι τη Φ4, και αυτό δεν ήταν έλλειψη — ήταν κανόνας.** Η **πινακίδα** λέει
 * πράγματα για δύο από τα ~30 πεδία της καρτέλας· τα υπόλοιπα ζουν στο **σώμα** του σχεδίου
 * (ADR-759 §2β.2) και μπήκαν εδώ **μαζί με τον αναγνώστη τους** (Λ1β), όχι πριν. Καθένα από
 * τα 26 παράγεται σήμερα από το πραγματικό `G753_ergasia F.dxf` — το επιβάλλει η πύλη.
 */
export const BINDABLE_SURVEY_FIELDS = [
  // ── Το έγγραφο ──
  'surveyDate',
  // ── Α. ΟΡΟΙ ΔΟΜΗΣΗΣ ──
  'sector',
  'plotBoundaryLabels',
  'minFrontage',
  'minArea',
  'declaredCoveragePct',
  'maxCoveragePct',
  'declaredMaxHeight',
  'declaredSd',
  'socialFactorSd',
  'totalSd',
  'landUse',
  'inSocialFactorZone',
  // ── Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ ──
  'settlementActs',
  'implementationActNumber',
  'implementationActDecision',
  'implementationActVolume',
  'implementationActEntry',
  'implementationActDate',
  'implementationActRegistry',
  'implementationActUrbanUnits',
  'implementationActOriginalProperties',
  // ── Γ–Ζ ──
  'buildabilityNote',
  'roadPlanDefinition',
  'plotArea',
  'heightDatum',
] as const;

export type BindableSurveyField = (typeof BINDABLE_SURVEY_FIELDS)[number];

// ── Η προδιαγραφή ─────────────────────────────────────────────────────────────

interface SurveyBindingSpecBase {
  /**
   * Το κλειδί **πρώτου επιπέδου** του `SurveyRecord` που αγγίζει η εγγραφή.
   *
   * 🔴 **Δεν είναι διακόσμηση — είναι η εμβέλεια του patch.** Το `updateSurveyRecord`
   * δέχεται `Partial<SurveyRecord>`, και γράφοντας ολόκληρη την εγγραφή θα σβήναμε ό,τι
   * άλλαξε στο μεταξύ από την καρτέλα: το ίδιο ακριβώς με το `project-snapshot.ts`, όπου
   * το gateway είναι σκέτο pass-through χωρίς συναλλαγή. Ο άνθρωπος πατά Έγκριση λεπτά
   * αφότου διαβάστηκε το σχέδιο.
   */
  readonly documentKey: keyof SurveyRecord;
}

/**
 * Πεδίο κειμένου.
 *
 * 🔑 `null` από το `parse` σημαίνει «**δεν αναλύθηκε**», και είναι **έγκυρο αποτέλεσμα, όχι
 * αποτυχία**. Το `Sourced` αποθηκεύει τότε `value: null` με **ακέραιο** `rawText`, και η
 * καρτέλα δείχνει το ωμό κείμενο. Η ανάλυση μπορεί να είναι λάθος· το πρωτότυπο ποτέ
 * (ADR-745 §8 κανόνας 3).
 */
export interface TextSurveyBindingSpec extends SurveyBindingSpecBase {
  readonly kind: 'text';
  readonly accessor: TextFieldAccessor;
  parse(rawText: string): string | null;
}

export interface NumberSurveyBindingSpec extends SurveyBindingSpecBase {
  readonly kind: 'number';
  readonly accessor: NumberFieldAccessor;
  parse(rawText: string): number | null;
}

export interface BooleanSurveyBindingSpec extends SurveyBindingSpecBase {
  readonly kind: 'boolean';
  readonly accessor: BooleanFieldAccessor;
  parse(rawText: string): boolean | null;
}

export interface TextListSurveyBindingSpec extends SurveyBindingSpecBase {
  readonly kind: 'textList';
  readonly accessor: TextListFieldAccessor;
  parse(rawText: string): readonly string[] | null;
}

/**
 * 🔑 **Το `kind` στενεύει `accessor` και `parse` ΜΑΖΙ** — ίδιο δόγμα με τον `FieldAccessor`.
 *
 * Η ένωση είχε **ένα** μέλος μέχρι τη Φ4 και μεγάλωσε όταν το σώμα του σχεδίου έφερε
 * αριθμούς (ΣΔ, κάλυψη, εμβαδόν), λογικές τιμές (ΖΚΣ) και λίστες (`Α,Β,Γ,Δ,Α`, «16 και 17»).
 * Κανένα μέλος δεν προστέθηκε «για το μέλλον»: κάθε ένα έχει σήμερα πεδία που το χρησιμοποιούν.
 */
export type SurveyBindingSpec =
  | TextSurveyBindingSpec
  | NumberSurveyBindingSpec
  | BooleanSurveyBindingSpec
  | TextListSurveyBindingSpec;

/**
 * Η **αναλυμένη** τιμή, με τον τύπο της δηλωμένο πάνω της.
 *
 * 🔴 **Γιατί ετικέτα και όχι σκέτη ένωση `string | number | boolean | string[] | null`.**
 * Ο writer πρέπει να επιλέξει τη σωστή `accessor.write` — και μια σκέτη ένωση θα τον
 * ανάγκαζε σε `typeof value === 'string' ? … : null`, δηλαδή να **πετάει σιωπηλά** μια τιμή
 * που δεν ταιριάζει στο πεδίο. Με την ετικέτα, η αναντιστοιχία είναι **ρητό σφάλμα** και το
 * `null` σημαίνει πάντα ένα πράγμα: «δεν αναλύθηκε».
 */
export type SurveyParsedValue =
  | { readonly kind: 'text'; readonly value: string | null }
  | { readonly kind: 'number'; readonly value: number | null }
  | { readonly kind: 'boolean'; readonly value: boolean | null }
  | { readonly kind: 'textList'; readonly value: readonly string[] | null };

/**
 * «Π.Ε. 39» → «39».
 *
 * 🔑 Η σημαδούρα **μένει** στην τιμή του τμήματος (`resolve-location.ts`, `keepMarker`)
 * γιατί χωρίς αυτήν ο άνθρωπος βλέπει σκέτο «39» και δεν ξέρει τι εγκρίνει. Το πεδίο όμως
 * τεκμηριώνεται ως **αριθμός πράξης** (`ImplementationAct.number`, π.χ. `"39"`), οπότε το
 * πρόθεμα κόβεται **εδώ** — στο σύνορο ανάμεσα σε «τι είδα» και «τι αποθηκεύω».
 *
 * Χωρίς αριθμό ⇒ `null`: το `rawText` κρατά ό,τι έγραφε το σχέδιο και ο μηχανικός βλέπει
 * ότι δεν αναλύθηκε, αντί για μια «καθαρή» τιμή που δεν σημαίνει τίποτα.
 */
function parseActNumber(rawText: string): string | null {
  const digits = /\d+/.exec(rawText);
  return digits ? digits[0] : null;
}

const textSpec = (
  documentKey: keyof SurveyRecord,
  accessor: TextFieldAccessor,
): TextSurveyBindingSpec => ({ kind: 'text', documentKey, accessor, parse: parseSurveyText });

const numberSpec = (
  documentKey: keyof SurveyRecord,
  accessor: NumberFieldAccessor,
): NumberSurveyBindingSpec => ({
  kind: 'number',
  documentKey,
  accessor,
  parse: parseStrictDecimal,
});

const textListSpec = (
  documentKey: keyof SurveyRecord,
  accessor: TextListFieldAccessor,
): TextListSurveyBindingSpec => ({
  kind: 'textList',
  documentKey,
  accessor,
  parse: parseSurveyTextList,
});

/**
 * Ο κατάλογος. Ρητός `Record<…>`: νέο πεδίο στο λεξιλόγιο **χωρίς** προδιαγραφή δεν χτίζει.
 */
export const SURVEY_BINDING_SPECS: Record<BindableSurveyField, SurveyBindingSpec> = {
  surveyDate: {
    kind: 'text',
    documentKey: 'surveyDate',
    accessor: SURVEY_DATE_FIELD,
    // «ΙΟΥΛΙΟΣ 2026» ⇒ `null` **επίτηδες**: μήνας δεν είναι ημερομηνία, και μια εφευρημένη
    // 1η Ιουλίου θα διαβαζόταν ως γεγονός. Το σώμα του **ίδιου** σχεδίου δίνει «30/7/2026»,
    // που η ίδια συνάρτηση διαβάζει σωστά χωρίς καμία αλλαγή (ADR-759 §4.7 απόφαση 4).
    parse: (rawText) => parseSurveyDate(rawText).iso,
  },

  // ── Α. ΟΡΟΙ ΔΟΜΗΣΗΣ ──
  sector: textSpec('buildingTerms', SECTOR_FIELD),
  plotBoundaryLabels: textListSpec('buildingTerms', PLOT_BOUNDARY_LABELS_FIELD),
  minFrontage: numberSpec('buildingTerms', MIN_FRONTAGE_FIELD),
  minArea: numberSpec('buildingTerms', MIN_AREA_FIELD),
  declaredCoveragePct: numberSpec('buildingTerms', DECLARED_COVERAGE_PCT_FIELD),
  maxCoveragePct: numberSpec('buildingTerms', MAX_COVERAGE_PCT_FIELD),
  declaredMaxHeight: textSpec('buildingTerms', DECLARED_MAX_HEIGHT_FIELD),
  declaredSd: numberSpec('buildingTerms', DECLARED_SD_FIELD),
  socialFactorSd: numberSpec('buildingTerms', SOCIAL_FACTOR_SD_FIELD),
  totalSd: numberSpec('buildingTerms', TOTAL_SD_FIELD),
  landUse: textSpec('buildingTerms', LAND_USE_FIELD),
  inSocialFactorZone: {
    kind: 'boolean',
    documentKey: 'buildingTerms',
    accessor: IN_SOCIAL_FACTOR_ZONE_FIELD,
    parse: parseSurveyAffirmation,
  },

  // ── Β. ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ ──
  settlementActs: textSpec('settlement', SETTLEMENT_ACTS_FIELD),
  implementationActNumber: {
    kind: 'text',
    documentKey: 'settlement',
    accessor: IMPLEMENTATION_ACT_NUMBER_FIELD,
    parse: parseActNumber,
  },
  implementationActDecision: textSpec('settlement', IMPLEMENTATION_ACT_DECISION_FIELD),
  implementationActVolume: textSpec('settlement', IMPLEMENTATION_ACT_VOLUME_FIELD),
  implementationActEntry: textSpec('settlement', IMPLEMENTATION_ACT_ENTRY_FIELD),
  implementationActDate: textSpec('settlement', IMPLEMENTATION_ACT_DATE_FIELD),
  implementationActRegistry: textSpec('settlement', IMPLEMENTATION_ACT_REGISTRY_FIELD),
  implementationActUrbanUnits: textListSpec('settlement', IMPLEMENTATION_ACT_URBAN_UNITS_FIELD),
  implementationActOriginalProperties: textListSpec(
    'settlement',
    IMPLEMENTATION_ACT_ORIGINAL_PROPERTIES_FIELD,
  ),

  // ── Γ–Ζ ──
  buildabilityNote: textSpec('buildabilityNote', BUILDABILITY_NOTE_FIELD),
  roadPlanDefinition: textSpec('roadPlanDefinition', ROAD_PLAN_DEFINITION_FIELD),
  plotArea: numberSpec('plotArea', PLOT_AREA_FIELD),
  heightDatum: textSpec('heightDatum', HEIGHT_DATUM_FIELD),
};

// ── Η ανάλυση ─────────────────────────────────────────────────────────────────

/**
 * Ωμό κείμενο σχεδίου → η τιμή που θα αποθηκευτεί, **με τον τύπο της δηλωμένο**.
 *
 * Η **μοναδική** είσοδος ανάλυσης — την καλούν και οι δύο αναγνώστες (πινακίδα, σώμα), ώστε
 * το ίδιο κείμενο να δίνει την ίδια τιμή από όποια διαδρομή κι αν έρθει.
 */
export function parseSurveyValue(field: BindableSurveyField, rawText: string): SurveyParsedValue {
  const spec = SURVEY_BINDING_SPECS[field];
  switch (spec.kind) {
    case 'text':
      return { kind: 'text', value: spec.parse(rawText) };
    case 'number':
      return { kind: 'number', value: spec.parse(rawText) };
    case 'boolean':
      return { kind: 'boolean', value: spec.parse(rawText) };
    case 'textList':
      return { kind: 'textList', value: spec.parse(rawText) };
  }
}

// ── Η εφαρμογή ────────────────────────────────────────────────────────────────

/** Τι άλλαξε μια προσγείωση: η νέα εγγραφή, και **ποιο** κλειδί χρειάζεται να γραφτεί. */
export interface SurveyFieldPatch {
  readonly record: SurveyRecord;
  readonly documentKey: keyof SurveyRecord;
}

/**
 * Γράφει την τιμή στο πεδίο της, με τον τύπο και των δύο ελεγμένο **μαζί**.
 *
 * ⚠️ Το `throw` στο τέλος είναι **δομικά απροσπέλαστο**: η ετικέτα της τιμής παράγεται από
 * την ίδια προδιαγραφή που δίνει τον accessor (`parseSurveyValue`). Υπάρχει γιατί η
 * εναλλακτική — σιωπηλό `null` σε αναντιστοιχία — θα έγραφε **κενό πεδίο** σε βεβαίωση
 * μηχανικού χωρίς κανένα σήμα. Ένα test το εκτελεί με χειροποίητη αναντιστοιχία, ώστε να
 * μην είναι νεκρός κώδικας αλλά **ελεγμένος φύλακας**.
 */
function writeParsed(
  spec: SurveyBindingSpec,
  record: SurveyRecord,
  parsed: SurveyParsedValue,
  rawText: string,
): SurveyRecord {
  if (spec.kind === 'text' && parsed.kind === 'text') {
    return spec.accessor.write(record, surveySourced(parsed.value, rawText));
  }
  if (spec.kind === 'number' && parsed.kind === 'number') {
    return spec.accessor.write(record, surveySourced(parsed.value, rawText));
  }
  if (spec.kind === 'boolean' && parsed.kind === 'boolean') {
    return spec.accessor.write(record, surveySourced(parsed.value, rawText));
  }
  if (spec.kind === 'textList' && parsed.kind === 'textList') {
    return spec.accessor.write(record, surveySourced(parsed.value, rawText));
  }
  throw new Error(
    `applySurveyFieldBinding: το πεδίο περιμένει «${spec.kind}» και δόθηκε «${parsed.kind}»`,
  );
}

/**
 * Γράφει **μία** τιμή σχεδίου μέσα σε μια εγγραφή τοπογραφικού, με προέλευση `'survey'`.
 *
 * Καθαρή: δέχεται και επιστρέφει `SurveyRecord`, δεν ξέρει τίποτα για Firestore. Ο writer
 * (`services/title-block-apply/apply-survey-record.ts`) την καλεί και μετατρέπει το
 * `documentKey` σε patch ενός κλειδιού.
 *
 * 🔴 **Το `value` ΔΙΝΕΤΑΙ, δεν ξανα-αναλύεται εδώ — και αυτό δεν είναι μικρολεπτομέρεια.**
 * Η ανάλυση έγινε **μία** φορά, στον Λ2, και το αποτέλεσμά της **φάνηκε στην οθόνη** πριν ο
 * άνθρωπος πατήσει Έγκριση. Μια δεύτερη ανάλυση τη στιγμή της εγγραφής θα ήταν δεύτερη πηγή
 * αλήθειας για το ίδιο ερώτημα: την ημέρα που ο κανόνας αλλάξει, το σύστημα θα **γράφει
 * άλλο** από αυτό που ενέκρινε ο μηχανικός — σιωπηλά, και με το όνομά του πάνω του.
 *
 * ⚠️ Το `rawText` είναι **υποχρεωτικό στην υπογραφή** — το απαιτεί ο `surveySourced()`,
 * όχι αυτό το σχόλιο. Τιμή διαβασμένη από σχέδιο χωρίς το κείμενό της δεν ελέγχεται ποτέ
 * ξανά από άνθρωπο.
 */
export function applySurveyFieldBinding(
  record: SurveyRecord,
  field: BindableSurveyField,
  parsed: SurveyParsedValue,
  rawText: string,
): SurveyFieldPatch {
  const spec = SURVEY_BINDING_SPECS[field];
  return { record: writeParsed(spec, record, parsed, rawText), documentKey: spec.documentKey };
}

/**
 * Πώς θα φανεί η προσγείωση στον άνθρωπο **πριν** πατήσει Έγκριση.
 *
 * Για κείμενο δείχνει την **αναλυμένη** τιμή, γιατί εκεί οι δύο διαφέρουν ουσιωδώς
 * («Π.Ε. 39» → «39»). Για αριθμούς και λίστες δείχνει το **ωμό**: το «1.364,05» είναι ήδη η
 * ελληνική γραφή του αριθμού, και μια δική μας μορφοποίηση εδώ θα ήταν διεπαφή μέσα σε
 * config — δηλαδή δεύτερος τόπος όπου αποφασίζεται πώς δείχνει ένας αριθμός.
 */
export function surveyBindingPreview(field: BindableSurveyField, rawText: string): string {
  const parsed = parseSurveyValue(field, rawText);
  return parsed.kind === 'text' ? (parsed.value ?? rawText) : rawText;
}
