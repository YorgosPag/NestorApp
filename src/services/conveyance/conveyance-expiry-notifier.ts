/**
 * =============================================================================
 * Οι ειδοποιήσεις λήξεων δικαιολογητικών (ADR-901 Φ4 · §6 Σ-5 · ADR-026)
 * =============================================================================
 *
 * | Γεγονός | Προς | Πού |
 * |---|---|---|
 * | `caseExpiryHost` | δημιουργός υπόθεσης + διαχειριστές του χώρου | καρτέλα ακινήτου (χώρος εταιρείας) |
 * | `caseExpiryEngaged` | επαγγελματίας που συμμετέχει τώρα | σελίδα υπόθεσης (προσωπικός χώρος) |
 *
 * 🔑 **Δύο τύποι γεγονότων, μία προτίμηση** (`caseExpiryAlerts`): ο προορισμός είναι **ντετερμινιστικός ανά τύπο**
 *    (κανόνες προορισμού), όπως στο ζεύγος `caseEngagementChanged` / `caseEngagementAnswered` — ο προορισμός ζει
 *    στο `conveyance-case-notice.ts`.
 * 🔑 `eventId` με το **αποτύπωμα του συνόλου** (`expiryEventId`): ίδιο σύνολο σημαίνει καμία δεύτερη ειδοποίηση.
 * ⚠️ Αποτυχία ειδοποίησης **δεν** σταματά τη σάρωση: επιστρέφει `false` και καταγράφεται.
 *
 * @module services/conveyance/conveyance-expiry-notifier
 */

import 'server-only';

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { expiryEventId, expirySummary, type ExpiryAlert } from '@/lib/conveyance/expiry-alerts';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { caseNoticeCopy, noticeToEngaged, noticeToHost } from './conveyance-case-notice';

const FEATURE = 'conveyance-expiry';
const TITLE_KEY = 'caseExpiry.title';

interface ExpiryNotice {
  readonly record: ConveyanceCase;
  readonly propertyName: string | null;
  readonly alerts: readonly ExpiryAlert[];
}

function titleParamsOf(notice: ExpiryNotice): Record<string, string> {
  return { title: notice.propertyName ?? notice.record.id, count: String(expirySummary(notice.alerts).count) };
}

/** Ο οικοδεσπότης: όλες οι γραμμές που λήγουν, με προσγείωση στο ακίνητο, στον χώρο του. */
export async function announceExpiryToHost(notice: ExpiryNotice & { readonly recipientUid: string }): Promise<boolean> {
  const delivery = await noticeToHost({
    record: notice.record,
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_EXPIRY_HOST,
    eventId: expiryEventId(notice.record.id, notice.recipientUid, notice.alerts),
    copy: caseNoticeCopy(TITLE_KEY, titleParamsOf(notice), 'caseExpiry.hostBody'),
    feature: FEATURE,
    recipientUid: notice.recipientUid,
  });
  return delivery !== 'failed';
}

/** Ο επαγγελματίας: **μόνο** οι γραμμές του ρόλου του, με προσγείωση στη σελίδα της υπόθεσης, στον δικό του χώρο. */
export async function announceExpiryToEngaged(notice: ExpiryNotice & { readonly engagement: Engagement }): Promise<boolean> {
  const delivery = await noticeToEngaged({
    record: notice.record,
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_EXPIRY_ENGAGED,
    eventId: expiryEventId(notice.record.id, notice.engagement.uid, notice.alerts),
    copy: caseNoticeCopy(TITLE_KEY, titleParamsOf(notice), 'caseExpiry.engagedBody'),
    feature: FEATURE,
    engagement: notice.engagement,
  });
  return delivery !== 'failed';
}
