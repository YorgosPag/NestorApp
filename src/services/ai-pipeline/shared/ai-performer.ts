/**
 * 🤖 Ο **φορέας** μιας εγγραφής του βοηθού AI (ADR-195) — ΕΝΑ σημείο για όλο το pipeline.
 *
 * Ο βοηθός είναι διεργασία της μηχανής (`system:ai-agent`) που ενεργεί **εκ μέρους** ανθρώπου.
 * Όπου ο άνθρωπος είναι **γνωστός χρήστης** (εντολή διαχειριστή με Firebase uid), ο φορέας είναι ο
 * ίδιος ο άνθρωπος. Η ταυτότητα καναλιού (Telegram id, τηλέφωνο) **δεν** είναι ποτέ όνομα.
 *
 * ℹ️ Το `buildAttribution` (`tools/executor-shared`) μένει ως ελεύθερο κείμενο για ίχνη αρχείων·
 * **δεν** είναι φορέας Ιστορικού.
 *
 * @module services/ai-pipeline/shared/ai-performer
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { processPerformer, userPerformer, type AuditPerformer, type ProcessPerformer } from '@/lib/audit/audit-performer';
import { auditActorOf, performerStamp, resolveProcessPerformer, type PerformerStamp } from '@/server/lib/performer-stamp';
import type { AdminCommandMeta } from '@/types/ai-pipeline';
import type { AgenticContext } from '../tools/executor-shared-types';

/** Εργαλείο του βοηθού: εκ μέρους του αναγνωρισμένου συνομιλητή, αν τον ξέρουμε. */
export function aiAgentPerformer(ctx: Pick<AgenticContext, 'contactMeta'>): ProcessPerformer {
  return processPerformer(SYSTEM_IDENTITY.AI_AGENT_ID, ctx.contactMeta?.displayName ?? null);
}

/** Η σφραγίδα `_lastModified*` μιας εγγραφής εργαλείου — σύγχρονη (καμία ανάγνωση). */
export function aiAgentStamp(ctx: Pick<AgenticContext, 'contactMeta'>): PerformerStamp {
  return performerStamp(resolveProcessPerformer(aiAgentPerformer(ctx)));
}

/**
 * Τα πεδία δράστη της γραμμής υπηρεσίας ενός εργαλείου. Ήταν **πέντε** αντίγραφα του
 * `performedBy: ctx.channelSenderId || 'system'` — ταυτότητα καναλιού στη θέση δράστη (N.0.2).
 */
export function aiAgentAuditActor(ctx: Pick<AgenticContext, 'contactMeta'>): ReturnType<typeof auditActorOf> {
  return auditActorOf(resolveProcessPerformer(aiAgentPerformer(ctx)));
}

/** Εντολή διαχειριστή: ο ίδιος ο χρήστης όταν έχει uid, αλλιώς ο βοηθός εκ μέρους του. */
export function adminCommandPerformer(meta: AdminCommandMeta | null | undefined): AuditPerformer {
  const identity = meta?.adminIdentity;
  const uid = identity?.firebaseUid?.trim();
  if (uid) return userPerformer(uid, identity?.displayName ?? null);
  return processPerformer(SYSTEM_IDENTITY.AI_AGENT_ID, identity?.displayName ?? null);
}
