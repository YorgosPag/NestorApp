import 'server-only';

/**
 * @fileoverview **Ο ΕΚΤΕΛΕΣΤΗΣ ΤΗΣ ΠΑΡΑΔΟΣΗΣ ΑΡΧΕΙΩΝ** — τα παραδοτέα της εταιρείας γίνονται **αντίγραφα του αγοραστή**
 * (ADR-916 Φ-Γ1 · Δ2 · Δ4 · Δ5 · Π2 · Π5).
 * @related services/property-handover/property-handover-set.server.ts (τι παραδίδεται — η ΙΔΙΑ σύνθεση με την όψη του
 *          γραφείου) · lib/property-handover/handover-delivery-plan.ts (τι τώρα) · handover-delivery-copy.server.ts (ένα
 *          αρχείο) · services/property-handover/property-handover-write.service.ts (ο ΕΝΑΣ γραφέας — γράφει την πρόοδο)
 * @module server/property-handover-delivery/handover-delivery.server
 *
 * ```
 * οφείλεται; → σύνολο παράδοσης → φάκελοι-προορισμοί → καθολικό → σχέδιο (προϋπολογισμός) → δέσμες → sha256 (Σ2) → πρόοδος
 * ```
 * 🔑 **Δεν αγγίζει ποτέ τη συλλογή των παραδόσεων**: την πρόοδο τη γράφει ο **ένας** γραφέας, μέσω του καταγραφέα που
 *    του δίνεται (ίδιο πρότυπο με τα email της πρόσκλησης — κανένας κύκλος εισαγωγών, καμία δεύτερη διαδρομή).
 * 🔑 **Τρεις καλούντες, ένας κώδικας**: ο γραφέας μετά το commit (πρώτο κομμάτι), το cron των 15′ (τα υπόλοιπα), το
 *    νυχτερινό δίχτυ (συμπληρώσεις, Δ5). Ιδεμπότητος — δύο ταυτόχρονες εκτελέσεις γράφουν **ένα** αντίγραφο ανά αρχείο.
 * 🛡️ **Ποτέ δεν πετά**: αποτυχία = γραμμή στο ημερολόγιο + `failed`· η επόμενη εκτέλεση ξαναδοκιμάζει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import {
  fileDeliveryStateOf,
  handoverDeliveryDigest,
  planHandoverDelivery,
  type HandoverDeliveryPlan,
} from '@/lib/property-handover/handover-delivery-plan';
import { createModuleLogger } from '@/lib/telemetry';
import { loadHandoverSet } from '@/services/property-handover/property-handover-set.server';
import type { PropertyHandover, PropertyHandoverFileDelivery, PropertyHandoverRecipient } from '@/types/property-handover';

import { copyHandoverBatch, type HandoverCopyContext, type HandoverDeliverableItem } from './handover-delivery-copy.server';
import { ensureHandoverDossiers } from './handover-delivery-dossiers.server';
import { hashDeliveredRows, type HandoverHashRun } from './handover-delivery-hash.server';
import { predecessorsOf, readDeliveredRows, type HandoverLedgerProof } from './handover-delivery-ledger.server';

const logger = createModuleLogger('PropertyHandoverDelivery');

/** Αρχεία ανά δέσμη — ίδιο με τον ρυθμό του `copyPairs`, ώστε κάθε δέσμη να είναι **ένα** κύμα rewrite. */
const BATCH_SIZE = 8;

export interface HandoverDeliveryBudget {
  readonly maxFiles: number;
  /** `Date.now()` μετά από το οποίο **δεν** ξεκινά νέα δέσμη — `null` ⇒ μόνο το όριο αρχείων. */
  readonly deadlineAt: number | null;
  /** Φ-Γ2 Σ2 — bytes προς κατακερματισμό (sha256) σε αυτή την εκτέλεση· ίδια προθεσμία με την αντιγραφή. */
  readonly maxHashBytes: number;
}

/** Ο καταγραφέας της προόδου — τον δίνει ο **ένας** γραφέας της παράδοσης (CAS στον ίδιο παραλήπτη). */
export type HandoverFileDeliveryRecorder = (input: {
  readonly handoverId: string;
  readonly recipientUserId: string;
  readonly fileDelivery: PropertyHandoverFileDelivery;
}) => Promise<void>;

/**
 * Φ-Γ2 Σ4 — **ο εκδότης του Πρωτοκόλλου**, όταν η εκτέλεση καταλήγει `delivered`. Θύρα (όπως ο καταγραφέας): ο εκτελεστής
 * **δεν** ξέρει τίποτα για σφράγιση ή PDF, και ο γραφέας του πρωτοκόλλου μένει έξω από τον κύκλο εισαγωγών του. Τη δίνουν
 * οι καλούντες (inline · cron · νυχτερινό δίχτυ) με **μία** συνεδρία σφράγισης ανά εκτέλεσή τους. Δεν ρίχνει ποτέ.
 */
export type HandoverProtocolIssuer = (handover: PropertyHandover) => Promise<void>;

export interface HandoverDeliveryRunOutcome {
  readonly kind: 'not-due' | 'delivering' | 'delivered' | 'failed';
  readonly copied: number;
  readonly failed: number;
}

interface CopyRun {
  readonly rows: readonly HandoverLedgerProof[];
  /** Φ-Δ.4 — έπαψαν να είναι παραδοτέα μέσα στο παράθυρο (απόφαση γραφείου): βγαίνουν από το σύνολο, όχι αποτυχία. */
  readonly withdrawn: number;
  readonly failed: number;
  readonly lastError: string | null;
}

/** Οι δέσμες, ως την προθεσμία — ό,τι δεν πρόλαβε μένει για την επόμενη εκτέλεση (καμία κατάσταση να χαθεί). */
async function runBatches(ctx: HandoverCopyContext, plan: HandoverDeliveryPlan<HandoverDeliverableItem>, deadlineAt: number | null): Promise<CopyRun> {
  const rows: HandoverLedgerProof[] = [];
  let failed = 0;
  let withdrawn = 0;
  let lastError: string | null = null;
  for (let i = 0; i < plan.copies.length; i += BATCH_SIZE) {
    if (deadlineAt !== null && Date.now() >= deadlineAt) break;
    const result = await copyHandoverBatch(ctx, plan.copies.slice(i, i + BATCH_SIZE));
    rows.push(...result.rows);
    failed += result.failed;
    withdrawn += result.withdrawn;
    lastError = result.lastError ?? lastError;
  }
  return { rows, withdrawn, failed, lastError };
}

/**
 * **Η νέα πρόοδος** — από το καθολικό (την αλήθεια), ποτέ από μετρητή που ίσως έχασε μια εκτέλεση. `delivered` θέλει
 * **και** sha256 σε κάθε γραμμή (Σ2): ως τότε μένει `delivering`, ώστε η ουρά του cron να συνεχίσει τον κατακερματισμό.
 */
async function progressOf(
  previous: PropertyHandoverFileDelivery | null,
  total: number,
  run: CopyRun,
  hashing: HandoverHashRun,
  awaitingReview: number,
): Promise<PropertyHandoverFileDelivery> {
  const now = nowISO();
  const { rows } = hashing;
  const state = run.failed === 0 && hashing.pending === 0 && rows.length >= total ? 'delivered' : 'delivering';
  const completedAt = state !== 'delivered' ? null : previous?.state === 'delivered' && previous.completedAt !== null ? previous.completedAt : now;
  return {
    state, delivered: rows.length, total, awaitingReview,
    bytes: rows.reduce((sum, row) => sum + row.size, 0),
    digest: await handoverDeliveryDigest(rows),
    startedAt: previous?.startedAt ?? now,
    completedAt,
    lastError: state === 'delivered' ? null : run.lastError ?? hashing.lastError ?? previous?.lastError ?? null,
    unverifiable: state === 'delivered' ? 0 : hashing.unverifiable,
  };
}

/** Ίδια πρόοδος (εκτός χρονοσφραγίδων) ⇒ καμία εγγραφή: το νυχτερινό δίχτυ σε παραδομένη παράδοση γράφει **τίποτα**. */
function sameProgress(a: PropertyHandoverFileDelivery | null, b: PropertyHandoverFileDelivery): boolean {
  return a !== null && a.state === b.state && a.delivered === b.delivered && a.total === b.total
    && a.awaitingReview === b.awaitingReview && a.bytes === b.bytes && a.digest === b.digest && a.lastError === b.lastError
    && a.unverifiable === b.unverifiable;
}

async function runDelivery(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  recipient: PropertyHandoverRecipient,
  budget: HandoverDeliveryBudget,
  record: HandoverFileDeliveryRecorder,
  issueProtocol: HandoverProtocolIssuer | null,
): Promise<HandoverDeliveryRunOutcome> {
  const set = await loadHandoverSet(adminDb, handover.companyId, handover.propertyId);
  if (set === null) throw new Error(`Property ${handover.propertyId} not found in tenant ${handover.companyId}`);
  const targets = await ensureHandoverDossiers(adminDb, handover, recipient, set.subject);
  const delivered = await readDeliveredRows(adminDb, handover);
  const deliverable = set.deliver.map((file): HandoverDeliverableItem => ({ sourceFileId: file.doc.id, file }));
  const predecessorOf = await predecessorsOf(adminDb, handover.companyId, delivered, new Set(deliverable.map((item) => item.sourceFileId)));
  const plan = planHandoverDelivery({ deliverable, delivered, predecessorOf, budget: budget.maxFiles });
  const ctx: HandoverCopyContext = { adminDb, handover, recipientUserId: recipient.userId, targets };
  const run = await runBatches(ctx, plan, budget.deadlineAt);
  const hashing = await hashDeliveredRows(ctx, [...delivered, ...run.rows], { maxBytes: budget.maxHashBytes, deadlineAt: budget.deadlineAt });
  const progress = await progressOf(handover.fileDelivery, plan.total - run.withdrawn, run, hashing, set.review.length);
  if (!sameProgress(handover.fileDelivery, progress)) await record({ handoverId: handover.id, recipientUserId: recipient.userId, fileDelivery: progress });
  // Σ4 — και όταν η πρόοδος δεν άλλαξε (νυχτερινό δίχτυ): εκεί ξαναδοκιμάζεται σφράγιση που περίμενε ρύθμιση.
  if (progress.state === 'delivered' && issueProtocol !== null) await issueProtocol({ ...handover, fileDelivery: progress });
  if (run.rows.length > 0 || run.failed > 0 || hashing.hashed > 0) {
    logger.info('Παράδοση αρχείων αγοραστή', {
      handoverId: handover.id, copied: run.rows.length, failed: run.failed, hashed: hashing.hashed, unhashed: hashing.pending,
      delivered: progress.delivered, total: progress.total,
    });
  }
  return { kind: progress.state, copied: run.rows.length, failed: run.failed };
}

/**
 * **Παραδίδει** ό,τι οφείλεται και χωρά στον προϋπολογισμό. Ιδεμπότητο · ποτέ δεν πετά · `not-due` όταν η πώληση δεν
 * ολοκληρώθηκε ή ο αγοραστής δεν αποδέχτηκε ακόμη (δεν υπάρχει φάκελος-προορισμός).
 */
export async function deliverHandoverFiles(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  budget: HandoverDeliveryBudget,
  record: HandoverFileDeliveryRecorder,
  issueProtocol: HandoverProtocolIssuer | null = null,
): Promise<HandoverDeliveryRunOutcome> {
  const { recipient } = handover;
  if (recipient === null || fileDeliveryStateOf(handover) === null) return { kind: 'not-due', copied: 0, failed: 0 };
  try {
    return await runDelivery(adminDb, handover, recipient, budget, record, issueProtocol);
  } catch (error) {
    logger.error('Η παράδοση αρχείων αγοραστή απέτυχε', { handoverId: handover.id, error: getErrorMessage(error) });
    return { kind: 'failed', copied: 0, failed: 0 };
  }
}
