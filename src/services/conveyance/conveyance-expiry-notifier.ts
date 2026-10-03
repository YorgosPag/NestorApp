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
 *    (κανόνες προορισμού), όπως στο ζεύγος `caseEngagementChanged` / `caseEngagementAnswered`.
 * 🔑 `eventId` με το **αποτύπωμα του συνόλου** (`expiryEventId`): ίδιο σύνολο σημαίνει καμία δεύτερη ειδοποίηση.
 * ⚠️ Αποτυχία ειδοποίησης **δεν** σταματά τη σάρωση: επιστρέφει `false` και καταγράφεται.
 *
 * @module services/conveyance/conveyance-expiry-notifier
 */

import 'server-only';

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { expiryEventId, expirySummary, type ExpiryAlert } from '@/lib/conveyance/expiry-alerts';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { caseEngagementAnsweredDestination, caseEngagementChangedDestination } from './conveyance-engagement-notifier';

const logger = createModuleLogger('conveyance-expiry-notifier');

const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

const TITLE_KEY = 'caseExpiry.title';

interface ExpiryNotice {
  readonly record: ConveyanceCase;
  readonly propertyName: string | null;
  readonly alerts: readonly ExpiryAlert[];
}

function titleParamsOf(notice: ExpiryNotice): Record<string, string> {
  return { title: notice.propertyName ?? notice.record.id, count: String(expirySummary(notice.alerts).count) };
}

async function send(eventId: string, run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    logger.error('Η ειδοποίηση λήξεων δεν στάλθηκε', { eventId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Ο οικοδεσπότης: όλες οι γραμμές που λήγουν, με προσγείωση στο ακίνητο, στον χώρο του. */
export function announceExpiryToHost(notice: ExpiryNotice & { readonly recipientUid: string }): Promise<boolean> {
  const eventId = expiryEventId(notice.record.id, notice.recipientUid, notice.alerts);
  const titleParams = titleParamsOf(notice);
  const propertyId = notice.record.subject.propertyId;
  return send(eventId, () => dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_EXPIRY_HOST,
    recipientId: notice.recipientUid,
    tenantId: notice.record.companyId,
    title: elSharedT(TITLE_KEY, titleParams),
    titleKey: TITLE_KEY,
    titleParams,
    body: elSharedT('caseExpiry.hostBody'),
    bodyKey: 'caseExpiry.hostBody',
    eventId,
    entityId: propertyId,
    entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
    ...caseEngagementAnsweredDestination(propertyId, notice.record.companyId),
    source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'conveyance-expiry', env: getCurrentEnvironment() },
  }));
}

/** Ο επαγγελματίας: **μόνο** οι γραμμές του ρόλου του, με προσγείωση στη σελίδα της υπόθεσης, στον δικό του χώρο. */
export function announceExpiryToEngaged(notice: ExpiryNotice & { readonly engagement: Engagement }): Promise<boolean> {
  const { engagement } = notice;
  const eventId = expiryEventId(notice.record.id, engagement.uid, notice.alerts);
  const titleParams = titleParamsOf(notice);
  return send(eventId, () => dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_EXPIRY_ENGAGED,
    recipientId: engagement.uid,
    // 🔑 Ο επαγγελματίας είναι ο μισθωτής του εαυτού του (ίδιο ιδίωμα με το `caseEngagementChanged`).
    tenantId: engagement.uid,
    title: elSharedT(TITLE_KEY, titleParams),
    titleKey: TITLE_KEY,
    titleParams,
    body: elSharedT('caseExpiry.engagedBody'),
    bodyKey: 'caseExpiry.engagedBody',
    eventId,
    entityId: engagement.id,
    entityType: NOTIFICATION_ENTITY_TYPES.ENGAGEMENT,
    ...caseEngagementChangedDestination(engagement.id, engagement.uid),
    source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'conveyance-expiry', env: getCurrentEnvironment() },
  }));
}
