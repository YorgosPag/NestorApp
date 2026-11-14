/**
 * @fileoverview ADR-915 §39 — άρνηση του «Νέος σύνδεσμος εισόδου» → HTTP. Χωριστό module: τα αρχεία route του Next εξάγουν
 *   **μόνο** HTTP handlers. Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της κάρτας (`SPACE_INVITE_REFUSAL_KEYS`).
 * @module app/api/document-registry/issuance-assignments/space-invitation/space-invite-refusals
 */

import type { SpaceInviteRefusal } from '@/server/issuance-invitations/issuance-space-invite';

/** Κάθε λόγος ρητά (χωρίς `default`) — νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
export const SPACE_INVITE_REFUSAL_STATUS: Readonly<Record<SpaceInviteRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  'not-accepted': [409, 'NOT_ACCEPTED'],
  entered: [409, 'ALREADY_ENTERED'],
  'no-project': [422, 'NO_PROJECT'],
  'no-authority': [422, 'NO_AUTHORITY'],
  'no-email': [422, 'NO_EMAIL'],
  unknown: [503, 'SPACE_UNKNOWN'],
};
