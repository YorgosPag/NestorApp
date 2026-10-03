/**
 * =============================================================================
 * Οι ειδοποιήσεις της συμμετοχής σε υπόθεση μεταβίβασης (ADR-901 Φ2 · ADR-026)
 * =============================================================================
 *
 * | Γεγονός | Προς | Γιατί |
 * |---|---|---|
 * | `caseEngagementChanged` (προτάθηκε · ανακλήθηκε · αποσύρθηκε · ολοκληρώθηκε) | επαγγελματία | πρόσβαση σε νομική υπόθεση **δεν** ανοίγει ούτε κλείνει σιωπηλά — η ανάκληση είναι **ειπωμένη** (ADR-787 Ε-2 §5) |
 * | `caseEngagementAnswered` (ανέλαβε · δεν ανέλαβε) | όποιον πρότεινε | το «Save & Send Notification» του Procore, **με** κλείσιμο του κύκλου |
 *
 * 🔑 Το θέμα του email βγαίνει **από το locale** (`createBundleTranslate`, ιδίωμα `first-contact-notifier`):
 *    κουδούνι και email δεν μπορούν να πουν άλλα. Κλειδί **ανά ρόλο**, όχι παράμετρος `{role}` — αλλιώς
 *    ελληνικό όνομα ρόλου θα έφτανε σε αγγλική οθόνη.
 * ⚠️ **Καμία αποτυχία ειδοποίησης δεν ακυρώνει την πράξη**: η συμμετοχή γράφτηκε ήδη· η ειδοποίηση είναι
 *    παρενέργεια (N.7.2 #6 — fire-and-forget **μόνο** για μη κρίσιμο).
 *
 * @module services/conveyance/conveyance-engagement-notifier
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
import { myCaseHref } from '@/lib/conveyance/conveyance-routes';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import type { Engagement, EngagementState } from '@/types/engagement';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('conveyance-engagement-notifier');

const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

/** Ποιες καταστάσεις λέγονται στον επαγγελματία — και με ποιο κλειδί. `null` = σιωπή (π.χ. δική του απάντηση). */
function changedTitleKey(engagement: Engagement): string | null {
  const byState: Readonly<Record<EngagementState, string | null>> = {
    offered: `caseEngagementChanged.offeredTitle.${engagement.role}`,
    revoked: 'caseEngagementChanged.revokedTitle',
    withdrawn: 'caseEngagementChanged.withdrawnTitle',
    completed: 'caseEngagementChanged.completedTitle',
    active: null,
    declined: null,
    expired: null,
  };
  return byState[engagement.state];
}

/** **Ο επαγγελματίας** προσγειώνεται στη σελίδα της υπόθεσης, στον **δικό** του χώρο (ποτέ στον ξένο). */
export function caseEngagementChangedDestination(engagementId: string, recipientUid: string): NotificationDestination {
  return viewDestination(myCaseHref(engagementId), personalWorkspace(recipientUid));
}

/**
 * **Ο οικοδεσπότης** προσγειώνεται στην καρτέλα του ακινήτου, στον χώρο του. ⚠️ Δηλωμένο όριο: οι σελίδες
 * πωλήσεων δεν έχουν διεύθυνση ανά ακίνητο, άρα η καρτέλα «Δικαιολογητικά» δεν ανοίγει απευθείας.
 */
export function caseEngagementAnsweredDestination(propertyId: string, hostCompanyId: string): NotificationDestination {
  return viewDestination(ENTITY_ROUTES.properties.withId(propertyId), orgWorkspace(hostCompanyId));
}

/** Ο επαγγελματίας μαθαίνει την **αλλαγή** της πρόσβασής του. */
export async function announceEngagementChanged(engagement: Engagement, propertyName: string | null): Promise<void> {
  const titleKey = changedTitleKey(engagement);
  if (titleKey === null) return;
  const titleParams = { title: propertyName ?? engagement.subject.caseId };
  const offered = engagement.state === 'offered';
  try {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_CHANGED,
      recipientId: engagement.uid,
      // 🔑 Ο επαγγελματίας είναι ο μισθωτής του εαυτού του — ίδιο ιδίωμα με το `tour-access-notifier`.
      tenantId: engagement.uid,
      title: elSharedT(titleKey, titleParams),
      titleKey,
      titleParams,
      ...(offered ? { body: elSharedT('caseEngagementChanged.offeredBody'), bodyKey: 'caseEngagementChanged.offeredBody' } : {}),
      eventId: `case-engagement:${engagement.id}:${engagement.state}`,
      entityId: engagement.id,
      entityType: NOTIFICATION_ENTITY_TYPES.ENGAGEMENT,
      ...caseEngagementChangedDestination(engagement.id, engagement.uid),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'conveyance-engagement', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση αλλαγής συμμετοχής δεν στάλθηκε', {
      engagementId: engagement.id, error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Όποιος πρότεινε μαθαίνει αν ο επαγγελματίας **ανέλαβε**. */
export async function announceEngagementAnswered(
  engagement: Engagement,
  propertyId: string,
  propertyName: string | null,
): Promise<void> {
  const accepted = engagement.state === 'active';
  const titleKey = accepted ? `caseEngagementAnswered.acceptedTitle.${engagement.role}` : 'caseEngagementAnswered.declinedTitle';
  const titleParams = { title: propertyName ?? engagement.subject.caseId, who: engagement.email };
  try {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_ANSWERED,
      recipientId: engagement.offeredBy,
      tenantId: engagement.hostCompanyId,
      title: elSharedT(titleKey, titleParams),
      titleKey,
      titleParams,
      eventId: `case-engagement:${engagement.id}:answered:${engagement.state}`,
      entityId: propertyId,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      ...caseEngagementAnsweredDestination(propertyId, engagement.hostCompanyId),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'conveyance-engagement', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση απάντησης συμμετοχής δεν στάλθηκε', {
      engagementId: engagement.id, error: error instanceof Error ? error.message : String(error),
    });
  }
}
