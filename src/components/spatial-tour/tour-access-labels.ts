/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΔΗΜΟΣΙΑΣ ΠΛΕΥΡΑΣ ΤΗΣ ΘΕΑΣΗΣ** — κάρτα αγγελίας + σελίδα θέασης (ADR-884 Κ3β).
 * @related ADR-744 (γιατί ΟΛΟΓΡΑΦΑ, ως μέλη αντικειμένου) · `spatial-tour-viewing-labels.ts` (η πλευρά του υπευθύνου)
 * @module components/spatial-tour/tour-access-labels
 *
 * 🔑 **Χωριστά από τα κλειδιά του υπευθύνου, επίτηδες**: τα εισάγει η **δημόσια** αγγελία — ό,τι βρίσκεται σε αυτό
 * το αρχείο μπαίνει στο i18n slice της (ADR-744 §20). Τα κλειδιά του πάνελ δεν έχουν δουλειά εκεί.
 * ⛔ Κάθε κλειδί ολόκληρο με το `spatial-tour:` — ποτέ πρόθεμα-σταθερά ή `spread`.
 */

import type { TourViewBasis } from '@/constants/spatial-tour-vocabulary';

export const ACCESS_KEYS = {
  cardTitle: 'spatial-tour:access.cardTitle',
  cardPublic: 'spatial-tour:access.cardPublic',
  cardOnRequest: 'spatial-tour:access.cardOnRequest',
  open: 'spatial-tour:access.open',
  request: 'spatial-tour:access.request',
  messageLabel: 'spatial-tour:access.messageLabel',
  messagePlaceholder: 'spatial-tour:access.messagePlaceholder',
  send: 'spatial-tour:access.send',
  cancel: 'spatial-tour:access.cancel',
  pending: 'spatial-tour:access.pending',
  withdraw: 'spatial-tour:access.withdraw',
  approved: 'spatial-tour:access.approved',
  declined: 'spatial-tour:access.declined',
  expired: 'spatial-tour:access.expired',
  revoked: 'spatial-tour:access.revoked',
  requestAgain: 'spatial-tour:access.requestAgain',
  signIn: 'spatial-tour:access.signIn',
  signInHint: 'spatial-tour:access.signInHint',
  failed: 'spatial-tour:refusal.unavailable',
} as const;

export const VIEWER_KEYS = {
  title: 'spatial-tour:viewer.title',
  preparing: 'spatial-tour:viewer.preparing',
  stops: 'spatial-tour:viewer.stops',
  backToListing: 'spatial-tour:viewer.backToListing',
  unavailable: 'spatial-tour:viewer.unavailable',
  signInRequired: 'spatial-tour:refusal.signInRequired',
  notViewable: 'spatial-tour:refusal.notViewable',
} as const;

/** Με ποια βάση βλέπει ο θεατής — ορατό ως σήμα, ώστε ο υπεύθυνος να ξέρει ότι βλέπει **προεπισκόπηση**. */
export const VIEW_BASIS_KEY: Readonly<Record<TourViewBasis, string>> = {
  manager: 'spatial-tour:viewer.basisManager',
  link: 'spatial-tour:viewer.basisLink',
  request: 'spatial-tour:viewer.basisRequest',
  public: 'spatial-tour:viewer.basisPublic',
};
