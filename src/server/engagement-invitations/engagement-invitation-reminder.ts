import 'server-only';

/**
 * @fileoverview **3 ΗΜΕΡΕΣ ΧΩΡΙΣ ΑΠΑΝΤΗΣΗ ⇒ ΥΠΕΝΘΥΜΙΣΗ ΣΤΟΝ ΠΡΟΣΚΑΛΟΥΝΤΑ** (ADR-901 Ε-5).
 * @related ADR-740 (cron dispatcher) · `config/engagement-policy.ts` · `conveyance-engagement-notifier.ts`
 * @module server/engagement-invitations/engagement-invitation-reminder
 *
 * 🔑 **Προληπτικά, όχι υπολογισμένα στη σάρωση**: η προθεσμία (`reminderDueAt`) γράφεται **στην έκδοση**· η σάρωση
 * απλώς ρωτά «ποιες οφείλονται;». Αλλαγή πολιτικής δεν ξαναγράφει την ιστορία των εκδομένων.
 *
 * 🔑 **Ακριβώς μία φορά, χωρίς χαμένη υπενθύμιση**: πρώτα η ειδοποίηση (ιδεμποτής — ντετερμινιστικό `eventId`,
 * dedupe του orchestrator), **μετά** το CAS `reminderSentAt` σε συναλλαγή. Πτώση ανάμεσα ⇒ η επόμενη σάρωση την
 * ξαναστέλνει και το dedupe την κόβει· ποτέ «σημειώθηκε αλλά δεν στάλθηκε».
 *
 * 🔑 **Ληγμένη ⇒ κλείνει**, δεν υπενθυμίζεται: γράφεται `expired` (η κατάσταση που ήδη **παρουσιάζεται**), ώστε η
 * σάρωση να μένει φραγμένη — μια ουρά νεκρών εγγράφων θα έτρωγε το όριο και θα έκρυβε τις ζωντανές.
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { engagementInvitationFromDocument } from '@/lib/conveyance/engagement-invitation-schema';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { announceInvitationUnanswered } from '@/services/conveyance/conveyance-engagement-notifier';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import type { EngagementInvitation } from '@/types/engagement-invitation';

import { engagementInvitationsCollection } from './engagement-invitation-issue';

const logger = createModuleLogger('engagement-invitation-reminder');

/** Όσες προσκλήσεις εξετάζει ένα πέρασμα — φραγμένο· το υπόλοιπο το παίρνει το επόμενο (`truncated`). */
const SWEEP_LIMIT = 200;

export interface ReminderSweepReport {
  readonly considered: number;
  readonly reminded: number;
  readonly expired: number;
  readonly skipped: number;
  readonly failed: number;
  readonly truncated: boolean;
}

type Verdict = 'remind' | 'expire' | 'skip';

/** Η κρίση πάνω στο **φρέσκο** έγγραφο — καθαρή, ώστε να ασκείται χωρίς βάση. */
export function reminderVerdict(invitation: EngagementInvitation | null, nowValue: string): Verdict {
  if (invitation === null || invitation.state !== 'pending' || invitation.reminderSentAt !== null) return 'skip';
  if (Date.parse(invitation.expiresAt) <= Date.parse(nowValue)) return 'expire';
  return Date.parse(invitation.reminderDueAt) <= Date.parse(nowValue) ? 'remind' : 'skip';
}

/** CAS: ξαναδιαβάζει, και γράφει **μόνο** αν η κρίση είναι ακόμη η ίδια. */
async function settle(db: Firestore, ref: DocumentReference, expected: Verdict, nowValue: string): Promise<boolean> {
  return db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const fresh = snap.exists ? engagementInvitationFromDocument(snap.data(), ref.id) : null;
    if (reminderVerdict(fresh, nowValue) !== expected) return false;
    tx.update(ref, expected === 'expire' ? { state: 'expired', resolvedAt: nowValue } : { reminderSentAt: nowValue });
    return true;
  });
}

async function remind(db: Firestore, invitation: EngagementInvitation, nowValue: string): Promise<boolean> {
  const subject = await loadConveyanceSubject(db, invitation.hostCompanyId, invitation.propertyId).catch(() => null);
  await announceInvitationUnanswered(invitation, subject?.propertyName ?? null);
  return settle(db, engagementInvitationsCollection(db).doc(invitation.id), 'remind', nowValue);
}

/** **Ένα πέρασμα.** Κάθε κάδος εκπέμπεται και όταν είναι μηδέν — «0» ≠ «δεν κοίταξε κανείς». */
export async function sweepEngagementInvitationReminders(db: Firestore): Promise<ReminderSweepReport> {
  const nowValue = nowISO();
  const snapshot = await engagementInvitationsCollection(db)
    .where('state', '==', 'pending')
    .where('reminderSentAt', '==', null)
    .where('reminderDueAt', '<=', nowValue)
    .limit(SWEEP_LIMIT)
    .get();
  const counts = { reminded: 0, expired: 0, skipped: 0, failed: 0 };
  for (const doc of snapshot.docs) {
    const invitation = engagementInvitationFromDocument(doc.data(), doc.id);
    const verdict = reminderVerdict(invitation, nowValue);
    try {
      if (verdict === 'skip' || invitation === null) counts.skipped += 1;
      else if (verdict === 'expire') counts[(await settle(db, doc.ref, 'expire', nowValue)) ? 'expired' : 'skipped'] += 1;
      else counts[(await remind(db, invitation, nowValue)) ? 'reminded' : 'skipped'] += 1;
    } catch (error: unknown) {
      counts.failed += 1;
      logger.error('Η υπενθύμιση πρόσκλησης απέτυχε', { invitationId: doc.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { considered: snapshot.size, ...counts, truncated: snapshot.size === SWEEP_LIMIT };
}
