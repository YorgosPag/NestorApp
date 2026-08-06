/**
 * Η ΕΓΚΡΙΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΗ ΒΑΣΗ — `survey_records` μέσα από `approveTitleBlockProposal`,
 * με τα ζωντανά `firestore.rules` πάνω σε αληθινό emulator (ADR-759 §Θ.1).
 *
 * ## Τι ρωτά αυτή η σουίτα, και γιατί κανένα υπάρχον test δεν το ρωτούσε
 *
 * Οι Φ2–Φ4γ παρέδωσαν **3.111 πράσινα tests** και **κανείς δεν έχει πατήσει Έγκριση σε
 * ζωντανή βάση** — ούτε για βαθμωτό, ούτε για γραμμή, ούτε για παρατήρηση. Τα δύο μισά
 * υπήρχαν και δεν συναντήθηκαν ποτέ:
 *
 *   - `tests/firestore-rules/suites/survey-records.rules.test.ts` σπέρνει έγγραφα
 *     **απευθείας** — ο writer δεν τρέχει ποτέ, άρα τα rules δεν είδαν ποτέ τα bytes του.
 *   - `src/**\/__tests__/**` τρέχει τον writer με **mock** Firestore — και ένα mock γράφει
 *     σε **μνήμη**, όπου τα πάντα επιβιώνουν επειδή τίποτα δεν ταξιδεύει.
 *
 * Είναι κατά λέξη το ίδιο κενό που περιγράφει το `firestore-seam.ts` για τον converter των
 * επαφών, ένα επίπεδο πιο μέσα. Η **ένωση** δεν τρέχτηκε ποτέ.
 *
 * ## 🔴 Η υπόθεση που γέννησε τη σουίτα, και η μέτρησή της
 *
 * `firestoreQueryService.update` καλεί `sanitizeForFirestore` και μετά `updateDoc`. Ο
 * καθαριστής **δεν κατεβαίνει σε πίνακες** (`firestore-sanitize.ts:43` — ο κλάδος
 * αναδρομής απαιτεί `isPlainObject && !Array.isArray`), και η προστασία που υπόσχεται το
 * επικεφαλίδα του αρχείου (*«Firestore REJECTS `undefined`· αυτή η συνάρτηση ΠΡΕΠΕΙ να
 * καλείται σε κάθε εγγραφή»*) είναι επομένως **δομικά ανύπαρκτη** ακριβώς για τα τέσσερα
 * κλειδιά που γράφει αυτή η φάση: `institutionalActs` (πίνακες **μέσα σε** πίνακες),
 * `remarks`, `approvals`, `titleDeeds`.
 *
 * Και το `Sourced.rawText` είναι **προαιρετικό**. Άρα το ερώτημα δεν είναι φιλολογικό: μια
 * λίστα κρατά δίπλα-δίπλα γραμμές **με** και **χωρίς** το κλειδί, και μόνο μια πραγματική
 * μεταφορά μπορεί να πει τι φτάνει στην άλλη άκρη. Οι τρεις εγγραφές παρακάτω κρατούν
 * **και τα δύο σχήματα ταυτόχρονα** σε κάθε λίστα, γι' αυτόν ακριβώς τον λόγο.
 *
 * ## Γιατί η σπορά γίνεται με ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟΥΣ κανόνες
 *
 * Το υπό εξέταση είναι η **εγγραφή**, όχι η δημιουργία. Η σπορά χρησιμοποιεί παρ' όλα αυτά
 * το πραγματικό `createEmptySurveyRecord`, ώστε το έγγραφο που θα δουν τα rules να είναι
 * bytes **παραγωγικού εργοστασίου** — που είναι το τρίτο ερώτημα του §Γ: το
 * `scope immutability` και το `confirmation freeze` ελέγχθηκαν μόνο με χειρόγραφα fixtures.
 *
 * ## Γιατί ΠΟΤΕ `super_admin`
 *
 * Ο κανόνας UPDATE έχει σκέλος `isSuperAdminOnly()` που παρακάμπτει τον έλεγχο μισθωτή.
 * Κάθε έγκριση εδώ γίνεται από πραγματικό `company_admin` του **ίδιου** μισθωτή.
 *
 * @see tests/service-integration/_harness/firestore-seam.ts (η μία ραφή)
 * @see ADR-759 §4.10, §4.11 (τι χτίστηκε) · §Θ.1 (γιατί αυτό έπρεπε να τρέξει)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { initEmulator, teardownEmulator, resetData } from '../../firestore-rules/_harness/emulator';
import { withSeedContext } from '../../firestore-rules/_harness/auth-contexts';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../../firestore-rules/_registry/personas';
import { withPersona, readRaw, listRaw } from '../_harness/firestore-seam';

// Η μία ραφή: ο παραγωγικός κώδικας κρατά το δικό του `@/lib/firebase`, αλλά το handle που
// παίρνει είναι ο emulator δεμένος στην ταυτότητα που ενεργεί.
jest.mock('@/lib/firebase', () => require('../_harness/firestore-seam').firebaseSeam);

import { approveTitleBlockProposal } from '@/services/title-block-apply';
import { listTitleBlockBindings } from '@/services/title-block-binding.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { cellRef } from '@/lib/title-block-binding-id';
import { surveyRowKey } from '@/services/enterprise-id-composite-keys';
import { SURVEY_ROW_LISTS, type SurveyRowPartValue } from '@/config/survey-row-bindings';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import {
  emptySourced,
  surveySourced,
  userSourced,
  type SurveyRecord,
} from '@/types/project-survey-record';
import type { BindingProposal, BindingTarget } from '@/types/title-block-binding';
import type { DocumentBodyListKey } from '@/types/document-body-reading';

const RECORDS = COLLECTIONS.SURVEY_RECORDS;
const BINDINGS = COLLECTIONS.TITLE_BLOCK_BINDINGS;

const ADMIN = PERSONA_CLAIMS.same_tenant_admin.uid;

const PROJECT_ID = 'proj_g753';
const RECORD_ID = 'svrec_g753_purchase';
const FILE_RECORD_ID = 'file_g753';
const LEVEL_ID = 'level_ground';
const LAYER = 'PINAKAKI 500';

/** Σταθερή ώρα: το `createdAt`/`updatedAt` της σποράς δεν είναι υπό εξέταση εδώ. */
const SEEDED_AT = '2026-08-06T09:00:00.000Z';

/**
 * Το σημείο εισαγωγής του εγγράφου «ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ» του G753.
 *
 * 🔑 **Ένα** σημείο για **όλες** τις γραμμές, και αυτό δεν είναι απλοποίηση του fixture: τα
 * τέσσερα έγγραφα του σώματος είναι **ένα MTEXT το καθένα**, άρα και οι έντεκα δηλώσεις
 * μοιράζονται ταυτόσημο `at` (ADR-759 §4.10). Είναι ακριβώς ο λόγος που το slot μιας γραμμής
 * είναι το `rowId` της και όχι το κελί — και ένα fixture με χωριστά σημεία θα άφηνε αυτή την
 * απόφαση αμάρτυρη.
 */
const BODY_AT = { x: 2140.75, y: -318.5 } as const;

/** Η πινακίδα — άλλο σημείο, γιατί τα βαθμωτά έρχονται από κελί πινακίδας. */
const TITLE_BLOCK_AT = { x: 1580.25, y: -96.125 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Οι δηλώσεις του σχεδίου, αυτούσιες
// ─────────────────────────────────────────────────────────────────────────────

/** «1364,05» — το εμβαδόν όπως το γράφει το G753, με **κόμμα**. */
const PLOT_AREA_RAW = '1364,05';
const PLOT_AREA_VALUE = 1364.05;

/** Γραμμή 05 της ενότητας Α′, με το ΦΕΚ της στη στήλη 2. */
const ACT_REFERENCE_RAW = 'ΔΠ/ΠΜ/28941/775/15.9.1993 Α.Ν.Θ.';
const ACT_GAZETTE_RAW = 'ΦΕΚ 1220Δ/29-09-1993';

/**
 * Η παρατήρηση της ενότητας Η — **με το διπλό κενό του σχεδίου**.
 *
 * Δεν είναι τυπογραφικό λάθος του fixture: κανένας άνθρωπος δεν πληκτρολογεί έτσι, και η
 * σύγκριση ταυτότητας της Φ4γ γίνεται στο κείμενο που **δείχνει** η γραμμή γι' αυτόν
 * ακριβώς τον λόγο. Ένα «τακτοποιημένο» fixture θα άφηνε την απόφαση αμάρτυρη.
 */
const REMARK_RAW = 'Από το οικόπεδο  δεν διέρχεται ρεύμα υψηλής τάσης';

// ─────────────────────────────────────────────────────────────────────────────
// Οι γείτονες — ό,τι ΠΡΕΠΕΙ να επιβιώσει κάθε εγγραφής
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Μια εγγραφή που ο μηχανικός έχει **ήδη** δουλέψει: κάθε λίστα κρατά περιεχόμενο, και
 * κάθε λίστα κρατά **και τα δύο σχήματα** του `Sourced` — με `rawText` (μεταγραφή) και
 * **χωρίς** (πληκτρολόγηση).
 *
 * 🔴 Η ανάμειξη είναι όλο το νόημα. Το `updateDoc` γράφει **ολόκληρο** το κλειδί πρώτου
 * επιπέδου, οπότε το `remarks` που φεύγει με την έγκριση της παρατήρησης κουβαλά μαζί του
 * και τη χειρόγραφη γραμμή. Αν η μεταφορά τα πείραζε — απορρίπτοντας το απόν κλειδί,
 * ισοπεδώνοντας το ένα σχήμα στο άλλο — θα φαινόταν **μόνο** εδώ, και μόνο σε πραγματική
 * βάση.
 */
function seededRecord(overrides: Partial<SurveyRecord> = {}): SurveyRecord {
  const base = createEmptySurveyRecord({
    companyId: SAME_TENANT_COMPANY_ID,
    projectId: PROJECT_ID,
    createdBy: ADMIN,
    now: SEEDED_AT,
    sourceFileName: 'G753_ergasia F.dxf',
  });

  return {
    ...base,
    id: RECORD_ID,

    // Βαθμωτός γείτονας, πληκτρολογημένος: `provenance: 'user'`, **χωρίς** `rawText`.
    heightDatum: userSourced('ΕΓΣΑ 87'),

    // Ένθετος πίνακας μέσα σε πίνακα — το βαθύτερο σημείο του σχήματος.
    institutionalActs: {
      ...base.institutionalActs,
      generalUrbanPlan: [
        {
          id: 'svact_typed_by_hand',
          reference: userSourced('Γ.Π.Σ. Δήμου Ευόσμου'),
          gazettes: [
            { rawText: 'ΦΕΚ 115/Δ/1994', number: '115', series: 'Δ', date: null, relation: null },
          ],
          note: emptySourced<string>(),
        },
      ],
    },

    // Value objects χωρίς id, το ένα μεταγραμμένο και το άλλο πληκτρολογημένο.
    remarks: [
      userSourced('Το ακίνητο δεν βαρύνεται με δουλείες'),
      surveySourced('Ισχύει η υπ. αριθμ. 39 πράξη εφαρμογής', 'Ισχύει η υπ. αριθμ. 39 πράξη εφαρμογής'),
    ],

    approvals: [
      {
        id: 'svapr_typed_by_hand',
        subject: userSourced('ΒΕΒΑΙΩΣΗ ΥΨΟΜΕΤΡΩΝ'),
        authority: userSourced('Δήμου Κορδελιού - Ευόσμου'),
        protocolNumber: emptySourced<string>(),
        date: emptySourced<string>(),
      },
    ],

    titleDeeds: [
      {
        id: 'svdeed_typed_by_hand',
        number: userSourced('2946'),
        date: userSourced('1993-01-18'),
        kind: userSourced('Γονικής Παροχής'),
        notaryName: surveySourced('ΠΑΠΠΑ ΕΛΕΝΗ', 'ΠΑΠΠΑ ΕΛΕΝΗ'),
        notaryContactId: null,
        volume: emptySourced<string>(),
        entry: userSourced('262'),
        registry: emptySourced<string>(),
      },
    ],

    ...overrides,
  };
}

/**
 * Βάζει το έγγραφο στη βάση με τους κανόνες **απενεργοποιημένους**.
 *
 * Η δημιουργία δεν είναι το υπό εξέταση· η **εγγραφή** είναι. Τα bytes όμως είναι
 * παραγωγικά (`createEmptySurveyRecord`), ώστε τα rules να κρίνουν έγγραφο που το σύστημα
 * θα έφτιαχνε πράγματι — το τρίτο ερώτημα του §Γ.
 */
async function seed(env: RulesTestEnvironment, record: SurveyRecord): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(RECORDS).doc(record.id).set(record);
  });
}

/** Το έγγραφο όπως κάθεται **στη βάση**, τυποποιημένο όσο χρειάζεται για να διαβαστεί. */
async function storedRecord(env: RulesTestEnvironment): Promise<SurveyRecord> {
  const raw = await readRaw(env, RECORDS, RECORD_ID);
  if (!raw) throw new Error('survey record vanished from the emulator');
  return raw as unknown as SurveyRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// Οι τρεις προτάσεις — μία ανά είδος εγγραφής
// ─────────────────────────────────────────────────────────────────────────────

interface Approval {
  readonly proposal: BindingProposal;
  readonly target: BindingTarget;
}

function bodyProposal(list: DocumentBodyListKey, snapshotValue: string): BindingProposal {
  return {
    fieldKey: list,
    titleBlockIndex: 0,
    // Ένα MTEXT ανά έγγραφο ⇒ **η ίδια** σημαδούρα για κάθε γραμμή του (§4.10).
    sourceHandle: 'mtext_body_1',
    labelHandle: 'mtext_body_1',
    at: BODY_AT,
    snapshotValue,
    candidates: [],
  };
}

/** Η ταυτότητα της δήλωσης, χτισμένη από τα **παραγωγικά** SSoT — ποτέ με το χέρι. */
function rowId(list: DocumentBodyListKey, ordinal: number): string {
  return surveyRowKey(SURVEY_ROW_LISTS[list].keyPrefix, [
    cellRef(BODY_AT),
    list,
    String(ordinal),
  ]);
}

function rowApproval(
  list: DocumentBodyListKey,
  ordinal: number,
  parts: readonly SurveyRowPartValue[],
  snapshotValue: string,
): Approval {
  return {
    proposal: bodyProposal(list, snapshotValue),
    target: {
      kind: 'survey-record-row',
      projectId: PROJECT_ID,
      recordId: RECORD_ID,
      list,
      rowId: rowId(list, ordinal),
      parts,
    },
  };
}

/** (α) Βαθμωτό — «ΕΜΒΑΔΟΝ» της πινακίδας → `plotArea`. */
const SCALAR: Approval = {
  proposal: {
    fieldKey: 'plotArea',
    titleBlockIndex: 0,
    sourceHandle: 'mtext_31',
    labelHandle: 'mtext_30',
    at: TITLE_BLOCK_AT,
    snapshotValue: PLOT_AREA_RAW,
    candidates: [],
  },
  target: {
    kind: 'survey-record',
    projectId: PROJECT_ID,
    recordId: RECORD_ID,
    field: 'plotArea',
    value: { kind: 'number', value: PLOT_AREA_VALUE },
  },
};

/** (β) Γραμμή λίστας — θεσμική πράξη με το ΦΕΚ της. */
const ROW: Approval = rowApproval(
  'urbanPlanDecree',
  0,
  [
    { part: 'reference', value: ACT_REFERENCE_RAW, rawText: ACT_REFERENCE_RAW },
    { part: 'gazette', value: ACT_GAZETTE_RAW, rawText: ACT_GAZETTE_RAW },
  ],
  `${ACT_REFERENCE_RAW}\t\t${ACT_GAZETTE_RAW}`,
);

/** (γ) Παρατήρηση — value object χωρίς ταυτότητα. */
const REMARK: Approval = rowApproval(
  'remarks',
  0,
  [{ part: 'remark', value: REMARK_RAW, rawText: REMARK_RAW }],
  REMARK_RAW,
);

/** Και τα τρία μαζί — ό,τι εκτελείται σε κάθε έλεγχο «οι γείτονες επιβιώνουν». */
const EVERY_KIND: readonly (readonly [string, Approval])[] = [
  ['βαθμωτό πεδίο', SCALAR],
  ['γραμμή λίστας', ROW],
  ['παρατήρηση', REMARK],
];

/** Το φορτίο που χτίζει το `useTitleBlockApproval` όταν ο άνθρωπος πατά Έγκριση. */
function approvalInput(
  which: Approval,
  overrides: {
    userId?: string;
    companyId?: string;
    /**
     * Ό,τι κρατά ήδη η παλέτα για αυτό το σχέδιο — η **εμβέλεια** μέσα στην οποία ψάχνεται
     * το supersede.
     *
     * 🔴 **Η προεπιλογή `[]` είναι ασφαλής ΜΟΝΟ όσο το test δεν ρωτά για supersede.** Με
     * κενή λίστα το `findSameSlotActive` δεν βρίσκει ποτέ τίποτα, άρα κάθε ισχυρισμός
     * «δεν πατήθηκε η προηγούμενη» περνά **ανεξάρτητα από το slot** — μετρημένο: η
     * μετάλλαξη «slot = η λίστα αντί για το rowId» **επέζησε** μέχρι να μπει αυτή η
     * παράμετρος. Είναι κατά λέξη το «αποδεικνύεις τον γείτονα, όχι τον φύλακα» που η
     * αδελφή σουίτα καταγράφει δύο φορές (M4, M8).
     */
    existingBindings?: Parameters<typeof approveTitleBlockProposal>[0]['existingBindings'];
  } = {},
) {
  return {
    proposal: which.proposal,
    target: which.target,
    fileRecordId: FILE_RECORD_ID,
    levelId: LEVEL_ID,
    layerName: LAYER,
    ctx: {
      userId: overrides.userId ?? ADMIN,
      companyId: overrides.companyId ?? SAME_TENANT_COMPANY_ID,
      snapshotValue: which.proposal.snapshotValue,
    },
    existingBindings: overrides.existingBindings ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Η ΕΓΚΡΙΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΗ ΒΑΣΗ — το τοπογραφικό επιβιώνει της μεταφοράς', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  /** Σπέρνει, εγκρίνει ως πραγματικός `company_admin`, επιστρέφει την ετυμηγορία. */
  async function approve(which: Approval, record: SurveyRecord = seededRecord()) {
    await seed(env, record);
    return withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(which)),
    );
  }

  // ── (α)(β)(γ) Τα τρία είδη γράφονται ───────────────────────────────────────

  describe('τα τρία είδη δήλωσης φτάνουν στη βάση', () => {
    it('(α) γράφει το βαθμωτό πεδίο με την προέλευσή του ακέραιη', async () => {
      // Το `value` **δίνεται** από τον Λ2, δεν ξανα-αναλύεται· το `rawText` είναι ό,τι
      // έγραφε το σχέδιο. Και τα δύο πρέπει να φτάσουν, αλλιώς η καρτέλα δεν μπορεί να
      // απαντήσει «σε έξι μήνες, ποιος το έγραψε αυτό;» (§5.3).
      expect(await approve(SCALAR)).toMatchObject({ success: true });

      expect((await storedRecord(env)).plotArea).toEqual({
        value: PLOT_AREA_VALUE,
        provenance: 'survey',
        rawText: PLOT_AREA_RAW,
      });
    });

    it('(β) γράφει τη γραμμή λίστας — μαζί με τον ένθετο πίνακα ΦΕΚ της', async () => {
      // Ο πίνακας μέσα στον πίνακα είναι το βαθύτερο σχήμα που ταξιδεύει, και ακριβώς
      // αυτό που ο καθαριστής δεν επισκέπτεται ποτέ.
      expect(await approve(ROW)).toMatchObject({ success: true });

      const acts = (await storedRecord(env)).institutionalActs.urbanPlanDecree;
      expect(acts).toHaveLength(1);
      expect(acts[0]?.id).toBe(rowId('urbanPlanDecree', 0));
      expect(acts[0]?.reference).toEqual({
        value: ACT_REFERENCE_RAW,
        provenance: 'survey',
        rawText: ACT_REFERENCE_RAW,
      });
      expect(acts[0]?.gazettes).toEqual([
        { rawText: ACT_GAZETTE_RAW, number: null, series: null, date: null, relation: null },
      ]);
    });

    it('(γ) γράφει την παρατήρηση — με το διπλό κενό του σχεδίου αυτούσιο', async () => {
      // Η παρατήρηση **είναι** το κείμενό της (Φ4γ). Μια μεταφορά που «τακτοποιεί» κενά
      // θα έσπαγε την ταυτοδυναμία της επόμενης έγκρισης, σιωπηλά.
      expect(await approve(REMARK)).toMatchObject({ success: true });

      const { remarks } = await storedRecord(env);
      expect(remarks).toHaveLength(3);
      expect(remarks[2]).toEqual({
        value: REMARK_RAW,
        provenance: 'survey',
        rawText: REMARK_RAW,
      });
    });
  });

  // ── (δ) Ο πυρήνας: οι γείτονες ─────────────────────────────────────────────

  describe('(δ) τα γειτονικά κλειδιά επιβιώνουν — το ερώτημα που κανένα mock δεν απαντά', () => {
    /**
     * Ό,τι δεν αγγίζει η έγκριση, όπως το έσπειρε ο μηχανικός.
     *
     * 🔴 Συγκρίνεται με `toEqual` και **ολόκληρο**, όχι με `toMatchObject`: μια
     * υποσύνολο-σύγκριση θα περνούσε ενώ το `rawText` έχει εξαφανιστεί ή ένα `undefined`
     * έχει γίνει `null`. Το κλειδί που **λείπει** είναι το εύρημα, όχι το κλειδί που
     * υπάρχει.
     */
    function untouched(record: SurveyRecord) {
      return {
        heightDatum: record.heightDatum,
        generalUrbanPlan: record.institutionalActs.generalUrbanPlan,
        approvals: record.approvals,
        titleDeeds: record.titleDeeds,
        remarks: record.remarks,
        surveyDate: record.surveyDate,
        buildingTerms: record.buildingTerms,
        settlement: record.settlement,
      };
    }

    /**
     * Ποιο κλειδί του `untouched()` αλλάζει **νόμιμα** ανά είδος έγκρισης.
     *
     * Κανένα για το βαθμωτό (`plotArea` δεν είναι γείτονας κανενός) και για τη γραμμή (η
     * `urbanPlanDecree` δεν είναι η `generalUrbanPlan` που κρατά ο μάρτυρας) — μόνο η
     * παρατήρηση γράφει μέσα στη λίστα που παρακολουθείται, και γι' αυτήν υπάρχει ο
     * χωριστός έλεγχος «εμπλουτίζει, δεν αντικαθιστά» ακριβώς από κάτω.
     */
    const WRITES_INTO: ReadonlyMap<Approval, string> = new Map([[REMARK, 'remarks']]);

    it.each(EVERY_KIND)(
      'η έγκριση «%s» αφήνει κάθε άλλο κλειδί ακέραιο',
      async (_label, which) => {
        const before = seededRecord();
        expect(await approve(which, before)).toMatchObject({ success: true });

        const expected = untouched(before);
        const actual = untouched(await storedRecord(env));
        const touched = WRITES_INTO.get(which);

        for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
          if (key === touched) continue;
          // Ένα κλειδί ανά ισχυρισμό: μια συνολική σύγκριση θα ονόμαζε τη διαφορά μία
          // φορά και θα έκρυβε τις υπόλοιπες.
          expect({ [key]: actual[key] }).toEqual({ [key]: expected[key] });
        }
      },
    );

    it('η έγκριση παρατήρησης ΕΜΠΛΟΥΤΙΖΕΙ τη λίστα — δεν την αντικαθιστά', async () => {
      // Το `updateDoc` γράφει **ολόκληρο** το `remarks`. Ένας writer που έστελνε μόνο τη
      // νέα γραμμή θα έσβηνε ό,τι πληκτρολόγησε ο άνθρωπος — χωρίς σφάλμα, χωρίς μήνυμα.
      const before = seededRecord();
      await approve(REMARK, before);

      const { remarks } = await storedRecord(env);
      expect(remarks.slice(0, 2)).toEqual(before.remarks);
    });

    it('🔴 το ΑΠΟΝ `rawText` μένει απόν — ο καθαριστής δεν κατεβαίνει σε πίνακες', async () => {
      // Η μία υπόθεση της §Γ.2, μετρημένη στην άλλη άκρη του καλωδίου. Το
      // `userSourced()` **παραλείπει** το κλειδί· το `sanitizeForFirestore` μετατρέπει
      // `undefined → null` αλλά **μόνο** σε απλά αντικείμενα. Αν μια γραμμή γύριζε με
      // `rawText: null`, η καρτέλα θα σταματούσε να λέει «κενό στο σχέδιο» και θα άρχιζε
      // να δείχνει άδειο πλαίσιο κειμένου — αλλαγή νοήματος χωρίς αλλαγή κώδικα.
      await approve(REMARK);

      const { remarks, approvals } = await storedRecord(env);

      expect(Object.keys(remarks[0] ?? {})).toEqual(['value', 'provenance']);
      expect(Object.keys(remarks[1] ?? {}).sort()).toEqual(['provenance', 'rawText', 'value']);
      expect(Object.keys(approvals[0]?.subject ?? {})).toEqual(['value', 'provenance']);
    });
  });

  // ── (ε) Ταυτοδυναμία, στη βάση ─────────────────────────────────────────────

  describe('(ε) η δεύτερη Έγκριση δεν διπλασιάζει — μετρημένο στη βάση', () => {
    /** Εγκρίνει **δύο** φορές την ίδια δήλωση, με το ίδιο ακριβώς φορτίο. */
    async function approveTwice(which: Approval) {
      await seed(env, seededRecord());
      await withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(which)),
      );
      return withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(which)),
      );
    }

    it('η γραμμή με ταυτότητα γράφεται ξανά στην ΙΔΙΑ θέση', async () => {
      // `upsertRowById`: ίδιο `rowId` ⇒ ίδια γραμμή. Χωρίς αυτό ο μηχανικός θα έσβηνε
      // γραμμές που εφηύρε το σύστημα.
      expect(await approveTwice(ROW)).toMatchObject({ success: true });

      const acts = (await storedRecord(env)).institutionalActs.urbanPlanDecree;
      expect(acts).toHaveLength(1);
      expect(acts[0]?.gazettes).toHaveLength(1);
    });

    it('η παρατήρηση ΧΩΡΙΣ ταυτότητα δεν προστίθεται δεύτερη φορά', async () => {
      // Ταυτοδυναμία χωρίς ταυτότητα (Φ4γ): η ταυτότητα είναι το κείμενο που **δείχνει**
      // η γραμμή. Είναι η μόνη από τις τρεις διαδρομές που δεν έχει `id` να συγκρίνει.
      expect(await approveTwice(REMARK)).toMatchObject({ success: true });

      expect((await storedRecord(env)).remarks).toHaveLength(3);
    });

    it('το βαθμωτό πεδίο γράφεται δύο φορές στην ίδια θέση, χωρίς ίχνος', async () => {
      expect(await approveTwice(SCALAR)).toMatchObject({ success: true });

      expect((await storedRecord(env)).plotArea).toEqual({
        value: PLOT_AREA_VALUE,
        provenance: 'survey',
        rawText: PLOT_AREA_RAW,
      });
      expect(await listRaw(env, BINDINGS)).toHaveLength(1);
    });
  });

  // ── (στ)(ζ) Οι φύλακες, με πραγματική άρνηση από πίσω ──────────────────────

  describe('(στ)(ζ) οι φύλακες μιλούν με κωδικό, και δεν αφήνουν ίχνος', () => {
    it.each(EVERY_KIND)(
      'παγωμένη εγγραφή απορρίπτει «%s» με SURVEY_RECORD_LOCKED',
      async (_label, which) => {
        // Ο φύλακας ζει στον writer ώστε η οθόνη να πάρει **λόγο**, όχι ανεξήγητο
        // permission error. Και τα rules θα αρνούνταν έτσι κι αλλιώς — γι' αυτό ο
        // έλεγχος «τίποτα δεν άλλαξε» παρακάτω δεν είναι πλεονασμός: αποδεικνύει ότι ο
        // κώδικας σταμάτησε **πριν** τη γραμμή, όχι ότι τον σταμάτησε η βάση.
        const frozen = seededRecord({ confirmedBy: ADMIN, confirmedAt: SEEDED_AT });
        const result = await approve(which, frozen);

        expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_LOCKED' });
        expect(await storedRecord(env)).toEqual(frozen);
        expect(await listRaw(env, BINDINGS)).toHaveLength(0);
      },
    );

    it('ξένος μισθωτής παίρνει SURVEY_RECORD_MISSING — ποτέ «ανήκει σε άλλον»', async () => {
      // 🔴 Ο ξεχωριστός κωδικός θα ήταν **μαντείο ύπαρξης**: «ανήκει σε άλλον»
      // επιβεβαιώνει ότι το id υπάρχει. Το `getSurveyRecord` είναι `getById`, δηλαδή δεν
      // περνά από φίλτρο μισθωτή (CHECK 3.35) — άρα η σιωπή είναι ο **μόνος** φύλακας,
      // και εδώ εκτελείται εναντίον εγγράφου που πράγματι υπάρχει.
      const foreign = seededRecord({ companyId: CROSS_TENANT_COMPANY_ID });
      await seed(env, foreign);

      const result = await withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(SCALAR)),
      );

      expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_MISSING' });
      expect(result).not.toMatchObject({ errorCode: 'SURVEY_RECORD_FOREIGN' });
      expect(await storedRecord(env)).toEqual(foreign);
    });

    it('εγγραφή άλλου έργου απορρίπτεται με δικό της κωδικό', async () => {
      // Ξεχωριστό από το παραπάνω **επίτηδες**: το λάθος έργο μέσα στον ίδιο μισθωτή δεν
      // είναι θέμα ασφαλείας, είναι λάθος στόχευσης — και ο μηχανικός πρέπει να μάθει
      // ποιο από τα δύο συνέβη.
      await seed(env, seededRecord({ projectId: 'proj_somewhere_else' }));

      const result = await withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(SCALAR)),
      );

      expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_WRONG_PROJECT' });
    });

    it('ανύπαρκτη εγγραφή δεν αφήνει provenance πίσω της (Γ9)', async () => {
      // Τίποτα δεν σπέρνεται. Η σειρά «πρώτα ο στόχος, μετά το binding» σημαίνει ότι μια
      // απόδειξη για εγγραφή που δεν έγινε είναι **αδύνατη** — κι αυτό μετριέται μόνο ως
      // κενή συλλογή.
      const result = await withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(SCALAR)),
      );

      expect(result).toMatchObject({ success: false, errorCode: 'SURVEY_RECORD_MISSING' });
      expect(await listRaw(env, BINDINGS)).toHaveLength(0);
      expect(await listRaw(env, RECORDS)).toHaveLength(0);
    });
  });

  // ── Η προέλευση, δίπλα στα δεδομένα ────────────────────────────────────────

  describe('η απόδειξη γράφεται μαζί με τα δεδομένα', () => {
    it.each(EVERY_KIND)('«%s» αφήνει binding που ονομάζει τον άνθρωπο', async (_label, which) => {
      // Δεδομένα χωρίς προέλευση είναι μεταγραφή που κανείς δεν υπέγραψε. Το ερώτημα
      // «ποιος και πότε» απαντιέται εδώ, στη βάση.
      expect(await approve(which)).toMatchObject({ success: true });

      const bindings = await listRaw(env, BINDINGS);
      expect(bindings).toHaveLength(1);
      expect(bindings[0]).toMatchObject({
        companyId: SAME_TENANT_COMPANY_ID,
        projectId: PROJECT_ID,
        status: 'active',
        confirmedBy: ADMIN,
      });
    });

    it('δύο δηλώσεις του ΙΔΙΟΥ MTEXT δεν πατούν η μία την άλλη', async () => {
      // 🔴 Η απόφαση της Φ4β που **μόνο** μια δεύτερη γραμμή μπορεί να ελέγξει, και μόνο
      // αφού η παλέτα ξαναφορτώσει: οι γραμμές ενός εγγράφου σώματος μοιράζονται `at`
      // **και** `sourceHandle`, δηλαδή κάθε άξονας που κοιτά το `findSameSlotActive` είναι
      // ταυτόσημος **εκτός** από το slot. Με slot τη λίστα — ή το κελί, όπως τα βαθμωτά —
      // η δεύτερη έγκριση θα μαρκάριζε `superseded` την πρώτη και θα επιβίωνε **μία**.
      //
      // ⚠️ Η δεύτερη έγκριση παίρνει τα bindings **ξαναδιαβασμένα από τη βάση**, όπως τα
      // κρατά η παλέτα. Με `[]` — που ήταν η πρώτη γραφή — το `findSameSlotActive` δεν έχει
      // πού να ψάξει και ο ισχυρισμός γίνεται κενός: μετρημένο, η μετάλλαξη του slot επέζησε.
      await seed(env, seededRecord());

      const first = await withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(ROW)),
      );
      expect(first).toMatchObject({ success: true, supersededIds: [] });

      const held = await withPersona(env, 'same_tenant_admin', () =>
        listTitleBlockBindings({
          companyId: SAME_TENANT_COMPANY_ID,
          fileRecordId: FILE_RECORD_ID,
          levelId: LEVEL_ID,
        }),
      );
      expect(held).toHaveLength(1);

      const sibling = rowApproval(
        'urbanPlanDecree',
        1,
        [{ part: 'reference', value: 'Γ.Π.Σ.', rawText: 'Γ.Π.Σ.' }],
        'Γ.Π.Σ.',
      );
      const second = await withPersona(env, 'same_tenant_admin', () =>
        approveTitleBlockProposal(approvalInput(sibling, { existingBindings: held })),
      );
      expect(second).toMatchObject({ success: true, supersededIds: [] });

      expect((await storedRecord(env)).institutionalActs.urbanPlanDecree).toHaveLength(2);
      const bindings = await listRaw(env, BINDINGS);
      expect(bindings).toHaveLength(2);
      expect(bindings.every((b) => b.status === 'active')).toBe(true);
    });
  });
});
