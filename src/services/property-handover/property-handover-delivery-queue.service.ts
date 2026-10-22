import 'server-only';

/**
 * @fileoverview **Η ουρά της παράδοσης αρχείων** — ό,τι οφείλεται και δεν τελείωσε, με προθεσμία (ADR-916 Φ-Γ1).
 * @related server/property-handover-delivery/handover-delivery.server.ts (ο εκτελεστής) ·
 *          property-handover-write.service.ts (ο ΕΝΑΣ γραφέας — καταγράφει την πρόοδο) · config/cron-schedule.ts
 * @module services/property-handover/property-handover-delivery-queue.service
 *
 * 🔑 **Η «ουρά» δεν είναι δεύτερη αλήθεια**: είναι ερώτημα ισότητας στο **παράγωγο** `fileDeliveryState` (το γράφει ο
 *    σειριοποιητής του γραφέα από το `fileDeliveryStateOf` — ποτέ χειρόγραφο). Δεν υπάρχει πίνακας εργασιών να χαθεί.
 * 🔑 **Δίκαιη**: κάθε παράδοση παίρνει το πολύ `HANDOVER_DELIVERY_CRON_FILE_BUDGET` αρχεία ανά εκτέλεση — ένα σπίτι με
 *    800 φωτογραφίες εργοταξίου δεν καθυστερεί τα υπόλοιπα.
 */

import type { Firestore as AdminFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  HANDOVER_DELIVERY_CRON_DEADLINE_MS,
  HANDOVER_DELIVERY_CRON_FILE_BUDGET,
  HANDOVER_DELIVERY_CRON_HASH_BYTE_BUDGET,
  HANDOVER_DELIVERY_CRON_HANDOVER_LIMIT,
} from '@/config/property-handover-delivery-policy';
import { HANDOVER_FILE_DELIVERY_QUEUE_STATES } from '@/lib/property-handover/handover-delivery-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import {
  deliverHandoverFiles,
  type HandoverFileDeliveryRecorder,
  type HandoverProtocolIssuer,
} from '@/server/property-handover-delivery/handover-delivery.server';

import { openHandoverProtocolRun } from './property-handover-protocol-write.service';
import { recordHandoverFileDelivery } from './property-handover-write.service';

export interface PropertyHandoverDeliveryReport {
  readonly queued: number;
  /** Παραδόσεις που έφτασαν στο `delivered` σε αυτή την εκτέλεση. */
  readonly completed: number;
  readonly copied: number;
  /** Αρχεία που απέτυχαν — ξαναδοκιμάζονται στην επόμενη εκτέλεση. */
  readonly failedFiles: number;
  /** Παραδόσεις που δεν έτρεξαν καθόλου (σφάλμα συνόλου/φακέλου) — βλ. ημερολόγιο. */
  readonly failedHandovers: number;
  /** Παραδόσεις που δεν πρόλαβαν πριν την προθεσμία — η επόμενη εκτέλεση (15′) συνεχίζει. */
  readonly deferred: number;
  /** Φ-Γ2 Σ4 — Πρωτόκολλα που οφείλονταν αλλά περιμένουν ρύθμιση παρόχου σφραγίδας (ADR-918) — ΕΝΑ σήμα, όχι σφάλμα. */
  readonly protocolsAwaitingSealConfiguration: number;
}

/** **Μία εκτέλεση της ουράς.** Ποτέ δεν πετά (ο εκτελεστής κρατά κάθε σφάλμα στη δική του παράδοση). */
export async function runPropertyHandoverDeliveryQueue(adminDb: AdminFirestore, startedAt: number = Date.now()): Promise<PropertyHandoverDeliveryReport> {
  const deadlineAt = startedAt + HANDOVER_DELIVERY_CRON_DEADLINE_MS;
  // tenant-scope-exempt: ουρά συστήματος — σαρώνει ΟΛΟΥΣ τους μισθωτές· κάθε παράδοση κουβαλά το δικό της `companyId`
  const snapshot = await adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS)
    .where('fileDeliveryState', 'in', [...HANDOVER_FILE_DELIVERY_QUEUE_STATES])
    .limit(HANDOVER_DELIVERY_CRON_HANDOVER_LIMIT)
    .get();
  const record: HandoverFileDeliveryRecorder = (input) => recordHandoverFileDelivery(adminDb, input);
  const report = { queued: snapshot.size, completed: 0, copied: 0, failedFiles: 0, failedHandovers: 0, deferred: 0 };
  // Σ4 — **μία** συνεδρία σφράγισης για όλη την εκτέλεση ⇒ ένα σήμα «περιμένει ρύθμιση», όσα κι αν οφείλονταν.
  const protocols = openHandoverProtocolRun(adminDb);
  let protocolsAwaitingSealConfiguration = 0;
  try {
    await deliverQueued(adminDb, snapshot.docs, { deadlineAt, record, issue: protocols.issue }, report);
  } finally {
    protocolsAwaitingSealConfiguration = protocols.finish();
  }
  return { ...report, protocolsAwaitingSealConfiguration };
}

interface QueueRun {
  readonly deadlineAt: number;
  readonly record: HandoverFileDeliveryRecorder;
  readonly issue: HandoverProtocolIssuer;
}

type MutableReport = Omit<PropertyHandoverDeliveryReport, 'protocolsAwaitingSealConfiguration'>;

async function deliverQueued(
  adminDb: AdminFirestore,
  docs: readonly QueryDocumentSnapshot[],
  run: QueueRun,
  report: { -readonly [K in keyof MutableReport]: MutableReport[K] },
): Promise<void> {
  const { deadlineAt, record } = run;
  for (const doc of docs) {
    const handover = propertyHandoverFromDocument(doc.data(), doc.id);
    if (handover === null) continue;
    if (Date.now() >= deadlineAt) {
      report.deferred += 1;
      continue;
    }
    const budget = { maxFiles: HANDOVER_DELIVERY_CRON_FILE_BUDGET, deadlineAt, maxHashBytes: HANDOVER_DELIVERY_CRON_HASH_BYTE_BUDGET };
    const outcome = await deliverHandoverFiles(adminDb, handover, budget, record, run.issue);
    report.copied += outcome.copied;
    report.failedFiles += outcome.failed;
    if (outcome.kind === 'delivered') report.completed += 1;
    if (outcome.kind === 'failed') report.failedHandovers += 1;
  }
}
