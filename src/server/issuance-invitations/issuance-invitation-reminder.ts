import 'server-only';

/**
 * @fileoverview ADR-915 §31 — **ΥΠΕΝΘΥΜΙΣΗ ΣΤΟΝ ΠΑΡΑΛΗΠΤΗ** του συνδέσμου ανάθεσης που δεν απαντήθηκε (DocuSign / Adobe Sign).
 * @related lib/document-validity/issuance-reminder.ts (πολιτική · κρίση) · issuance-invitation-answer.ts (η ΙΔΙΑ κρίση
 *   «ισχύει ο σύνδεσμος;») · issuance-invitation-kind.ts (επανέκδοση συνδέσμου) · ADR-740 (ο dispatcher)
 * @module server/issuance-invitations/issuance-invitation-reminder
 *
 * ```
 * οφειλόμενα μηνύματα ─► κρίση (σύνδεσμος · παράδοση · λήξη · ώρα) ─► νέος σύνδεσμος της ΙΔΙΑΣ πρόσκλησης ─► email ─► CAS
 * ```
 * 🔴 **Ποτέ πρώτη αποστολή**: η σάρωση βλέπει **μόνο** μηνύματα που το γραφείο έστειλε χειροκίνητα και ο πάροχος δέχτηκε
 *    (το πρόγραμμα γεννιέται στην αναφορά του αποστολέα). Χωρίς πρόγραμμα, δεν υπάρχει τίποτα να βρει.
 * 🔴 **Ποτέ ο κωδικός** (§29): δεν τον έχουμε — μόνο HMAC. Ο νέος σύνδεσμος είναι της **ίδιας** πρόσκλησης, άρα ο κωδικός που
 *    είπε το γραφείο **ισχύει**, και ο μετρητής αποτυχιών **δεν** μηδενίζεται (NIST 800-63B).
 * 🔑 **Η ΙΔΙΑ κρίση με τη σελίδα**: καμία υπενθύμιση για σύνδεσμο που η σελίδα θα αρνιόταν (αντικατεστημένος · απαντημένος ·
 *    ακυρωμένος · άλλος υπεύθυνος · κλειδωμένος).
 * 🔑 **Πρώτα το email, μετά το CAS** (όπως ο engagement reminder): πτώση ανάμεσα ⇒ η επόμενη σάρωση ξανακρίνει. Ο σύνδεσμος
 *    γράφεται **πριν** το email (αλλιώς δεν θα δούλευε), φραγμένα (`ISSUANCE_LINK_REISSUE_CAP`).
 * 🔑 **Ίδια συσχέτιση** με το αρχικό μήνυμα (§30): επιστροφή της υπενθύμισης ⇒ η ΙΔΙΑ γραμμή «επέστρεψε», η ΙΔΙΑ ειδοποίηση
 *    στο γραφείο — και καμία επόμενη υπενθύμιση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceApprovalRequest, IssuanceNotice } from '@/lib/document-validity/issuance-assignment';
import { documentRequestLocation } from '@/lib/document-validity/document-request-link';
import { insideReminderHours, issuanceReminderVerdict, type IssuanceReminders } from '@/lib/document-validity/issuance-reminder';
import { publicUrl } from '@/lib/http/public-origin';
import { createModuleLogger } from '@/lib/telemetry';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { zonedParts } from '@/server/notifications/email-delivery-clock';
import {
  readDueIssuanceReminders,
  recordIssuanceReminder,
  type IssuanceMessageTarget,
} from '@/services/document-registry/issuance-assignments.server';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';
import { buildIssuanceEmail } from '@/services/email-templates/issuance-invitation-email';
import { DEFAULT_NOTIFICATION_TIMEZONE } from '@/services/user-notification-settings/user-notification-settings.types';
import type { IssuanceInvitation } from '@/types/issuance-invitation';

import { issuanceDeliveryCorrelation } from './issuance-delivery-ref';
import { issuanceEmailFactsOf, resolveIssuanceInvitation, type ResolvedLink } from './issuance-invitation-answer';
import {
  isIssuanceLinkLocked,
  issuanceInvitationsCollection,
  parseIssuanceInvitation,
  reissueIssuanceInvitationLink,
} from './issuance-invitation-kind';

const logger = createModuleLogger('issuance-invitation-reminder');

/** Όσα έγγραφα εξετάζει ένα πέρασμα **ανά είδος μηνύματος** — φραγμένο· το υπόλοιπο το παίρνει το επόμενο (`truncated`). */
const SWEEP_LIMIT = 100;

export interface IssuanceReminderSweepReport {
  readonly considered: number;
  readonly reminded: number;
  readonly retired: number;
  readonly waiting: number;
  readonly failed: number;
  readonly truncated: boolean;
  /** Το πέρασμα έπεσε έξω από τις ώρες γραφείου (π.χ. catch-up μετά από επανεκκίνηση) ⇒ δεν κοίταξε τίποτα, **επίτηδες**. */
  readonly outsideOfficeHours: boolean;
}

type Settled = 'reminded' | 'retired' | 'waiting' | 'failed';

type DueMessage = (IssuanceApprovalRequest | IssuanceNotice) & { readonly invitationId: string; readonly reminders: IssuanceReminders & { readonly dueAt: string } };

/** Τα μηνύματα της ανάθεσης που **οφείλουν** υπενθύμιση — το πολύ δύο (αίτημα έγκρισης · μήνυμα στον επαγγελματία). */
function dueMessagesOf(assignment: DocumentIssuanceAssignment, nowIso: string): readonly DueMessage[] {
  return [assignment.approvalRequest, assignment.notice].flatMap((message): DueMessage[] => {
    const dueAt = message?.reminders?.dueAt ?? null;
    if (message === null || message.invitationId === null || message.reminders === null || dueAt === null) return [];
    return Date.parse(dueAt) <= Date.parse(nowIso) ? [{ ...message, invitationId: message.invitationId, reminders: { ...message.reminders, dueAt } }] : [];
  });
}

/** Η πρόσκληση του μηνύματος — **μόνο** αν ανήκει σε αυτή την ανάθεση και αυτό το γραφείο (ξένο ≡ ανύπαρκτο). */
async function invitationOf(db: Firestore, assignment: DocumentIssuanceAssignment, invitationId: string): Promise<IssuanceInvitation | null> {
  const invitation = parseIssuanceInvitation((await issuanceInvitationsCollection(db).doc(invitationId).get()).data(), invitationId);
  const ours = invitation !== null && invitation.companyId === assignment.companyId && invitation.assignmentId === assignment.id;
  return ours ? invitation : null;
}

/** Ισχύει ο σύνδεσμος; — η **ίδια** κρίση με τη σελίδα, συν ό,τι η σελίδα κρίνει από το token (κατάσταση · κλείδωμα). */
async function openLinkOf(db: Firestore, invitation: IssuanceInvitation | null, now: Date): Promise<ResolvedLink | null> {
  if (invitation === null || invitation.state !== 'pending' || isIssuanceLinkLocked(invitation)) return null;
  const resolved = await resolveIssuanceInvitation(db, invitation, now);
  return resolved.ok ? resolved.link : null;
}

/** **Η υπενθύμιση** — το ΙΔΙΟ μήνυμα με το αίτημα, με νέο σύνδεσμο της ΙΔΙΑΣ πρόσκλησης. Ποτέ δεν πετά. */
async function deliverReminder(link: ResolvedLink, message: DueMessage, token: string): Promise<InvitationNoticeOutcome> {
  const { invitation } = link;
  const url = publicUrl(documentRequestLocation(token));
  const facts = await issuanceEmailFactsOf(link, message.note);
  const common = { facts, expiresAt: invitation.expiresAt, accessCode: invitation.accessCode !== null, reminder: { firstSentAt: message.at } };
  return deliverInvitationEmail({
    invitationId: invitation.id,
    kind: 'document-issuance-reminder',
    inviteeEmail: invitation.inviteeEmail,
    inviterUid: invitation.invitedByUid,
    correlation: issuanceDeliveryCorrelation(invitation.id, { kind: 'recipient' }),
    compose: async (language) => {
      if (url === null) return null;
      return invitation.audience === 'owner'
        ? buildIssuanceEmail({ kind: 'approval', language, coOwnerNames: [], link: url, ...common })
        : buildIssuanceEmail({ kind: 'professional', language, link: url, ...common });
    },
  });
}

/** Ένα μήνυμα: κρίση → απόσυρση, αναμονή ή υπενθύμιση. Πετά μόνο σε βλάβη βάσης (η σάρωση το μετρά). */
async function settle(db: Firestore, assignment: DocumentIssuanceAssignment, message: DueMessage, now: Date): Promise<Settled> {
  const nowIso = now.toISOString();
  const target: IssuanceMessageTarget = { companyId: assignment.companyId, propertyId: assignment.propertyId, documentKind: assignment.documentKind, invitationId: message.invitationId };
  const retire = async (): Promise<Settled> => { await recordIssuanceReminder(db, target, { kind: 'retired', dueAt: message.reminders.dueAt }); return 'retired'; };
  const invitation = await invitationOf(db, assignment, message.invitationId);
  const link = await openLinkOf(db, invitation, now);
  const verdict = issuanceReminderVerdict({
    reminders: message.reminders, delivery: message.delivery, linkOpen: link !== null, expiresAt: invitation?.expiresAt ?? nowIso, nowIso,
  });
  if (verdict.kind === 'wait') return 'waiting';
  if (verdict.kind === 'retire' || link === null) return retire();
  const reissued = await reissueIssuanceInvitationLink(db, link.invitation.id, nowIso);
  if (!reissued.ok) return retire();
  const outcome = await deliverReminder(link, message, reissued.token);
  if (outcome !== 'accepted') {
    // Το πρόγραμμα μένει: η επόμενη σάρωση ξαναδοκιμάζει, φραγμένα από το όριο επανέκδοσης.
    logger.warn('Η υπενθύμιση ανάθεσης δεν έγινε δεκτή από τον πάροχο', { invitationId: link.invitation.id, outcome });
    return 'failed';
  }
  await recordIssuanceReminder(db, target, { kind: 'sent', dueAt: verdict.dueAt, sentAt: nowIso, expiresAt: link.invitation.expiresAt });
  return 'reminded';
}

/** **Ένα πέρασμα.** Κάθε κάδος εκπέμπεται και όταν είναι μηδέν — «0» ≠ «δεν κοίταξε κανείς». */
export async function sweepIssuanceInvitationReminders(db: Firestore, now: Date): Promise<IssuanceReminderSweepReport> {
  const nowIso = now.toISOString();
  if (!insideReminderHours(zonedParts(now, DEFAULT_NOTIFICATION_TIMEZONE))) {
    return { considered: 0, reminded: 0, retired: 0, waiting: 0, failed: 0, truncated: false, outsideOfficeHours: true };
  }
  const { assignments, truncated } = await readDueIssuanceReminders(db, nowIso, SWEEP_LIMIT);
  const counts: Record<Settled, number> = { reminded: 0, retired: 0, waiting: 0, failed: 0 };
  let considered = 0;
  for (const assignment of assignments) {
    for (const message of dueMessagesOf(assignment, nowIso)) {
      considered += 1;
      try {
        counts[await settle(db, assignment, message, now)] += 1;
      } catch (error: unknown) {
        counts.failed += 1;
        logger.error('Η υπενθύμιση ανάθεσης απέτυχε', { invitationId: message.invitationId, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return { considered, ...counts, truncated, outsideOfficeHours: false };
}
