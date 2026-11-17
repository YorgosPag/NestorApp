import 'server-only';

/**
 * @fileoverview **Οι ειδοποιήσεις της πρόσβασης στον φάκελο ιδιώτη** (ADR-916 Φ-Ε1 Σ4 · ADR-026).
 * @module services/property-dossier/dossier-engagement-notifier
 * @related `services/conveyance/conveyance-engagement-notifier.ts` (ο αδελφός της μεταβίβασης — ίδια γεγονότα, ίδιες
 *          προτιμήσεις χρήστη) · `dossier-access-host.service.ts` (πράξεις κατόχου) · `dossier-engagement-host-adapter.ts`
 *
 * | Γεγονός | Προς | Γιατί |
 * |---|---|---|
 * | `caseEngagementChanged` (ανακλήθηκε · αποσύρθηκε · ανανεώθηκε · άλλαξε το εύρος) | επαγγελματία | πρόσβαση σε νομικό φάκελο **δεν** αλλάζει σιωπηλά (ADR-787 Ε-2 §5) — ούτε όταν **μεγαλώνει** |
 * | `caseEngagementAnswered` (ανέλαβε · δεν ανέλαβε · 3 ημέρες χωρίς απάντηση) | κάτοχο | ο κύκλος κλείνει: ο ιδιώτης μαθαίνει ότι ο δικηγόρος του **μπήκε** (Dropbox/Drive: «X accepted your invitation») |
 *
 * 🔑 **Ίδια γεγονότα με τη μεταβίβαση, όχι νέα**: μία προτίμηση χρήστη για «απαντήσεις επαγγελματιών», μία υποχρεωτική
 *    κατηγορία για «η πρόσβασή σας άλλαξε». Μόνο το **κείμενο** είναι του φακέλου (`…dossier.*`).
 * 🔑 Ο κάτοχος είναι ο **μισθωτής του εαυτού του** (`tenantId = uid`, ιδίωμα `tour-access-notifier`)· προσγειώνεται στη
 *    σελίδα του φακέλου του, στον προσωπικό του χώρο. Ο επαγγελματίας προσγειώνεται όπου και στη μεταβίβαση
 *    (`caseEngagementChangedDestination` — η ΜΙΑ ερμηνεία του «σπιτιού» της συμμετοχής).
 * 🔑 `eventId` ντετερμινιστικό: η επανάληψη δεν διπλασιάζει (dedupe του orchestrator). Η ανανέωση/εύρος μπορεί να
 *    ξανασυμβεί ⇒ φέρει το `updatedAt` της μετάβασης.
 * ⚠️ **Καμία αποτυχία ειδοποίησης δεν ακυρώνει την πράξη** (N.7.2 #6): η συμμετοχή γράφτηκε ήδη.
 */

import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { dossierDetailHref } from '@/lib/property-dossier/property-dossier-routes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { caseEngagementChangedDestination } from '@/services/conveyance/conveyance-engagement-notifier';
import type { DossierEngagement } from '@/types/engagement';
import type { DossierEngagementInvitation } from '@/types/engagement-invitation';
import { personalWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('dossier-engagement-notifier');

const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

const CHANGED = 'caseEngagementChanged.dossier';
const ANSWERED = 'caseEngagementAnswered.dossier';

/** Μία ειδοποίηση του φακέλου — προς τον επαγγελματία **ή** προς τον κάτοχο. */
interface DossierNotice {
  readonly eventType: typeof NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_CHANGED
    | typeof NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_ANSWERED;
  readonly recipientUid: string;
  readonly titleKey: string;
  readonly titleParams: Readonly<Record<string, string>>;
  readonly bodyKey?: string;
  readonly eventId: string;
  readonly entity: { readonly type: 'engagement' | 'property_dossier'; readonly id: string };
  readonly destination: NotificationDestination;
}

async function dispatchDossierNotice(notice: DossierNotice): Promise<void> {
  try {
    await dispatchNotification({
      eventType: notice.eventType,
      recipientId: notice.recipientUid,
      tenantId: notice.recipientUid,
      title: elSharedT(notice.titleKey, notice.titleParams),
      titleKey: notice.titleKey,
      titleParams: notice.titleParams,
      ...(notice.bodyKey ? { body: elSharedT(notice.bodyKey), bodyKey: notice.bodyKey } : {}),
      eventId: notice.eventId,
      entityId: notice.entity.id,
      entityType: notice.entity.type,
      ...notice.destination,
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: 'dossier-engagement', env: getCurrentEnvironment() },
    });
  } catch (error) {
    logger.error('Η ειδοποίηση του φακέλου δεν στάλθηκε', {
      eventId: notice.eventId, error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// ΠΡΟΣ ΤΟΝ ΕΠΑΓΓΕΛΜΑΤΙΑ — ό,τι άλλαξε ο κάτοχος
// =============================================================================

/** Η πράξη του κατόχου που άλλαξε την πρόσβαση — από τη **μετάβαση** του γραφέα, όχι από το αίτημα. */
export type DossierOwnerChange = 'ended' | 'renewed' | 'reach';

/** Ποιο κλειδί λέει την αλλαγή. Τέλος σε `offered` = απόσυρση πρότασης· σε `active` = ανάκληση. */
function changedTitleKey(change: DossierOwnerChange, after: DossierEngagement): string {
  if (change === 'renewed') return `${CHANGED}.renewedTitle`;
  if (change === 'reach') return `${CHANGED}.reachTitle`;
  return after.state === 'withdrawn' ? `${CHANGED}.withdrawnTitle` : `${CHANGED}.revokedTitle`;
}

/** Ο επαγγελματίας μαθαίνει **κάθε** αλλαγή της πρόσβασής του από τον κάτοχο. */
export async function announceDossierAccessChanged(
  after: DossierEngagement,
  change: DossierOwnerChange,
  dossierLabel: string | null,
): Promise<void> {
  await dispatchDossierNotice({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_CHANGED,
    recipientUid: after.uid,
    titleKey: changedTitleKey(change, after),
    titleParams: { title: dossierLabel ?? after.subject.dossierId, days: String(after.shareDays) },
    eventId: `dossier-engagement:${after.id}:${change}:${after.updatedAt}`,
    entity: { type: NOTIFICATION_ENTITY_TYPES.ENGAGEMENT, id: after.id },
    destination: await caseEngagementChangedDestination(after),
  });
}

// =============================================================================
// ΠΡΟΣ ΤΟΝ ΚΑΤΟΧΟ — η απάντηση του επαγγελματία
// =============================================================================

/** Ο κάτοχος προσγειώνεται στη σελίδα του φακέλου του — εκεί ζει η κάρτα «Πρόσβαση». */
function ownerNotice(
  invitation: DossierEngagementInvitation,
  notice: Pick<DossierNotice, 'titleKey' | 'titleParams' | 'bodyKey' | 'eventId'>,
): DossierNotice {
  const dossierId = invitation.subject.dossierId;
  return {
    ...notice,
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_ENGAGEMENT_ANSWERED,
    recipientUid: invitation.invitedByUid,
    entity: { type: NOTIFICATION_ENTITY_TYPES.PROPERTY_DOSSIER, id: dossierId },
    destination: viewDestination(dossierDetailHref(dossierId), personalWorkspace(invitation.invitedByUid)),
  };
}

/** Ο κάτοχος μαθαίνει ότι ο επαγγελματίας **ανέλαβε** — ή ότι **δεν** ανέλαβε. */
export async function announceDossierInvitationAnswered(
  invitation: DossierEngagementInvitation,
  answer: 'accepted' | 'declined',
  dossierLabel: string | null,
): Promise<void> {
  const titleKey = answer === 'accepted' ? `${ANSWERED}.acceptedTitle.${invitation.role}` : `${ANSWERED}.declinedTitle`;
  await dispatchDossierNotice(ownerNotice(invitation, {
    titleKey,
    titleParams: { title: dossierLabel ?? invitation.subject.dossierId, who: invitation.inviteeEmail },
    eventId: `dossier-invitation:${invitation.id}:${answer}`,
  }));
}

/** ADR-901 Ε-5 — **3 ημέρες χωρίς απάντηση** ⇒ υπενθύμιση στον κάτοχο (μία φορά ανά πρόσκληση). */
export async function announceDossierInvitationUnanswered(invitation: DossierEngagementInvitation, dossierLabel: string | null): Promise<void> {
  await dispatchDossierNotice(ownerNotice(invitation, {
    titleKey: `${ANSWERED}.invitationPendingTitle`,
    titleParams: { title: dossierLabel ?? invitation.subject.dossierId, who: invitation.inviteeEmail },
    bodyKey: `${ANSWERED}.invitationPendingBody`,
    eventId: `dossier-invitation:${invitation.id}:reminder`,
  }));
}
