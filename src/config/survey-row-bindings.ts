/**
 * @related ADR-759 Φ4β — πώς προσγειώνεται μια **γραμμή** του σχεδίου μέσα στην καρτέλα.
 *
 * ## Γιατί χωριστό αρχείο από το `survey-bindable-fields.ts`
 *
 * Το βαθμωτό πεδίο έχει **όνομα** (`plotArea`) και ο writer το γράφει με έναν accessor. Μια
 * γραμμή λίστας δεν έχει: πριν γραφτεί κάτι, πρέπει να απαντηθεί **ποια γραμμή** — και η
 * απάντηση ορίζει και την **ταυτοδυναμία**. Δύο διαφορετικά ερωτήματα, δύο κατάλογοι.
 *
 * ## 🔴 Ο κανόνας που τηρείται αυτούσιος: δείχνουμε στον accessor ΤΗΣ ΚΑΡΤΕΛΑΣ
 *
 * Κάθε μέρος γράφεται από **το ίδιο αντικείμενο** που γράφει και το πληκτρολόγιο του
 * μηχανικού (`survey-list-config.ts`), βρισκόμενο με το `part` id του. Η εναλλακτική — να
 * ξαναγραφτεί εδώ το `(row) => ({ ...row, authority: next })` — είναι κατά λέξη ο sibling
 * clone που υπάρχει ο N.18 για να σταματά: **και τα δύο μεταγλωττίζονται, και τα δύο
 * φαίνονται σωστά**, και την ημέρα που διορθωθεί το ένα, το άλλο γράφει το παλιό σχήμα.
 *
 * ## 🔴 Η ταυτοδυναμία δεν είναι λεπτομέρεια υλοποίησης
 *
 * Η έγκριση της ίδιας γραμμής δύο φορές **δεν** διπλασιάζει: η γραμμή φέρει ταυτότητα
 * παραγόμενη από το σχέδιο (`surveyRowKey`), και το `upsertRowById` τη βρίσκει. Χωρίς αυτό,
 * το δεύτερο κλικ θα άφηνε τον μηχανικό να σβήνει γραμμές που εφηύρε το σύστημα — και θα
 * ήταν αυτός που θα κατηγορούσε τον εαυτό του (N.7.2 ερώτημα 3).
 *
 * Καθαρό αρχείο: μηδέν I/O, καμία εξάρτηση σε React/Firestore.
 */
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import {
  SURVEY_ACT_SECTIONS,
  SURVEY_APPROVALS_SECTION,
  SURVEY_TITLE_DEEDS_SECTION,
  type SurveyListSection,
} from '@/config/survey-list-config';
import { parseSurveyDate } from '@/lib/survey-record/survey-date';
import { parseSurveyText } from '@/lib/survey-record/survey-text-values';
import {
  ACT_GROUP_KEYS,
  actLens,
  approvalLens,
  newInstitutionalAct,
  newSurveyApproval,
  newSurveyTitleDeed,
  titleDeedLens,
  upsertRowById,
  type ActGroupKey,
} from '@/lib/survey-record/survey-list-rows';
import type {
  DocumentBodyListKey,
  DocumentBodyPartKey,
} from '@/types/document-body-reading';
import { surveySourced, type SurveyRecord } from '@/types/project-survey-record';

// ── Η ανάλυση ενός μέρους ─────────────────────────────────────────────────────

/**
 * Ωμό κείμενο ⇒ η τιμή που αποθηκεύεται, **ανά μέρος**.
 *
 * 🔑 Ρητός `Record<…>`: νέο μέρος στο λεξιλόγιο ανάγνωσης **χωρίς** απόφαση ανάλυσης δεν
 * χτίζει. Το `gazette` λείπει επίτηδες — δεν είναι πεδίο κειμένου αλλά **ένθετη γραμμή**, και
 * το `rawText` της απαιτείται από την υπογραφή του σχήματος (Q3), άρα δεν αναλύεται ποτέ.
 */
const PART_PARSE: Record<
  Exclude<DocumentBodyPartKey, 'gazette'>,
  (rawText: string) => string | null
> = {
  reference: parseSurveyText,
  note: parseSurveyText,
  subject: parseSurveyText,
  authority: parseSurveyText,
  number: parseSurveyText,
  // 🔴 Η **μόνη** μη-ταυτοτική ανάλυση, και είναι η ίδια που κάνει το `surveyDate`: το πεδίο
  // τεκμηριώνεται ISO, το σχέδιο γράφει «18/01/1993». Δεύτερος αναλυτής ημερομηνίας θα
  // σήμαινε ότι η ίδια γραφή δίνει άλλη τιμή ανάλογα με τη διαδρομή.
  date: (rawText) => parseSurveyDate(rawText).iso,
  kind: parseSurveyText,
  notaryName: parseSurveyText,
  volume: parseSurveyText,
  entry: parseSurveyText,
  registry: parseSurveyText,
};

/** Η τιμή ενός μέρους· `null` όταν δεν αναλύεται — κατάσταση, όχι αποτυχία. */
export function parseSurveyRowPart(part: DocumentBodyPartKey, rawText: string): string | null {
  // Το ΦΕΚ αποθηκεύεται **αυτούσιο**: είναι το ένα πράγμα που πρέπει να επιβιώνει όταν
  // τίποτα δεν αναλύεται (ADR-759 Q3), και το σχήμα το απαιτεί στην υπογραφή του.
  return part === 'gazette' ? rawText : PART_PARSE[part](rawText);
}

// ── Ποια λίστα ────────────────────────────────────────────────────────────────

/** Ό,τι χρειάζεται ο writer για **μία** επαναλαμβανόμενη ενότητα, χωρίς γενικούς τύπους. */
export interface SurveyRowListSpec {
  /** Η ενότητα της καρτέλας — η SSoT των writers κάθε μέρους. */
  readonly section: SurveyListSection;
  /**
   * Το κλειδί **πρώτου επιπέδου** που αγγίζει η εγγραφή — η εμβέλεια του patch.
   *
   * Ίδιος λόγος με το `SurveyBindingSpec.documentKey`: το `updateSurveyRecord` δέχεται
   * `Partial<SurveyRecord>` και γράφοντας ολόκληρη την εγγραφή θα σβήναμε ό,τι άλλαξε στην
   * καρτέλα στο μεταξύ.
   */
  readonly documentKey: keyof SurveyRecord;
  /** Το πρόθεμα ταυτότητας των γραμμών της — δες `surveyRowKey`. */
  readonly idPrefix: string;
  /** Βρίσκει τη γραμμή με αυτή την ταυτότητα, ή την **προσθέτει**. */
  upsert(record: SurveyRecord, rowId: string): { readonly record: SurveyRecord; readonly index: number };
}

/**
 * Οι τρεις ομάδες θεσμικών πράξεων: ίδιο σχήμα, άλλο κλειδί ⇒ **ένα** εργοστάσιο, τρεις
 * κλήσεις. Γραμμένες χωριστά θα ήταν τρία δίδυμα που το `ssot:discover` (name-based) δεν
 * βλέπει.
 */
function actListSpec(group: ActGroupKey): SurveyRowListSpec {
  const lens = actLens(group);
  const section = SURVEY_ACT_SECTIONS[ACT_GROUP_KEYS.indexOf(group)];
  return {
    section,
    documentKey: 'institutionalActs',
    idPrefix: ENTERPRISE_ID_PREFIXES.SURVEY_ACT,
    // ⚠️ Το εργοστάσιο καλείται και η **ταυτότητά** του αντικαθίσταται: έτσι υπάρχει ένας
    // μόνο ορισμός του «τι είναι κενή πράξη», και η ταυτότητα μένει το μόνο που αλλάζει.
    upsert: (record, rowId) =>
      upsertRowById(record, lens, rowId, (id) => ({ ...newInstitutionalAct(), id })),
  };
}

/**
 * Ο κατάλογος. Ρητός `Record<…>`: νέα λίστα στο λεξιλόγιο ανάγνωσης **χωρίς** προορισμό δεν
 * χτίζει — ίδιος φύλακας με το `SURVEY_BINDING_SPECS`.
 */
export const SURVEY_ROW_LISTS: Record<DocumentBodyListKey, SurveyRowListSpec> = {
  urbanPlanDecree: actListSpec('urbanPlanDecree'),
  generalUrbanPlan: actListSpec('generalUrbanPlan'),
  zoningRegulations: actListSpec('zoningRegulations'),
  approvals: {
    section: SURVEY_APPROVALS_SECTION,
    documentKey: 'approvals',
    idPrefix: ENTERPRISE_ID_PREFIXES.SURVEY_APPROVAL,
    upsert: (record, rowId) =>
      upsertRowById(record, approvalLens, rowId, (id) => ({ ...newSurveyApproval(), id })),
  },
  titleDeeds: {
    section: SURVEY_TITLE_DEEDS_SECTION,
    documentKey: 'titleDeeds',
    idPrefix: ENTERPRISE_ID_PREFIXES.SURVEY_TITLE_DEED,
    upsert: (record, rowId) =>
      upsertRowById(record, titleDeedLens, rowId, (id) => ({ ...newSurveyTitleDeed(), id })),
  },
};

// ── Η εγγραφή ─────────────────────────────────────────────────────────────────

/** Μία τιμή γραμμής, **ήδη αναλυμένη** — η ίδια που είδε ο άνθρωπος πριν πατήσει Έγκριση. */
export interface SurveyRowPartValue {
  readonly part: DocumentBodyPartKey;
  /** `null` ⇒ δεν αναλύθηκε· το `rawText` παραμένει η αλήθεια (ADR-745 §8 κανόνας 3). */
  readonly value: string | null;
  readonly rawText: string;
}

/**
 * Γράφει ένα μέρος κειμένου μέσα από **τον accessor της καρτέλας**.
 *
 * ⚠️ Το `throw` είναι **δομικά απροσπέλαστο** από τη ζωντανή ροή: το λεξιλόγιο μερών και οι
 * accessors ελέγχονται για ισότητα από πύλη. Υπάρχει γιατί η εναλλακτική — σιωπηλή
 * παράλειψη — θα έγραφε γραμμή **χωρίς** το μέρος της, χωρίς κανένα σήμα. Ένα test το
 * εκτελεί, ώστε να είναι ελεγμένος φύλακας και όχι νεκρός κώδικας.
 */
function writeTextPart(
  record: SurveyRecord,
  section: SurveyListSection,
  index: number,
  value: SurveyRowPartValue,
): SurveyRecord {
  // Το όνομα του συμβολαιογράφου ζει στο **ένα** control που ζευγαρώνει γραμμένο όνομα και
  // σύνδεσμο επαφής: γράφεται το όνομα, ο σύνδεσμος μένει όπως ήταν — ανάγνωση δεν είναι
  // ταυτοποίηση (ADR-745 §8).
  const linked = section.linkedContact;
  if (value.part === 'notaryName' && linked) {
    return linked.write(
      record,
      index,
      surveySourced(value.value, value.rawText),
      linked.readLinkedId(record, index),
    );
  }

  const accessor = section.rowFields(index).find((field) => field.part === value.part);
  if (!accessor || accessor.kind !== 'text') {
    throw new Error(
      `applySurveyRowBinding: part "${value.part}" has no text field on the row`,
    );
  }
  return accessor.write(record, surveySourced(value.value, value.rawText));
}

/**
 * Προσθέτει ένα ΦΕΚ στην πράξη, **αν δεν το λέει ήδη**.
 *
 * 🔑 Η ταυτότητα ενός ΦΕΚ είναι το ίδιο του το κείμενο — είναι value object, χωρίς id (δες
 * `survey-list-rows.ts`, η γραμμή που το IFC τραβά ανάμεσα σε rooted entities και references).
 * Άρα ιδεοδυναμία σημαίνει «ίδιο `rawText` ⇒ ίδια αναφορά», και τα ΦΕΚ που πρόσθεσε ο
 * μηχανικός με το χέρι **επιβιώνουν**: δεν αντικαθίσταται η λίστα, εμπλουτίζεται.
 */
function writeGazette(
  record: SurveyRecord,
  section: SurveyListSection,
  index: number,
  value: SurveyRowPartValue,
): SurveyRecord {
  const sub = section.gazettes;
  if (!sub) {
    throw new Error('applySurveyRowBinding: this list section declares no gazette sub-list');
  }
  const rawTextOf = (from: SurveyRecord, gazetteIndex: number): string | null => {
    const field = sub.fields(index, gazetteIndex).find((f) => f.part === 'rawText');
    return field && field.kind === 'text' ? field.read(from) : null;
  };

  const count = sub.count(record, index);
  for (let i = 0; i < count; i += 1) {
    if (rawTextOf(record, i) === value.rawText) return record;
  }

  const appended = sub.appendRow(record, index);
  const field = sub.fields(index, count).find((f) => f.part === 'rawText');
  if (!field || field.kind !== 'text') {
    throw new Error('applySurveyRowBinding: the gazette reference has no rawText field');
  }
  return field.write(appended, value.rawText);
}

/** Τι άλλαξε η προσγείωση μιας γραμμής: η νέα εγγραφή, και **ποιο** κλειδί θέλει εγγραφή. */
export interface SurveyRowPatch {
  readonly record: SurveyRecord;
  readonly documentKey: keyof SurveyRecord;
}

/**
 * Γράφει **μία γραμμή** του σχεδίου μέσα σε μια εγγραφή τοπογραφικού, με προέλευση `'survey'`.
 *
 * Καθαρή: δέχεται και επιστρέφει `SurveyRecord`. Ιδεοδύναμη: δεύτερη κλήση με το ίδιο `rowId`
 * ξαναγράφει **την ίδια** γραμμή.
 */
export function applySurveyRowBinding(
  record: SurveyRecord,
  list: DocumentBodyListKey,
  rowId: string,
  parts: readonly SurveyRowPartValue[],
): SurveyRowPatch {
  const spec = SURVEY_ROW_LISTS[list];
  const seeded = spec.upsert(record, rowId);

  let next = seeded.record;
  for (const value of parts) {
    next =
      value.part === 'gazette'
        ? writeGazette(next, spec.section, seeded.index, value)
        : writeTextPart(next, spec.section, seeded.index, value);
  }
  return { record: next, documentKey: spec.documentKey };
}
