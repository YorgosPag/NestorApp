/**
 * @fileoverview **Οι ετικέτες της πρόσκλησης υπόθεσης** (`/case-invite/[token]`) — κλειστοί πίνακες κλειδιών i18n.
 * @related ADR-901 Φ3 · `spatial-tour-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/case-invite/case-invite-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ σκέτες σταθερές ή δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη
 * πινάκων ετικετών — αλλιώς «ανεπίλυτη δυναμική t()» και ο γεννήτορας αρνείται. `Record` πάνω σε κλειστά σύνολα:
 * νέα άρνηση ή νέο μητρώο δεν μεταγλωττίζεται χωρίς τα λόγια του.
 */

import type { EngagementInvitationRefusal } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** Η βάση του βήματος — μία φορά. */
export const CASE_INVITE_NS = 'conveyance';

export const CASE_INVITE_KEYS = {
  title: 'conveyance:engagement.invite.title',
  intro: 'conveyance:engagement.invite.intro',
  roleLabel: 'conveyance:engagement.invite.roleLabel',
  findLabel: 'conveyance:engagement.invite.findLabel',
  find: 'conveyance:engagement.invite.find',
  linkExpires: 'conveyance:engagement.invite.linkExpires',
  scope: 'conveyance:engagement.invite.scope',
  identityDeclared: 'conveyance:engagement.invite.identityDeclared',
  unnamedHost: 'conveyance:engagement.invite.unnamedHost',
  unnamedProperty: 'conveyance:engagement.invite.unnamedProperty',
  signIn: 'conveyance:engagement.invite.signIn',
  signInHint: 'conveyance:engagement.invite.signInHint',
  credentialTitle: 'conveyance:engagement.invite.credentialTitle',
  credentialHint: 'conveyance:engagement.invite.credentialHint',
  numberRequired: 'conveyance:engagement.invite.numberRequired',
  accept: 'conveyance:engagement.invite.accept',
  decline: 'conveyance:engagement.invite.decline',
  accepted: 'conveyance:engagement.invite.accepted',
  acceptedBody: 'conveyance:engagement.invite.acceptedBody',
  openCase: 'conveyance:engagement.invite.openCase',
  declined: 'conveyance:engagement.invite.declined',
  declinedBody: 'conveyance:engagement.invite.declinedBody',
  unavailable: 'conveyance:engagement.invite.unavailable',
  retry: 'conveyance:engagement.invite.retry',
  home: 'conveyance:engagement.invite.home',
} as const;

/** Ο ρόλος της πρόσκλησης — το **ίδιο** λεξιλόγιο με τις θέσεις του οικοδεσπότη. */
export const CASE_INVITE_ROLE_KEY: Readonly<Record<LegalProfessionalRole, string>> = {
  seller_lawyer: 'conveyance:engagement.roles.seller_lawyer',
  buyer_lawyer: 'conveyance:engagement.roles.buyer_lawyer',
  notary: 'conveyance:engagement.roles.notary',
};

/** Η ετικέτα του αριθμού — **ο ρόλος** διαλέγει μητρώο (`ROLE_REGISTRY_AUTHORITY`, Ε-4), όχι ο άνθρωπος. */
export const CASE_INVITE_NUMBER_KEY: Readonly<Record<LegalProfessionalRole, string>> = {
  seller_lawyer: 'conveyance:engagement.invite.numberLabel.bar-association',
  buyer_lawyer: 'conveyance:engagement.invite.numberLabel.bar-association',
  notary: 'conveyance:engagement.invite.numberLabel.notary-association',
};

export const CASE_INVITE_CHAPTER_KEY: Readonly<Record<LegalProfessionalRole, string>> = {
  seller_lawyer: 'conveyance:engagement.invite.chapterLabel.bar-association',
  buyer_lawyer: 'conveyance:engagement.invite.chapterLabel.bar-association',
  notary: 'conveyance:engagement.invite.chapterLabel.notary-association',
};

export const CASE_INVITE_REFUSAL_KEY: Readonly<Record<EngagementInvitationRefusal, string>> = {
  'link-invalid': 'conveyance:engagement.invite.refusals.link-invalid',
  'link-foreign': 'conveyance:engagement.invite.refusals.link-foreign',
  'invitation-unknown': 'conveyance:engagement.invite.refusals.invitation-unknown',
  expired: 'conveyance:engagement.invite.refusals.expired',
  'already-used': 'conveyance:engagement.invite.refusals.already-used',
  revoked: 'conveyance:engagement.invite.refusals.revoked',
  'wrong-recipient': 'conveyance:engagement.invite.refusals.wrong-recipient',
  'slot-occupied': 'conveyance:engagement.invite.refusals.slot-occupied',
  'role-conflict': 'conveyance:engagement.invite.refusals.role-conflict',
  'case-closed': 'conveyance:engagement.invite.refusals.case-closed',
};
