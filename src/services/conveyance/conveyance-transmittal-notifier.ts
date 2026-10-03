/**
 * =============================================================================
 * «Νέο έγγραφο / νέα έκδοση στην υπόθεση» — η ειδοποίηση του transmittal (ADR-901 Φ4.4 · Φ4.5)
 * =============================================================================
 *
 * Φεύγει **μόνο** προς όσους ανήκουν στο ακροατήριο του ρόλου του συντάκτη (`contribution-audience.ts`) — τους
 * υπολογίζει ο γραφέας, όχι αυτό το module. Δύο τύποι γεγονότος για ντετερμινιστικό προορισμό (ίδιο ζεύγος με τη
 * συμμετοχή και τις λήξεις): ο οικοδεσπότης → καρτέλα ακινήτου · ο επαγγελματίας → σελίδα της υπόθεσης.
 *
 * Φ4.5 — αποστολή που **διαδέχεται** άλλη (`supersedes`) λέει «Νέα έκδοση», όχι «Νέο έγγραφο»: ο παραλήπτης ξέρει
 * ότι αυτό που είχε **αντικαταστάθηκε** (Aconex «superseded»).
 *
 * 🔑 `eventId` = `case-transmittal:<contributionId>:<uid>` — ντετερμινιστικό: η επανάληψη του αιτήματος **δεν**
 * στέλνει δεύτερη ειδοποίηση. Η αποτυχία ειδοποίησης **δεν** ακυρώνει την αποστολή (καταγράφεται).
 *
 * @module services/conveyance/conveyance-transmittal-notifier
 */

import 'server-only';

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';
import type { Engagement } from '@/types/engagement';
import { caseNoticeCopy, noticeToEngaged, noticeToHost, type CaseNoticeCopy } from './conveyance-case-notice';

const FEATURE = 'conveyance-transmittal';

interface TransmittalNotice {
  readonly record: ConveyanceCase;
  readonly propertyName: string | null;
  readonly contribution: ConveyanceContribution;
}

function transmittalEventId(contributionId: string, recipientUid: string): string {
  return `case-transmittal:${contributionId}:${recipientUid}`;
}

function copyOf(notice: TransmittalNotice): CaseNoticeCopy {
  const titleKey = notice.contribution.supersedes === null ? 'caseDocument.title' : 'caseDocument.revisionTitle';
  const titleParams = { title: notice.propertyName ?? notice.record.id, document: notice.contribution.file.displayName };
  return caseNoticeCopy(titleKey, titleParams, `caseDocument.body.${notice.contribution.authorRole}`);
}

export async function announceDocumentToHost(notice: TransmittalNotice & { readonly recipientUid: string }): Promise<boolean> {
  const delivery = await noticeToHost({
    record: notice.record,
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_HOST,
    eventId: transmittalEventId(notice.contribution.id, notice.recipientUid),
    copy: copyOf(notice),
    feature: FEATURE,
    recipientUid: notice.recipientUid,
  });
  return delivery !== 'failed';
}

export async function announceDocumentToEngaged(notice: TransmittalNotice & { readonly engagement: Engagement }): Promise<boolean> {
  const delivery = await noticeToEngaged({
    record: notice.record,
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_ENGAGED,
    eventId: transmittalEventId(notice.contribution.id, notice.engagement.uid),
    copy: copyOf(notice),
    feature: FEATURE,
    engagement: notice.engagement,
  });
  return delivery !== 'failed';
}
