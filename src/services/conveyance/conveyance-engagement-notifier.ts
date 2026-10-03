/**
 * =============================================================================
 * Οι ειδοποιήσεις της συμμετοχής σε υπόθεση μεταβίβασης (ADR-901 Φ2 · ADR-026)
 * =============================================================================
 *
 * | Γεγονός | Προς | Γιατί |
 * |---|---|---|
 * | `caseEngagementChanged` (προτάθηκε · ανακλήθηκε · αποσύρθηκε · ολοκληρώθηκε) | επαγγελματία | πρόσβαση σε νομική υπόθεση **δεν** ανοίγει ούτε κλείνει σιωπηλά — η ανάκληση είναι **ειπωμένη** (ADR-787 Ε-2 §5) |
 * | `caseEngagementAnswered` (ανέλαβε · δεν ανέλαβε) | όποιον πρότεινε | το «Save & Send Notification» του Procore, **με** κλείσιμο του κύκλου |
 * | `caseEngagementAnswered` (πρόσκληση: δεν ανέλαβε · 3 ημέρες χωρίς απάντηση) | όποιον προσκάλεσε | ADR-901 Φ3 · Ε-5 — **ίδια** προτίμηση: «απαντήσεις επαγγελματιών», και η σιωπή είναι απάντηση που αξίζει να ειπωθεί |
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
import type { EngagementInvitation } from '@/types/engagement-invitation';
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

/** Μία ειδοποίηση **προς τον οικοδεσπότη** για μια θέση της υπόθεσής του — κοινή για συμμετοχή και πρόσκληση. */
interface InviterNotice {
  readonly recipientUid: string;
  readonly hostCompanyId: string;
  readonly propertyId: string;
  readonly titleKey: string;
  readonly titleParams: Readonly<Record<string, string>>;
  readonly bodyKey?: string;
  /** Ντετερμινιστικό — η επανάληψη (retry · sweep) **δεν** διπλασιάζει (dedupe του orchestrator). */
  readonly eventId: string;
}

async function announceToInviter(notice: InviterNotice): Promise<void> {
  try {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_ANSWERED,
      recipientId: notice.recipientUid,
      tenantId: notice.hostCompanyId,
      title: elSharedT(notice.titleKey, notice.titleParams),
      titleKey: notice.titleKey,
      titleParams: notice.titleParams,
      ...(notice.bodyKey ? { body: elSharedT(notice.bodyKey), bodyKey: notice.bodyKey } : {}),
      eventId: notice.eventId,
      entityId: notice.propertyId,
      entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
      ...caseEngagementAnsweredDestination(notice.propertyId, notice.hostCompanyId),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'conveyance-engagement', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση προς τον οικοδεσπότη δεν στάλθηκε', {
      eventId: notice.eventId, error: error instanceof Error ? error.message : String(error),
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
  await announceToInviter({
    recipientUid: engagement.offeredBy,
    hostCompanyId: engagement.hostCompanyId,
    propertyId,
    titleKey: accepted ? `caseEngagementAnswered.acceptedTitle.${engagement.role}` : 'caseEngagementAnswered.declinedTitle',
    titleParams: { title: propertyName ?? engagement.subject.caseId, who: engagement.email },
    eventId: `case-engagement:${engagement.id}:answered:${engagement.state}`,
  });
}

/**
 * ADR-901 Φ3 — ο επαγγελματίας **χωρίς λογαριασμό** πάτησε «Δεν αναλαμβάνω» στην πρόσκληση με email: δεν υπάρχει
 * συμμετοχή να πει «δεν ανέλαβε», άρα το λέει η **πρόσκληση** (Ε-5: «η άρνηση ειδοποιεί τον προσκαλούντα»).
 */
export async function announceInvitationDeclined(invitation: EngagementInvitation, propertyName: string | null): Promise<void> {
  await announceToInviter({
    recipientUid: invitation.invitedByUid,
    hostCompanyId: invitation.hostCompanyId,
    propertyId: invitation.propertyId,
    titleKey: 'caseEngagementAnswered.declinedTitle',
    titleParams: { title: propertyName ?? invitation.caseId, who: invitation.inviteeEmail },
    eventId: `case-invitation:${invitation.id}:declined`,
  });
}

/** ADR-901 Ε-5 — **3 ημέρες χωρίς απάντηση** ⇒ υπενθύμιση στον **προσκαλούντα** (μία φορά ανά πρόσκληση). */
export async function announceInvitationUnanswered(invitation: EngagementInvitation, propertyName: string | null): Promise<void> {
  await announceToInviter({
    recipientUid: invitation.invitedByUid,
    hostCompanyId: invitation.hostCompanyId,
    propertyId: invitation.propertyId,
    titleKey: 'caseEngagementAnswered.invitationPendingTitle',
    titleParams: { title: propertyName ?? invitation.caseId, who: invitation.inviteeEmail },
    bodyKey: 'caseEngagementAnswered.invitationPendingBody',
    eventId: `case-invitation:${invitation.id}:reminder`,
  });
}
