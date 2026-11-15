/**
 * @fileoverview ADR-915 §45 Φ3 — άρνηση της χειροκίνητης υπενθύμισης παράδοσης → HTTP. Χωριστό module: τα αρχεία route του
 *   Next εξάγουν **μόνο** HTTP handlers. Οι κωδικοί είναι και τα κλειδιά μηνυμάτων του κουμπιού (`DELIVERY_REMINDER_REFUSAL_KEYS`).
 * @module app/api/document-registry/issuance-assignments/delivery-reminder/delivery-reminder-refusals
 */

import type { ManualDeliveryReminderFailure } from '@/server/issuance-invitations/issuance-delivery-reminder';

/** Κάθε λόγος ρητά (χωρίς `default`) — νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
export const DELIVERY_REMINDER_REFUSAL_STATUS: Readonly<Record<ManualDeliveryReminderFailure, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  'not-accepted': [409, 'NOT_ACCEPTED'],
  'no-email': [422, 'NO_EMAIL'],
  // 409, όχι 429: δεν είναι όριο ρυθμού του πελάτη (που θα το ξαναδοκίμαζε), είναι κανόνας της ανάθεσης.
  'too-soon': [409, 'TOO_SOON'],
  limit: [422, 'REMINDER_LIMIT'],
};
