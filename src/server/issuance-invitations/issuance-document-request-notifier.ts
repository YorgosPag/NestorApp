import 'server-only';

/**
 * @fileoverview ADR-942 Φ1 (Δ8) — **οι ειδοποιήσεις του αιτήματος εγγράφων** στην ανάθεση έκδοσης.
 *   - «Ζητούνται N έγγραφα» στο γραφείο — **μία** ανά παραλήπτη ανά πάτημα («Ζήτησε όλα» = μία σύνοψη)·
 *   - «Ανέβηκε έγγραφο που ζητήσατε» στον μηχανικό, στον χώρο του — **μία** ανά αίτημα ανά αρχείο.
 * @related conveyance-document-request-notifier.ts (ίδιο ιδίωμα σύνοψης) · issuance-delivery-change-notifier.ts (ίδιοι προορισμοί)
 * @module server/issuance-invitations/issuance-document-request-notifier
 *
 * 🔑 `eventId` ντετερμινιστικό: η επανάληψη ενός πατήματος που έσκασε στη μέση ξαναστέλνει το **ίδιο** γεγονός (ο
 *    orchestrator το απορρίπτει ως διπλότυπο).
 * 🔑 Ο τίτλος **δεν** ονομάζει το έγγραφο: το αποθηκευμένο κείμενο θα ήταν ελληνικό σε αγγλόφωνο παραλήπτη. Η λίστα
 *    φαίνεται στο πάνελ της γραμμής.
 * 🔒 Ε-9′: προς τον μηχανικό **κανένα** στοιχείο επικοινωνίας του γραφείου.
 */

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { fnv1a32 } from '@/lib/hash/fnv1a';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { caseEngagementChangedDestination } from '@/services/conveyance/conveyance-engagement-notifier';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';
import type { IssuanceEngagement } from '@/types/engagement';
import { orgWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('issuance-document-request-notifier');
const FEATURE = 'document-issuance-document-request';
/** Οι ειδοποιήσεις αποδίδονται στα ελληνικά στον διακομιστή (κλειδί + παράμετροι αποθηκεύονται για επαναπόδοση). */
const NOTICE_LOCALE = 'el';
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', NOTICE_LOCALE);

const SOURCE = () => ({ service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() });

type NoticeAssignment = Pick<DocumentIssuanceAssignment, 'id' | 'companyId' | 'propertyId' | 'documentKind'>;

/** Ντετερμινιστικό: (σύνολο αιτημάτων, παραλήπτης). Ίδιο σύνολο ⇒ καμία δεύτερη ειδοποίηση. */
function requestedEventId(requestIds: readonly string[], recipientUid: string): string {
  const digest = fnv1a32([...requestIds].sort().join('|')).toString(16).padStart(8, '0');
  return `issuance-doc-request:${digest}:${recipientUid}`;
}

async function deliver(input: Parameters<typeof dispatchNotification>[0]): Promise<'delivered' | 'failed'> {
  try {
    await dispatchNotification(input);
    return 'delivered';
  } catch (error) {
    logger.error('Η ειδοποίηση αιτήματος εγγράφων δεν στάλθηκε', { eventId: input.eventId, error: error instanceof Error ? error.message : String(error) });
    return 'failed';
  }
}

export interface DocumentsRequestedNotice {
  readonly assignment: NoticeAssignment;
  readonly propertyName: string | null;
  readonly requestIds: readonly string[];
  readonly recipientUids: readonly string[];
}

/** Στο γραφείο: «Ζητούνται N έγγραφα» — προσγείωση στο πάνελ της γραμμής, εκεί ανεβάζει. Αποτυχία έστω μίας ⇒ `failed`. */
export async function announceDocumentsRequested(notice: DocumentsRequestedNotice): Promise<'delivered' | 'failed'> {
  const { assignment } = notice;
  const titleParams = { title: notice.propertyName ?? assignment.id, count: String(notice.requestIds.length) };
  const destination = viewDestination(documentExpiryHref(undefined, { doc: issuanceKeyOf(assignment.propertyId, assignment.documentKind) }), orgWorkspace(assignment.companyId));
  const deliveries = await Promise.all(notice.recipientUids.map((recipientUid) => deliver({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DOCUMENTS_REQUESTED,
    recipientId: recipientUid,
    tenantId: assignment.companyId,
    title: noticeT('documentIssuanceRequest.requested', titleParams),
    titleKey: 'documentIssuanceRequest.requested',
    titleParams,
    body: noticeT('documentIssuanceRequest.requestedBody'),
    bodyKey: 'documentIssuanceRequest.requestedBody',
    eventId: requestedEventId(notice.requestIds, recipientUid),
    ...destination,
    source: SOURCE(),
  })));
  return deliveries.includes('failed') ? 'failed' : 'delivered';
}

export interface DocumentProvidedNotice {
  readonly assignment: NoticeAssignment;
  readonly propertyName: string | null;
  readonly requestId: string;
  readonly fileId: string;
  readonly engagement: IssuanceEngagement;
}

/** Στον μηχανικό, στον χώρο του: «Ανέβηκε έγγραφο που ζητήσατε». Ποτέ δεν πετά. */
export async function announceDocumentProvided(notice: DocumentProvidedNotice): Promise<void> {
  try {
    const titleParams = { title: notice.propertyName ?? notice.assignment.id };
    await deliver({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_DOCUMENT_PROVIDED,
      recipientId: notice.engagement.uid,
      tenantId: notice.assignment.companyId,
      title: noticeT('documentIssuanceRequest.provided', titleParams),
      titleKey: 'documentIssuanceRequest.provided',
      titleParams,
      body: noticeT('documentIssuanceRequest.providedBody'),
      bodyKey: 'documentIssuanceRequest.providedBody',
      eventId: `issuance-doc-provided:${notice.requestId}:${notice.fileId}:${notice.engagement.uid}`,
      ...(await caseEngagementChangedDestination(notice.engagement)),
      source: SOURCE(),
    });
  } catch (error) {
    logger.error('Η ειδοποίηση «ανέβηκε έγγραφο» δεν στάλθηκε', { requestId: notice.requestId, error: error instanceof Error ? error.message : String(error) });
  }
}
