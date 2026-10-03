/**
 * =============================================================================
 * Ειδοποιήσεις λήξεων δικαιολογητικών — η ΣΑΡΩΣΗ (ADR-901 Φ4 · §6 Σ-5)
 * =============================================================================
 *
 * Μία φορά τη μέρα: για κάθε **ανοιχτή** (όχι ακόμη υπογεγραμμένη) υπόθεση, ο κατάλογος ξαναπαράγεται από τα
 * αρχεία και κάθε παραλήπτης παίρνει **μία** σύνοψη με τις γραμμές του που λήγουν ή δεν θα ισχύουν στην υπογραφή.
 * Η σύνοψη φεύγει **μόνο** αν το σύνολο άλλαξε (`expiryEventId`, ακμή, όχι στάθμη).
 *
 * | Παραλήπτης | Ποιες γραμμές | Πού προσγειώνεται |
 * |---|---|---|
 * | οικοδεσπότης: ο δημιουργός της υπόθεσης + οι διαχειριστές του χώρου | όλες | καρτέλα ακινήτου (χώρος εταιρείας) |
 * | κάθε επαγγελματίας που συμμετέχει **τώρα** | **μόνο** του ρόλου του (`visibleTo`, Α22) | η σελίδα της υπόθεσης (προσωπικός χώρος) |
 *
 * 🔑 Μετά την υπογραφή (`signed`) η ισχύς των πιστοποιητικών δεν κρίνει πια τίποτα, άρα σιωπή.
 * 🔑 Αποτυχία μιας υπόθεσης **δεν** σταματά τις υπόλοιπες. Η επανάληψη είναι ακίνδυνη (ντετερμινιστικό `eventId`).
 *
 * @module services/conveyance/conveyance-expiry-alerts.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideEngagement, isEngaged } from '@/lib/auth/engagement-judge';
import { effectiveCaseState } from '@/lib/conveyance/case-state';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { expiryAlertsOf } from '@/lib/conveyance/expiry-alerts';
import { createModuleLogger } from '@/lib/telemetry';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { checklistForRole, engagementChecklistViewer, HOST_CHECKLIST_VIEWER } from './conveyance-engagement-access.service';
import { listCaseEngagements } from './conveyance-engagement-support';
import { announceExpiryToEngaged, announceExpiryToHost } from './conveyance-expiry-notifier';
import { loadConveyanceSubject, type ConveyanceSubjectContext } from './conveyance-subject.server';

const logger = createModuleLogger('conveyance-expiry-alerts');

/** Φραγμένη σάρωση: περισσότερες ⇒ `truncated` στην αναφορά (ποτέ σιωπηλά). */
export const EXPIRY_SWEEP_LIMIT = 200;

export interface ExpirySweepReport {
  readonly considered: number;
  readonly notified: number;
  readonly skipped: number;
  readonly failed: number;
  readonly truncated: boolean;
}

/** Ο οικοδεσπότης: ο δημιουργός της υπόθεσης **και** οι ενεργοί διαχειριστές του χώρου, χωρίς διπλά. */
async function hostRecipients(db: Firestore, record: ConveyanceCase): Promise<string[]> {
  return [...new Set([record.createdBy, ...(await activeWorkspaceAdministrators(db, record.companyId))])];
}

function engagedNow(engagement: Engagement, nowMs: number): boolean {
  if (engagement.state !== 'active') return false;
  return isEngaged(decideEngagement({ engagement, uid: engagement.uid, subject: engagement.subject, scope: 'conveyance:case:view', nowMs }).verdict);
}

async function alertHost(db: Firestore, record: ConveyanceCase, context: ConveyanceSubjectContext): Promise<number> {
  const alerts = expiryAlertsOf((await checklistForRole(db, record, context, HOST_CHECKLIST_VIEWER)).rows);
  if (alerts.length === 0) return 0;
  const recipients = await hostRecipients(db, record);
  const sent = await Promise.all(recipients.map((uid) => announceExpiryToHost({ record, propertyName: context.propertyName, recipientUid: uid, alerts })));
  return sent.filter(Boolean).length;
}

async function alertEngaged(db: Firestore, record: ConveyanceCase, context: ConveyanceSubjectContext, nowMs: number): Promise<number> {
  const projectId = record.subject.projectId;
  if (!projectId) return 0;
  const engaged = (await listCaseEngagements(db, record.companyId, projectId, record.id)).filter((e) => engagedNow(e, nowMs));
  const sent = await Promise.all(engaged.map(async (engagement) => {
    const alerts = expiryAlertsOf((await checklistForRole(db, record, context, engagementChecklistViewer(engagement))).rows);
    return alerts.length > 0 && announceExpiryToEngaged({ record, propertyName: context.propertyName, engagement, alerts });
  }));
  return sent.filter(Boolean).length;
}

/** Μία υπόθεση ⇒ πόσες ειδοποιήσεις, ή `skipped` (υπογεγραμμένη ή χωρίς αναγνώσιμο ακίνητο). */
async function sweepCase(db: Firestore, record: ConveyanceCase, nowMs: number): Promise<number | 'skipped'> {
  const context = await loadConveyanceSubject(db, record.companyId, record.subject.propertyId);
  if (!context || effectiveCaseState(record.storedState, context.legalPhase) !== 'open') return 'skipped';
  const [host, engaged] = await Promise.all([alertHost(db, record, context), alertEngaged(db, record, context, nowMs)]);
  return host + engaged;
}

export async function sweepConveyanceExpiryAlerts(db: Firestore, nowMs: number): Promise<ExpirySweepReport> {
  // tenant-scope-exempt: cron μηχανής→μηχανής που σαρώνει τις ανοιχτές υποθέσεις ΟΛΩΝ των μισθωτών εκ σχεδιασμού
  // (καμία τιμή από αίτημα χρήστη). Κάθε ειδοποίηση πηγαίνει στον μισθωτή ΤΗΣ ΥΠΟΘΕΣΗΣ (`record.companyId`).
  const snapshot = await db.collection(COLLECTIONS.CONVEYANCE_CASES).where('storedState', '==', 'open').limit(EXPIRY_SWEEP_LIMIT + 1).get();
  const docs = snapshot.docs.slice(0, EXPIRY_SWEEP_LIMIT);
  let notified = 0;
  let skipped = 0;
  let failed = 0;
  for (const doc of docs) {
    const record = parseConveyanceCase(doc.data());
    if (!record) { skipped += 1; continue; }
    try {
      const outcome = await sweepCase(db, record, nowMs);
      if (outcome === 'skipped') skipped += 1;
      else notified += outcome;
    } catch (error) {
      failed += 1;
      logger.error('Η σάρωση λήξεων απέτυχε για υπόθεση', { caseId: record.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { considered: docs.length, notified, skipped, failed, truncated: snapshot.docs.length > EXPIRY_SWEEP_LIMIT };
}
