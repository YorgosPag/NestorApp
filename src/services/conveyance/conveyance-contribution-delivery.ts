/**
 * =============================================================================
 * Η ΠΑΡΑΔΟΣΗ ενός transmittal — δέσμευση · ίχνος · ειδοποίηση (ADR-901 Φ4.4)
 * =============================================================================
 *
 * Ό,τι ακολουθεί την εγγραφή της πράξης. Καμία αποτυχία εδώ **δεν** ακυρώνει την πράξη (ADR-862 §5.7): η πράξη
 * είναι η αλήθεια, και κάθε βήμα είναι **ιδεμποτές**, άρα η επανάληψη του αιτήματος συγκλίνει.
 *
 * 🔑 Δύο κανόνες που ζουν **εδώ**:
 * - **Το ίχνος δεν διαρρέει** (Α23): το βιβλίο της υπόθεσης το βλέπει ο οικοδεσπότης. Όταν **δεν** ανήκει στο ακροατήριο
 *   (π.χ. έκθεση δικηγόρου αγοραστή), η εγγραφή φέρει **μόνο** το αδιαφανές `fileId` — ποτέ όνομα αρχείου.
 * - **Παραλήπτες από τον ρόλο** (Α23): ενεργοί τώρα συμμετέχοντες στο ακροατήριο **που βλέπουν τη γραμμή**, και ο
 *   οικοδεσπότης μόνο αν ανήκει στο ακροατήριο. Ποτέ ο ίδιος ο συντάκτης.
 *
 * @module services/conveyance/conveyance-contribution-delivery
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import { CASE_DOCUMENT_FIELD, CASE_TRANSMITTAL_FIELD } from '@/lib/conveyance/case-activity';
import { reachesViewer } from '@/lib/conveyance/contribution-audience';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';
import type { EngagedCaseAccess } from './conveyance-engagement-access.service';
import { activeCaseEngagements, caseHostRecipients } from './conveyance-engagement-support';
import { ensureTransmittalHold, releaseTransmittalHold } from './conveyance-transmittal-hold';
import { announceDocumentToEngaged, announceDocumentToHost } from './conveyance-transmittal-notifier';

const logger = createModuleLogger('conveyance-contribution-delivery');

/** Η εγγραφή στο βιβλίο της υπόθεσης — με όνομα **μόνο** όταν ο οικοδεσπότης ανήκει στο ακροατήριο. */
async function recordTransmittal(access: EngagedCaseAccess, contribution: ConveyanceContribution, action: 'document_added' | 'document_removed'): Promise<void> {
  const label = reachesViewer(contribution.authorRole, 'host') ? contribution.file.displayName : undefined;
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: access.record.id,
    entityName: access.context.propertyName,
    action,
    changes: [
      { field: CASE_DOCUMENT_FIELD, oldValue: null, newValue: contribution.file.fileId, ...(label ? { label } : {}) },
      { field: CASE_TRANSMITTAL_FIELD, oldValue: contribution.supersedes, newValue: contribution.id, label: contribution.authorRole },
    ],
    performedBy: action === 'document_removed' ? contribution.withdrawnBy ?? contribution.authorUid : contribution.authorUid,
    performedByName: null,
    companyId: access.record.companyId,
  });
}

/** Ειδοποίηση σε όσους φτάνει η αποστολή — εκτός του συντάκτη. */
async function notifyAudience(db: Firestore, access: EngagedCaseAccess, item: ChecklistItem, contribution: ConveyanceContribution, nowMs: number): Promise<void> {
  const { record, context } = access;
  const author = contribution.authorUid;
  const notice = { record, propertyName: context.propertyName, contribution };
  const engaged = (await activeCaseEngagements(db, record, nowMs))
    .filter((e) => e.uid !== author && reachesViewer(contribution.authorRole, e.role) && item.visibleTo.includes(e.role));
  const hosts = reachesViewer(contribution.authorRole, 'host')
    ? (await caseHostRecipients(db, record)).filter((uid) => uid !== author)
    : [];
  await Promise.all([
    ...engaged.map((engagement) => announceDocumentToEngaged({ ...notice, engagement })),
    ...hosts.map((recipientUid) => announceDocumentToHost({ ...notice, recipientUid })),
  ]);
}

interface IssuedDelivery {
  readonly access: EngagedCaseAccess;
  readonly item: ChecklistItem;
  readonly contribution: ConveyanceContribution;
  /** Νέο έγγραφο (`issued`) — ίχνος/ειδοποίηση μόνο τότε· η δέσμευση συγκλίνει πάντα. */
  readonly fresh: boolean;
  readonly nowMs: number;
}

export async function deliverIssued(db: Firestore, delivery: IssuedDelivery): Promise<void> {
  const { access, contribution } = delivery;
  const hold = await ensureTransmittalHold(contribution.authorUid, contribution.file.fileId, contribution.caseId);
  if (hold !== 'held') logger.warn('Η σταλμένη έκδοση δεν δεσμεύτηκε', { contributionId: contribution.id, hold });
  if (!delivery.fresh) return;
  try {
    await recordTransmittal(access, contribution, 'document_added');
    await notifyAudience(db, access, delivery.item, contribution, delivery.nowMs);
  } catch (error) {
    logger.error('Η παράδοση του transmittal απέτυχε', { contributionId: contribution.id, error: error instanceof Error ? error.message : String(error) });
  }
}

interface WithdrawnDelivery {
  readonly access: EngagedCaseAccess;
  readonly contribution: ConveyanceContribution;
  /** Όλες οι αποστολές της υπόθεσης μετά την απόσυρση — `null` = δεν διαβάστηκαν (⇒ η δέσμευση **μένει**). */
  readonly remaining: readonly ConveyanceContribution[] | null;
}

export async function deliverWithdrawn(delivery: WithdrawnDelivery): Promise<void> {
  const { access, contribution, remaining } = delivery;
  await recordTransmittal(access, contribution, 'document_removed').catch((error: unknown) =>
    logger.error('Το ίχνος της απόσυρσης δεν γράφτηκε', { contributionId: contribution.id, error: error instanceof Error ? error.message : String(error) }));
  if (remaining === null) {
    logger.warn('Οι αποστολές δεν διαβάστηκαν — η δέσμευση μένει (ασφαλής πλευρά)', { contributionId: contribution.id });
    return;
  }
  const stillPinned = new Set(remaining
    .filter((c) => c.authorUid === contribution.authorUid && c.withdrawnAt === null && c.id !== contribution.id)
    .map((c) => c.file.fileId));
  const hold = await releaseTransmittalHold(contribution.authorUid, contribution.file.fileId, stillPinned);
  if (hold === 'failed' || hold === 'foreign-hold') logger.warn('Η δέσμευση δεν αποδεσμεύτηκε', { contributionId: contribution.id, hold });
}
