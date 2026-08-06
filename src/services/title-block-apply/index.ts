/**
 * @fileoverview Ο διανομέας της έγκρισης — **η μοναδική διαδρομή εγγραφής** (ADR-745 Φ3β).
 *
 * Καλείται **μόνο** από ρητό κλικ ανθρώπου. Δεν υπάρχει `useEffect` που να φτάνει εδώ, και
 * αυτό δεν το εγγυάται το σχόλιο — το εγγυάται ο κατάσκοπος εγγραφής.
 *
 * 🔑 **Γ9 — ΠΡΩΤΑ ο στόχος, ΜΕΤΑ το binding.** Η σειρά είναι κώδικας, όχι σύμβαση:
 * αν σκάσει το binding, ο στόχος υπάρχει **χωρίς** provenance — ανιχνεύσιμο, και το επόμενο
 * κλικ το ξαναγράφει ιδεοδύναμα. Ανάποδα, το binding θα βεβαίωνε εγγραφή που **δεν έγινε**:
 * φάντασμα provenance, δηλαδή ψέμα που φέρει το όνομα ενός ανθρώπου.
 *
 * @module services/title-block-apply
 */

import { nowISO } from '@/lib/date-local';
import { buildTitleBlockBindingKey } from '@/lib/title-block-binding-id';
import { bindingSlot } from '@/lib/title-block-binding-id';
import {
  findSameSlotActive,
  listTitleBlockBindings,
  saveTitleBlockBinding,
} from '@/services/title-block-binding.service';
import type { BindingProposal, BindingTarget, TitleBlockBinding } from '@/types/title-block-binding';
import { applyContactTarget } from './apply-contact';
import { applyDrawingMetaTarget } from './apply-drawing-meta';
import { applyLandownerTarget } from './apply-landowner';
import { applyProjectAddressTarget, applyProjectFieldTarget } from './apply-project-value';
import { applySurveyRecordTarget } from './apply-survey-record';
import type { ApplyTargetContext, ApplyTargetResult } from './apply-types';
import {
  refuseLandownerReplacement,
  withdrawSupersededTargets,
  type WithdrawFailure,
} from './withdraw-superseded';

export type { ApplyTargetContext, ApplyTargetResult } from './apply-types';
export type { WithdrawFailure } from './withdraw-superseded';

/**
 * Ποιο έργο αφορά ο στόχος — για το **αποκανονικοποιημένο** `projectId` του εγγράφου.
 *
 * 🔑 **ADR-759 Φ3: το `drawing-meta` κουβαλά πλέον κι αυτό έργο**, και ο λόγος είναι ο ίδιος που
 * παλιότερα το έκανε μη-εγγράψιμο: χωρίς `projectId` το binding είναι αόρατο στον φύλακα
 * διαγραφής έργου (`deletion-registry.ts:441`), δηλαδή **ορφανή απόδειξη** — χειρότερη από καμία.
 * Η τιμή ανήκει στο φύλλο· η **απόδειξη** χρειάζεται έργο. Ο Λ2 δεν παράγει καν υποψήφιο όταν το
 * σχέδιο δεν είναι δεμένο (`no-project`), οπότε αυτή η συνάρτηση δεν επιστρέφει πια ποτέ `null`
 * σε πραγματική ροή — μένει ως **φύλακας** για προγραμματιστική κλήση.
 */
function projectIdOf(target: BindingTarget): string {
  return target.projectId;
}

async function applyTarget(target: BindingTarget, ctx: ApplyTargetContext): Promise<ApplyTargetResult> {
  switch (target.kind) {
    case 'contact':
      return applyContactTarget(target, ctx);
    case 'landowner':
      return applyLandownerTarget(target, ctx);
    case 'project-field':
      return applyProjectFieldTarget(target, ctx);
    case 'project-address':
      return applyProjectAddressTarget(target, ctx);
    case 'drawing-meta':
      return applyDrawingMetaTarget(target, ctx);
    case 'survey-record':
      return applySurveyRecordTarget(target, ctx);
  }
}

export interface ApproveProposalInput {
  readonly proposal: BindingProposal;
  readonly target: BindingTarget;
  readonly fileRecordId: string;
  readonly levelId: string;
  readonly layerName: string;
  readonly ctx: ApplyTargetContext;
  /** Ό,τι υπάρχει ήδη για αυτό το σχέδιο — η εμβέλεια μέσα στην οποία ψάχνεται το supersede. */
  readonly existingBindings: readonly TitleBlockBinding[];
}

export type ApproveResult =
  | {
      readonly success: true;
      readonly bindingId: string;
      readonly supersededIds: readonly string[];
      /**
       * Στόχοι που αντικαταστάθηκαν αλλά **δεν** κατάφεραν να αποσυρθούν.
       *
       * Κενό στη συντριπτική πλειοψηφία. Δεν ακυρώνει την έγκριση — τη **συνοδεύει**, ώστε ένας
       * μισοκαθαρισμένος παλιός σύνδεσμος να μη μείνει αόρατος.
       */
      readonly withdrawFailures: readonly WithdrawFailure[];
    }
  | { readonly success: false; readonly error: string; readonly errorCode: string };

/** Το binding που πρόκειται να γραφτεί — χτίζεται **πριν** τον στόχο, ώστε οι φύλακες να το δουν. */
function buildBinding(input: ApproveProposalInput, id: string, projectId: string): TitleBlockBinding {
  const { proposal, target, fileRecordId, levelId, layerName, ctx } = input;
  return {
    id,
    companyId: ctx.companyId,
    projectId,
    fileRecordId,
    levelId,
    layerName,
    titleBlockIndex: proposal.titleBlockIndex,
    fieldKey: proposal.fieldKey,
    sourceHandle: proposal.sourceHandle,
    labelHandle: proposal.labelHandle,
    slot: bindingSlot(proposal, target),
    target,
    snapshotValue: proposal.snapshotValue,
    status: 'active',
    confirmedBy: ctx.userId,
    confirmedAt: nowISO(),
  };
}

/**
 * Εγκρίνει **μία** πρόταση: γράφει τον στόχο, μετά την προέλευση.
 *
 * Ο καλών έχει ήδη επιβεβαιώσει ότι υπάρχει `fileRecordId` — εδώ ο έλεγχος επαναλαμβάνεται
 * γιατί ένας φύλακας που ζει μόνο στο UI δεν είναι φύλακας.
 */
export async function approveTitleBlockProposal(input: ApproveProposalInput): Promise<ApproveResult> {
  const { proposal, target, fileRecordId, levelId, layerName, ctx, existingBindings } = input;

  if (!ctx.userId) return { success: false, error: 'no signed-in user', errorCode: 'MISSING_CREATOR' };
  if (!ctx.companyId) return { success: false, error: 'no tenant', errorCode: 'MISSING_TENANT' };

  const projectId = projectIdOf(target);
  if (!projectId) {
    // Ο Λ2 δεν παράγει υποψήφιο χωρίς έργο (`no-project`). Αυτό είναι το δίχτυ για κλήση που
    // παρακάμπτει το UI — μια απόδειξη χωρίς έργο δεν μπορεί ποτέ να ξαναβρεθεί ή να διαγραφεί.
    return { success: false, error: 'target has no project', errorCode: 'MISSING_PROJECT' };
  }

  let bindingId: string;
  try {
    // Σκάει καθαρά αν λείπει `fileRecordId`/`levelId` — ΠΟΤΕ `?? ''`, που θα γεννούσε δεύτερο
    // έγγραφο για την ίδια σύνδεση στο επόμενο φόρτωμα.
    bindingId = buildTitleBlockBindingKey({ fileRecordId, levelId, proposal, target });
  } catch (error) {
    return { success: false, error: String(error), errorCode: 'INVALID_BINDING_KEY' };
  }

  const binding = buildBinding(input, bindingId, projectId);
  const sameSlot = findSameSlotActive(existingBindings, binding);

  // ── 0. Ο ΦΥΛΑΚΑΣ ΤΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗΣ ──────────────────────────────────────
  // Πριν από **οτιδήποτε**: μια αντικατάσταση οικοπεδούχου ξαναμοιράζει τα χιλιοστά τρίτων.
  // Ελέγχεται εδώ και όχι στο UI, γιατί ένας φύλακας που ζει μόνο στο UI δεν είναι φύλακας.
  if (target.kind === 'landowner') {
    const blocked = refuseLandownerReplacement(sameSlot, target.contactId);
    if (blocked) {
      return {
        success: false,
        error: `slot already bound to landowner ${
          blocked.target.kind === 'landowner' ? blocked.target.contactId : ''
        }`,
        errorCode: 'LANDOWNER_SLOT_TAKEN',
      };
    }
  }

  // ── 1. Ο ΣΤΟΧΟΣ (Γ9) ──────────────────────────────────────────────────────
  const applied = await applyTarget(target, ctx);
  if (!applied.success) {
    return { success: false, error: applied.error, errorCode: applied.errorCode };
  }

  // ── 2. Η ΠΡΟΕΛΕΥΣΗ ────────────────────────────────────────────────────────
  const saved = await saveTitleBlockBinding(binding, existingBindings);
  if (!saved.success) {
    return { success: false, error: saved.error, errorCode: saved.errorCode };
  }

  // ── 3. Η ΑΠΟΣΥΡΣΗ ΤΩΝ ΑΝΤΙΚΑΤΑΣΤΑΘΕΝΤΩΝ ──────────────────────────────────
  // **Μετά** το επιτυχές supersede, ποτέ πριν: ανάποδα, μια αποτυχία εγγραφής θα άφηνε τον
  // παλιό στόχο αποσυνδεδεμένο **χωρίς αντικαταστάτη** — δηλαδή θα έσβηνε σύνδεση που κανείς
  // δεν ζήτησε να σβήσει. Ίδιο σκεπτικό με τη σειρά του Γ9, ένα βήμα παρακάτω.
  const withdrawFailures = await withdrawSupersededTargets(
    sameSlot.filter((b) => saved.supersededIds.includes(b.id)),
    ctx.userId,
  );

  return {
    success: true,
    bindingId: saved.bindingId,
    supersededIds: saved.supersededIds,
    withdrawFailures,
  };
}

export { listTitleBlockBindings };
