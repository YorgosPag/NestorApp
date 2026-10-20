/**
 * @fileoverview **Οι ετικέτες της πρόσκλησης αγοραστή** (`/handover-invite/[token]`) — κλειστοί πίνακες κλειδιών i18n.
 * @related ADR-916 Φ-Β2 · `case-invite-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/handover-invite/handover-invite-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών —
 * αλλιώς «ανεπίλυτη δυναμική t()» και ο γεννήτορας αρνείται. `Record` πάνω σε κλειστά σύνολα: νέα άρνηση ή νέα αφορμή
 * δεν μεταγλωττίζεται χωρίς τα λόγια της.
 * 🔑 **Λεξιλόγιο `property-market`** — το ΙΔΙΟ με τον φάκελο που ανοίγει η αποδοχή («Οι φάκελοί μου»).
 */

import type { PropertyHandoverInvitationOccasion } from '@/types/property-handover';
import type { PropertyHandoverInvitationRefusal } from '@/types/property-handover-invitation';

export const HANDOVER_INVITE_NS = 'property-market';

export const HANDOVER_INVITE_KEYS = {
  title: 'property-market:handoverInvite.title',
  findLabel: 'property-market:handoverInvite.findLabel',
  find: 'property-market:handoverInvite.find',
  costLabel: 'property-market:handoverInvite.costLabel',
  cost: 'property-market:handoverInvite.cost',
  linkExpires: 'property-market:handoverInvite.linkExpires',
  scope: 'property-market:handoverInvite.scope',
  unnamedIssuer: 'property-market:handoverInvite.unnamedIssuer',
  unnamedProperty: 'property-market:handoverInvite.unnamedProperty',
  signIn: 'property-market:handoverInvite.signIn',
  signInHint: 'property-market:handoverInvite.signInHint',
  accept: 'property-market:handoverInvite.accept',
  decline: 'property-market:handoverInvite.decline',
  declineHint: 'property-market:handoverInvite.declineHint',
  accepted: 'property-market:handoverInvite.accepted',
  openDossier: 'property-market:handoverInvite.openDossier',
  declined: 'property-market:handoverInvite.declined',
  declinedBody: 'property-market:handoverInvite.declinedBody',
  unavailable: 'property-market:handoverInvite.unavailable',
  /** Μετά το κλικ: η πρόσκληση άνοιξε — απέτυχε η **απάντηση**, και λέμε ότι τίποτα δεν χάθηκε. */
  answerFailed: 'property-market:handoverInvite.answerFailed',
  retry: 'property-market:handoverInvite.retry',
  home: 'property-market:handoverInvite.home',
  myDossiers: 'property-market:handoverInvite.myDossiers',
} as const;

/** Η εισαγωγή — **η ίδια** διατύπωση με το email της αντίστοιχης αφορμής. */
export const HANDOVER_INVITE_INTRO_KEY: Readonly<Record<PropertyHandoverInvitationOccasion, string>> = {
  reservation: 'property-market:handoverInvite.intro.reservation',
  completion: 'property-market:handoverInvite.intro.completion',
};

/** Μετά την αποδοχή: τι βλέπει τώρα στον φάκελο — «ετοιμάζεται» πριν την ολοκλήρωση. */
export const HANDOVER_INVITE_ACCEPTED_BODY_KEY: Readonly<Record<PropertyHandoverInvitationOccasion, string>> = {
  reservation: 'property-market:handoverInvite.acceptedBody.reservation',
  completion: 'property-market:handoverInvite.acceptedBody.completion',
};

export const HANDOVER_INVITE_REFUSAL_KEY: Readonly<Record<PropertyHandoverInvitationRefusal, string>> = {
  'link-invalid': 'property-market:handoverInvite.refusals.link-invalid',
  'link-foreign': 'property-market:handoverInvite.refusals.link-foreign',
  'invitation-unknown': 'property-market:handoverInvite.refusals.invitation-unknown',
  expired: 'property-market:handoverInvite.refusals.expired',
  'already-used': 'property-market:handoverInvite.refusals.already-used',
  revoked: 'property-market:handoverInvite.refusals.revoked',
  'wrong-recipient': 'property-market:handoverInvite.refusals.wrong-recipient',
  'handover-closed': 'property-market:handoverInvite.refusals.handover-closed',
};
