import 'server-only';

/**
 * @fileoverview ADR-915 §45 Φ5 — **οι ειδοποιήσεις της προθεσμίας παράδοσης** (Α6): «καθυστερεί» στο γραφείο (+1 · +7),
 *   «λήγει αύριο» στον επαγγελματία, στον χώρο του. Μία φορά ανά ορόσημο **και** προθεσμία.
 * @related lib/document-validity/issuance-delivery-milestone.ts (ποιο ορόσημο · `eventId`) · issuance-delivery-reminder.ts
 *   (η σάρωση που τις εκπέμπει, με τον ρυθμό των υπενθυμίσεων) · issuance-answer-notifier.ts (το ίδιο ιδίωμα)
 * @module server/issuance-invitations/issuance-delivery-notifier
 *
 * 🔑 **Ποτέ δεν πετά**: μια ειδοποίηση που απέτυχε δεν σταματά την υπενθύμιση· το διπλότυπο το κόβει ο αποστολέας (`eventId`).
 * 🔑 Προσγείωση: γραφείο ⇒ το πάνελ της γραμμής (`?doc=`, εκεί ζει η «Υπενθύμιση»)· επαγγελματίας ⇒ το σπίτι της
 *    συμμετοχής του (ο ΙΔΙΟΣ προορισμός με τις ειδοποιήσεις συμμετοχής).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import { issuanceKeyOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { issuanceDeliveryOf } from '@/lib/document-validity/issuance-delivery-due';
import { deliveryMilestoneEventId, deliveryMilestoneOf, type DeliveryMilestone } from '@/lib/document-validity/issuance-delivery-milestone';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { caseEngagementChangedDestination } from '@/services/conveyance/conveyance-engagement-notifier';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';
import { orgWorkspace } from '@/types/workspace-membership';

import { activeIssuanceEngagementOf } from './issuance-active-engagement';

const logger = createModuleLogger('issuance-delivery-notifier');
const FEATURE = 'document-issuance-delivery';
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

export interface DeliveryMilestoneSubject {
  readonly assignment: DocumentIssuanceAssignment;
  readonly registry: DocumentRegistryResponse;
  readonly record: IssuanceAssignmentRecord;
  readonly now: Date;
}

const SOURCE = () => ({ service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() });

/** Η αποστολή — ποτέ δεν πετά (μια χαμένη ειδοποίηση δεν σταματά την υπενθύμιση). */
async function send(input: Parameters<typeof dispatchNotification>[0]): Promise<void> {
  try {
    await dispatchNotification(input);
  } catch (error) {
    logger.error('Η ειδοποίηση προθεσμίας παράδοσης δεν στάλθηκε', { eventId: input.eventId, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Το γραφείο: όποιος πρότεινε και όποιος έστειλε (μπορεί να είναι ο ίδιος) — «καθυστερεί N ημέρες». */
async function announceOverdue(subject: DeliveryMilestoneSubject, dueOn: string, milestone: DeliveryMilestone, days: number): Promise<void> {
  const { assignment, registry, record } = subject;
  const titleParams = { title: registry.properties[assignment.propertyId]?.name ?? assignment.id };
  const name = registry.people[record.professionalContactId]?.name ?? null;
  const bodyKey = name === null ? 'documentIssuanceDelivery.overdueBodyUnnamed' : 'documentIssuanceDelivery.overdueBody';
  const bodyParams = name === null ? { days } : { days, name };
  const destination = viewDestination(documentExpiryHref(undefined, { doc: issuanceKeyOf(assignment.propertyId, assignment.documentKind) }), orgWorkspace(assignment.companyId));
  const recipients = [...new Set([record.proposedByUid, ...(record.notice === null ? [] : [record.notice.byUid])])];
  await Promise.all(recipients.map((recipientUid) => send({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_OVERDUE,
    recipientId: recipientUid,
    tenantId: assignment.companyId,
    title: noticeT('documentIssuanceDelivery.overdue', titleParams),
    titleKey: 'documentIssuanceDelivery.overdue',
    titleParams,
    body: noticeT(bodyKey, bodyParams),
    bodyKey,
    bodyParams,
    eventId: deliveryMilestoneEventId(assignment.id, dueOn, milestone, recipientUid),
    ...destination,
    source: SOURCE(),
  })));
}

/** Ο επαγγελματίας, **μόνο** με ενεργή συμμετοχή στον χώρο — «λήγει αύριο». */
async function announceDueTomorrow(db: Firestore, subject: DeliveryMilestoneSubject, dueOn: string): Promise<void> {
  const { assignment, registry, now } = subject;
  const engagement = await activeIssuanceEngagementOf(db, assignment, registry, now.toISOString());
  if (engagement === null) return;
  const titleParams = { title: registry.properties[assignment.propertyId]?.name ?? assignment.id };
  await send({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DELIVERY_DUE,
    recipientId: engagement.uid,
    tenantId: assignment.companyId,
    title: noticeT('documentIssuanceDelivery.dueTomorrow', titleParams),
    titleKey: 'documentIssuanceDelivery.dueTomorrow',
    titleParams,
    body: noticeT('documentIssuanceDelivery.dueTomorrowBody'),
    bodyKey: 'documentIssuanceDelivery.dueTomorrowBody',
    eventId: deliveryMilestoneEventId(assignment.id, dueOn, 'due-tomorrow', engagement.uid),
    ...(await caseEngagementChangedDestination(engagement)),
    source: SOURCE(),
  });
}

/** Το ορόσημο **σήμερα**, αν υπάρχει, στον σωστό αποδέκτη. Ποτέ δεν πετά. */
export async function announceDeliveryMilestone(db: Firestore, subject: DeliveryMilestoneSubject): Promise<void> {
  const dueOn = issuanceDeliveryOf(subject.record)?.dueOn ?? null;
  const reached = deliveryMilestoneOf(dueOn, conveyanceToday(subject.now));
  if (dueOn === null || reached === null) return;
  try {
    if (reached.milestone === 'due-tomorrow') await announceDueTomorrow(db, subject, dueOn);
    else await announceOverdue(subject, dueOn, reached.milestone, reached.days);
  } catch (error) {
    logger.error('Το ορόσημο προθεσμίας δεν ανακοινώθηκε', { assignmentId: subject.assignment.id, error: error instanceof Error ? error.message : String(error) });
  }
}
