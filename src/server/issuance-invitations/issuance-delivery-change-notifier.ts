import 'server-only';

/**
 * @fileoverview ADR-915 §45.20 Φ6γ — **οι ειδοποιήσεις του αιτήματος νέας ημερομηνίας**: «ζητά νέα ημερομηνία» στο γραφείο,
 *   «όρισε νέα» / «δεν εγκρίθηκε» στον μηχανικό, στον χώρο του. Μία ανά αίτημα **και** μετάβαση (`eventId`).
 * @related lib/document-validity/issuance-delivery-change.ts (ποια μετάβαση) · issuance-delivery-notifier.ts (το ίδιο ιδίωμα)
 * @module server/issuance-invitations/issuance-delivery-change-notifier
 *
 * 🔑 **Ποτέ δεν πετά**: η πράξη γράφτηκε ήδη· μια χαμένη ειδοποίηση δεν την αναιρεί (το διπλότυπο το κόβει το `eventId`).
 * 🔑 Προσγείωση: γραφείο ⇒ το πάνελ της γραμμής (`?doc=`, εκεί απαντά)· μηχανικός ⇒ το σπίτι της συμμετοχής του.
 * 🔒 Ε-9′: προς τον μηχανικό **κανένα** στοιχείο επικοινωνίας του γραφείου — μόνο ημερομηνία και αιτιολογία.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { formatCalendarDate } from '@/lib/intl-formatting';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import { issuanceKeyOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import type { DeliveryChangeTransition } from '@/lib/document-validity/issuance-delivery-change';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { caseEngagementChangedDestination } from '@/services/conveyance/conveyance-engagement-notifier';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { orgWorkspace } from '@/types/workspace-membership';

import { activeIssuanceEngagementOf } from './issuance-active-engagement';

const logger = createModuleLogger('issuance-delivery-change-notifier');
const FEATURE = 'document-issuance-delivery-change';
/** Οι ειδοποιήσεις αποδίδονται στα ελληνικά στον διακομιστή (κλειδί + παράμετροι αποθηκεύονται για επαναπόδοση). */
const NOTICE_LOCALE = 'el';
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', NOTICE_LOCALE);

/** Ποια ανάθεση — (γραφείο, ακίνητο, είδος) + η ταυτότητά της. */
export interface DeliveryChangeSubject {
  readonly assignmentId: string;
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly record: IssuanceAssignmentRecord;
  readonly registry: DocumentRegistryResponse;
  readonly now: Date;
}

const SOURCE = () => ({ service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() });

/** Ένα αίτημα + μία μετάβαση + ένας αποδέκτης ⇒ μία ειδοποίηση. */
function eventIdOf(assignmentId: string, requestAt: string, step: string, recipientUid: string): string {
  return `document-issuance-delivery-change:${assignmentId}:${requestAt}:${step}:${recipientUid}`;
}

async function send(input: Parameters<typeof dispatchNotification>[0]): Promise<void> {
  try {
    await dispatchNotification(input);
  } catch (error) {
    logger.error('Η ειδοποίηση αιτήματος νέας ημερομηνίας δεν στάλθηκε', { eventId: input.eventId, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Το αποθηκευμένο κείμενο (εφεδρεία · push · παλιοί αναγνώστες) μένει ελληνικό με μορφοποιημένη ημέρα, ενώ οι
 * `bodyParams` κρατούν την ημέρα ακατέργαστη για τον αποδότη (ADR-915 §45.20).
 */
function storedBodyParams(params: Readonly<Record<string, string>>): Record<string, string> {
  return params.date ? { ...params, date: formatCalendarDate(params.date, NOTICE_LOCALE) } : { ...params };
}

function titleParamsOf(subject: DeliveryChangeSubject) {
  return { title: subject.registry.properties[subject.propertyId]?.name ?? subject.assignmentId };
}

/** Το γραφείο: όποιος πρότεινε και όποιος έστειλε — «ο μηχανικός ζητά παράδοση έως …». */
async function announceRequested(subject: DeliveryChangeSubject, request: Extract<DeliveryChangeTransition, { kind: 'requested' }>['request']): Promise<void> {
  const { record, registry } = subject;
  const titleParams = titleParamsOf(subject);
  const name = registry.people[record.professionalContactId]?.name ?? null;
  // Η ημέρα μένει ΑΚΑΤΕΡΓΑΣΤΗ στις παραμέτρους: τη μορφοποιεί ο αποδότης στη γλώσσα του αναγνώστη (notification-display-title).
  const date = request.dueOn;
  const bodyKey = name === null ? 'documentIssuanceDelivery.changeRequestedBodyUnnamed' : 'documentIssuanceDelivery.changeRequestedBody';
  const bodyParams = name === null ? { date, reason: request.reason } : { date, reason: request.reason, name };
  const destination = viewDestination(documentExpiryHref(undefined, { doc: issuanceKeyOf(subject.propertyId, subject.documentKind) }), orgWorkspace(subject.companyId));
  const recipients = [...new Set([record.proposedByUid, ...(record.notice === null ? [] : [record.notice.byUid])])];
  await Promise.all(recipients.map((recipientUid) => send({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DELIVERY_CHANGE_REQUESTED,
    recipientId: recipientUid,
    tenantId: subject.companyId,
    title: noticeT('documentIssuanceDelivery.changeRequested', titleParams),
    titleKey: 'documentIssuanceDelivery.changeRequested',
    titleParams,
    body: noticeT(bodyKey, storedBodyParams(bodyParams)),
    bodyKey,
    bodyParams,
    eventId: eventIdOf(subject.assignmentId, request.at, 'requested', recipientUid),
    ...destination,
    source: SOURCE(),
  })));
}

/** Ο μηχανικός, **μόνο** με ενεργή συμμετοχή — «όρισε νέα ημερομηνία» ή «δεν εγκρίθηκε, γιατί …». */
async function announceAnswered(db: Firestore, subject: DeliveryChangeSubject, request: Extract<DeliveryChangeTransition, { kind: 'answered' }>['request']): Promise<void> {
  const engagement = await activeIssuanceEngagementOf(db, {
    id: subject.assignmentId, companyId: subject.companyId, propertyId: subject.propertyId, documentKind: subject.documentKind,
  }, subject.registry, subject.now.toISOString());
  if (engagement === null) return;
  const { answer } = request;
  const accepted = answer.outcome === 'accepted';
  const titleKey = accepted ? 'documentIssuanceDelivery.changeAccepted' : 'documentIssuanceDelivery.changeDeclined';
  const bodyKey = accepted ? 'documentIssuanceDelivery.changeAcceptedBody' : 'documentIssuanceDelivery.changeDeclinedBody';
  const bodyParams = accepted ? { date: answer.dueOn ?? '' } : { reason: answer.reason ?? '' };
  const titleParams = titleParamsOf(subject);
  await send({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DELIVERY_CHANGE_ANSWERED,
    recipientId: engagement.uid,
    tenantId: subject.companyId,
    title: noticeT(titleKey, titleParams),
    titleKey,
    titleParams,
    body: noticeT(bodyKey, storedBodyParams(bodyParams)),
    bodyKey,
    bodyParams,
    eventId: eventIdOf(subject.assignmentId, request.at, answer.outcome, engagement.uid),
    ...(await caseEngagementChangedDestination(engagement)),
    source: SOURCE(),
  });
}

/** Η μετάβαση αυτής της γραφής, αν υπάρχει, στον σωστό αποδέκτη. Ποτέ δεν πετά. */
export async function announceDeliveryChange(db: Firestore, subject: DeliveryChangeSubject, transition: DeliveryChangeTransition | null): Promise<void> {
  if (transition === null) return;
  try {
    if (transition.kind === 'requested') await announceRequested(subject, transition.request);
    else await announceAnswered(db, subject, transition.request);
  } catch (error) {
    logger.error('Το αίτημα νέας ημερομηνίας δεν ανακοινώθηκε', { assignmentId: subject.assignmentId, error: error instanceof Error ? error.message : String(error) });
  }
}
