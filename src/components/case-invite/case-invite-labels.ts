/**
 * @fileoverview **Οι ετικέτες της πρόσκλησης υπόθεσης** (`/case-invite/[token]`) — κλειστοί πίνακες κλειδιών i18n.
 * @related ADR-901 Φ3 · `spatial-tour-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/case-invite/case-invite-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ σκέτες σταθερές ή δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη
 * πινάκων ετικετών — αλλιώς «ανεπίλυτη δυναμική t()» και ο γεννήτορας αρνείται. `Record` πάνω σε κλειστά σύνολα:
 * νέα άρνηση ή νέο μητρώο δεν μεταγλωττίζεται χωρίς τα λόγια του.
 */

import type { ChapteredRegistryId, RegistryAuthorityId } from '@/constants/professional-registries';
import type { EngagementSubjectKind } from '@/types/engagement';
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
  /** ADR-915 §39 — τα βήματα μετά τον λογαριασμό (`InvitationSteps`): απάντηση με ιδιότητα → ο χώρος. */
  stepAnswer: 'conveyance:engagement.invite.stepAnswer',
  stepSpace: 'conveyance:engagement.invite.stepSpace',
  credentialTitle: 'conveyance:engagement.invite.credentialTitle',
  credentialHint: 'conveyance:engagement.invite.credentialHint',
  numberRequired: 'conveyance:engagement.invite.numberRequired',
  /** ADR-915 §39.6 — «δεν θυμάστε τον αριθμό;» → η δημόσια αναζήτηση του μητρώου (μόνο όταν υπάρχει). */
  registryLookup: 'conveyance:engagement.invite.registryLookup',
  registryLookupHint: 'conveyance:engagement.invite.registryLookupHint',
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

/**
 * Η ετικέτα του αριθμού — ανά **μητρώο**, που το παράγει η υπόθεση (νομικός ρόλος ⇒ σύλλογος · ανάθεση έκδοσης ⇒
 * προσόν → άδεια → αρχή, ADR-862 §5.3.11), ποτέ ο άνθρωπος (Ε-4). Ολικός πάνω στο λεξιλόγιο των αρχών.
 */
export const CASE_INVITE_NUMBER_KEY: Readonly<Record<RegistryAuthorityId, string>> = {
  tee: 'conveyance:engagement.invite.numberLabel.tee',
  gemi: 'conveyance:engagement.invite.numberLabel.gemi',
  oee: 'conveyance:engagement.invite.numberLabel.oee',
  'bar-association': 'conveyance:engagement.invite.numberLabel.bar-association',
  'notary-association': 'conveyance:engagement.invite.numberLabel.notary-association',
  'regional-authority': 'conveyance:engagement.invite.numberLabel.regional-authority',
  ypen: 'conveyance:engagement.invite.numberLabel.ypen',
};

/** Ο σύλλογος/περιφέρεια — **μόνο** σε αρχή με παραρτήματα (`REGISTRY_AUTHORITY_SCOPE`)· η εθνική δεν τον έχει. */
export const CASE_INVITE_CHAPTER_KEY: Readonly<Record<ChapteredRegistryId, string>> = {
  'bar-association': 'conveyance:engagement.invite.chapterLabel.bar-association',
  'notary-association': 'conveyance:engagement.invite.chapterLabel.notary-association',
  'regional-authority': 'conveyance:engagement.invite.chapterLabel.regional-authority',
};

interface CaseInviteSubjectKeys {
  readonly title: string;
  readonly intro: string;
  readonly scope: string;
  readonly accepted: string;
  readonly acceptedBody: string;
  readonly open: string;
}

/**
 * Η εισαγωγή της πρόσκλησης — ανά είδος υπόθεσης (υπόθεση μεταβίβασης · χώρος ανάθεσης έκδοσης).
 * ⚠️ Δηλωμένος τύπος, ΟΧΙ `as const satisfies`: ο γεννήτορας του slice (ADR-744, `key-tables.js`) ξεδιπλώνει μόνο `as` —
 * με `satisfies` ο πίνακας δεν διαβάζεται και το `t(T[kind].scope)` λύνεται με το ΟΝΟΜΑ της ιδιότητας (ψευδή κλειδιά).
 */
export const CASE_INVITE_SUBJECT_KEYS: Readonly<Record<EngagementSubjectKind, CaseInviteSubjectKeys>> = {
  conveyance_case: {
    title: 'conveyance:engagement.invite.title',
    intro: 'conveyance:engagement.invite.intro',
    scope: 'conveyance:engagement.invite.scope',
    accepted: 'conveyance:engagement.invite.accepted',
    acceptedBody: 'conveyance:engagement.invite.acceptedBody',
    open: 'conveyance:engagement.invite.openCase',
  },
  document_issuance: {
    title: 'conveyance:engagement.invite.issuance.title',
    intro: 'conveyance:engagement.invite.issuance.intro',
    scope: 'conveyance:engagement.invite.issuance.scope',
    accepted: 'conveyance:engagement.invite.issuance.accepted',
    acceptedBody: 'conveyance:engagement.invite.issuance.acceptedBody',
    open: 'conveyance:engagement.invite.issuance.open',
  },
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
  'acting-choice-required': 'conveyance:engagement.invite.refusals.acting-choice-required',
  'acting-refused': 'conveyance:engagement.invite.refusals.acting-refused',
};
