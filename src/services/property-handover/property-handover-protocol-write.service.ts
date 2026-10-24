import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ ΠΑΡΑΔΟΣΗΣ** — κρίση → στοιχεία → σφράγιση → bytes → μία συναλλαγή → ίχνη
 *               (ADR-916 Φ-Γ2 Σ4).
 * @related lib/property-handover/handover-protocol-plan.ts (η κρίση) · property-handover-protocol-facts.server.ts ·
 *          services/pdf/renderers/handover-protocol (το σφραγισμένο PDF) · property-handover-protocol-store.server.ts (bytes)
 * @module services/property-handover/property-handover-protocol-write.service
 *
 * 🔑 **Συμφιλίωση, όχι γεγονός** (Π5): ο γραφέας καλείται μετά από **κάθε** εκτέλεση της παράδοσης που κατέληξε `delivered`
 *    (inline · cron · νυχτερινό δίχτυ). Η κρίση λέει αν οφείλεται· όταν όχι, **καμία** ανάγνωση πέρα από την παράδοση.
 * 🔒 **Μία συναλλαγή** γεννά: το έγγραφο `phpr` · την εγγραφή της εταιρείας (`files`) · του αγοραστή (`files_personal`) ·
 *    τον δείκτη στην παράδοση + την προβολή στον φάκελο. **CAS** (`stageHandoverProtocolPointer`): αν στο μεταξύ η παράδοση
 *    άλλαξε αποτύπωμα, παραλήπτη ή δείκτη, **τίποτα** δεν γράφεται — τα bytes μένουν και η επόμενη εκτέλεση τα υιοθετεί.
 * ⛔ **Ποτέ δεν ρίχνει**: κάθε αποτυχία είναι ονομασμένη έκβαση· ο καλών (εκτελεστής παράδοσης) δεν σταματά ποτέ εξαιτίας της.
 * ⛔ **Κανένα ασφράγιστο Πρωτόκολλο**: χωρίς ρύθμιση παρόχου ⇒ `awaiting-seal-configuration`, και **τίποτα** στο GCS ή στη βάση.
 */

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { planHandoverProtocol, type HandoverProtocolNotDueReason } from '@/lib/property-handover/handover-protocol-plan';
import { propertyHandoverProtocolFromDocument } from '@/lib/property-handover/property-handover-protocol-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyKindOfScope } from '@/lib/workspace/custody-scope';
import { openSealSession, type SealSession } from '@/server/pdf-seal/seal-pdf.server';
import type { HandoverProtocolIssuer } from '@/server/property-handover-delivery/handover-delivery.server';
import { readyFileRecordData } from '@/server/property-handover-delivery/handover-delivery-copy.server';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { produceHandoverProtocolPdf, type HandoverProtocolPdfFailure } from '@/services/pdf/renderers/handover-protocol/handover-protocol-pdf.server';
import type { PropertyHandover } from '@/types/property-handover';
import type { PropertyHandoverProtocol } from '@/types/property-handover-protocol';

import { loadHandoverProtocolFacts, type DueHandoverProtocol, type HandoverProtocolRefusal } from './property-handover-protocol-facts.server';
import {
  HANDOVER_PROTOCOL_ACTOR,
  storeHandoverProtocol,
  type StoredHandoverProtocol,
  type StoredProtocolCopy,
} from './property-handover-protocol-store.server';
import { stageHandoverProtocolPointer, type HandoverProtocolPointerStage } from './property-handover-progress-write';
import { recordHandoverWrite } from './property-handover-write.service';

const logger = createModuleLogger('PropertyHandoverProtocolWrite');

export type HandoverProtocolIssueOutcome =
  | { readonly kind: 'issued'; readonly protocolId: string; readonly revision: number }
  | { readonly kind: 'current'; readonly protocolId: string }
  | { readonly kind: 'not-due'; readonly reason: HandoverProtocolNotDueReason; readonly unverifiable: number }
  | { readonly kind: 'refused'; readonly reason: HandoverProtocolRefusal; readonly detail: string }
  | { readonly kind: 'awaiting-seal-configuration' }
  /** Η παράδοση άλλαξε ανάμεσα στην κρίση και στη συναλλαγή — η επόμενη εκτέλεση κρίνει ξανά. */
  | { readonly kind: 'superseded' }
  | { readonly kind: 'failed'; readonly reason: HandoverProtocolPdfFailure | 'foreign-object' | 'copy-unproven' | 'error'; readonly detail: string };

type ReadyHandover = PropertyHandover & { readonly recipient: NonNullable<PropertyHandover['recipient']> };

const protocolRef = (adminDb: AdminFirestore, protocolId: string) => adminDb.collection(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS).doc(protocolId);
const companyFileRef = (adminDb: AdminFirestore, handover: PropertyHandover, fileId: string) =>
  adminDb.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope({ companyId: handover.companyId })]]).doc(fileId);
const recipientFileRef = (adminDb: AdminFirestore, handover: ReadyHandover, fileId: string) =>
  adminDb.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope({ userId: handover.recipient.userId })]]).doc(fileId);

/** Το έγγραφο `phpr`, όπως αποθηκεύεται — **χωρίς** `protocolId` (η ταυτότητα είναι το id του εγγράφου και νικά). */
function protocolDocument(handover: ReadyHandover, plan: DueHandoverProtocol, stored: StoredHandoverProtocol): Omit<PropertyHandoverProtocol, 'protocolId'> {
  const { view, sha256 } = stored.sealed;
  return {
    companyId: handover.companyId, propertyId: handover.propertyId, handoverId: handover.id, recipientUserId: handover.recipient.userId,
    revision: plan.revision, digest: plan.ledgerDigest, issuedAt: view.issuedAt, supersedesProtocolId: plan.supersedesProtocolId,
    pdfSha256: sha256, legalText: { version: view.legalText.version, digest: view.legalText.digest },
    companyFileId: stored.company.built.fileId, recipientFileId: stored.recipient.built.fileId,
    rows: view.rows.length, bytes: view.totalBytes,
  };
}

/**
 * Γέννηση εγγραφής αρχείου **μόνο αν λείπει** — η επανάληψη θεραπεύει ό,τι έλειψε, ποτέ διπλό.
 * 📜 ADR-916 Φ-Δ.6 — το αντίτυπο της εταιρείας γεννιέται **record** (`recordHold`) στην ίδια εγγραφή: κανένα παράθυρο όπου
 * υπάρχει χωρίς δέσμευση. Τα bytes του κλειδώθηκαν ήδη από τον αποθηκευτή, πριν από αυτή τη συναλλαγή.
 */
async function createFileIfAbsent(tx: Transaction, ref: DocumentReference, copy: StoredProtocolCopy, sha256: string): Promise<() => void> {
  const exists = (await tx.get(ref)).exists;
  return () => {
    if (exists) return;
    const ready = readyFileRecordData(copy.built, { sizeBytes: copy.sizeBytes, placement: copy.placement, hash: sha256 });
    tx.create(ref, { ...ready, ...(copy.recordHold ?? {}) });
  };
}

type CommitResult = { readonly kind: 'issued'; readonly stage: HandoverProtocolPointerStage } | { readonly kind: 'current' } | { readonly kind: 'superseded' };

/** **Η μία συναλλαγή** — αναγνώσεις πρώτα (υπάρχον πρωτόκολλο · αρχεία · CAS παράδοσης), γραφές στο τέλος. */
async function commitProtocol(adminDb: AdminFirestore, handover: ReadyHandover, plan: DueHandoverProtocol, stored: StoredHandoverProtocol): Promise<CommitResult> {
  const { view, sha256 } = stored.sealed;
  return adminDb.runTransaction(async (tx): Promise<CommitResult> => {
    const ref = protocolRef(adminDb, plan.protocolId);
    const existing = propertyHandoverProtocolFromDocument((await tx.get(ref)).data(), ref.id);
    if (existing !== null) return { kind: 'current' };
    const writeCompany = await createFileIfAbsent(tx, companyFileRef(adminDb, handover, stored.company.built.fileId), stored.company, sha256);
    const writeRecipient = await createFileIfAbsent(tx, recipientFileRef(adminDb, handover, stored.recipient.built.fileId), stored.recipient, sha256);
    const stage = await stageHandoverProtocolPointer(tx, adminDb, {
      handoverId: handover.id, recipientUserId: handover.recipient.userId, ledgerDigest: plan.ledgerDigest,
      previousProtocolId: plan.supersedesProtocolId,
      pointer: {
        protocolId: plan.protocolId, revision: plan.revision, digest: plan.ledgerDigest, issuedAt: view.issuedAt,
        companyFileId: stored.company.built.fileId, recipientFileId: stored.recipient.built.fileId,
      },
    });
    if (stage === null) return { kind: 'superseded' };
    tx.create(ref, protocolDocument(handover, plan, stored));
    writeCompany();
    writeRecipient();
    stage.commit();
    return { kind: 'issued', stage };
  });
}

/** Τα ίχνη **μετά** το commit: δύο γραμμές ιστορικού αρχείου + η μετάβαση της παράδοσης (ADR-195). */
async function recordIssued(handover: ReadyHandover, plan: DueHandoverProtocol, stored: StoredHandoverProtocol, stage: HandoverProtocolPointerStage): Promise<void> {
  const metadata = { handoverId: handover.id, protocolId: plan.protocolId, revision: plan.revision };
  await Promise.all([
    recordFileAudit({ fileId: stored.company.built.fileId, action: 'handover_protocol_issue', performedBy: HANDOVER_PROTOCOL_ACTOR, companyId: handover.companyId, metadata }),
    recordFileAudit({
      fileId: stored.recipient.built.fileId, action: 'handover_receive', performedBy: HANDOVER_PROTOCOL_ACTOR, userId: handover.recipient.userId,
      metadata: { ...metadata, issuerCompanyId: handover.companyId },
    }),
    recordHandoverWrite(stage.write, HANDOVER_PROTOCOL_ACTOR),
  ]);
}

/** Η οφειλόμενη έκδοση — ό,τι μπορεί να αρνηθεί ή να αποτύχει, με όνομα. */
async function issueDue(adminDb: AdminFirestore, handover: ReadyHandover, plan: DueHandoverProtocol, session: SealSession): Promise<HandoverProtocolIssueOutcome> {
  // Χωρίς πάροχο σφραγίδας **τίποτα** δεν διαβάζεται ούτε αποδίδεται — μόνο μετριέται (ένα σήμα ανά εκτέλεση).
  if (session.awaitingConfiguration() !== null) return { kind: 'awaiting-seal-configuration' };
  const facts = await loadHandoverProtocolFacts(adminDb, handover, plan, nowISO());
  if (facts.kind === 'refused') return facts;
  const produced = await produceHandoverProtocolPdf(facts.view, session);
  if (produced.kind === 'awaiting-seal-configuration') return { kind: 'awaiting-seal-configuration' };
  if (produced.kind === 'failed') return { kind: 'failed', reason: produced.reason, detail: produced.detail };
  const store = await storeHandoverProtocol(handover, { pdf: produced.pdf, sha256: produced.sha256, view: facts.view });
  if (store.kind === 'failed') return store;
  const committed = await commitProtocol(adminDb, handover, plan, store.stored);
  if (committed.kind === 'current') return { kind: 'current', protocolId: plan.protocolId };
  if (committed.kind === 'superseded') return committed;
  await recordIssued(handover, plan, store.stored, committed.stage);
  return { kind: 'issued', protocolId: plan.protocolId, revision: plan.revision };
}

/** Μία γραμμή ημερολογίου ανά έκβαση που αξίζει — η αναμονή ρύθμισης **όχι**: τη μετρά η συνεδρία (ένα σήμα ανά εκτέλεση). */
function logOutcome(handover: PropertyHandover, outcome: HandoverProtocolIssueOutcome): void {
  const context = { handoverId: handover.id };
  if (outcome.kind === 'issued') logger.info('Πρωτόκολλο παράδοσης εκδόθηκε', { ...context, protocolId: outcome.protocolId, revision: outcome.revision });
  else if (outcome.kind === 'refused') logger.warn('Πρωτόκολλο παράδοσης: άρνηση έκδοσης', { ...context, reason: outcome.reason, detail: outcome.detail });
  else if (outcome.kind === 'failed') logger.error('Πρωτόκολλο παράδοσης: αποτυχία', { ...context, reason: outcome.reason, detail: outcome.detail });
  else if (outcome.kind === 'not-due' && outcome.reason === 'unverifiable-rows') {
    logger.warn('Πρωτόκολλο παράδοσης: γραμμές χωρίς αποδείξιμα bytes (Ο13)', { ...context, unverifiable: outcome.unverifiable });
  }
}

/** **Ο εκδότης μιας εκτέλεσης** — η θύρα του εκτελεστή, πάνω σε **μία** συνεδρία σφράγισης. */
export interface HandoverProtocolRun {
  readonly issue: HandoverProtocolIssuer;
  /** Κλείνει την εκτέλεση: **ένα** σήμα αν κάποιο πρωτόκολλο περίμενε ρύθμιση· επιστρέφει πόσα. */
  finish(): number;
}

/** Ανοίγει μία εκτέλεση έκδοσης — ο καλών (inline · cron · νυχτερινό δίχτυ) την κλείνει με `finish()`. */
export function openHandoverProtocolRun(adminDb: AdminFirestore, session: SealSession = openSealSession()): HandoverProtocolRun {
  return {
    issue: async (handover) => logOutcome(handover, await issueHandoverProtocol(adminDb, handover, session)),
    finish: () => session.finish(),
  };
}

/**
 * **Εκδίδει το Πρωτόκολλο όταν οφείλεται.** Ιδεμπότητο: ίδιο καθολικό ⇒ ίδιο `phpr` ⇒ η δεύτερη εκτέλεση βρίσκει το πρώτο.
 * Η συνεδρία σφράγισης ανοίγει **μία** ανά εκτέλεση από τον καλούντα (ένα σήμα «περιμένει ρύθμιση», ADR-918).
 */
export async function issueHandoverProtocol(adminDb: AdminFirestore, handover: PropertyHandover, session: SealSession): Promise<HandoverProtocolIssueOutcome> {
  const plan = planHandoverProtocol(handover);
  if (plan.kind === 'not-due') return plan;
  if (plan.kind === 'current') return plan;
  if (handover.recipient === null) return { kind: 'not-due', reason: 'not-ready', unverifiable: 0 };
  try {
    return await issueDue(adminDb, { ...handover, recipient: handover.recipient }, plan, session);
  } catch (error) {
    logger.error('Πρωτόκολλο παράδοσης: αποτυχία έκδοσης', { handoverId: handover.id, protocolId: plan.protocolId, error: getErrorMessage(error) });
    return { kind: 'failed', reason: 'error', detail: getErrorMessage(error) };
  }
}
