/**
 * @fileoverview **Οι μεταβάσεις που προσφέρει μια γραμμή της λίστας, και γιατί μια είναι ανενεργή** — καθαρό
 *   (ADR-928 §5.5 · Φ3α-2).
 * @module components/projects/procurement/subcontracts/subcontract-row-actions
 *
 * 🔑 **Οι ίδιοι κριτές με τον γραφέα**, καμία δεύτερη λογική: `refuseTransition` (πίνακας + φύλακες δεδομένων) και, για
 *    την «Έκδοση», ο `judgeClauseSelections` με την **ίδια** είσοδο που χτίζει ο γραφέας στο `issue`
 *    (`selectionInputsOf` + προηγούμενες επιλογές) και την **ίδια** βιβλιοθήκη (`approved-library`). Άρα το κουμπί
 *    ανάβει μόνο όταν ο διακομιστής θα δεχτεί, και όταν δεν ανάβει λέει **γιατί** — με τη λέξη που θα έλεγε ο γραφέας.
 * 🔑 Fail-closed: όσο η βιβλιοθήκη φορτώνει, η «Έκδοση» μένει ανενεργή («ελέγχεται»), ποτέ «εντάξει» στα τυφλά.
 * ⚠️ Όριο: ο έλεγχος δίγλωσσου εγγράφου (`translationMissing`) θέλει τα κείμενα των μεταφράσεων — τον κάνει μόνο ο
 *    γραφέας, και η άρνησή του φτάνει ως μήνυμα από τον ίδιο πίνακα.
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { ActionEmphasis } from '@/design-system/color-bridge';
import type { AgreementLifecycleRefusal } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import { refuseTransition } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import {
  judgeClauseSelections,
  selectionInputsOf,
  type ApprovedLibrary,
} from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import {
  SUBCONTRACT_AGREEMENT_FSM,
  SUBCONTRACT_AGREEMENT_TRANSITIONS,
  type SubcontractAgreement,
  type SubcontractAgreementTransition,
} from '@/subapps/procurement/subcontracts/types/agreement';

/** Μεταβάσεις που κλείνουν τον δρόμο του εγγράφου — κόκκινες, με ρητή επιβεβαίωση. */
export const DESTRUCTIVE_TRANSITIONS: ReadonlySet<SubcontractAgreementTransition> = new Set(['discard', 'withdraw', 'terminate']);

/**
 * Μεταβάσεις που **δεν αναιρούνται** — θέλουν επιβεβαίωση **με τις συνέπειές τους** (ADR-928 §5.24.5): οι καταστρεπτικές,
 * και η κανονική ροή που παγώνει το έγγραφο (`issue`: αναθεώρηση + κείμενα ρητρών · `accept`: δέσμευση, και στον Τρόπο Β
 * νέο συμφωνητικό). Οι `issue`/`accept` **δεν** γίνονται κόκκινες: είναι ο δρόμος, όχι κίνδυνος (NN/g · Material).
 */
export const CONFIRMED_TRANSITIONS: ReadonlySet<SubcontractAgreementTransition> = new Set([...DESTRUCTIVE_TRANSITIONS, 'issue', 'accept']);

/**
 * **Ο κανονικός δρόμος** του εγγράφου (`draft → issued → accepted → in_execution → completed`) — η «επόμενη κίνηση».
 * Κάθε κατάσταση έχει το πολύ **μία** από αυτές ⇒ το πολύ **ένα** κύριο κουμπί ανά οθόνη (Primer · Atlassian · Carbon:
 * ένα primary ανά ομάδα). Το `expire` ΔΕΝ είναι δρόμος: στο `issued` στέκεται δίπλα στο `accept` ως δευτερεύον.
 */
const FORWARD_TRANSITIONS: ReadonlySet<SubcontractAgreementTransition> = new Set(['issue', 'accept', 'mobilize', 'complete']);

/** Η έμφαση της μετάβασης (ADR-770 §19.4): δρόμος ⇒ κύρια · καταστρεπτική ⇒ μελάνι άρνησης · άλλη ⇒ δευτερεύουσα. */
function emphasisOf(transition: SubcontractAgreementTransition): ActionEmphasis {
  if (DESTRUCTIVE_TRANSITIONS.has(transition)) return 'caution';
  return FORWARD_TRANSITIONS.has(transition) ? 'primary' : 'secondary';
}

/** Γιατί μια μετάβαση δεν προσφέρεται τώρα. */
export type RowActionBlock =
  | { readonly kind: 'refusal'; readonly refusal: AgreementLifecycleRefusal }
  | { readonly kind: 'issue'; readonly issue: SubcontractIssue }
  | { readonly kind: 'checking' }
  /** Ο επεξεργαστής έχει μη αποθηκευμένες αλλαγές: η μετάβαση θα έκρινε την αποθηκευμένη εκδοχή, όχι ό,τι βλέπει ο άνθρωπος. */
  | { readonly kind: 'unsaved' };

const UNSAVED: RowActionBlock = { kind: 'unsaved' };

/** Με μη αποθηκευμένες αλλαγές καμία μετάβαση δεν προσφέρεται — η δική της αιτία, αν έχει, μένει πρώτη. */
export function blockedWhileUnsaved(actions: readonly RowAction[], unsaved: boolean): readonly RowAction[] {
  return unsaved ? actions.map((action) => ({ ...action, block: action.block ?? UNSAVED })) : actions;
}

export interface RowAction {
  readonly transition: SubcontractAgreementTransition;
  readonly destructive: boolean;
  /** Πώς φαίνεται ως κουμπί — ιδιότητα της μετάβασης, όχι του κουμπιού (`emphasisOf`). */
  readonly emphasis: ActionEmphasis;
  /** Ζητά επιβεβαίωση πριν σταλεί (`CONFIRMED_TRANSITIONS`). */
  readonly confirm: boolean;
  readonly block: RowActionBlock | null;
}

export interface RowActionContext {
  readonly today: CalendarDay;
  /** `null` ⇒ η βιβλιοθήκη δεν έχει φτάσει ακόμη. */
  readonly library: ApprovedLibrary | null;
  readonly actorUid: string;
}

/** Η κρίση των ρητρών όπως στο `issue` του γραφέα — το πρώτο εύρημα, ή `null`. */
function issueBlock(agreement: SubcontractAgreement, context: RowActionContext): RowActionBlock | null {
  if (context.library === null) return { kind: 'checking' };
  const judged = judgeClauseSelections(
    selectionInputsOf(agreement.clauses),
    context.library,
    agreement.terms,
    agreement.clauses,
    { uid: context.actorUid },
  );
  const [first] = judged.issues;
  return first ? { kind: 'issue', issue: first } : null;
}

function blockOf(agreement: SubcontractAgreement, transition: SubcontractAgreementTransition, context: RowActionContext): RowActionBlock | null {
  const refusal = refuseTransition(agreement, transition, context.today);
  if (refusal !== null) return { kind: 'refusal', refusal };
  return transition === 'issue' ? issueBlock(agreement, context) : null;
}

/** Οι μεταβάσεις **από** την τρέχουσα κατάσταση (ό,τι άλλο δεν έχει νόημα να φανεί), με την κρίση τους. */
export function rowActionsOf(agreement: SubcontractAgreement, context: RowActionContext): RowAction[] {
  return SUBCONTRACT_AGREEMENT_TRANSITIONS.filter((transition) =>
    SUBCONTRACT_AGREEMENT_FSM[transition].from.includes(agreement.status),
  ).map((transition) => ({
    transition,
    destructive: DESTRUCTIVE_TRANSITIONS.has(transition),
    emphasis: emphasisOf(transition),
    confirm: CONFIRMED_TRANSITIONS.has(transition),
    block: blockOf(agreement, transition, context),
  }));
}
