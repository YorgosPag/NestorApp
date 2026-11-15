import 'server-only';

/**
 * @fileoverview ADR-915 §45 Φ3 — **ΥΠΕΝΘΥΜΙΣΗ ΠΑΡΑΔΟΣΗΣ ΣΤΟΝ ΕΠΑΓΓΕΛΜΑΤΙΑ**: αυτόματη (σάρωση, Vanta) και χειροκίνητη
 *   (ένα πάτημα του γραφείου, DocuSign «Remind») — **μία** αποστολή, **μία** κρίση «είναι ακόμη ανοιχτή;».
 * @related lib/document-validity/issuance-delivery-reminder.ts (πολιτική · πρόγραμμα · κρίση) ·
 *   issuance-invitation-reminder.ts (η §31: ίδιο σχήμα, ίδιο cron) · issuance-space-invite.ts (ίδιος κανόνας διεύθυνσης)
 * @module server/issuance-invitations/issuance-delivery-reminder
 *
 * ```
 * οφειλόμενες ─► ανά γραφείο: ΕΝΑ μητρώο ─► κρίση (ανοιχτή · ίδια προθεσμία · κενό ημέρας · ώρα) ─► email ─► CAS
 * ```
 * 🔑 **«Ανοιχτή» = η ΙΔΙΑ κρίση με την οθόνη**: `issuanceStateOf` πάνω στο νεότερο έγγραφο του μητρώου (απόφαση Giorgio
 *    2026-11-15: ο ΕΝΑΣ αναγνώστης `readDocumentRegistry`, **μία** φορά ανά γραφείο ανά πέρασμα — καμία δεύτερη ανάγνωση
 *    «ενός ακινήτου» που θα μπορούσε να διαφωνήσει με την οθόνη). Ολοκληρώθηκε · ακυρώθηκε · αποσύρθηκε ⇒ απόσυρση.
 * 🔑 **Πού**: η διεύθυνση που **απέδειξε** ο ίδιος, αλλιώς η κύρια της επαφής (`inviteeEmailOf`, §39).
 * 🔑 **Με χώρο** (μπήκε με λογαριασμό, ενεργή συμμετοχή) ⇒ κουμπί προς τη σελίδα της ανάθεσης στο **δικό του** σπίτι
 *    (ο ΙΔΙΟΣ προορισμός με τις ειδοποιήσεις συμμετοχής)· **χωρίς** ⇒ κανένας σύνδεσμος.
 * 🔑 **Πρώτα το email, μετά το CAS** (§31): πτώση ανάμεσα ⇒ η επόμενη σάρωση ξανακρίνει.
 * 🔒 Ποτέ τηλέφωνο/email του γραφείου, ποτέ η ημέρα της υπογραφής του ιδιοκτήτη.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { readEngagementForSubject } from '@/lib/auth/engagement-read';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { issuanceKeyOf, issuanceStateOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { issuanceDeliveryOf } from '@/lib/document-validity/issuance-delivery-due';
import {
  deliveryReminderMomentOf,
  deliveryReminderVerdict,
  manualDeliveryReminderRefusal,
  type ManualDeliveryReminderRefusal,
} from '@/lib/document-validity/issuance-delivery-reminder';
import { insideReminderHours } from '@/lib/document-validity/issuance-reminder';
import { publicUrl } from '@/lib/http/public-origin';
import { createModuleLogger } from '@/lib/telemetry';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { addressInWorkspace } from '@/lib/workspace/workspace-address';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { latestIssuanceSpaceInvitations } from '@/server/engagement-invitations/engagement-invitation-issue';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { zonedParts } from '@/server/notifications/email-delivery-clock';
import { caseEngagementChangedDestination } from '@/services/conveyance/conveyance-engagement-notifier';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';
import { readDueDeliveryReminders, recordDeliveryReminder } from '@/services/document-registry/issuance-assignments.server';
import { buildIssuanceEmail } from '@/services/email-templates/issuance-invitation-email';
import { DEFAULT_NOTIFICATION_TIMEZONE } from '@/services/user-notification-settings/user-notification-settings.types';

import type { IssuanceReminderSweepReport } from './issuance-invitation-reminder';
import { inviteeEmailOf, readOwnAssignment } from './issuance-space-invite';

const logger = createModuleLogger('issuance-delivery-reminder');

/** Όσες αναθέσεις εξετάζει ένα πέρασμα — φραγμένο· το υπόλοιπο το παίρνει το επόμενο (`truncated`). */
const SWEEP_LIMIT = 100;

/** Το είδος για τα ίχνη της αποστολής. */
const EMAIL_KIND = 'document-issuance-delivery-reminder';

type Settled = 'reminded' | 'retired' | 'waiting' | 'failed';

/** Η ανάθεση **όπως τη βλέπει η οθόνη** — μόνο αν είναι ανοιχτή **και** αναληφθείσα· αλλιώς `null`. */
function acceptedRecordOf(registry: DocumentRegistryResponse, propertyId: string, kind: DocumentKind): IssuanceAssignmentRecord | null {
  const issuance = registry.issuance[issuanceKeyOf(propertyId, kind)];
  if (!registry.issuanceKnown || issuance === undefined) return null;
  const state = issuanceStateOf(issuance.record, issuance.latestIssuedOn);
  return state.kind === 'open' && state.stage === 'accepted' ? state.record : null;
}

/**
 * Ο χώρος του επαγγελματία, ως **απόλυτος** σύνδεσμος — μόνο αν μπήκε (η κάρτα το λέει ήδη) **και** η συμμετοχή του είναι
 * ενεργή. Ο προορισμός είναι ο ΙΔΙΟΣ με τις ειδοποιήσεις συμμετοχής (σπίτι της συμμετοχής, όχι του γραφείου). Ποτέ δεν
 * πετά: χωρίς βεβαιότητα ⇒ `null` ⇒ μήνυμα χωρίς σύνδεσμο.
 */
async function spaceLinkOf(db: Firestore, assignment: DocumentIssuanceAssignment, registry: DocumentRegistryResponse, nowIso: string): Promise<string | null> {
  if (registry.issuanceSpaces?.[issuanceKeyOf(assignment.propertyId, assignment.documentKind)]?.kind !== 'entered') return null;
  try {
    const latest = (await latestIssuanceSpaceInvitations(db, assignment.companyId, nowIso)).byAssignment.get(assignment.id);
    if (latest === undefined || latest.resolvedByUid === null) return null;
    const read = await readEngagementForSubject(db, {
      hostCompanyId: assignment.companyId, projectId: latest.projectId, uid: latest.resolvedByUid,
      subject: { kind: 'document_issuance', assignmentId: assignment.id },
    });
    if (read.outcome !== 'found' || read.engagement === null || read.engagement.state !== 'active') return null;
    const destination = await caseEngagementChangedDestination(read.engagement);
    const path = destination.actions[0]?.url;
    return path === undefined ? null : publicUrl(await addressInWorkspace(destination.workspace, path));
  } catch (error: unknown) {
    logger.warn('Ο σύνδεσμος του χώρου δεν βρέθηκε — υπενθύμιση χωρίς σύνδεσμο', { assignmentId: assignment.id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

interface ReminderSubject {
  readonly assignment: DocumentIssuanceAssignment;
  readonly registry: DocumentRegistryResponse;
  readonly record: IssuanceAssignmentRecord;
  readonly now: Date;
}

/** **Η υπενθύμιση** — `no-email` αν δεν υπάρχει πουθενά διεύθυνση. Η αποστολή ποτέ δεν πετά (`deliverInvitationEmail`). */
async function deliverDeliveryReminder(db: Firestore, subject: ReminderSubject): Promise<InvitationNoticeOutcome | 'no-email'> {
  const { assignment, registry, record, now } = subject;
  const email = await inviteeEmailOf(db, assignment);
  if (email === null) return 'no-email';
  const [spaceLink, officeName] = await Promise.all([
    spaceLinkOf(db, assignment, registry, now.toISOString()),
    readWorkspaceName(assignment.companyId).then(trimmedStringOrNull, () => null),
  ]);
  const dueOn = issuanceDeliveryOf(record)?.dueOn ?? null;
  const facts = {
    officeName, propertyLabel: registry.properties[assignment.propertyId]?.name ?? null, documentKind: assignment.documentKind,
    professionalName: registry.people[record.professionalContactId]?.name ?? null, credential: record.credential, note: null,
  };
  return deliverInvitationEmail({
    // Για τα ίχνη μόνο: η υπενθύμιση δεν έχει πρόσκληση — ταυτότητα είναι η ανάθεση.
    invitationId: assignment.id,
    kind: EMAIL_KIND,
    inviteeEmail: email,
    // Η κλίμακα γλώσσας: του παραλήπτη, αλλιώς όποιου πρότεινε την ανάθεση (εκείνος ξεκίνησε τη σχέση).
    inviterUid: record.proposedByUid,
    compose: async (language) => buildIssuanceEmail({
      kind: 'delivery-reminder', language, facts, moment: deliveryReminderMomentOf(dueOn, conveyanceToday(now)), dueOn, spaceLink,
    }),
  });
}

function targetOf(assignment: DocumentIssuanceAssignment) {
  return { companyId: assignment.companyId, propertyId: assignment.propertyId, documentKind: assignment.documentKind };
}

/** Μία ανάθεση: κρίση → απόσυρση, αναμονή ή υπενθύμιση. Πετά μόνο σε βλάβη βάσης (η σάρωση το μετρά). */
async function settle(db: Firestore, assignment: DocumentIssuanceAssignment, registry: DocumentRegistryResponse, now: Date): Promise<Settled> {
  const record = acceptedRecordOf(registry, assignment.propertyId, assignment.documentKind);
  const verdict = deliveryReminderVerdict({
    reminders: assignment.deliveryReminders, open: record !== null,
    dueOn: record === null ? null : issuanceDeliveryOf(record)?.dueOn ?? null, nowIso: now.toISOString(),
  });
  if (verdict.kind === 'wait') return 'waiting';
  const retire = async (): Promise<Settled> => { await recordDeliveryReminder(db, targetOf(assignment), { kind: 'retired', dueAt: verdict.dueAt }); return 'retired'; };
  if (verdict.kind === 'retire' || record === null) return retire();
  const outcome = await deliverDeliveryReminder(db, { assignment, registry, record, now });
  if (outcome === 'no-email') {
    logger.warn('Υπενθύμιση παράδοσης χωρίς διεύθυνση — το πρόγραμμα αποσύρεται', { assignmentId: assignment.id });
    return retire();
  }
  if (outcome !== 'accepted') {
    // Το πρόγραμμα μένει: η επόμενη σάρωση ξαναδοκιμάζει.
    logger.warn('Η υπενθύμιση παράδοσης δεν έγινε δεκτή από τον πάροχο', { assignmentId: assignment.id, outcome });
    return 'failed';
  }
  await recordDeliveryReminder(db, targetOf(assignment), { kind: 'sent', dueAt: verdict.dueAt, sentAt: now.toISOString() });
  return 'reminded';
}

/** Ένα γραφείο: **ένα** μητρώο, μετά κάθε ανάθεσή του. Βλάβη στο μητρώο ⇒ όλες «failed» (η επόμενη σάρωση ξανακρίνει). */
async function settleCompany(db: Firestore, companyId: string, assignments: readonly DocumentIssuanceAssignment[], now: Date, counts: Record<Settled, number>): Promise<void> {
  let registry: DocumentRegistryResponse;
  try {
    registry = await readDocumentRegistry(db, companyId, now);
  } catch (error: unknown) {
    counts.failed += assignments.length;
    logger.error('Το μητρώο δεν διαβάστηκε — καμία υπενθύμιση παράδοσης για το γραφείο', { companyId, error: error instanceof Error ? error.message : String(error) });
    return;
  }
  for (const assignment of assignments) {
    try {
      counts[await settle(db, assignment, registry, now)] += 1;
    } catch (error: unknown) {
      counts.failed += 1;
      logger.error('Η υπενθύμιση παράδοσης απέτυχε', { assignmentId: assignment.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** **Ένα πέρασμα.** Κάθε κάδος εκπέμπεται και όταν είναι μηδέν — «0» ≠ «δεν κοίταξε κανείς». */
export async function sweepIssuanceDeliveryReminders(db: Firestore, now: Date): Promise<IssuanceReminderSweepReport> {
  if (!insideReminderHours(zonedParts(now, DEFAULT_NOTIFICATION_TIMEZONE))) {
    return { considered: 0, reminded: 0, retired: 0, waiting: 0, failed: 0, truncated: false, outsideOfficeHours: true };
  }
  const nowIso = now.toISOString();
  const { assignments, truncated } = await readDueDeliveryReminders(db, nowIso, SWEEP_LIMIT);
  // Ανά γραφείο: ΕΝΑ μητρώο για όλες τις αναθέσεις του (απόφαση §45 Φ3 — ο ΕΝΑΣ αναγνώστης, όχι ανά ακίνητο).
  const byCompany = new Map<string, DocumentIssuanceAssignment[]>();
  for (const assignment of assignments) byCompany.set(assignment.companyId, [...(byCompany.get(assignment.companyId) ?? []), assignment]);
  const counts: Record<Settled, number> = { reminded: 0, retired: 0, waiting: 0, failed: 0 };
  for (const [companyId, ofCompany] of byCompany) await settleCompany(db, companyId, ofCompany, now, counts);
  return { considered: assignments.length, ...counts, truncated, outsideOfficeHours: false };
}

/** Ποιος στέλνει — από το token του αιτήματος (`withAuth`), ποτέ από το σώμα. */
export interface DeliveryReminderSender {
  readonly companyId: string;
  readonly uid: string;
}

/**
 * - `absent`       — καμία τέτοια ανάθεση σε αυτό το γραφείο (ξένη ≡ ανύπαρκτη)
 * - `not-accepted` — δεν είναι αναληφθείσα και ανοιχτή (πριν την ανάθεση · ολοκληρώθηκε · ακυρώθηκε · αποσύρθηκε)
 * - `no-email`     — καμία διεύθυνση: ούτε αποδεδειγμένη ούτε στην επαφή
 * - `too-soon` · `limit` — η κρίση του leaf (όχι δύο την ίδια ημέρα · φρένο ιστορικού)
 */
export type ManualDeliveryReminderFailure = 'absent' | 'not-accepted' | 'no-email' | ManualDeliveryReminderRefusal;

export type ManualDeliveryReminderOutcome =
  | { readonly ok: true; readonly delivery: InvitationNoticeOutcome; readonly at: string }
  | { readonly ok: false; readonly refusal: ManualDeliveryReminderFailure };

/**
 * **Χειροκίνητη υπενθύμιση παράδοσης** — ένα πάτημα του γραφείου. Καταγράφεται **μόνο** αν ο πάροχος δέχτηκε το email
 * (μια υπενθύμιση που δεν έφυγε δεν «μετρά» για το κενό της ημέρας). Η ιδεμποτία του πατήματος είναι του συνόρου
 * (ADR-872)· η κρίση «όχι δύο την ίδια ημέρα» ξανατρέχει στη συναλλαγή της καταγραφής.
 */
export async function sendManualDeliveryReminder(
  db: Firestore,
  sender: DeliveryReminderSender,
  target: { readonly propertyId: string; readonly documentKind: DocumentKind },
  now: Date,
): Promise<ManualDeliveryReminderOutcome> {
  const assignment = await readOwnAssignment(db, sender.companyId, target.propertyId, target.documentKind);
  if (assignment === null) return { ok: false, refusal: 'absent' };
  const registry = await readDocumentRegistry(db, sender.companyId, now);
  const record = acceptedRecordOf(registry, assignment.propertyId, assignment.documentKind);
  if (record === null) return { ok: false, refusal: 'not-accepted' };
  const at = now.toISOString();
  const refusal = manualDeliveryReminderRefusal(assignment.deliveryReminders, at);
  if (refusal !== null) return { ok: false, refusal };
  const delivery = await deliverDeliveryReminder(db, { assignment, registry, record, now });
  if (delivery === 'no-email') return { ok: false, refusal: 'no-email' };
  if (delivery === 'accepted') await recordDeliveryReminder(db, targetOf(assignment), { kind: 'manual', at, byUid: sender.uid });
  return { ok: true, delivery, at };
}
