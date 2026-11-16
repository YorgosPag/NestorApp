/**
 * @fileoverview ADR-915 §45.15 (1β-γ-2) — άρνηση της «Εφαρμογής στην επαφή» → HTTP. Χωριστό module: τα αρχεία route του
 *   Next εξάγουν **μόνο** HTTP handlers. Οι κωδικοί είναι και τα κλειδιά μηνυμάτων του κουμπιού (`OWNER_VAT_REFUSAL_KEYS`).
 * @module app/api/document-registry/issuance-assignments/owner-vat/owner-vat-refusals
 */

import type { OwnerVatCorrectionRefusal } from '@/server/issuance-invitations/issuance-owner-vat-correction';

/** Κάθε λόγος ρητά (χωρίς `default`) — νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. */
export const OWNER_VAT_REFUSAL_STATUS: Readonly<Record<OwnerVatCorrectionRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  // 409: η διόρθωση άλλαξε στο μεταξύ (νέα έγκριση) — η οθόνη ξαναφορτώνει και δείχνει την τρέχουσα.
  'no-correction': [409, 'NO_CORRECTION'],
  'contact-unavailable': [404, 'CONTACT_UNAVAILABLE'],
};
