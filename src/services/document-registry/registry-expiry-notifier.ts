/**
 * =============================================================================
 * Η ειδοποίηση του μητρώου λήξεων — μία σύνοψη ανά παραλήπτη (ADR-915 Φ5α · §12 · ADR-026)
 * =============================================================================
 *
 * | Γεγονός | Προς | Πού προσγειώνεται |
 * |---|---|---|
 * | `properties.documentExpiry` | οι ενεργοί διαχειριστές του χώρου (Φ5α· ο υπεύθυνος εγγράφων = Φ5β) | η **στενότερη** προβολή του μητρώου που περιέχει κάθε γραμμή της σύνοψης |
 *
 * 🔑 `eventId` = (εταιρεία, παραλήπτης, αποτύπωμα των **ακμών**): η επανάληψη πριν γραφτεί το ημερολόγιο δεν διπλασιάζει.
 * 🔑 Προορισμός **πάντα** από βοηθό διαδρομής (`documentExpiryHref`) και **πάντα** με τον χώρο του γραφείου (ADR-849 §6δ).
 * ⚠️ Αποτυχία **δεν** σταματά τη σάρωση: επιστρέφει `'failed'` και καταγράφεται.
 *
 * @module services/document-registry/registry-expiry-notifier
 */

import 'server-only';

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { documentExpiryHref, type RegistryView } from '@/lib/document-validity/document-registry-view';
import { expiryAlertsDigest, type ExpiryAlert } from '@/lib/document-validity/expiry-alert-stage';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { orgWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('registry-expiry-notifier');
const FEATURE = 'document-expiry';
const BODY_KEY = 'documentExpiry.body';
const BLOCKING_BODY_KEY = 'documentExpiry.blockingBody';

/** Η ελληνική απόδοση για το αποθηκευμένο κείμενο (και το email)· ο drawer αποδίδει από τα κλειδιά. */
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

export type RegistryNoticeDelivery = 'sent' | 'skipped' | 'failed';

export interface RegistryExpiryNotice {
  readonly companyId: string;
  readonly recipientUid: string;
  /** Οι **ακμές** — μόνο ό,τι είναι νέο. Ποτέ κενό (ο καλών σιωπά πριν φτάσει εδώ). */
  readonly alerts: readonly ExpiryAlert[];
  readonly view: RegistryView;
}

/** Ντετερμινιστικό: ίδιες ακμές για τον ίδιο άνθρωπο ⇒ ίδιο `eventId` ⇒ καμία δεύτερη ειδοποίηση. */
export function registryExpiryEventId(companyId: string, recipientUid: string, alerts: readonly ExpiryAlert[]): string {
  return `document-expiry:${companyId}:${recipientUid}:${expiryAlertsDigest(alerts)}`;
}

function copyOf(alerts: readonly ExpiryAlert[]) {
  // 🔑 Τοπική σταθερά με κυριολεκτικό κλειδί: έτσι τη βλέπει η άγκυρα προσβασιμότητας (ADR-841 Α18.14). Ζει στο `common-shared`.
  const titleKey = 'documentExpiry.title';
  const titleParams = { count: String(alerts.length) };
  const blocking = alerts.filter((alert) => alert.blocking).length;
  const bodyKey = blocking > 0 ? BLOCKING_BODY_KEY : BODY_KEY;
  const bodyParams = blocking > 0 ? { blocking: String(blocking) } : undefined;
  return {
    title: noticeT(titleKey, titleParams),
    titleKey,
    titleParams,
    body: noticeT(bodyKey, bodyParams),
    bodyKey,
    ...(bodyParams ? { bodyParams } : {}),
  };
}

/** Μία σύνοψη προς έναν άνθρωπο του γραφείου. */
export async function announceRegistryExpiry(notice: RegistryExpiryNotice): Promise<RegistryNoticeDelivery> {
  const eventId = registryExpiryEventId(notice.companyId, notice.recipientUid, notice.alerts);
  try {
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_EXPIRY,
      recipientId: notice.recipientUid,
      tenantId: notice.companyId,
      ...copyOf(notice.alerts),
      eventId,
      ...viewDestination(documentExpiryHref(notice.view), orgWorkspace(notice.companyId)),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() },
    });
    return result.skipped ? 'skipped' : 'sent';
  } catch (error) {
    logger.error('Η ειδοποίηση του μητρώου λήξεων δεν στάλθηκε', {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}
