import 'server-only';

/**
 * @fileoverview ADR-915 §28 Η-Β10 — **«Απάντησαν»**: ειδοποίηση στο γραφείο όταν ο υπεύθυνος ή ο επαγγελματίας απαντά με
 *   τον σύνδεσμο.
 * @related issuance-invitation-answer.ts (ο καλών) · services/document-registry/registry-expiry-notifier.ts (το ιδίωμα)
 * @module server/issuance-invitations/issuance-answer-notifier
 *
 * | Γεγονός | Προς | Προσγείωση |
 * |---|---|---|
 * | `properties.documentIssuanceAnswered` | όποιος **πρότεινε** + όποιος **έστειλε** (χωρίς διπλά) | «Λήξεις εγγράφων», στον χώρο του γραφείου |
 *
 * 🔑 `eventId` = (ανάθεση, σύνδεσμος, παραλήπτης) — ντετερμινιστικό: μία απάντηση ανά σύνδεσμο (μίας χρήσης), άρα μία
 *    ειδοποίηση ανά άνθρωπο· επανάληψη μετά από σφάλμα ⇒ ο orchestrator την απορρίπτει ως διπλότυπη.
 * 🔑 Ο τίτλος ονομάζει το **ακίνητο**, όχι το έγγραφο: η ετικέτα εγγράφου είναι μεταφράσιμη, το αποθηκευμένο κείμενο όχι.
 * ⚠️ **Δεν πετά ποτέ**: η απάντηση έχει ήδη καταγραφεί· μια χαμένη ειδοποίηση δεν την ακυρώνει.
 */

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import type { IssuanceLinkAnswer } from '@/lib/document-validity/issuance-request';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { orgWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('issuance-answer-notifier');
const FEATURE = 'document-issuance';

/** Η ελληνική απόδοση για το αποθηκευμένο κείμενο· ο drawer αποδίδει από τα κλειδιά. */
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

/** 🔑 Κυριολεκτικά κλειδιά (ζουν στο `common-shared`) — έτσι τα βλέπει η άγκυρα προσβασιμότητας τίτλων. */
/**
 * Τι έγινε στον σύνδεσμο: μία απάντηση, ή (§29) **κλείδωμα** μετά από 5 λάθος κωδικούς — όπως το Adobe Sign ειδοποιεί τον
 * αποστολέα. Ίδιο γεγονός, ίδια προτίμηση (`documentIssuanceAnswers`): «κίνηση στον σύνδεσμο που έστειλα».
 * §30 — ή (`delivery-failed`) **το email επέστρεψε**: ο πάροχος δεν μπόρεσε να το παραδώσει (DocuSign «Envelope delivery to a
 * recipient fails»). Ο σύνδεσμος δεν θα απαντηθεί ποτέ — το γραφείο πρέπει να το μάθει χωρίς να κοιτάξει.
 */
export type IssuanceLinkEvent = IssuanceLinkAnswer | 'code-locked' | 'delivery-failed';

const TITLE_KEYS: Readonly<Record<IssuanceLinkEvent, string>> = {
  approve: 'documentIssuanceAnswered.approved',
  reject: 'documentIssuanceAnswered.rejected',
  accept: 'documentIssuanceAnswered.accepted',
  decline: 'documentIssuanceAnswered.declined',
  'code-locked': 'documentIssuanceAnswered.locked',
  'delivery-failed': 'documentIssuanceAnswered.bounced',
};

/** Το σώμα κάθε γεγονότος — με όνομα του αποδέκτη, ή χωρίς (επαφή χωρίς όνομα). */
const BODY_KEYS: Readonly<Record<IssuanceLinkEvent, { readonly named: string; readonly unnamed: string }>> = {
  approve: { named: 'documentIssuanceAnswered.body', unnamed: 'documentIssuanceAnswered.bodyUnnamed' },
  reject: { named: 'documentIssuanceAnswered.body', unnamed: 'documentIssuanceAnswered.bodyUnnamed' },
  accept: { named: 'documentIssuanceAnswered.body', unnamed: 'documentIssuanceAnswered.bodyUnnamed' },
  decline: { named: 'documentIssuanceAnswered.body', unnamed: 'documentIssuanceAnswered.bodyUnnamed' },
  'code-locked': { named: 'documentIssuanceAnswered.lockedBody', unnamed: 'documentIssuanceAnswered.lockedBodyUnnamed' },
  'delivery-failed': { named: 'documentIssuanceAnswered.bouncedBody', unnamed: 'documentIssuanceAnswered.bouncedBodyUnnamed' },
};

/** Γεγονότα του ίδιου συνδέσμου που **δεν** είναι η απάντηση — δικό τους κλειδί, αλλιώς το ένα θα έσβηνε το άλλο ως διπλότυπο. */
const EVENT_ID_SUFFIX: Readonly<Partial<Record<IssuanceLinkEvent, string>>> = { 'code-locked': ':locked', 'delivery-failed': ':bounced' };

export interface IssuanceAnswerNotice {
  readonly companyId: string;
  readonly assignmentId: string;
  readonly invitationId: string;
  readonly answer: IssuanceLinkEvent;
  /** Όποιος πρότεινε και όποιος έστειλε — μπορεί να είναι ο ίδιος άνθρωπος. */
  readonly recipientUids: readonly string[];
  readonly propertyName: string | null;
  readonly respondentName: string | null;
}

/** Ντετερμινιστικό: (ανάθεση, σύνδεσμος, παραλήπτης). */
export function issuanceAnswerEventId(assignmentId: string, invitationId: string, recipientUid: string, event: IssuanceLinkEvent): string {
  // Το κλείδωμα και η απάντηση είναι **δύο** γεγονότα του ίδιου συνδέσμου — ίδιο κλειδί θα έσβηνε το ένα ως διπλότυπο.
  const base = `document-issuance:${assignmentId}:${invitationId}:${recipientUid}`;
  return `${base}${EVENT_ID_SUFFIX[event] ?? ''}`;
}

function copyOf(notice: IssuanceAnswerNotice) {
  const titleKey = TITLE_KEYS[notice.answer];
  const titleParams = { title: notice.propertyName ?? notice.assignmentId };
  const bodyKey = notice.respondentName === null ? BODY_KEYS[notice.answer].unnamed : BODY_KEYS[notice.answer].named;
  const bodyParams = notice.respondentName === null ? undefined : { name: notice.respondentName };
  return {
    title: noticeT(titleKey, titleParams),
    titleKey,
    titleParams,
    body: noticeT(bodyKey, bodyParams),
    bodyKey,
    ...(bodyParams ? { bodyParams } : {}),
  };
}

async function announceTo(notice: IssuanceAnswerNotice, recipientUid: string): Promise<'sent' | 'skipped' | 'failed'> {
  const eventId = issuanceAnswerEventId(notice.assignmentId, notice.invitationId, recipientUid, notice.answer);
  try {
    const result = await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_ANSWERED,
      recipientId: recipientUid,
      tenantId: notice.companyId,
      ...copyOf(notice),
      eventId,
      ...viewDestination(documentExpiryHref(), orgWorkspace(notice.companyId)),
      source: { service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() },
    });
    return result.skipped ? 'skipped' : 'sent';
  } catch (error) {
    logger.error('Η ειδοποίηση απάντησης ανάθεσης δεν στάλθηκε', { eventId, error: error instanceof Error ? error.message : String(error) });
    return 'failed';
  }
}

/** Μία ειδοποίηση ανά άνθρωπο του γραφείου — ποτέ δύο στον ίδιο. */
export async function announceIssuanceAnswer(notice: IssuanceAnswerNotice): Promise<readonly ('sent' | 'skipped' | 'failed')[]> {
  return Promise.all([...new Set(notice.recipientUids)].map((uid) => announceTo(notice, uid)));
}
