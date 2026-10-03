/**
 * =============================================================================
 * «Σας ζητούν έγγραφο» — η ειδοποίηση του αιτήματος (ADR-901 Φ4.5)
 * =============================================================================
 *
 * **Μία** ειδοποίηση ανά παραλήπτη ανά πάτημα — το «Ζήτησε όλα τα ελλείποντα» φτάνει ως **σύνοψη** («Ζητούνται 4
 * έγγραφα»), όχι ως τέσσερα κουδουνίσματα (το Procore στέλνει ένα email ανά RFI· εδώ ο παραλήπτης παίρνει **μία** λίστα).
 *
 * Ο τίτλος **δεν** ονομάζει το έγγραφο: η ετικέτα της γραμμής είναι μεταφράσιμη, και το αποθηκευμένο κείμενο θα ήταν
 * ελληνικό σε αγγλόφωνο παραλήπτη. Η γραμμή φαίνεται στη σελίδα της υπόθεσης («Εκκρεμεί από: εσάς»).
 *
 * 🔑 `eventId` = `case-doc-request:<αποτύπωμα των αιτημάτων>:<uid>` — ντετερμινιστικό: η επανάληψη ενός αιτήματος που
 *    έσκασε στη μέση ξαναστέλνει το **ίδιο** γεγονός (ο orchestrator το απορρίπτει ως διπλότυπο) αντί για δεύτερο.
 *
 * @module services/conveyance/conveyance-document-request-notifier
 */

import 'server-only';

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { fnv1a32 } from '@/lib/hash/fnv1a';
import type { CaseActorRole, ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { caseNoticeCopy, noticeToEngaged, noticeToHost, type CaseNoticeCopy, type CaseNoticeDelivery } from './conveyance-case-notice';

const FEATURE = 'conveyance-document-request';

export type DocumentRequestRecipient =
  | { readonly kind: 'host'; readonly uid: string }
  | { readonly kind: 'engaged'; readonly engagement: Engagement };

interface DocumentRequestNotice {
  readonly record: ConveyanceCase;
  readonly propertyName: string | null;
  readonly requesterRole: CaseActorRole;
  /** Οι ταυτότητες των αιτημάτων που περιλαμβάνει — το αποτύπωμά τους κάνει το γεγονός ιδεμποτικό. */
  readonly requestIds: readonly string[];
  readonly recipient: DocumentRequestRecipient;
}

function recipientUidOf(recipient: DocumentRequestRecipient): string {
  return recipient.kind === 'host' ? recipient.uid : recipient.engagement.uid;
}

/** Ντετερμινιστικό: (σύνολο αιτημάτων, παραλήπτης). Ίδιο σύνολο ⇒ καμία δεύτερη ειδοποίηση. */
export function documentRequestEventId(requestIds: readonly string[], recipientUid: string): string {
  const digest = fnv1a32([...requestIds].sort().join('|')).toString(16).padStart(8, '0');
  return `case-doc-request:${digest}:${recipientUid}`;
}

function copyOf(notice: DocumentRequestNotice): CaseNoticeCopy {
  const count = notice.requestIds.length;
  const titleParams = { title: notice.propertyName ?? notice.record.id, count: String(count) };
  const titleKey = count === 1 ? 'caseDocumentRequest.titleOne' : 'caseDocumentRequest.titleMany';
  return caseNoticeCopy(titleKey, titleParams, `caseDocumentRequest.body.${notice.requesterRole}`);
}

/** Η ειδοποίηση προς **έναν** παραλήπτη — οικοδεσπότης (ακίνητο) ή επαγγελματίας (σελίδα υπόθεσης). */
export function announceDocumentRequest(notice: DocumentRequestNotice): Promise<CaseNoticeDelivery> {
  const base = {
    record: notice.record,
    eventId: documentRequestEventId(notice.requestIds, recipientUidOf(notice.recipient)),
    copy: copyOf(notice),
    feature: FEATURE,
  };
  const { recipient } = notice;
  return recipient.kind === 'host'
    ? noticeToHost({ ...base, eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_REQUEST_HOST, recipientUid: recipient.uid })
    : noticeToEngaged({ ...base, eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_CASE_DOCUMENT_REQUEST_ENGAGED, engagement: recipient.engagement });
}
