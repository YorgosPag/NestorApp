import 'server-only';

/**
 * @fileoverview **Η ΠΟΡΤΑ του κλεισίματος γραμμής χωρίς πλήρες αποτύπωμα** (ADR-916 §5.23 Φ-Δ.7γ · Ο13β (i)).
 * @related lib/property-handover/handover-line-closure.ts (η ΜΙΑ κρίση — η πόρτα δεν αποφασίζει) ·
 *          server/property-handover-delivery/handover-delivery-evidence.server.ts (η μέτρηση) ·
 *          server/property-handover-delivery/handover-delivery-ledger.server.ts (`recordDeliveryClosure` — η μία εγγραφή)
 * @module services/property-handover/property-handover-line-closure.service
 *
 * 🔑 **Σειρά**: παράδοση του ενοικιαστή → γραμμή → **φρέσκια μέτρηση** (GCS) → κρίση → **συναλλαγή** (ξαναδιαβάζει γραμμή
 *    και παράδοση) → ίχνος → συμφιλίωση. Η μέτρηση γίνεται **έξω** από τη συναλλαγή (το GCS δεν συμμετέχει σε συναλλαγές
 *    Firestore)· είναι ασφαλές γιατί η πράξη δέχεται **μόνο** οριστικές αιτίες: bytes που έσβησε οριστικά το GCS δεν
 *    ξαναεμφανίζονται. Ό,τι **μπορεί** να αλλάξει στο μεταξύ (sha256 · ανάκληση · άλλος παραλήπτης) το ξαναελέγχει η συναλλαγή.
 * 🔒 Η αιτία **δεν** έρχεται από το αίτημα — τη μετρά η μηχανή. Ο άνθρωπος δίνει μόνο αιτιολογία, που μένει στο γραφείο.
 * 🛡️ **Ποτέ δεν πετά**: αποτυχία = γραμμή ημερολογίου + `failed` (503) — ποτέ κλείσιμο «στα τυφλά» μετά από σφάλμα δικτύου.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { getErrorMessage } from '@/lib/error-utils';
import { fileCustodyOf } from '@/lib/files/file-custody';
import { handoverLineClosureOf } from '@/lib/property-handover/handover-line-closure';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyOnly } from '@/lib/workspace/custody-scope';
import { candidatesOf, probeDeliveredRow } from '@/server/property-handover-delivery/handover-delivery-evidence.server';
import { releaseOrphanedSourceBytes } from '@/server/property-handover-delivery/handover-delivery-orphan-release.server';
import {
  deliverySourceRef,
  readDeliveredRows,
  recordDeliveryClosure,
  type HandoverLedgerProof,
} from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { PropertyHandover } from '@/types/property-handover';
import type {
  HandoverLineClosureCause,
  HandoverLineClosureRefusal,
  HandoverLineClosureRequest,
  HandoverLineEvidence,
} from '@/types/property-handover-line-closure';

import { handoverDocRef } from './property-handover-progress-write';
import { syncPropertyHandovers } from './property-handover-write.service';

const logger = createModuleLogger('PropertyHandoverLineClosure');

export interface HandoverLineClosureCommand extends Omit<HandoverLineClosureRequest, 'confirmIrreversible'> {
  readonly companyId: string;
  readonly propertyId: string;
  /** uid του ανθρώπου του γραφείου. */
  readonly performedBy: string;
}

export type HandoverLineClosureOutcome =
  | { readonly kind: 'closed' | 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverLineClosureRefusal }
  | { readonly kind: 'failed' };

/** Η παράδοση **αυτού** του ενοικιαστή και **αυτού** του ακινήτου — ξένη ή ανύπαρκτη ⇒ `null` (ίδια απάντηση). */
async function ownHandover(adminDb: AdminFirestore, command: HandoverLineClosureCommand): Promise<PropertyHandover | null> {
  const read = propertyHandoverFromDocument((await handoverDocRef(adminDb, command.handoverId).get()).data(), command.handoverId);
  // Η ΜΙΑ ερώτηση ιδιοκτησίας (ADR-742 · CHECK 3.7): ξένο = ανύπαρκτο, και η απόπειρα καταγράφεται.
  const handover = ownedOrNull(read, command.companyId, { resource: 'property handover', resourceId: command.handoverId, path: 'line-closure' });
  return handover !== null && handover.propertyId === command.propertyId ? handover : null;
}

interface MeasuredLine {
  readonly row: HandoverLedgerProof;
  readonly evidence: HandoverLineEvidence;
}

/** Η γραμμή + η φρέσκια μέτρησή της — `null` ⇒ η παράδοση δεν έχει τέτοια γραμμή (ή δεν έχει ακόμη παραλήπτη). */
async function measureLine(adminDb: AdminFirestore, handover: PropertyHandover, sourceFileId: string): Promise<MeasuredLine | null> {
  const row = (await readDeliveredRows(adminDb, handover)).find((candidate) => candidate.sourceFileId === sourceFileId);
  if (row === undefined || handover.recipient === null) return null;
  const ctx = { adminDb, handover, recipientUserId: handover.recipient.userId };
  const candidates = await candidatesOf(ctx, [row]);
  return { row, evidence: await probeDeliveredRow(row, candidates.get(row.sourceFileId) ?? []) };
}

/** Μετά το commit: η γραμμή ιστορικού της πηγής (αν υπάρχει ακόμη) + η συμφιλίωση (νέο αποτύπωμα v3 → Πρωτόκολλο). */
async function afterClosure(adminDb: AdminFirestore, command: HandoverLineClosureCommand, cause: HandoverLineClosureCause): Promise<void> {
  const source = (await deliverySourceRef(adminDb, command.sourceFileId).get()).data();
  const custody = source?.companyId === command.companyId ? fileCustodyOf(source) : null;
  if (custody !== null) {
    await recordFileAudit({
      fileId: command.sourceFileId,
      action: 'handover_line_closure',
      performedBy: command.performedBy,
      metadata: { handoverId: command.handoverId, cause, reason: command.reason.trim() },
      ...custodyOnly(custody),
    });
  }
  const synced = await syncPropertyHandovers(adminDb, command.propertyId, { cause: 'office-line-closure', performedBy: command.performedBy });
  // Το κλείσιμο ΔΕΣΜΕΥΤΗΚΕ· αποτυχία συμφιλίωσης = το δίχτυ (cron · νυχτερινό) θα την πιάσει — ποτέ άρνηση της πράξης.
  if (synced.kind === 'failed') logger.warn('Handover sync after line closure failed', { propertyId: command.propertyId, handoverId: command.handoverId });
}

/** **Κλείνει** μια γραμμή χωρίς πλήρες αποτύπωμα. Ιδεμπότητο (`unchanged`) · ποτέ δεν πετά. */
export async function closeHandoverLine(adminDb: AdminFirestore, command: HandoverLineClosureCommand): Promise<HandoverLineClosureOutcome> {
  try {
    const handover = await ownHandover(adminDb, command);
    const measured = handover === null ? null : await measureLine(adminDb, handover, command.sourceFileId);
    if (handover === null || measured === null) return { kind: 'refused', reason: 'line-unknown' };
    const verdict = handoverLineClosureOf(handover, measured.evidence);
    if (verdict.kind !== 'close') return verdict;
    const written = await recordDeliveryClosure(adminDb, command.handoverId, {
      sourceFileId: measured.row.sourceFileId, crc32c: measured.row.crc32c, size: measured.row.size,
      cause: verdict.cause, reason: command.reason.trim(), closedBy: command.performedBy,
    });
    if (written.kind !== 'closed') return written;
    // Ο24 — καμία απόδειξη δεν θα γραφτεί πια: ορφανή πηγή ⇒ τα bytes της στον sweeper (ποτέ δεν πετά).
    await releaseOrphanedSourceBytes(adminDb, command.handoverId, command.sourceFileId);
    await afterClosure(adminDb, command, verdict.cause);
    return { kind: 'closed' };
  } catch (error) {
    logger.error('Handover line closure failed', { propertyId: command.propertyId, handoverId: command.handoverId, error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}
