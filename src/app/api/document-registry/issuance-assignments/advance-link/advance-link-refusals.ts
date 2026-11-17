/**
 * @fileoverview ADR-943 Φ5β2 — άρνηση του «Αίτημα πληρωμής / Νέος σύνδεσμος» → HTTP. Χωριστό module: τα αρχεία route του
 *   Next εξάγουν **μόνο** HTTP handlers. Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της κάρτας (`ISSUANCE_ADVANCE_LINK_REFUSAL_KEYS`).
 * @module app/api/document-registry/issuance-assignments/advance-link/advance-link-refusals
 */

import type { AdvancePaymentRequestRefusal } from '@/server/issuance-invitations/issuance-advance-payment-request';

/** Κάθε λόγος ρητά (χωρίς `default`) — νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
export const ADVANCE_LINK_REFUSAL_STATUS: Readonly<Record<AdvancePaymentRequestRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  'not-accepted': [409, 'NOT_ACCEPTED'],
  'nothing-to-do': [409, 'NOTHING_TO_DO'],
  'no-advance': [409, 'NO_ADVANCE'],
  settled: [409, 'SETTLED'],
  'no-email': [422, 'NO_EMAIL'],
  unavailable: [503, 'UNAVAILABLE'],
};
