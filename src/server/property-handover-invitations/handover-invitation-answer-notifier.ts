import 'server-only';

/**
 * @fileoverview ADR-916 §5.15 Φ-Δ.2 (Ο7) — **«Ο αγοραστής απάντησε»**: ειδοποίηση στο γραφείο όταν ο αγοραστής αποδέχεται ή
 *   αρνείται την πρόσκληση παράδοσης.
 * @related handover-invitation-redeem.ts (ο καλών, **μετά** το commit) · issuance-invitations/issuance-answer-notifier.ts
 *   (το ιδίωμα) · lib/property-handover/handover-office-status.ts (η ΜΙΑ κρίση «ποιος κινείται»)
 * @module server/property-handover-invitations/handover-invitation-answer-notifier
 *
 * | Γεγονός | Προς | Προσγείωση |
 * |---|---|---|
 * | `properties.handoverInvitationAnswered` | όποιος **έστειλε** (αν είναι άνθρωπος) + οι **διαχειριστές** του χώρου | καρτέλα «Παράδοση» του ακινήτου |
 *
 * 🔑 **Η επόμενη κίνηση από την ΙΔΙΑ κρίση με την καρτέλα** (`handoverOfficeStatusOf` → `move`) — η ειδοποίηση και η οθόνη
 *    δεν μπορούν να διαφωνήσουν. Το DocuSign λέει «declined»· εμείς λέμε και **ποιος κινείται τώρα**.
 * 🔑 `eventId` = (πρόσκληση, απάντηση): ο orchestrator αποδιπλώνει ανά (τύπο, παραλήπτη, eventId) ⇒ επανάληψη = μία ειδοποίηση.
 * 🔒 **Καμία PII**: μόνο ονοματεπώνυμο αγοραστή (επαφή του ίδιου μισθωτή) + ακίνητο. Ποτέ email · τηλέφωνο · ΑΦΜ.
 * ⚠️ **Δεν πετά ποτέ**: η απάντηση του αγοραστή έχει ήδη καταγραφεί· μια χαμένη ειδοποίηση δεν την ακυρώνει.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  getCurrentEnvironment,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_SEVERITIES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { handoverOfficeStatusOf } from '@/lib/property-handover/handover-office-status';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { createModuleLogger } from '@/lib/telemetry';
import { workspaceHostRecipients } from '@/lib/workspace/workspace-host-recipients';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { sealConfigurationOf } from '@/server/pdf-seal/seal-config.server';
import { handoverRecipientNamesOf } from '@/services/property-handover/property-handover-recipient-name.server';
import type { HandoverOfficeMove } from '@/types/property-handover';
import type { PropertyHandoverInvitation } from '@/types/property-handover-invitation';
import { orgWorkspace } from '@/types/workspace-membership';

import { describeHandoverInvitation } from './handover-invitation-description';

const logger = createModuleLogger('handover-invitation-answer-notifier');
const FEATURE = 'property-handover-invitation';

/** Η ελληνική απόδοση για το αποθηκευμένο κείμενο· ο drawer αποδίδει από τα κλειδιά. */
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

export type HandoverInvitationAnswer = 'accepted' | 'declined';
export type HandoverAnswerDelivery = 'sent' | 'skipped' | 'failed';

/** 🔑 Κυριολεκτικά κλειδιά (ζουν στο `common-shared`) — έτσι τα βλέπουν οι πύλες i18n. */
const TITLE_KEYS: Readonly<Record<HandoverInvitationAnswer, string>> = {
  accepted: 'handoverInvitationAnswered.accepted',
  declined: 'handoverInvitationAnswered.declined',
};

/** Το σώμα = **η επόμενη κίνηση** — ολικό ως προς το λεξιλόγιο κινήσεων (νέα κίνηση ⇒ ο τύπος ζητά κείμενο). */
const BODY_KEYS: Readonly<Record<HandoverOfficeMove, { readonly named: string; readonly unnamed: string }>> = {
  office: { named: 'handoverInvitationAnswered.body.office', unnamed: 'handoverInvitationAnswered.bodyUnnamed.office' },
  buyer: { named: 'handoverInvitationAnswered.body.buyer', unnamed: 'handoverInvitationAnswered.bodyUnnamed.buyer' },
  sale: { named: 'handoverInvitationAnswered.body.sale', unnamed: 'handoverInvitationAnswered.bodyUnnamed.sale' },
  system: { named: 'handoverInvitationAnswered.body.system', unnamed: 'handoverInvitationAnswered.bodyUnnamed.system' },
  none: { named: 'handoverInvitationAnswered.body.none', unnamed: 'handoverInvitationAnswered.bodyUnnamed.none' },
};

/** Η άρνηση **ζητά** κίνηση του γραφείου — ίδια με την κρίση (`declined ⇒ office`), αν η παράδοση δεν διαβάζεται. */
const FALLBACK_MOVE: Readonly<Record<HandoverInvitationAnswer, HandoverOfficeMove>> = { accepted: 'system', declined: 'office' };

/** **Ο ΕΝΑΣ προορισμός**: η καρτέλα «Παράδοση» του ακινήτου, στον χώρο του γραφείου. Τον ρωτά και ο κανόνας προορισμού. */
export function handoverInvitationAnsweredDestination(propertyId: string, companyId: string): NotificationDestination {
  return viewDestination(ENTITY_ROUTES.properties.withTab(propertyId, 'handover'), orgWorkspace(companyId));
}

/** Ντετερμινιστικό: (πρόσκληση, απάντηση). Η πρόσκληση απαντιέται **μία** φορά, άρα μία ειδοποίηση ανά άνθρωπο. */
export function handoverAnswerEventId(invitationId: string, answer: HandoverInvitationAnswer): string {
  return `handover-invitation:${invitationId}:${answer}`;
}

interface AnswerFacts {
  readonly move: HandoverOfficeMove;
  readonly buyerName: string | null;
  readonly propertyLabel: string | null;
  readonly recipients: readonly string[];
}

/** Η επόμενη κίνηση **μετά** την απάντηση — από την παράδοση όπως είναι τώρα, με την ίδια κρίση με την καρτέλα. */
async function nextMoveOf(db: Firestore, invitation: PropertyHandoverInvitation, answer: HandoverInvitationAnswer): Promise<HandoverOfficeMove> {
  const snap = await db.collection(COLLECTIONS.PROPERTY_HANDOVERS).doc(invitation.handoverId).get();
  const handover = propertyHandoverFromDocument(snap.data(), snap.id);
  if (handover === null) return FALLBACK_MOVE[answer];
  const sealConfigured = sealConfigurationOf(process.env).kind === 'configured';
  return handoverOfficeStatusOf(handover, { snapshot: null, sealConfigured, nowValue: nowISO() }).move;
}

async function factsOf(db: Firestore, invitation: PropertyHandoverInvitation, answer: HandoverInvitationAnswer, respondentUid: string): Promise<AnswerFacts> {
  const { companyId, propertyId, contactId } = invitation;
  const [move, names, description, recipients] = await Promise.all([
    nextMoveOf(db, invitation, answer),
    handoverRecipientNamesOf(db, companyId, [contactId]),
    describeHandoverInvitation(db, { companyId, propertyId }),
    workspaceHostRecipients(db, companyId, { actors: [invitation.invitedByUid], exclude: respondentUid }),
  ]);
  return { move, buyerName: names.get(contactId) ?? null, propertyLabel: description.propertyLabel, recipients };
}

function copyOf(answer: HandoverInvitationAnswer, facts: AnswerFacts, propertyId: string) {
  const titleKey = TITLE_KEYS[answer];
  const titleParams = { title: facts.propertyLabel ?? propertyId };
  const bodyKey = facts.buyerName === null ? BODY_KEYS[facts.move].unnamed : BODY_KEYS[facts.move].named;
  const bodyParams = facts.buyerName === null ? undefined : { name: facts.buyerName };
  return {
    title: noticeT(titleKey, titleParams),
    titleKey,
    titleParams,
    body: noticeT(bodyKey, bodyParams),
    bodyKey,
    ...(bodyParams ? { bodyParams } : {}),
  };
}

function announceTo(invitation: PropertyHandoverInvitation, answer: HandoverInvitationAnswer, facts: AnswerFacts, recipientUid: string) {
  return dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_HANDOVER_INVITATION_ANSWERED,
    recipientId: recipientUid,
    tenantId: invitation.companyId,
    ...copyOf(answer, facts, invitation.propertyId),
    // Η άρνηση ζητά απόφαση του γραφείου ⇒ ΠΡΟΕΙΔΟΠΟΙΗΣΗ· η αποδοχή είναι πληροφορία.
    severity: answer === 'declined' ? NOTIFICATION_SEVERITIES.WARNING : NOTIFICATION_SEVERITIES.INFO,
    eventId: handoverAnswerEventId(invitation.id, answer),
    entityId: invitation.propertyId,
    entityType: NOTIFICATION_ENTITY_TYPES.PROPERTY,
    ...handoverInvitationAnsweredDestination(invitation.propertyId, invitation.companyId),
    source: { service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() },
  });
}

async function deliverTo(invitation: PropertyHandoverInvitation, answer: HandoverInvitationAnswer, facts: AnswerFacts, uid: string): Promise<HandoverAnswerDelivery> {
  try {
    return (await announceTo(invitation, answer, facts, uid)).skipped ? 'skipped' : 'sent';
  } catch (error) {
    logger.error('Η ειδοποίηση απάντησης αγοραστή δεν στάλθηκε', { invitationId: invitation.id, answer, error: getErrorMessage(error) });
    return 'failed';
  }
}

/**
 * **Μία ειδοποίηση ανά άνθρωπο του γραφείου** — ποτέ δύο στον ίδιο, ποτέ στη μηχανή, ποτέ στον ίδιο τον αγοραστή.
 * Αποτυχία οπουδήποτε (ανάγνωση · αποστολή) ⇒ καταγράφεται και επιστρέφεται, **ποτέ** δεν πετά.
 */
export async function announceHandoverInvitationAnswer(
  db: Firestore,
  input: { readonly invitation: PropertyHandoverInvitation; readonly answer: HandoverInvitationAnswer; readonly respondentUid: string },
): Promise<readonly HandoverAnswerDelivery[]> {
  const { invitation, answer } = input;
  try {
    const facts = await factsOf(db, invitation, answer, input.respondentUid);
    return await Promise.all(facts.recipients.map((uid) => deliverTo(invitation, answer, facts, uid)));
  } catch (error) {
    logger.error('Οι αποδέκτες της απάντησης αγοραστή δεν βρέθηκαν', { invitationId: invitation.id, answer, error: getErrorMessage(error) });
    return ['failed'];
  }
}
