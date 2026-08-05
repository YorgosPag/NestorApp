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
import type {
  BindingBlockReason,
  BindingCandidate,
  BindingEvidenceKind,
  BindingTargetKind,
} from '@/types/title-block-binding';
import type { TitleBlockFieldKey } from '@/types/title-block-reading';
import type { ApprovalBlocker } from './useTitleBlockApproval';

export const FIELD_LABEL: Record<TitleBlockFieldKey, string> = {
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
  'not-yet-writable': 'titleBlockBinding.blocked.not-yet-writable',
  'no-primary-address': 'titleBlockBinding.blocked.no-primary-address',
};

export const TARGET_LABEL: Record<BindingTargetKind, string> = {
  contact: 'titleBlockBinding.target.contact',
  landowner: 'titleBlockBinding.target.landowner',
  'project-address': 'titleBlockBinding.target.project-address',
  'project-field': 'titleBlockBinding.target.project-field',
  'drawing-meta': 'titleBlockBinding.target.drawing-meta',
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
): string =>
  candidate.target.kind === 'contact'
    ? t('titleBlockBinding.candidateWithRole', {
        name: candidate.label,
        role: roleLabel(candidate.target.role, t),
      })
    : candidate.label;

export const BLOCKER_LABEL: Record<RowBlocker, string> = {
  noFileRecord: 'titleBlockBinding.disabled.noFileRecord',
  noUser: 'titleBlockBinding.disabled.noUser',
  needsPercent: 'titleBlockBinding.disabled.needsPercent',
  needsChoice: 'titleBlockBinding.disabled.needsChoice',
};
