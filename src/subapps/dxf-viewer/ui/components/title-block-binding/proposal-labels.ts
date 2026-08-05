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

import type {
  BindingBlockReason,
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
export const BLOCKER_LABEL: Record<RowBlocker, string> = {
  noFileRecord: 'titleBlockBinding.disabled.noFileRecord',
  noUser: 'titleBlockBinding.disabled.noUser',
  needsPercent: 'titleBlockBinding.disabled.needsPercent',
  needsChoice: 'titleBlockBinding.disabled.needsChoice',
};
