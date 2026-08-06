/**
 * @fileoverview Οι ρητοί χάρτες κλειδιών της παλέτας σύνδεσης πινακίδας (ADR-745 Φ3β).
 *
 * 🔴 **Ποτέ** `` t(`titleBlockBinding.fields.${key}`) ``. Ο generator του shell slice
 * (CHECK 3.34) **αρνείται να παράγει** όταν συναντήσει ανεπίλυτη δυναμική `t()`, και το
 * αποτέλεσμα θα ήταν **ωμό κλειδί στην οθόνη με τη μετάφραση να υπάρχει** — το ακριβές σχήμα
 * που κόστισε τρεις επαναλήψεις (ADR-744/752 και ο κατάλογος στιλ του ADR-750 Φ6, όπου
 * **13 στα 14** κλειδιά δεν ταίριαζαν και η CHECK 3.8 ήταν **δομικά τυφλή** επειδή ο κώδικας
 * **συνέθετε** το κλειδί).
 *
 * Ο τύπος `Record<Kind, 'literal.key'>` κάνει το κενό **σφάλμα μεταγλώττισης**: νέο είδος
 * στόχου ή νέα αιτία μπλοκαρίσματος χωρίς ετικέτα δεν χτίζει.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/proposal-labels
 */

import { type RoleTranslateFn, roleLabel } from '@/config/project-role-labels';
import { surveyAffirmationLabel } from '@/config/survey-record-labels';
import type { SurveyParsedValue } from '@/config/survey-bindable-fields';
import type {
  BindingBlockReason,
  BindingCandidate,
  BindingCaution,
  BindingEvidenceKind,
  BindingSourceKind,
  BindingTargetKind,
  ProposalFieldKey,
} from '@/types/title-block-binding';
import type { ApprovalBlocker } from './useTitleBlockApproval';

/**
 * ⚠️ **Ρητός `Record<ProposalFieldKey, …>`**: καλύπτει **και** τα κλειδιά της πινακίδας **και**
 * του σώματος (Φ4). Νέο κλειδί ανάγνωσης χωρίς ετικέτα **δεν χτίζει** — που είναι ο μόνος
 * λόγος που μια γραμμή της παλέτας δεν μπορεί ποτέ να εμφανιστεί ανώνυμη.
 */
export const FIELD_LABEL: Record<ProposalFieldKey, string> = {
  // ── Πινακίδα ──
  employer: 'titleBlockBinding.fields.employer',
  projectTitle: 'titleBlockBinding.fields.projectTitle',
  location: 'titleBlockBinding.fields.location',
  designers: 'titleBlockBinding.fields.designers',
  studyType: 'titleBlockBinding.fields.studyType',
  drawingType: 'titleBlockBinding.fields.drawingType',
  drawingNumber: 'titleBlockBinding.fields.drawingNumber',
  scale: 'titleBlockBinding.fields.scale',
  studyDate: 'titleBlockBinding.fields.studyDate',
  drawnBy: 'titleBlockBinding.fields.drawnBy',
  signature: 'titleBlockBinding.fields.signature',
  // ── Σώμα του σχεδίου (ADR-759 Φ4) ──
  sector: 'titleBlockBinding.fields.sector',
  plotBoundaryLabels: 'titleBlockBinding.fields.plotBoundaryLabels',
  minFrontage: 'titleBlockBinding.fields.minFrontage',
  minArea: 'titleBlockBinding.fields.minArea',
  declaredCoveragePct: 'titleBlockBinding.fields.declaredCoveragePct',
  maxCoveragePct: 'titleBlockBinding.fields.maxCoveragePct',
  declaredMaxHeight: 'titleBlockBinding.fields.declaredMaxHeight',
  declaredSd: 'titleBlockBinding.fields.declaredSd',
  socialFactorSd: 'titleBlockBinding.fields.socialFactorSd',
  totalSd: 'titleBlockBinding.fields.totalSd',
  landUse: 'titleBlockBinding.fields.landUse',
  inSocialFactorZone: 'titleBlockBinding.fields.inSocialFactorZone',
  settlementActs: 'titleBlockBinding.fields.settlementActs',
  implementationActNumber: 'titleBlockBinding.fields.implementationActNumber',
  implementationActDecision: 'titleBlockBinding.fields.implementationActDecision',
  implementationActVolume: 'titleBlockBinding.fields.implementationActVolume',
  implementationActEntry: 'titleBlockBinding.fields.implementationActEntry',
  implementationActDate: 'titleBlockBinding.fields.implementationActDate',
  implementationActRegistry: 'titleBlockBinding.fields.implementationActRegistry',
  implementationActUrbanUnits: 'titleBlockBinding.fields.implementationActUrbanUnits',
  implementationActOriginalProperties: 'titleBlockBinding.fields.implementationActOriginalProperties',
  buildabilityNote: 'titleBlockBinding.fields.buildabilityNote',
  roadPlanDefinition: 'titleBlockBinding.fields.roadPlanDefinition',
  plotArea: 'titleBlockBinding.fields.plotArea',
  heightDatum: 'titleBlockBinding.fields.heightDatum',
  surveyDate: 'titleBlockBinding.fields.surveyDate',
  regionalUnit: 'titleBlockBinding.fields.regionalUnit',
};

/**
 * Ποιος αναγνώστης γέννησε τη γραμμή — **δήλωση αξιοπιστίας**, όχι μεταδεδομένο (§4.6).
 *
 * Η πινακίδα έχει δομή· το σώμα είναι πρόζα. Ο μηχανικός πρέπει να ξέρει ποια από τις δύο
 * κοιτάζει **πριν** πατήσει Έγκριση, γι' αυτό το κείμενο του σώματος λέει ρητά «επιβεβαίωσε».
 */
export const SOURCE_KIND_LABEL: Record<BindingSourceKind, string> = {
  'title-block': 'titleBlockBinding.sourceKind.title-block',
  'document-body': 'titleBlockBinding.sourceKind.document-body',
};

export const EVIDENCE_LABEL: Record<BindingEvidenceKind, string> = {
  email: 'titleBlockBinding.evidence.email',
  phone: 'titleBlockBinding.evidence.phone',
  'name-exact': 'titleBlockBinding.evidence.name-exact',
  'name-abbrev': 'titleBlockBinding.evidence.name-abbrev',
  'name-fuzzy': 'titleBlockBinding.evidence.name-fuzzy',
};

export const BLOCKED_LABEL: Record<BindingBlockReason, string> = {
  'no-project': 'titleBlockBinding.blocked.no-project',
  'unsupported-field': 'titleBlockBinding.blocked.unsupported-field',
  'no-match': 'titleBlockBinding.blocked.no-match',
  'role-undecided': 'titleBlockBinding.blocked.role-undecided',
  'no-primary-address': 'titleBlockBinding.blocked.no-primary-address',
  'resolver-gap': 'titleBlockBinding.blocked.resolver-gap',
  'no-survey-record': 'titleBlockBinding.blocked.no-survey-record',
  'survey-record-undecided': 'titleBlockBinding.blocked.survey-record-undecided',
  'survey-record-locked': 'titleBlockBinding.blocked.survey-record-locked',
};

/**
 * «Γίνεται — να τι δεν ξέρουμε».
 *
 * 🔑 Ξεχωριστός πίνακας από το {@link BLOCKED_LABEL} επειδή είναι **άλλη πρόταση προς τον
 * άνθρωπο**: εκείνο εξηγεί γιατί δεν υπάρχει κουμπί· αυτό στέκεται δίπλα σε ένα κουμπί που
 * **δουλεύει** και ζητά δεύτερη ματιά. Το `ambiguous-abbreviation` μετακόμισε εδώ στη Φ3γ —
 * ήταν φραγμός για κάτι που δεν ήταν φραγμένο.
 */
export const CAUTION_LABEL: Record<BindingCaution, string> = {
  'ambiguous-abbreviation': 'titleBlockBinding.caution.ambiguous-abbreviation',
  'partial-value': 'titleBlockBinding.caution.partial-value',
};

export const TARGET_LABEL: Record<BindingTargetKind, string> = {
  contact: 'titleBlockBinding.target.contact',
  landowner: 'titleBlockBinding.target.landowner',
  'project-address': 'titleBlockBinding.target.project-address',
  'project-field': 'titleBlockBinding.target.project-field',
  'drawing-meta': 'titleBlockBinding.target.drawing-meta',
  'survey-record': 'titleBlockBinding.target.survey-record',
};

/**
 * Γιατί το κουμπί είναι κλειστό — **από τη σκοπιά της γραμμής**.
 *
 * 🔑 Ευρύτερο από το `ApprovalBlocker` κατά **μία** τιμή, και η διαφορά είναι δομική: ο
 * `blockerFor()` δέχεται **ήδη χτισμένο** `ApproveRequest`, που απαιτεί `target`. Όταν δεν έχει
 * διαλέξει ακόμη ο άνθρωπος **δεν υπάρχει target**, άρα ο hook δεν καλείται καν — η αιτία
 * γεννιέται στη γραμμή και μόνο εκεί. Διευρύνοντας το `ApprovalBlocker` θα δηλώναμε τιμή που ο
 * hook **δεν μπορεί να επιστρέψει ποτέ**.
 */
export type RowBlocker = ApprovalBlocker | 'needsChoice';

/**
 * Ένα κλειδί ανά αιτία, ποτέ σκέτο γκρίζο κουμπί.
 *
 * ⚠️ Ο ρητός τύπος `Record<RowBlocker, string>` **αντικατέστησε** ένα `as const` που δεν
 * επαλήθευε τίποτα — παρά την υπόσχεση του docblock αυτού του αρχείου ότι το κενό γίνεται
 * σφάλμα μεταγλώττισης. Νέα αιτία χωρίς ετικέτα δεν χτίζει πλέον.
 */
/**
 * Ποια μαρτυρία δείχνει και την **τιμή** της.
 *
 * 🔴 **Γιατί υπάρχει.** Δύο τηλέφωνα γραφείου παρήγαγαν δύο πανομοιότυπα «ταιριάζει το τηλέφωνο»
 * — δηλαδή **μηδέν πληροφορία** για το ποιο ταίριαξε. Μετρημένο στην οθόνη 05/08 στο G753.
 *
 * Τα `name-*` μένουν έξω γιατί το `value` τους **είναι** το `contact.displayName`
 * (`resolve-people.ts:110-112` δίπλα στο `:155`) — το ίδιο ακριβώς κείμενο που γράφει η γραμμή
 * «→ …». Θα ήταν διπλότυπο, όχι διάκριση. ⚠️ Αυτό ισχύει **μόνο όταν υπάρχει επιλεγμένος**
 * υποψήφιος· χωρίς αυτόν δεν αποδίδεται καθόλου γραμμή «→ …» και η τιμή του ονόματος γίνεται
 * ξανά χρήσιμη — γι' αυτό ο πίνακας είναι το **ένα** από τα δύο σκέλη της συνθήκης, όχι όλη.
 *
 * Ρητός `Record<…>`: νέο είδος μαρτυρίας χωρίς απόφαση **δεν χτίζει**.
 */
export const EVIDENCE_SHOWS_VALUE: Record<BindingEvidenceKind, boolean> = {
  email: true,
  phone: true,
  'name-exact': false,
  'name-abbrev': false,
  'name-fuzzy': false,
};

/**
 * Η ταυτότητα ενός υποψηφίου όπως τη διαβάζει ο άνθρωπος: **όνομα + ο ρόλος με τον οποίο θα
 * γραφτεί στη βάση**.
 *
 * 🔴 **Γιατί δεν αρκεί το `label`.** Δύο γραμμές «Μελετητής» έδειχναν ταυτόσημη ετικέτα «Επαφή
 * έργου» και σκέτο όνομα, ενώ γράφονταν **διαφορετικοί ρόλοι** (`surveyor` / `structural_engineer`).
 * Ο ρόλος φαινόταν **μόνο** στον επιλογέα, που αποδίδεται μόνο σε αμφισημία
 * (`TitleBlockProposalRow.tsx`) — άρα στη συνηθισμένη περίπτωση ο άνθρωπος πατούσε «Έγκριση»
 * χωρίς να βλέπει **τι** εγκρίνει. Είναι το αντίστροφο του κανόνα που ήδη επιβάλλει η γραμμή για
 * το κλειστό κουμπί: *απενεργοποιημένο χωρίς εξήγηση είναι σφάλμα αναφοράς*.
 *
 * 🔑 **Μία σύνθεση, δύο καταναλωτές.** Ζούσε μόνο μέσα στον επιλογέα· δεύτερη αντιγραφή στη
 * γραμμή θα ήταν sibling clone (N.18) — το κλασικό «κεντρικοποιείς το Α, γράφεις το Β δίδυμο».
 *
 * Οι μη-επαφές (οικοπεδούχος, διεύθυνση, στοιχείο έργου) επιστρέφουν σκέτο `label`: δεν φέρουν
 * ρόλο στον τύπο τους, και το είδος τους το λέει ήδη το `TARGET_LABEL` στην κεφαλίδα.
 */
export const candidateLabel = (
  candidate: BindingCandidate,
  t: RoleTranslateFn,
): string => {
  switch (candidate.target.kind) {
    case 'contact':
      return t('titleBlockBinding.candidateWithRole', {
        name: candidate.label,
        role: roleLabel(candidate.target.role, t),
      });
    case 'survey-record':
      return surveyValueLabel(candidate.target.value, t) ?? candidate.label;
    case 'landowner':
    case 'project-address':
    case 'project-field':
    case 'drawing-meta':
      return candidate.label;
  }
};

/**
 * Η **αναλυμένη** τιμή τοπογραφικού όπως θα τη διαβάσει ο άνθρωπος — ή `null` όταν το ωμό
 * κείμενο του σχεδίου είναι ήδη η καλύτερη γραφή της.
 *
 * 🔴 **Γιατί υπάρχει: το βέλος έλεγε ψέματα.** Η γραμμή έγραφε
 * `Ζώνη κοινωνικού συντελεστή → ΕΝΤΟΣ ΖΩΝΗΣ ΚΟΙΝΩΝΙΚΟΥ ΣΥΝΤΕΛΕΣΤΗ`, αλλά η Έγκριση γράφει
 * **checkbox = Ναι**. Το «→» σημαίνει «αυτό θα γραφτεί», άρα η οθόνη υποσχόταν κάτι που δεν
 * ίσχυε — μετρημένο στην οθόνη 06/08 στο G753.
 *
 * 🔑 **Δεν μαντεύεται τίποτα**: το `target.value` κουβαλά ήδη την **ετικέτα τύπου**
 * (`{kind:'boolean', value:true}`), ακριβώς για να μη χρειάζεται `typeof` εδώ (ADR-759 §4.8).
 *
 * ⚠️ **Οι αριθμοί και οι λίστες μένουν ωμοί, και αυτό είναι απόφαση.** Το «1.364,05» **είναι**
 * η ελληνική γραφή του αριθμού· δική μας μορφοποίηση θα ήταν **δεύτερος τόπος** όπου
 * αποφασίζεται πώς δείχνει ένας αριθμός, ενώ ο πρώτος (η καρτέλα) θα έδειχνε άλλο. Μόνο η
 * λογική τιμή διαφέρει **ουσιωδώς** από το κείμενο που τη γέννησε.
 *
 * ⚠️ `value: null` ⇒ `null`: «δεν αναλύθηκε» δεν έχει λέξη, και η επιφύλαξη `partial-value`
 * το λέει ήδη ρητά από κάτω. Το ωμό κείμενο είναι εκεί η μόνη αλήθεια (ADR-745 §8 κανόνας 3).
 */
function surveyValueLabel(value: SurveyParsedValue, t: RoleTranslateFn): string | null {
  switch (value.kind) {
    case 'boolean':
      return value.value === null ? null : surveyAffirmationLabel(value.value, t);
    case 'text':
    case 'number':
    case 'textList':
      return null;
  }
}

export const BLOCKER_LABEL: Record<RowBlocker, string> = {
  noFileRecord: 'titleBlockBinding.disabled.noFileRecord',
  noUser: 'titleBlockBinding.disabled.noUser',
  needsPercent: 'titleBlockBinding.disabled.needsPercent',
  needsChoice: 'titleBlockBinding.disabled.needsChoice',
};
