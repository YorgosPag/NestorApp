/**
 * @fileoverview ADR-915 §45 Φ5 — **τα ορόσημα της προθεσμίας παράδοσης** που αξίζουν ειδοποίηση (Α6): «λήγει αύριο»
 *   (στον επαγγελματία) · «καθυστερεί» (+1) · «καθυστερεί εβδομάδα» (+7) (στο γραφείο). Καθαρό· η ημέρα είναι του
 *   **ίδιου** ρολογιού με το μητρώο (`issuanceLatenessOf`).
 * @related issuance-delivery-due.ts (η βαθμίδα) · server/issuance-invitations/issuance-delivery-notifier.ts (η αποστολή)
 * @module lib/document-validity/issuance-delivery-milestone
 *
 * 🔑 **Μία φορά ανά ορόσημο ΚΑΙ προθεσμία**: το `eventId` περιέχει το `dueOn` — νέα προθεσμία ⇒ νέος κύκλος· ίδιο ορόσημο
 *    ξανά ⇒ ο αποστολέας το απορρίπτει ως διπλότυπο.
 * 🔑 **Το πιο πρόσφατο ορόσημο που έχει περάσει**: η σάρωση επισκέπτεται με τον ρυθμό των υπενθυμίσεων — αν βρεθεί στις
 *    +9, λέει «εβδομάδα» (όχι το χαμένο +1, που θα ήταν πια ψέμα).
 */

import { issuanceLatenessOf } from './issuance-delivery-due';

export const DELIVERY_MILESTONES = ['due-tomorrow', 'overdue', 'overdue-week'] as const;
export type DeliveryMilestone = (typeof DELIVERY_MILESTONES)[number];

/** Οι ημέρες καθυστέρησης από τις οποίες μετρά το «εβδομάδα». */
export const DELIVERY_MILESTONE_POLICY = { overdueWeekDays: 7 } as const;

/** Το ορόσημο **σήμερα** — `null` όταν σήμερα δεν είναι ορόσημο (εντός προθεσμίας πέρα από αύριο · χωρίς προθεσμία). */
export function deliveryMilestoneOf(dueOn: string | null, today: string): { readonly milestone: DeliveryMilestone; readonly days: number } | null {
  const lateness = issuanceLatenessOf(dueOn, today);
  if (lateness.tier === 'overdue') {
    return { milestone: lateness.days >= DELIVERY_MILESTONE_POLICY.overdueWeekDays ? 'overdue-week' : 'overdue', days: lateness.days };
  }
  if (lateness.tier === 'due-soon' && lateness.daysLeft === 1) return { milestone: 'due-tomorrow', days: 0 };
  return null;
}

/** Ντετερμινιστικό: (ανάθεση, προθεσμία, ορόσημο, παραλήπτης). */
export function deliveryMilestoneEventId(assignmentId: string, dueOn: string, milestone: DeliveryMilestone, recipientUid: string): string {
  return `document-issuance-delivery:${assignmentId}:${dueOn}:${milestone}:${recipientUid}`;
}
