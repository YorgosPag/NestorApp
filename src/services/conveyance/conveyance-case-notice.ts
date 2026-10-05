/**
 * =============================================================================
 * Η ΜΙΑ αποστολή ειδοποίησης υπόθεσης — οικοδεσπότης ή επαγγελματίας (ADR-901 Φ4 · Φ4.4 · Φ4.5)
 * =============================================================================
 *
 * Κάθε ειδοποίηση της υπόθεσης έχει **δύο** παραλλαγές με ντετερμινιστικό προορισμό (κανόνες προορισμού):
 *
 * | Προς | `tenantId` | Οντότητα | Προσγείωση |
 * |---|---|---|---|
 * | οικοδεσπότη (δημιουργός + διαχειριστές χώρου) | ο μισθωτής της υπόθεσης | ακίνητο | `caseEngagementAnsweredDestination` |
 * | επαγγελματία (ενεργή συμμετοχή) | **ο ίδιος** (μισθωτής του εαυτού του) | συμμετοχή | `caseEngagementChangedDestination` |
 *
 * Ήταν αντιγραμμένο σε κάθε notifier (λήξεις · transmittal) — ο τρίτος (αίτημα εγγράφου) θα το έκανε τριπλότυπο.
 *
 * 🔑 Το αποτέλεσμα **δεν** χάνεται: `sent` · `skipped` (διπλότυπο `eventId` ή προτίμηση) · `failed`. Η αποτυχία
 *    ειδοποίησης **δεν** πετά ποτέ — καταγράφεται και επιστρέφεται.
 *
 * @module services/conveyance/conveyance-case-notice
 */

import 'server-only';

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  SOURCE_SERVICES,
  type NotificationEventType,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification, type DispatchResult } from '@/server/notifications/notification-orchestrator';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { caseEngagementAnsweredDestination, caseEngagementChangedDestination } from './conveyance-engagement-notifier';

const logger = createModuleLogger('conveyance-case-notice');

/** Το κείμενο στα ελληνικά για το σώμα της εγγραφής + κλειδιά για την απόδοση στη γλώσσα του παραλήπτη. */
export const caseNoticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

export type CaseNoticeDelivery = 'sent' | 'skipped' | 'failed';

export interface CaseNoticeCopy {
  readonly title: string;
  readonly titleKey: string;
  readonly titleParams: Record<string, string>;
  readonly body: string;
  readonly bodyKey: string;
  readonly bodyParams?: Record<string, string>;
}

interface CaseNotice {
  readonly record: ConveyanceCase;
  readonly eventType: NotificationEventType;
  readonly eventId: string;
  readonly copy: CaseNoticeCopy;
  /** Το χαρακτηριστικό που στέλνει (`source.feature`) — για τα logs και την ανίχνευση. */
  readonly feature: string;
}

/** Ο **κοινός** τίτλος/σώμα από κλειδιά του `common-shared` — η ελληνική απόδοση για το αποθηκευμένο κείμενο. */
export function caseNoticeCopy(titleKey: string, titleParams: Record<string, string>, bodyKey: string, bodyParams?: Record<string, string>): CaseNoticeCopy {
  return {
    title: caseNoticeT(titleKey, titleParams),
    titleKey,
    titleParams,
    body: caseNoticeT(bodyKey, bodyParams),
    bodyKey,
    ...(bodyParams ? { bodyParams } : {}),
  };
}

async function deliver(notice: CaseNotice, run: () => Promise<DispatchResult>): Promise<CaseNoticeDelivery> {
  try {
    const result = await run();
    return result.skipped ? 'skipped' : 'sent';
  } catch (error) {
    logger.error('Η ειδοποίηση υπόθεσης δεν στάλθηκε', {
      feature: notice.feature,
      eventId: notice.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

function sourceOf(notice: CaseNotice) {
  return { service: SOURCE_SERVICES.PROPERTIES, feature: notice.feature, env: getCurrentEnvironment() };
}

/** Προς τον **οικοδεσπότη**: προσγείωση στο ακίνητο, στον χώρο της εταιρείας. */
export function noticeToHost(notice: CaseNotice & { readonly recipientUid: string }): Promise<CaseNoticeDelivery> {
  const propertyId = notice.record.subject.propertyId;
  return deliver(notice, () => dispatchNotification({
    eventType: notice.eventType,
    recipientId: notice.recipientUid,
    tenantId: notice.record.companyId,
    ...notice.copy,
    eventId: notice.eventId,
    entityId: propertyId,
    entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
    ...caseEngagementAnsweredDestination(propertyId, notice.record.companyId),
    source: sourceOf(notice),
  }));
}

/** Προς τον **επαγγελματία**: προσγείωση στη σελίδα της υπόθεσης, στον δικό του χώρο. */
export function noticeToEngaged(notice: CaseNotice & { readonly engagement: Engagement }): Promise<CaseNoticeDelivery> {
  const { engagement } = notice;
  return deliver(notice, () => dispatchNotification({
    eventType: notice.eventType,
    recipientId: engagement.uid,
    // 🔑 Ο επαγγελματίας είναι ο μισθωτής του εαυτού του (ίδιο ιδίωμα με το `caseEngagementChanged`).
    tenantId: engagement.uid,
    ...notice.copy,
    eventId: notice.eventId,
    entityId: engagement.id,
    entityType: NOTIFICATION_ENTITY_TYPES.ENGAGEMENT,
    ...caseEngagementChangedDestination(engagement),
    source: sourceOf(notice),
  }));
}
