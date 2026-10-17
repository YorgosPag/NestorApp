/**
 * @fileoverview ADR-915 §28 — άρνηση της αποστολής → HTTP. Χωριστό module: τα αρχεία route του Next εξάγουν **μόνο**
 *   HTTP handlers. Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της οθόνης (`ISSUANCE_REFUSAL_CODES`, άγκυρα ισότητας).
 * @module app/api/document-registry/issuance-assignments/messages/issuance-send-refusals
 */

import type { SendRefusal } from '@/server/issuance-invitations/issuance-invitation-send';

/** Κάθε λόγος ρητά (χωρίς `default`) — νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
export const ISSUANCE_SEND_REFUSAL_STATUS: Readonly<Record<SendRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  unavailable: [503, 'ASSIGNMENTS_UNAVAILABLE'],
  'transition-refused': [409, 'TRANSITION_REFUSED'],
  'lead-undesignated': [409, 'LEAD_UNDESIGNATED'],
  'lead-changed': [409, 'LEAD_CHANGED'],
  'no-email': [422, 'NO_EMAIL'],
  'co-owner-unknown': [422, 'CO_OWNER_UNKNOWN'],
  'secret-missing': [503, 'LINKS_UNAVAILABLE'],
  stale: [409, 'STALE'],
  unqualified: [422, 'UNQUALIFIED'],
  'actor-refused': [422, 'ACTOR_REFUSED'],
};
