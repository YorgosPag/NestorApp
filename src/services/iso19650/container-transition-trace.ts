/**
 * =============================================================================
 * ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΩΝ ΠΡΑΞΕΩΝ ΤΟΥ ΔΟΧΕΙΟΥ — ΜΕΤΑ ΤΟ COMMIT, ΜΗ-ΜΠΛΟΚΑΡΟΝ (ADR-862 Φ0 Β6)
 * =============================================================================
 *
 * ⚠️ **Εξήχθη αυτούσιο από τον γραφέα** (`container-transitions`, N.7.1: έφτασε 487/500 με την
 * κληρονομιά της διαδοχής, ADR-845 §7.17 Α3γ). Καμία απόφαση δεν μετακινήθηκε και καμία δεν
 * προστέθηκε· άλλαξε **μόνο** ποιος τη στεγάζει. Καλείται **μόνο** από τον ΕΝΑΝ γραφέα.
 *
 * @module services/iso19650/container-transition-trace
 * @see services/iso19650/container-transitions — ο μοναδικός καλών
 */

import 'server-only';

import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { FileAuditAction, FileAuditMetadata } from '@/types/file-audit';

import {
  ACT_SPEC,
  type ContainerTransitionOutcome,
  type ContainerTransitionRequest,
} from './container-transition-policy';

/**
 * ⚠️ **ΟΧΙ μέσα στη συναλλαγή** (ADR-862 §5.7, δόγμα `recordMembershipGrantAudit`): το
 * σώμα ξαναεκτελείται σε σύγκρουση, άρα παρενέργεια μέσα του φεύγει **πολλές φορές**.
 * Και η αποτυχία του **δεν** επιτρέπεται να ακυρώσει σφραγίδα που έγινε.
 *
 * 🔑 **Δεν χάνεται τίποτα νομικά**: το αυθεντικό ίχνος *(ποιος · πότε · ποια
 * αναθεώρηση)* είναι το `cdeSeal` **πάνω στο έγγραφο**, γραμμένο **ατομικά** στο (8)
 * και αμετάβλητο από τους κανόνες (Β4). Αυτό εδώ είναι η **προβολή** του.
 */
export function recordTrace(request: ContainerTransitionRequest, outcome: ContainerTransitionOutcome): void {
  const trace = traceOf(request, outcome);
  if (trace === null) return;
  // 📒 ADR-866 §2.6.11 — η γραμμή πάει στο βιβλίο **του κατόχου του δράστη** (`FILE_AUDIT_COLLECTION`):
  //    εταιρικό ⇒ `file_audit_log`, προσωπικό ⇒ `file_audit_log_personal`, που το διαβάζει ο κάτοχος.
  //    Ο κάτοχος είναι ο **ίδιος** που διάλεξε το διαμέρισμα του αρχείου — μία πηγή, ποτέ δεύτερη.
  safeFireAndForget(
    recordFileAudit({
      fileId: outcome.fileId,
      action: trace.action,
      performedBy: request.actor.uid,
      ...request.actor.custody,
      metadata: trace.metadata,
    }),
    'ContainerTransitions.recordTrace',
    { fileId: outcome.fileId, act: outcome.act },
  );
}

/**
 * **Τι καταγράφεται** για κάθε έκβαση — `null` όταν δεν έγινε τίποτα (noop · άρνηση).
 *
 * 🔑 ADR-862 §5.3.7: διαδοχή **χωρίς** φάση ⇒ `version_supersede`, **ποτέ** `cde_supersede` — το
 * ημερολόγιο δεν επιτρέπεται να ισχυριστεί μετάβαση ISO 19650 που δεν έγινε.
 */
function traceOf(
  request: ContainerTransitionRequest,
  outcome: ContainerTransitionOutcome,
): { readonly action: FileAuditAction; readonly metadata: FileAuditMetadata } | null {
  if (outcome.kind === 'succeeded') {
    return { action: 'version_supersede', metadata: { supersededByFileId: outcome.supersededByFileId } };
  }
  if (outcome.kind !== 'transitioned') return null;
  return {
    action: ACT_SPEC[outcome.act].audit,
    metadata: {
      from: outcome.from,
      to: outcome.to,
      revision: outcome.revision,
      ...(request.suitabilityCode === undefined ? {} : { suitabilityCode: request.suitabilityCode }),
      ...(request.reason === undefined ? {} : { reason: request.reason }),
      ...(request.supersededByFileId === undefined
        ? {}
        : { supersededByFileId: request.supersededByFileId }),
    },
  };
}
