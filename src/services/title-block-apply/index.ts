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
  listTitleBlockBindings,
  saveTitleBlockBinding,
} from '@/services/title-block-binding.service';
import type { BindingProposal, BindingTarget, TitleBlockBinding } from '@/types/title-block-binding';
import { applyContactTarget } from './apply-contact';
import { applyLandownerTarget } from './apply-landowner';
import { applyProjectAddressTarget, applyProjectFieldTarget } from './apply-project-value';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

export type { ApplyTargetContext, ApplyTargetResult } from './apply-types';

/**
 * Ποιο έργο αφορά ο στόχος — για το **αποκανονικοποιημένο** `projectId` του εγγράφου.
 *
 * Το `drawing-meta` δεν έχει έργο, και γι' αυτό ακριβώς **δεν είναι εγγράψιμο στη Φ3β**: χωρίς
 * `projectId` το binding θα ήταν αόρατο στον φύλακα διαγραφής του έργου, δηλαδή **ορφανή
 * απόδειξη** — χειρότερη από καμία.
 */
function projectIdOf(target: BindingTarget): string | null {
  return target.kind === 'drawing-meta' ? null : target.projectId;
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
      // Δηλωμένο, όχι σιωπηλό: το `DxfLevelDocument` δεν έχει πεδίο υποδοχής και το
      // `UpdateDxfLevelSchema` είναι `.passthrough()` — εγγραφή εδώ θα γινόταν χωρίς σχήμα.
      // Ο Λ2 το μαρκάρει ήδη `not-yet-writable`, άρα το UI δεν προσφέρει κουμπί· αυτή η
      // γραμμή είναι ο φύλακας για την ημέρα που κάποιος το καλέσει προγραμματιστικά.
      return applyFailed('drawing metadata has no landing field yet', 'NOT_YET_WRITABLE');
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
  | { readonly success: true; readonly bindingId: string; readonly supersededIds: readonly string[] }
  | { readonly success: false; readonly error: string; readonly errorCode: string };

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
    return { success: false, error: 'target has no project', errorCode: 'NOT_YET_WRITABLE' };
  }

  let bindingId: string;
  try {
    // Σκάει καθαρά αν λείπει `fileRecordId`/`levelId` — ΠΟΤΕ `?? ''`, που θα γεννούσε δεύτερο
    // έγγραφο για την ίδια σύνδεση στο επόμενο φόρτωμα.
    bindingId = buildTitleBlockBindingKey({ fileRecordId, levelId, proposal, target });
  } catch (error) {
    return { success: false, error: String(error), errorCode: 'INVALID_BINDING_KEY' };
  }

  // ── 1. Ο ΣΤΟΧΟΣ (Γ9) ──────────────────────────────────────────────────────
  const applied = await applyTarget(target, ctx);
  if (!applied.success) {
    return { success: false, error: applied.error, errorCode: applied.errorCode };
  }

  // ── 2. Η ΠΡΟΕΛΕΥΣΗ ────────────────────────────────────────────────────────
  const binding: TitleBlockBinding = {
    id: bindingId,
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

  const saved = await saveTitleBlockBinding(binding, existingBindings);
  if (!saved.success) {
    return { success: false, error: saved.error, errorCode: saved.errorCode };
  }

  return { success: true, bindingId: saved.bindingId, supersededIds: saved.supersededIds };
}

export { listTitleBlockBindings };
