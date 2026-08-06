/**
 * @fileoverview 🔴 **Η πύλη που κάνει το νεκρό λεξιλόγιο αδύνατο** (ADR-759 §4.4.1).
 *
 * ## Γιατί υπάρχει — μετρημένο, όχι θεωρητικό
 *
 * Το `no-primary-address` έζησε στο repo δηλωμένο σε **τρία** σημεία — ένωση τύπων,
 * `BLOCKED_LABEL`, κλειδιά el **και** en — και **καμία συνάρτηση δεν το επέστρεψε ποτέ**. Ήταν
 * μήνυμα που κανείς δεν μπορούσε να δει, με πλήρη μετάφραση. Ταυτόχρονα το `resolver-gap`
 * δηλωνόταν στο ADR ως ληφθείσα απόφαση και **δεν υπήρχε καθόλου** στον κώδικα.
 *
 * Δύο εκδοχές του **ίδιου** ελαττώματος, και **καμία πύλη δεν μπορούσε να δει καμία από τις
 * δύο**: μια χειρόγραφη ένωση TypeScript δεν απαριθμείται σε χρόνο εκτέλεσης, άρα η ερώτηση
 * «**μπορεί κάποιος να δει ποτέ αυτό το μήνυμα;**» ήταν κυριολεκτικά αδύνατο να τεθεί. Τη
 * διαφορά τη βρήκε **άνθρωπος διαβάζοντας δύο αρχεία δίπλα-δίπλα** — που δεν επαναλαμβάνεται.
 *
 * ## Τι ελέγχει, και γιατί **ισότητα** και όχι εγκλεισμός
 *
 * Ο πραγματικός Λ2 τρέχει πάνω στο πραγματικό fixture του G753 σε όλα τα σχετικά συμφραζόμενα.
 * Το σύνολο των `blockedBy` που **όντως παρήχθησαν** πρέπει να ισούται με το `BINDING_BLOCK_REASONS`:
 *
 * - **⊆** (τίποτα παραπάνω): παραγωγός αδήλωτης αιτίας ⇒ δεν μεταγλωττίζεται καν, το απαιτεί
 *   ήδη ο ρητός `Record<BindingBlockReason, string>` του `proposal-labels.ts`.
 * - **⊇** (τίποτα λιγότερο): **αυτό είναι το καινούργιο**. Δηλωμένη αιτία χωρίς παραγωγό =
 *   κόκκινο. Θα είχε πιάσει το `no-primary-address` από την πρώτη μέρα, και πιάνει και την
 *   αντίστροφη περίπτωση: κατάσταση που έμεινε πίσω αφού η φάση της τελείωσε (το
 *   `not-yet-writable` της Φ3β, που αφαιρέθηκε στη Φ3 ακριβώς γι' αυτόν τον λόγο).
 *
 * ⚠️ **ΜΗΝ «διορθώσεις» αποτυχία προσθέτοντας ό,τι να 'ναι στα σενάρια.** Η αποτυχία λέει ένα
 * από **τρία** πράγματα, και μόνο το τρίτο λύνεται εδώ:
 * 1. ο κώδικας που παράγει την αιτία δεν γράφτηκε ποτέ ⇒ **γράψ' τον**·
 * 2. δεν χρειάζεται πια ⇒ **βγάλ' την από την ένωση** (έτσι έφυγε το `not-yet-writable` στη Φ3)·
 * 3. η αιτία **είναι** ζωντανή αλλά καμία **είσοδος** εδώ δεν τη φτάνει ⇒ πρόσθεσε σενάριο —
 *    **μόνο** αν περιγράφει πραγματική κατάσταση χρήστη, ποτέ επειδή βολεύει το test.
 *
 * 🔴 **Η πρώτη εκτέλεση αυτής της πύλης βρήκε ακριβώς την περίπτωση 3, και το εύρημα ήταν
 * χειρότερο από ελάττωμα του test.** Το `unsupported-field` έμεινε χωρίς παραγωγό, γιατί στο
 * G753 οι **μόνες** γραμμές που το παρήγαν ήταν οι τέσσερις άδετες σημαδούρες (`Δ.Ε.` · `Π.Ε.` ·
 * `ΟΙΚ.` · `Οδός`) — η πινακίδα του δείγματος **δεν έχει καν** `ΕΡΓΟ`/`ΜΕΛΕΤΗ`/`ΣΧΕΔΙΑΣΕ`
 * (μετρημένο: διαβάζονται 7 πεδία, κανένα από τα `projectTitle`/`studyType`/`drawnBy`/`signature`).
 *
 * ⇒ Δηλαδή πριν τη Φ3 το μήνυμα «**κανείς δεν το ζητά**» εμφανιζόταν στην οθόνη **αποκλειστικά**
 * πάνω σε τιμές που **ζητούσαμε και οι τέσσερις**. Δεν ήταν ανακριβές μήνυμα — ήταν το **μόνο**
 * μήνυμα εκείνης της κατηγορίας, και ήταν ψευδές σε **100%** των εμφανίσεών του. Η §2.2 του
 * ADR-759 το είχε δει ως «τρεις αιτίες πίσω από δύο μηνύματα»· η μέτρηση δείχνει ότι το ένα από
 * τα δύο μηνύματα δεν είχε **καμία** αληθή εμφάνιση στο δείγμα.
 */

/* global describe, it, expect */
import { BINDABLE_SURVEY_FIELDS, type BindableSurveyField } from '@/config/survey-bindable-fields';
import { readTitleBlocks } from '@/subapps/dxf-viewer/text-engine/title-block/reading/title-block-reading';
import { G753_TITLEBLOCK_ROWS } from '@/subapps/dxf-viewer/text-engine/title-block/reading/__tests__/fixtures/g753-titleblock.fixture';
import {
  BINDING_BLOCK_REASONS,
  BINDING_CAUTIONS,
  BINDING_SOURCE_KINDS,
  type BindingBlockReason,
  type BindingCaution,
  type BindingProposal,
  type BindingSourceKind,
} from '@/types/title-block-binding';
import { DOCUMENT_BODY_FIELD_KEYS, type DocumentBodyFieldKey } from '@/types/document-body-reading';
import { g753DocumentReadings } from '@/lib/document-body/__tests__/fixtures/g753-body.fixture';
import { resolveDocumentBodyProposals } from '../resolve-document-body';
import type { TitleBlockReading } from '@/types/title-block-reading';
import { resolveTitleBlockProposals } from '../title-block-proposals';
import type { ContactSnapshotEntry } from '../resolve-people';
import type { SurveySnapshot } from '../resolve-survey-record';

const LEVEL = 'lvl_topo';
const PROJECT = 'proj_g753';

/** Ένα έργο με **ένα** τοπογραφικό, ανοιχτό — η συνηθισμένη κατάσταση. */
const ONE_OPEN_RECORD: SurveySnapshot = {
  records: [{ id: 'srv_a', isConfirmed: false, label: 'ΙΟΥΛΙΟΣ 2026' }],
  activeId: null,
};

/** Το ίδιο τοπογραφικό, **επιβεβαιωμένο** ⇒ παγωμένο. */
const ONE_FROZEN_RECORD: SurveySnapshot = {
  records: [{ id: 'srv_a', isConfirmed: true, label: 'ΙΟΥΛΙΟΣ 2026' }],
  activeId: 'srv_a',
};

/** Δύο τοπογραφικά και **κανένας δείκτης** — ο προορισμός δεν είναι μονοσήμαντος. */
const TWO_RECORDS_NO_POINTER: SurveySnapshot = {
  records: [
    { id: 'srv_a', isConfirmed: false, label: 'ΙΟΥΛΙΟΣ 2026' },
    { id: 'srv_b', isConfirmed: false, label: 'ΜΑΡΤΙΟΣ 2024' },
  ],
  activeId: null,
};

const readings = (): TitleBlockReading[] => readTitleBlocks('PINAKAKI 500', G753_TITLEBLOCK_ROWS);

const KNOWN_CONTACTS: readonly ContactSnapshotEntry[] = [
  { id: 'cont_mavro', displayName: 'Κωνσταντίνος Μαυρομιχάλης', phones: ['2310 788493'], emails: [] },
  { id: 'cont_nikolaou', displayName: 'Ιωάννης Νικολάου', phones: [], emails: ['info@nikolaou.com.gr'] },
  { id: 'cont_zerva', displayName: 'Γεωργία Ζέρβα', phones: [], emails: [] },
];

/**
 * Μια πινακίδα με πρόσωπο **γνωστό** αλλά ειδικότητα που δεν δίνει ρόλο.
 *
 * 🔑 Χειροποίητη **μόνο** ως προς την είσοδο· ο Λ2 που τρέχει είναι ο πραγματικός. Το G753 δεν
 * μπορεί να παραγάγει `role-undecided` — και οι δύο μελετητές του έχουν καθαρή ειδικότητα. Ένα
 * fixture που δεν φτάνει σε μια κατάσταση **δεν αποδεικνύει ότι η κατάσταση είναι νεκρή**, και
 * αυτή ακριβώς η σύγχυση είναι που θέλουμε να μην ξανασυμβεί.
 */
const READING_WITH_UNDECIDED_ROLE: TitleBlockReading = {
  layerName: 'PINAKAKI 500',
  bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  fields: [
    {
      key: 'designers',
      rawValue: 'ΑΓΝΩΣΤΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ',
      sourceHandle: 'h1',
      labelHandle: 'h0',
      at: { x: 0, y: 0 },
      matchedBy: 'same-cell',
    },
  ],
  people: [
    {
      displayName: 'Κωνσταντίνος Μαυρομιχάλης',
      professionText: 'ΑΠΟΦΟΙΤΟΣ ΛΥΚΕΙΟΥ',
      phones: ['2310 788493'],
      emails: [],
      websites: [],
    },
  ],
  unparsed: [],
};

/**
 * Πινακίδα με **τίτλο έργου** — το πιο συνηθισμένο πεδίο ελληνικής πινακίδας, που το G753
 * απλώς δεν έχει στο layer `PINAKAKI 500`.
 *
 * 🔑 Δεν είναι υποθετικό σενάριο για να γίνει πράσινο το test: ο `TITLE_BLOCK_FIELD_KEYS` το
 * δηλώνει, ο Λ1 το διαβάζει, και **καμία** οντότητα της βάσης δεν το ζητά — ο ορισμός του
 * `unsupported-field`. Χωρίς αυτό, η αιτία θα φαινόταν νεκρή ενώ είναι η μόνη σωστή απάντηση
 * για τέσσερα από τα έντεκα πεδία που ξέρει να διαβάζει ο Λ1.
 */
const READING_WITH_PROJECT_TITLE: TitleBlockReading = {
  layerName: 'PINAKAKI 500',
  bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  fields: [
    {
      key: 'projectTitle',
      rawValue: 'ΤΟΠΟΓΡΑΦΙΚΗ ΑΠΟΤΥΠΩΣΗ ΟΙΚΟΠΕΔΟΥ',
      sourceHandle: 'h3',
      labelHandle: 'h2',
      at: { x: 0, y: 0 },
      matchedBy: 'same-cell',
    },
  ],
  people: [],
  unparsed: [],
};

/** Κάθε συμφραζόμενο που ο χρήστης μπορεί πραγματικά να βρεθεί, και τι παράγει το καθένα. */
const SCENARIOS: ReadonlyArray<{ readonly what: string; readonly reasons: () => Set<string> }> = [
  {
    what: 'σχέδιο ΔΕΜΕΝΟ σε έργο με κύρια διεύθυνση, όλες οι επαφές γνωστές',
    reasons: () =>
      collect(readings(), {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: true,
        survey: ONE_OPEN_RECORD,
      }),
  },
  {
    // Το έργο δεν έχει ακόμη καρτέλα «Στοιχεία Τοπογραφικού» — η **αρχική** κατάσταση κάθε
    // έργου, όχι εξωτικό σενάριο: η καρτέλα φτιάχνεται με το χέρι από τον μηχανικό.
    what: 'έργο ΧΩΡΙΣ καμία εγγραφή τοπογραφικού',
    reasons: () =>
      collect(readings(), {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: true,
      }),
  },
  {
    what: 'έργο με ΔΥΟ τοπογραφικά και κανένα δηλωμένο ως ενεργό',
    reasons: () =>
      collect(readings(), {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: true,
        survey: TWO_RECORDS_NO_POINTER,
      }),
  },
  {
    what: 'το ενεργό τοπογραφικό είναι ΕΠΙΒΕΒΑΙΩΜΕΝΟ (παγωμένο)',
    reasons: () =>
      collect(readings(), {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: true,
        survey: ONE_FROZEN_RECORD,
      }),
  },
  {
    what: 'σχέδιο ΧΩΡΙΣ έργο',
    reasons: () => collect(readings(), { levelId: LEVEL, contacts: KNOWN_CONTACTS }),
  },
  {
    what: 'έργο ΧΩΡΙΣ κύρια διεύθυνση',
    reasons: () =>
      collect(readings(), {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: false,
        survey: ONE_OPEN_RECORD,
      }),
  },
  {
    what: 'καμία επαφή στη βάση',
    reasons: () => collect(readings(), {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: [],
        hasPrimaryAddress: true,
        survey: ONE_OPEN_RECORD,
      }),
  },
  {
    what: 'πινακίδα με τίτλο έργου — πεδίο που καμία οντότητα δεν ζητά',
    reasons: () =>
      collect([READING_WITH_PROJECT_TITLE], {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: true,
        survey: ONE_OPEN_RECORD,
      }),
  },
  {
    what: 'πρόσωπο γνωστό, ειδικότητα χωρίς ρόλο',
    reasons: () =>
      collect([READING_WITH_UNDECIDED_ROLE], {
        projectId: PROJECT,
        levelId: LEVEL,
        contacts: KNOWN_CONTACTS,
        hasPrimaryAddress: true,
        survey: ONE_OPEN_RECORD,
      }),
  },
];

function collect(
  input: readonly TitleBlockReading[],
  context: Parameters<typeof resolveTitleBlockProposals>[1],
): Set<string> {
  const reasons = new Set<string>();
  for (const proposal of resolveTitleBlockProposals(input, context)) {
    if (proposal.blockedBy) reasons.add(proposal.blockedBy);
  }
  return reasons;
}

const producedByAnyScenario = (): Set<string> => {
  const all = new Set<string>();
  for (const scenario of SCENARIOS) for (const reason of scenario.reasons()) all.add(reason);
  return all;
};

/**
 * Ό,τι παράγει ο πραγματικός Λ2 **πέρα από** τις αιτίες μπλοκαρίσματος.
 *
 * Τρέχει στο σενάριο με **ανοιχτό** τοπογραφικό, γιατί επιφυλάξεις και στόχοι υπάρχουν μόνο
 * όταν η πρόταση όντως γίνεται — μπλοκαρισμένη γραμμή δεν έχει ούτε τα δύο.
 */
function producedOpenRecord(): {
  readonly cautions: Set<string>;
  readonly surveyFields: Set<string>;
  readonly sourceKinds: Set<string>;
  readonly bodyFields: Set<string>;
} {
  const cautions = new Set<string>();
  const surveyFields = new Set<string>();
  const sourceKinds = new Set<string>();
  const bodyFields = new Set<string>();

  // 🔴 **ΚΑΙ ΟΙ ΔΥΟ αναγνώστες** (Φ4). Ο Λ2 έπαψε να έχει μία είσοδο: η πινακίδα και το σώμα
  // του σχεδίου γεννούν προτάσεις από διαφορετικό υλικό, και ένα λεξιλόγιο που ελέγχεται
  // μόνο απέναντι στον έναν είναι **μισοελεγμένο** — ακριβώς το κενό που άφησε το
  // `sourceKind` να ζήσει χωρίς παραγωγό.
  const proposals: BindingProposal[] = [
    ...resolveTitleBlockProposals(readings(), {
      projectId: PROJECT,
      levelId: LEVEL,
      contacts: KNOWN_CONTACTS,
      hasPrimaryAddress: true,
      survey: ONE_OPEN_RECORD,
    }),
    ...resolveDocumentBodyProposals(g753DocumentReadings(), {
      projectId: PROJECT,
      hasPrimaryAddress: true,
      survey: ONE_OPEN_RECORD,
    }),
  ];

  for (const proposal of proposals) {
    if (proposal.caution) cautions.add(proposal.caution);
    // Απόν ⇒ `'title-block'` **εξ ορισμού** (δες `BindingProposal.sourceKind`) — η προεπιλογή
    // είναι παραγωγός όσο και η ρητή δήλωση, αλλιώς η πύλη θα απαιτούσε θόρυβο σε επτά σημεία.
    sourceKinds.add(proposal.sourceKind ?? 'title-block');
    for (const candidate of proposal.candidates) {
      if (candidate.target.kind === 'survey-record') surveyFields.add(candidate.target.field);
    }
  }

  for (const reading of g753DocumentReadings()) {
    for (const field of reading.fields) bodyFields.add(field.key);
  }

  return { cautions, surveyFields, sourceKinds, bodyFields };
}

describe('🔴 κάθε δηλωμένη αιτία μπλοκαρίσματος ΕΧΕΙ παραγωγό', () => {
  it.each(BINDING_BLOCK_REASONS)(
    '«%s» παράγεται από τον πραγματικό Λ2 σε τουλάχιστον ένα συμφραζόμενο',
    (reason: BindingBlockReason) => {
      expect(producedByAnyScenario().has(reason)).toBe(true);
    },
  );

  it('🔴 και ΤΙΠΟΤΑ παραπάνω — η δηλωμένη λίστα δεν έχει ξεχάσει κάτι που ήδη παράγεται', () => {
    const declared = new Set<string>(BINDING_BLOCK_REASONS);
    for (const produced of producedByAnyScenario()) expect(declared.has(produced)).toBe(true);
  });

  it('τα δύο σύνολα είναι ΙΣΑ — ούτε νεκρή δήλωση, ούτε αδήλωτος παραγωγός', () => {
    expect([...producedByAnyScenario()].sort()).toEqual([...BINDING_BLOCK_REASONS].sort());
  });
});

/**
 * 🔴 **Η ίδια πύλη, στο ίδιο σχήμα, για τις ΕΠΙΦΥΛΑΞΕΙΣ** (ADR-759 Φ3γ).
 *
 * Μια επιφύλαξη χωρίς παραγωγό είναι **ακριβώς** το ίδιο ελάττωμα με μια αιτία χωρίς
 * παραγωγό — μεταφρασμένο μήνυμα που κανείς δεν μπορεί να δει. Το ότι η έννοια είναι νέα δεν
 * της δίνει περίοδο χάριτος: γεννήθηκε **μαζί** με την πύλη της, που είναι όλο το μάθημα του
 * §4.4 (το `resolver-gap` έζησε φάσεις στα χαρτιά πριν υπάρξει σε κώδικα).
 */
describe('🔴 κάθε δηλωμένη ΕΠΙΦΥΛΑΞΗ έχει παραγωγό', () => {
  it.each(BINDING_CAUTIONS)('«%s» παράγεται από τον πραγματικό Λ2', (caution: BindingCaution) => {
    expect(producedOpenRecord().cautions.has(caution)).toBe(true);
  });

  it('τα δύο σύνολα είναι ΙΣΑ — ούτε νεκρή δήλωση, ούτε αδήλωτος παραγωγός', () => {
    expect([...producedOpenRecord().cautions].sort()).toEqual([...BINDING_CAUTIONS].sort());
  });
});

/**
 * 🔴 **Και για το ΛΕΞΙΛΟΓΙΟ ΣΤΟΧΩΝ του τοπογραφικού.**
 *
 * Το `BINDABLE_SURVEY_FIELDS` είναι υπόσχεση: «αυτά τα πεδία της καρτέλας μπορεί να τα
 * γεμίσει το σχέδιο». Ένα πεδίο δηλωμένο χωρίς παραγωγό μετατρέπει την υπόσχεση σε ψέμα που
 * **κανείς δεν μπορεί να διαψεύσει διαβάζοντας** — ο κατάλογος φαίνεται πλούσιος, η οθόνη
 * δεν προσφέρει τίποτα. Είναι η αιτία που ο κατάλογος έχει **δύο** εγγραφές και όχι τριάντα:
 * το σώμα του σχεδίου θα φέρει τις υπόλοιπες **μαζί με τον αναγνώστη τους**.
 */
describe('🔴 κάθε δηλωμένο πεδίο τοπογραφικού ΠΡΟΣΓΕΙΩΝΕΤΑΙ όντως', () => {
  it.each(BINDABLE_SURVEY_FIELDS)(
    '«%s» παράγεται ως στόχος από τον πραγματικό Λ2 στο G753',
    (field: BindableSurveyField) => {
      expect(producedOpenRecord().surveyFields.has(field)).toBe(true);
    },
  );

  it('τα δύο σύνολα είναι ΙΣΑ — κανένας αδήλωτος στόχος δεν διαφεύγει', () => {
    expect([...producedOpenRecord().surveyFields].sort()).toEqual([...BINDABLE_SURVEY_FIELDS].sort());
  });
});

describe('τα σενάρια είναι διακριτά — κανένα δεν είναι διακοσμητικό', () => {
  it('κάθε σενάριο συνεισφέρει τουλάχιστον μία αιτία που δεν δίνει το «πλήρες» σενάριο', () => {
    const baseline = SCENARIOS[0].reasons();
    for (const scenario of SCENARIOS.slice(1)) {
      const own = [...scenario.reasons()].filter((r) => !baseline.has(r));
      expect(own.length).toBeGreaterThan(0);
    }
  });
});

/**
 * 🔴 **ΤΟ ΧΡΕΟΣ ΤΗΣ Φ3γ, ΚΛΕΙΣΜΕΝΟ** (ADR-759 §4.6).
 *
 * Το `BINDING_SOURCE_KINDS` προστέθηκε στη Φ3γ **προκαταβολικά**, για να το χρησιμοποιήσει ο
 * αναγνώστης του σώματος — και έμεινε με **μηδέν παραγωγούς** (επαληθευμένο με grep 06/08).
 * Είναι κατά λέξη το ελάττωμα που κυνηγά όλη η αλυσίδα ADR-745/759: δηλωμένο λεξιλόγιο χωρίς
 * κώδικα πίσω του. Δύο τίμιες εκβάσεις υπήρχαν — να παραχθεί ή να φύγει από την ένωση — και η
 * Φ4 διάλεξε την πρώτη. Αυτή η πύλη είναι ο λόγος που δεν μπορεί να ξαναγίνει.
 */
describe('🔴 κάθε δηλωμένο ΕΙΔΟΣ ΠΗΓΗΣ έχει παραγωγό', () => {
  it.each(BINDING_SOURCE_KINDS)('«%s» παράγεται από τον πραγματικό Λ2', (kind: BindingSourceKind) => {
    expect(producedOpenRecord().sourceKinds.has(kind)).toBe(true);
  });

  it('τα δύο σύνολα είναι ΙΣΑ — ούτε νεκρή δήλωση, ούτε αδήλωτος παραγωγός', () => {
    expect([...producedOpenRecord().sourceKinds].sort()).toEqual([...BINDING_SOURCE_KINDS].sort());
  });
});

/**
 * 🔴 **Και για το λεξιλόγιο ΑΝΑΓΝΩΣΗΣ του σώματος** (Φ4).
 *
 * Ίδιο δόγμα, τρίτη εφαρμογή: κλειδί που δηλώνει «αυτό ξέρω να το διαβάζω» και δεν το παράγει
 * κανένας κανόνας πάνω στο **πραγματικό** σχέδιο είναι υπόσχεση που κανείς δεν μπορεί να
 * διαψεύσει διαβάζοντας. Τα 27 κλειδιά είναι μετρημένα στο `G753_ergasia F.dxf`.
 */
describe('🔴 κάθε δηλωμένο πεδίο ΣΩΜΑΤΟΣ διαβάζεται όντως', () => {
  it.each(DOCUMENT_BODY_FIELD_KEYS)(
    '«%s» παράγεται από τον πραγματικό Λ1β στο G753',
    (key: DocumentBodyFieldKey) => {
      expect(producedOpenRecord().bodyFields.has(key)).toBe(true);
    },
  );

  it('τα δύο σύνολα είναι ΙΣΑ — κανένας αδήλωτος αναγνώστης δεν διαφεύγει', () => {
    expect([...producedOpenRecord().bodyFields].sort()).toEqual([...DOCUMENT_BODY_FIELD_KEYS].sort());
  });
});
