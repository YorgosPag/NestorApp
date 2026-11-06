/**
 * @module services/crm/opportunity-owner-notifier
 * @description **«Σου ανατέθηκε η ευκαιρία …»** (ADR-930 §3.8) — HubSpot «assigned to you» · Salesforce «Send
 * Notification Email» στο Change Owner. Εδώ, ➕ το **σημείωμα παράδοσης** φτάνει μαζί: ο νέος κάτοχος μαθαίνει
 * **τι** παραλαμβάνει, όχι μόνο **ότι** παρέλαβε.
 *
 * 🔑 Κείμενα ΜΟΝΟ από το `common-shared` (`createBundleTranslate`, όπως ο `ownership-decision-notifier`).
 * 🔑 Ρυθμίσιμο από τον άνθρωπο: `crm.opportunityAssigned` (όχι υποχρεωτικό).
 * 🔑 Ιδεμπότητα: `eventId` = ευκαιρία + νέος κάτοχος + έκδοση εγγράφου — μία ειδοποίηση ανά μεταβίβαση.
 * ⚠️ Όποιος αναθέτει **στον εαυτό του** δεν ειδοποιείται (το ξέρει ήδη). **Δεν πετά ΠΟΤΕ** — η μεταβίβαση είναι ήδη γραμμένη.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { readNetworkPeople } from '@/services/network-messaging/thread-people';
import { orgWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('opportunity-owner-notifier');

const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');

const TITLE_KEY = 'opportunityAssigned.title';
const BODY_KEY = 'opportunityAssigned.body';
const BODY_WITH_NOTE_KEY = 'opportunityAssigned.bodyWithNote';

export interface OpportunityOwnerTransferAnnouncement {
  readonly opportunityId: string;
  readonly opportunityTitle: string | null;
  readonly companyId: string;
  readonly newOwnerUid: string;
  readonly actorUid: string;
  readonly note: string | null;
  /** Η έκδοση (`_v`) που έγραψε η μεταβίβαση — κάνει το `eventId` μοναδικό ανά μεταβίβαση. */
  readonly version: number;
}

/** Τα κλειδιά + παράμετροι της ειδοποίησης — καθαρό, ώστε το test να ρωτά **αυτόν** τον κανόνα. */
export function opportunityOwnerWording(input: {
  readonly subject: string;
  readonly actor: string;
  readonly note: string | null;
}): { readonly bodyKey: string; readonly params: Readonly<Record<string, string>> } {
  const params = { subject: input.subject, actor: input.actor, note: input.note ?? '' };
  return { bodyKey: input.note ? BODY_WITH_NOTE_KEY : BODY_KEY, params };
}

/**
 * @returns `true` όταν στάλθηκε· `false` όταν παραλείφθηκε ή απέτυχε (με log). **Κανένα πέταγμα.**
 */
export async function announceOpportunityOwnerTransfer(input: OpportunityOwnerTransferAnnouncement): Promise<boolean> {
  if (input.newOwnerUid === input.actorUid) return false;
  try {
    const [actor] = await readNetworkPeople(getAdminFirestore(), [input.actorUid]);
    const { bodyKey, params } = opportunityOwnerWording({
      subject: input.opportunityTitle ?? '',
      actor: actor?.name ?? '',
      note: input.note,
    });
    const workspace = orgWorkspace(input.companyId);
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.CRM_OPPORTUNITY_ASSIGNED,
      recipientId: input.newOwnerUid,
      tenantId: input.companyId,
      title: elSharedT(TITLE_KEY, params),
      titleKey: TITLE_KEY,
      titleParams: params,
      body: elSharedT(bodyKey, params),
      bodyKey,
      bodyParams: params,
      eventId: `opportunity-owner:${input.opportunityId}>${input.newOwnerUid}@${input.version}`,
      entityId: input.opportunityId,
      entityType: NOTIFICATION_ENTITY_TYPES.OPPORTUNITY,
      ...viewDestination(ENTITY_ROUTES.crm.lead(input.opportunityId), workspace),
      source: { service: SOURCE_SERVICES.CRM, feature: 'opportunity-owner-transfer', env: getCurrentEnvironment() },
    });
    return result.success;
  } catch (error) {
    logger.error('Η ειδοποίηση μεταβίβασης ευκαιρίας δεν στάλθηκε', {
      data: { opportunityId: input.opportunityId },
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
