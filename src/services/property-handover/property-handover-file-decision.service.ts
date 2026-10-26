import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ της απόφασης παράδοσης ανά αρχείο** — «παραδίδεται» / «μένει εσωτερικό» (ADR-916 §5.18 Φ-Δ.4).
 * @related lib/property-handover/handover-file-decision-plan.ts (η ΜΙΑ κρίση — ο γραφέας δεν αποφασίζει) ·
 *          property-handover-set.server.ts (ποια αρχεία ανήκουν στην πώληση) · property-handover-write.service.ts (η συμφιλίωση)
 * @module services/property-handover/property-handover-file-decision.service
 *
 * 🔑 **Σειρά**: σύνολο (ανήκει το αρχείο στο θέμα της πώλησης;) → **συναλλαγή** (φρέσκο αρχείο + οι θέσεις καθολικού του σε
 *    κάθε παράδοση → καθαρή κρίση → εγγραφή) → ίχνος → συμφιλίωση. Η συμφιλίωση **μετά**: ό,τι έγινε «Παραδίδεται» φτάνει
 *    τώρα, και το «θέλουν απόφαση» ξαναμετριέται τώρα.
 * 🔒 **Κούρσα με την αντιγραφή — κλειστή**: διαβάζουμε τις **ίδιες** ντετερμινιστικές θέσεις καθολικού που γεννά ο εκτελεστής,
 *    κι εκείνος ξαναδιαβάζει την πηγή στη δική του συναλλαγή ⇒ σειριοποιούνται. Ποτέ «εσωτερικό» πάνω σε κάτι που έφυγε.
 * 🔴 **ΠΟΤΕ `updatedAt` / `revision`** (ίδιος λόγος με τα γεγονότα εγγράφου): το αποτύπωμα του ελέγχου μεταβίβασης είναι
 *    `fileId:revision:updatedAt` — μια απόφαση παράδοσης **δεν** αλλάζει τα bytes και δεν πρέπει να «παλιώνει» εγκρίσεις.
 * 🛡️ **Ποτέ δεν πετά**: αποτυχία = γραμμή ημερολογίου + `failed` (503).
 */

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { fileCustodyOf } from '@/lib/files/file-custody';
import { FieldValue } from '@/lib/firebaseAdmin';
import { FILE_HANDOVER_DECISION_FIELD, type FileHandoverDecision } from '@/lib/property-handover/file-handover-decision';
import { handoverCandidateFromDocument } from '@/lib/property-handover/handover-disposition';
import { handoverFileDecisionOf, type HandoverFileDecisionVerdict } from '@/lib/property-handover/handover-file-decision-plan';
import { isSharedHandoverSource } from '@/lib/property-handover/handover-source-scope';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyOnly, type CustodyScope } from '@/lib/workspace/custody-scope';
import { deliveryLedgerRef, sharedSourceDeliveriesQuery } from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type {
  HandoverFileDecisionDisposition,
  HandoverFileDecisionRefusal,
  HandoverFileDecisionRequest,
} from '@/types/property-handover-file-decision';

import { loadHandoverSet, type HandoverSet, type HandoverSetFile } from './property-handover-set.server';
import { propertiesReachedBySharedSource, type SharedSourceRef } from './property-handover-shared-reach.server';
import { propertyHandoversQuery, syncPropertyHandovers } from './property-handover-write.service';

const logger = createModuleLogger('PropertyHandoverFileDecision');

export interface HandoverFileDecisionCommand extends HandoverFileDecisionRequest {
  readonly companyId: string;
  readonly propertyId: string;
  /** uid του ανθρώπου του γραφείου. */
  readonly performedBy: string;
}

export type HandoverFileDecisionOutcome =
  | { readonly kind: 'decided' | 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverFileDecisionRefusal }
  | { readonly kind: 'failed' };

interface Committed {
  readonly verdict: HandoverFileDecisionVerdict;
  readonly previous: HandoverFileDecisionDisposition | null;
  readonly custody: CustodyScope | null;
  /** Φ-Γ3 — η οντότητα του αρχείου: κοινό (κτίριο · έργο) ⇒ η απόφαση φτάνει σε κάθε πώληση του (`null` = άρνηση). */
  readonly source: SharedSourceRef | null;
}

const REFUSED_UNKNOWN: Committed = { verdict: { kind: 'refused', reason: 'file-unknown' }, previous: null, custody: null, source: null };

/** Το αρχείο **μέσα** στο θέμα της πώλησης — ποτέ εγγραφή σε αρχείο άλλου ακινήτου ή επαφής. */
function fileOfSet(set: HandoverSet, fileId: string): HandoverSetFile | undefined {
  return [...set.deliver, ...set.review, ...set.internal].find((file) => file.doc.id === fileId);
}

/**
 * Φ-Γ3 — **κοινό** αρχείο (κτίριο · έργο): «παραδόθηκε;» σε **οποιαδήποτε** μονάδα — όλοι οι αγοραστές του κτιρίου παίρνουν
 * το **ίδιο** κοινό πακέτο (§5.18 απάντηση 4, επεκταμένη). Μέσα στη συναλλαγή ⇒ σειριοποιείται με την αντιγραφή.
 */
async function deliveredElsewhere(tx: Transaction, adminDb: AdminFirestore, command: HandoverFileDecisionCommand, file: HandoverSetFile): Promise<boolean> {
  if (!isSharedHandoverSource(file.preview.entityType)) return false;
  return !(await tx.get(sharedSourceDeliveriesQuery(adminDb, command.companyId, [file.doc.id]).limit(1))).empty;
}

/** Η συναλλαγή: όλες οι αναγνώσεις (αρχείο + θέσεις καθολικού σε κάθε παράδοση) **πριν** από την εγγραφή. */
function commitDecision(adminDb: AdminFirestore, command: HandoverFileDecisionCommand, file: HandoverSetFile): Promise<Committed> {
  return adminDb.runTransaction(async (tx) => {
    const handovers = await tx.get(propertyHandoversQuery(adminDb, command.companyId, command.propertyId));
    const ledgerRefs = handovers.docs.map((handover) => deliveryLedgerRef(adminDb, handover.id, file.doc.id));
    const [fileSnap, ...ledger] = await Promise.all([tx.get(file.doc.ref), ...ledgerRefs.map((ref) => tx.get(ref))]);
    const elsewhere = await deliveredElsewhere(tx, adminDb, command, file);
    const data = fileSnap.data();
    // Μετακινήθηκε σε άλλη οντότητα ανάμεσα στο σύνολο και τη συναλλαγή ⇒ δεν ανήκει πια στην πώληση.
    if (data === undefined || data.entityType !== file.preview.entityType || data.entityId !== file.preview.entityId) return REFUSED_UNKNOWN;
    const candidate = handoverCandidateFromDocument(data);
    const delivered = elsewhere || ledger.some((row) => row.exists);
    const verdict = handoverFileDecisionOf({ candidate, delivered }, command);
    if (verdict.kind === 'apply') {
      const decision: FileHandoverDecision | null = verdict.next === null ? null : {
        disposition: verdict.next, reason: command.reason.trim(), decidedBy: command.performedBy, decidedAt: nowISO(),
      };
      // 🔴 ΜΟΝΟ το πεδίο — κανένα `updatedAt` (βλ. κεφαλίδα).
      tx.update(file.doc.ref, { [FILE_HANDOVER_DECISION_FIELD]: decision ?? FieldValue.delete() });
    }
    return {
      verdict, previous: candidate?.handoverDecision?.disposition ?? null, custody: fileCustodyOf(data),
      source: { companyId: command.companyId, entityType: file.preview.entityType, entityId: file.preview.entityId },
    };
  });
}

/**
 * Η συμφιλίωση μετά την απόφαση — του ακινήτου **και** (Φ-Γ3) κάθε άλλης πώλησης που αφορά το κοινό αρχείο. Ένα-ένα (ο
 * γραφέας κρατά συναλλαγή ανά ακίνητο)· αποτυχία = γραμμή ημερολογίου, το δίχτυ (cron · νυχτερινό) την ξαναπιάνει.
 */
async function syncReachedProperties(adminDb: AdminFirestore, command: HandoverFileDecisionCommand, committed: Committed): Promise<void> {
  const shared = committed.source === null ? [] : await propertiesReachedBySharedSource(adminDb, committed.source);
  const propertyIds = [command.propertyId, ...shared.filter((id) => id !== command.propertyId)];
  for (const propertyId of propertyIds) {
    const synced = await syncPropertyHandovers(adminDb, propertyId, { cause: 'office-file-decision', performedBy: command.performedBy });
    // Η απόφαση ΔΕΣΜΕΥΤΗΚΕ· αποτυχία συμφιλίωσης = το δίχτυ θα την πιάσει — ποτέ άρνηση της απόφασης.
    if (synced.kind === 'failed') logger.warn('Handover sync after file decision failed', { propertyId, fileId: command.fileId });
  }
}

/** Μετά το commit: η γραμμή ιστορικού του αρχείου (το αυθεντικό ίχνος ζει στο ίδιο το αρχείο) + η συμφιλίωση. */
async function afterDecision(adminDb: AdminFirestore, command: HandoverFileDecisionCommand, committed: Committed): Promise<void> {
  if (committed.custody !== null) {
    await recordFileAudit({
      fileId: command.fileId,
      action: 'handover_decision',
      performedBy: command.performedBy,
      metadata: { choice: command.choice, previous: committed.previous ?? 'automatic', reason: command.reason.trim() },
      ...custodyOnly(committed.custody),
    });
  }
  await syncReachedProperties(adminDb, command, committed);
}

/** **Αποφασίζει** για ένα αρχείο της πώλησης. Ιδεμπότητο (`unchanged`) · ποτέ δεν πετά. */
export async function decideHandoverFile(adminDb: AdminFirestore, command: HandoverFileDecisionCommand): Promise<HandoverFileDecisionOutcome> {
  try {
    const set = await loadHandoverSet(adminDb, command.companyId, command.propertyId);
    const file = set === null ? undefined : fileOfSet(set, command.fileId);
    if (file === undefined) return { kind: 'refused', reason: 'file-unknown' };
    const committed = await commitDecision(adminDb, command, file);
    if (committed.verdict.kind === 'refused') return committed.verdict;
    if (committed.verdict.kind === 'unchanged') return { kind: 'unchanged' };
    await afterDecision(adminDb, command, committed);
    return { kind: 'decided' };
  } catch (error) {
    logger.error('Handover file decision failed', { propertyId: command.propertyId, fileId: command.fileId, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}
