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
 * ## 🔴 ΔΥΟ ΤΑΥΤΟΤΗΤΕΣ, ΟΧΙ ΜΙΑ — και η ενότητα Η το έκανε ορατό (Φ4γ)
 *
 * Οι πέντε πρώτες λίστες δείχνουν σε **rooted** γραμμές (`InstitutionalAct`, `SurveyApproval`,
 * `SurveyTitleDeed`): αντικείμενα με δικό τους enterprise id. Η **παρατήρηση** δεν είναι
 * αντικείμενο — **είναι** ένα `Sourced<string>`. Το IFC τραβά ακριβώς εκεί τη γραμμή ανάμεσα
 * σε `IfcRoot` (που παίρνει `GlobalId`) και σε value objects τύπου `IfcDocumentReference`
 * (που υπάρχουν μόνο μέσα από όποιον τα αναφέρει)· το `enterprise-id-prefixes.ts` το δηλώνει
 * ρητά: *«οι αναφορές ΦΕΚ και οι παρατηρήσεις παίρνουν ΤΙΠΟΤΑ»*.
 *
 * Άρα το ερώτημα χωρίζεται σε **δύο**, και οι δύο απαντήσεις είναι διαφορετικές:
 *
 * | ερώτημα | ποιος το ρωτά | rooted γραμμή | value object |
 * |---|---|---|---|
 * | *ποια **δήλωση** του σχεδίου εγκρίθηκε;* | η συλλογή συνδέσεων (`bindingSlot`) | `rowId` | `rowId` |
 * | *σε ποια **γραμμή της καρτέλας** γράφεται;* | ο writer | το `id` της | **το κείμενό της** |
 *
 * ⚠️ **Το να αποκτήσει η παρατήρηση `id` για να βολέψει ο writer θα ήταν η ανάποδη λύση**:
 * αλλαγή σχήματος για χάρη του κώδικα που το γράφει. Η σωστή απάντηση ήταν **ήδη γραμμένη**
 * στο repo, για τα ΦΕΚ — που είναι κι αυτά value objects: *ίδιο κείμενο ⇒ ίδια αναφορά*, άρα
 * η λίστα **εμπλουτίζεται** και ό,τι πρόσθεσε ο άνθρωπος επιβιώνει. Η Φ4γ δεν την ξανάγραψε:
 * την **τράβηξε έξω** ({@link upsertValueRow}), και τώρα τη μοιράζονται και οι δύο.
 *
 * Καθαρό αρχείο: μηδέν I/O, καμία εξάρτηση σε React/Firestore.
 */
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import {
  SURVEY_ACT_SECTIONS,
  SURVEY_APPROVALS_SECTION,
  SURVEY_REMARKS_SECTION,
  SURVEY_TITLE_DEEDS_SECTION,
  type GazetteTextField,
  type SurveyListSection,
} from '@/config/survey-list-config';
import type { TextFieldAccessor } from '@/config/survey-card-config';
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
  remark: parseSurveyText,
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

/**
 * Πώς βρίσκει ο writer **σε ποια γραμμή της καρτέλας** γράφει.
 *
 * Δύο εκδοχές, και η διάκριση είναι η γραμμή IFC `IfcRoot` ⇄ value object (δες το docblock
 * του αρχείου). Ρητή ένωση και όχι προαιρετικό πεδίο: ο μεταγλωττιστής απαιτεί απόφαση σε
 * κάθε νέα λίστα, αντί να αφήνει το «ξέχασα το upsert» να γίνει σιωπηλό `undefined`.
 */
type SurveyRowIdentity =
  /** **Rooted γραμμή**: το κλειδί δήλωσης του σχεδίου **γίνεται** το enterprise id της. */
  | {
      readonly by: 'row-id';
      /** Βρίσκει τη γραμμή με αυτή την ταυτότητα, ή την **προσθέτει**. */
      upsert(
        record: SurveyRecord,
        rowId: string,
      ): { readonly record: SurveyRecord; readonly index: number };
    }
  /**
   * **Value object**: δεν υπάρχει αντικείμενο γραμμής, άρα δεν υπάρχει id. Ταυτότητα είναι
   * το ίδιο του το κείμενο, και η εγγραφή είναι «πρόσθεσέ το αν δεν το λέει ήδη».
   */
  | { readonly by: 'text' };

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
  /**
   * Το πρόθεμα του **κλειδιού δήλωσης** — δες `surveyRowKey` και `bindingSlot`.
   *
   * 🔑 Για rooted γραμμές είναι το enterprise prefix, γιατί εκεί το κλειδί **γίνεται** το id
   * της γραμμής (N.6: id μόνο με πρόθεμα του μητρώου).
   *
   * 🔴 Για value objects **δεν επιτρέπεται** να εφευρεθεί prefix μητρώου: το
   * `enterprise-id-prefixes.ts` δηλώνει ονομαστικά ότι οι παρατηρήσεις δεν παίρνουν id, και
   * ένα `svrem` εκεί θα ήταν ακριβώς η ψευδής ανεξαρτησία που εκείνο το σχόλιο απαγορεύει.
   * Το κλειδί τους ζει **μόνο** στη συλλογή συνδέσεων (ποια δήλωση εγκρίθηκε) και τίποτα δεν
   * το αποθηκεύει ως ταυτότητα γραμμής — άρα το πρόθεμα είναι σκέτο namespace δήλωσης.
   */
  readonly keyPrefix: string;
  readonly identity: SurveyRowIdentity;
}

/**
 * Το namespace του κλειδιού δήλωσης μιας **παρατήρησης**.
 *
 * ⚠️ **ΔΕΝ είναι enterprise id prefix και ΔΕΝ ανήκει στο μητρώο** — δες `keyPrefix`. Ενικός
 * επίτηδες: ονομάζει **μία δήλωση** του σχεδίου, όχι τη λίστα της καρτέλας.
 */
const REMARK_STATEMENT_PREFIX = 'remark';

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
    keyPrefix: ENTERPRISE_ID_PREFIXES.SURVEY_ACT,
    identity: {
      by: 'row-id',
      // ⚠️ Το εργοστάσιο καλείται και η **ταυτότητά** του αντικαθίσταται: έτσι υπάρχει ένας
      // μόνο ορισμός του «τι είναι κενή πράξη», και η ταυτότητα μένει το μόνο που αλλάζει.
      upsert: (record, rowId) =>
        upsertRowById(record, lens, rowId, (id) => ({ ...newInstitutionalAct(), id })),
    },
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
  remarks: {
    section: SURVEY_REMARKS_SECTION,
    documentKey: 'remarks',
    keyPrefix: REMARK_STATEMENT_PREFIX,
    identity: { by: 'text' },
  },
  approvals: {
    section: SURVEY_APPROVALS_SECTION,
    documentKey: 'approvals',
    keyPrefix: ENTERPRISE_ID_PREFIXES.SURVEY_APPROVAL,
    identity: {
      by: 'row-id',
      upsert: (record, rowId) =>
        upsertRowById(record, approvalLens, rowId, (id) => ({ ...newSurveyApproval(), id })),
    },
  },
  titleDeeds: {
    section: SURVEY_TITLE_DEEDS_SECTION,
    documentKey: 'titleDeeds',
    keyPrefix: ENTERPRISE_ID_PREFIXES.SURVEY_TITLE_DEED,
    identity: {
      by: 'row-id',
      upsert: (record, rowId) =>
        upsertRowById(record, titleDeedLens, rowId, (id) => ({ ...newSurveyTitleDeed(), id })),
    },
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
 * Το πεδίο κειμένου της γραμμής `index` που φέρει αυτό το μέρος.
 *
 * ⚠️ Το `throw` είναι **δομικά απροσπέλαστο** από τη ζωντανή ροή: το λεξιλόγιο μερών και οι
 * accessors ελέγχονται για ισότητα από πύλη. Υπάρχει γιατί η εναλλακτική — σιωπηλή
 * παράλειψη — θα έγραφε γραμμή **χωρίς** το μέρος της, χωρίς κανένα σήμα. Ένα test το
 * εκτελεί, ώστε να είναι ελεγμένος φύλακας και όχι νεκρός κώδικας.
 */
function rowTextField(
  section: SurveyListSection,
  index: number,
  part: DocumentBodyPartKey,
): TextFieldAccessor {
  const accessor = section.rowFields(index).find((field) => field.part === part);
  if (!accessor || accessor.kind !== 'text') {
    throw new Error(`applySurveyRowBinding: part "${part}" has no text field on the row`);
  }
  return accessor;
}

/** Γράφει ένα μέρος κειμένου μέσα από **τον accessor της καρτέλας**. */
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

  return rowTextField(section, index, value.part).write(
    record,
    surveySourced(value.value, value.rawText),
  );
}

// ── Value objects: ταυτότητα ΧΩΡΙΣ id (Φ4β για τα ΦΕΚ, Φ4γ για τις παρατηρήσεις) ──────

/**
 * Μια λίστα από **value objects**, στην ελάχιστη όψη που χρειάζεται το «βρες το ή πρόσθεσέ το».
 *
 * 🔑 Δύο πολύ διαφορετικά πράγματα τη γεμίζουν — τα ΦΕΚ **μέσα σε μία πράξη** και οι
 * παρατηρήσεις **στη ρίζα της εγγραφής** — και αυτό είναι ακριβώς το νόημα: το ερώτημα
 * *«υπάρχει ήδη αυτή η δήλωση;»* είναι **ένα**, όσο κι αν διαφέρουν οι δύο διαδρομές προς
 * τα δεδομένα.
 */
interface ValueRowList {
  count(record: SurveyRecord): number;
  appendRow(record: SurveyRecord): SurveyRecord;
  /** Το κείμενο που **φέρει** η γραμμή `index` — η ταυτότητά της· `null` όταν δεν φέρει. */
  shownText(record: SurveyRecord, index: number): string | null;
  write(record: SurveyRecord, index: number, value: SurveyRowPartValue): SurveyRecord;
}

/**
 * Προσθέτει το value object **αν η λίστα δεν το λέει ήδη**.
 *
 * 🔴 **Η ταυτοδυναμία χωρίς ταυτότητα** (ADR-759 §4.11). Ένα value object δεν έχει id, άρα
 * «ίδια γραμμή» σημαίνει **ίδιο κείμενο**. Δύο πράγματα κερδίζονται μαζί: δεύτερη Έγκριση δεν
 * διπλασιάζει, και ό,τι πρόσθεσε ο μηχανικός με το χέρι **επιβιώνει** — η λίστα εμπλουτίζεται,
 * δεν αντικαθίσταται.
 *
 * ⚠️ **Βρέθηκε ⇒ δεν αγγίζεται.** Η εναλλακτική («ξαναγράψ' το, είναι το ίδιο») θα άλλαζε την
 * `provenance` μιας γραμμής που έγραψε **άνθρωπος** σε `'survey'` — δηλαδή θα απέδιδε στο
 * σχέδιο πρόταση που πληκτρολόγησε ο μηχανικός. Το «ποιος το έγραψε» είναι όλο το νόημα του
 * `Sourced` (§5.3).
 *
 * ⚠️ Η σύγκριση γίνεται στο **κείμενο που δείχνει η γραμμή** (`value ?? rawText`), όχι στο ωμό:
 * το σχέδιο γράφει «οικόπεδο**  **δεν» με διπλό κενό, ο άνθρωπος πληκτρολογεί ένα. Ίδια
 * πρόταση, δύο γραφές — και για τα ΦΕΚ οι δύο όψεις **ταυτίζονται** (το `gazette` δεν
 * αναλύεται, άρα `value === rawText`), οπότε η συμπεριφορά τους μένει κατά λέξη η ίδια.
 */
function upsertValueRow(
  record: SurveyRecord,
  rows: ValueRowList,
  value: SurveyRowPartValue,
): SurveyRecord {
  const text = value.value ?? value.rawText;
  const count = rows.count(record);

  for (let i = 0; i < count; i += 1) {
    if (rows.shownText(record, i) === text) return record;
  }
  return rows.write(rows.appendRow(record), count, value);
}

/** Τα ΦΕΚ της πράξης `actIndex` — value objects **μέσα** σε rooted γραμμή. */
function gazetteRows(section: SurveyListSection, actIndex: number): ValueRowList {
  const sub = section.gazettes;
  if (!sub) {
    throw new Error('applySurveyRowBinding: this list section declares no gazette sub-list');
  }
  const rawTextField = (gazetteIndex: number): GazetteTextField => {
    const field = sub.fields(actIndex, gazetteIndex).find((f) => f.part === 'rawText');
    if (!field || field.kind !== 'text') {
      throw new Error('applySurveyRowBinding: the gazette reference has no rawText field');
    }
    return field;
  };

  return {
    count: (from) => sub.count(from, actIndex),
    appendRow: (from) => sub.appendRow(from, actIndex),
    // Το ΦΕΚ αποθηκεύεται **αυτούσιο** (Q3): η μόνη του όψη είναι το `rawText` του.
    shownText: (from, index) => rawTextField(index).read(from) || null,
    write: (from, index, next) => rawTextField(index).write(from, next.rawText),
  };
}

/** Οι γραμμές μιας ενότητας που **είναι** το κείμενό τους — η ενότητα Η. */
function sourcedRows(section: SurveyListSection, part: DocumentBodyPartKey): ValueRowList {
  return {
    count: (from) => section.count(from),
    appendRow: (from) => section.appendRow(from),
    shownText: (from, index) => {
      const current = rowTextField(section, index, part).read(from);
      return current.value ?? current.rawText ?? null;
    },
    write: (from, index, next) =>
      rowTextField(section, index, part).write(from, surveySourced(next.value, next.rawText)),
  };
}

/** Τι άλλαξε η προσγείωση μιας γραμμής: η νέα εγγραφή, και **ποιο** κλειδί θέλει εγγραφή. */
export interface SurveyRowPatch {
  readonly record: SurveyRecord;
  readonly documentKey: keyof SurveyRecord;
}

/**
 * Γράφει **μία γραμμή** του σχεδίου μέσα σε μια εγγραφή τοπογραφικού, με προέλευση `'survey'`.
 *
 * Καθαρή: δέχεται και επιστρέφει `SurveyRecord`. Ιδεοδύναμη και στις **δύο** ταυτότητες:
 * δεύτερη κλήση με το ίδιο `rowId` ξαναγράφει την ίδια rooted γραμμή· δεύτερη κλήση με το ίδιο
 * κείμενο δεν προσθέτει δεύτερο value object.
 */
export function applySurveyRowBinding(
  record: SurveyRecord,
  list: DocumentBodyListKey,
  rowId: string,
  parts: readonly SurveyRowPartValue[],
): SurveyRowPatch {
  const spec = SURVEY_ROW_LISTS[list];

  // 🔴 Value object: η γραμμή **είναι** το μέρος της. Δεν υπάρχει θέση να «σπαρθεί» πρώτη και
  // μετά να γεμίσει — το `rowId` εδώ ονομάζει τη **δήλωση του σχεδίου**, όχι γραμμή καρτέλας.
  if (spec.identity.by === 'text') {
    const next = parts.reduce(
      (acc, value) => upsertValueRow(acc, sourcedRows(spec.section, value.part), value),
      record,
    );
    return { record: next, documentKey: spec.documentKey };
  }

  const seeded = spec.identity.upsert(record, rowId);
  let next = seeded.record;
  for (const value of parts) {
    next =
      value.part === 'gazette'
        ? upsertValueRow(next, gazetteRows(spec.section, seeded.index), value)
        : writeTextPart(next, spec.section, seeded.index, value);
  }
  return { record: next, documentKey: spec.documentKey };
}
