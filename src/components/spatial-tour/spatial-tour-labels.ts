/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΡΟΗΣ ΦΩΤΟΓΡΑΦΟΥ** — πλήρη κυριολεκτικά, σε κλειστούς πίνακες (ADR-884 Κ3α).
 * @related ADR-744 (γιατί ΟΛΟΓΡΑΦΑ) · `components/workspace-invite/workspace-invite-labels.ts` (το πρότυπο)
 * @module components/spatial-tour/spatial-tour-labels
 *
 * ⛔ **Κάθε κλειδί γράφεται ολόκληρο με το `spatial-tour:`** — ο γεννήτορας του slice διαβάζει **μόνο** τιμές σταθεράς
 * του ίδιου αρχείου· σταθερά-πρόθεμα ή `spread` ⇒ η σελίδα μένει χωρίς slice και βάφει ωμά κλειδιά.
 * 🔑 Κάθε πίνακας είναι `Record<λεξιλόγιο, …>`: νέα άρνηση/κατάσταση **δεν μεταγλωττίζεται** χωρίς λέξεις.
 */

import type { MediaLicensePurpose } from '@/constants/media-rights-vocabulary';
import type { TourCaptureAudience, TourMilestone } from '@/constants/spatial-tour-vocabulary';
import type { TourRefusalName } from '@/lib/spatial-tour/tour-refusal-vocabulary';
// ⚠️ TYPE-ONLY πέρα από το σύνορο του διακομιστή — σβήνεται στη μεταγλώττιση.
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import type { TourGrantStanding } from '@/lib/spatial-tour/tour-authority';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

export const TOUR_REFUSAL_KEY: Readonly<Record<TourRefusalName, string>> = {
  'tour-absent': 'spatial-tour:refusal.tourAbsent',
  'not-requestable': 'spatial-tour:refusal.notRequestable',
  'not-manager': 'spatial-tour:refusal.notManager',
  'expiry-required': 'spatial-tour:refusal.expiryRequired',
  'expiry-past': 'spatial-tour:refusal.expiryPast',
  'expiry-too-far': 'spatial-tour:refusal.expiryTooFar',
  'request-absent': 'spatial-tour:refusal.requestAbsent',
  'not-pending': 'spatial-tour:refusal.notPending',
  'not-active': 'spatial-tour:refusal.notActive',
  'reason-required': 'spatial-tour:refusal.reasonRequired',
  'grant-absent': 'spatial-tour:refusal.grantAbsent',
  'tour-custody-mismatch': 'spatial-tour:refusal.tourCustodyMismatch',
  'tour-unreadable': 'spatial-tour:refusal.tourUnreadable',
  'sign-in-required': 'spatial-tour:refusal.signInRequired',
  'not-viewable': 'spatial-tour:refusal.notViewable',
  'publish-needs-capture': 'spatial-tour:refusal.publishNeedsCapture',
  'visibility-unsupported': 'spatial-tour:refusal.visibilityUnsupported',
  'no-capture-grant': 'spatial-tour:refusal.noCaptureGrant',
  'revoked': 'spatial-tour:refusal.revoked',
  'expired': 'spatial-tour:refusal.expired',
  'unreadable-expiry': 'spatial-tour:refusal.unreadableExpiry',
  'scope-missing': 'spatial-tour:refusal.scopeMissing',
  'not-jpeg': 'spatial-tour:refusal.notJpeg',
  'too-large': 'spatial-tour:refusal.tooLarge',
  'not-equirect': 'spatial-tour:refusal.notEquirect',
  'too-small': 'spatial-tour:refusal.tooSmall',
  'wrong-projection': 'spatial-tour:refusal.wrongProjection',
  'ticket-invalid': 'spatial-tour:refusal.ticketInvalid',
  'ticket-foreign': 'spatial-tour:refusal.ticketForeign',
  'upload-missing': 'spatial-tour:refusal.uploadMissing',
  'upload-incomplete': 'spatial-tour:refusal.uploadIncomplete',
  'declaration-invalid': 'spatial-tour:refusal.declarationInvalid',
};

/**
 * «Κάτι δεν πήγε καλά» — για ό,τι ο διακομιστής **δεν** ονόμασε.
 * ⚠️ **Μέλος αντικειμένου, ποτέ σκέτη σταθερά**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών —
 * μια εισηγμένη σταθερά string μένει «ανεπίλυτη δυναμική t()» και ο γεννήτορας αρνείται να παράξει.
 */
export const TOUR_FAILURE_KEYS = {
  unavailable: 'spatial-tour:refusal.unavailable',
} as const;

export const INVITE_REFUSAL_KEY: Readonly<Record<InvitationCoreRefusal, string>> = {
  'link-invalid': 'spatial-tour:inviteRefusal.linkInvalid',
  'link-foreign': 'spatial-tour:inviteRefusal.linkForeign',
  'invitation-unknown': 'spatial-tour:inviteRefusal.invitationUnknown',
  'expired': 'spatial-tour:inviteRefusal.expired',
  'already-used': 'spatial-tour:inviteRefusal.alreadyUsed',
  'revoked': 'spatial-tour:inviteRefusal.revoked',
  'wrong-recipient': 'spatial-tour:inviteRefusal.wrongRecipient',
};

/** Οι αρνήσεις που σημαίνουν «αυτός ο σύνδεσμος δεν δείχνει πουθενά» ⇒ **404** (ADR-853 §18 Ε-Η). */
export const INVITE_REFUSAL_IS_NOT_FOUND: Readonly<Record<InvitationCoreRefusal, boolean>> = {
  'link-invalid': true,
  'link-foreign': true,
  'invitation-unknown': true,
  'expired': false,
  'already-used': false,
  'revoked': false,
  'wrong-recipient': false,
};

export const INVITE_KEYS = {
  title: 'spatial-tour:invite.title',
  intro: 'spatial-tour:invite.intro',
  unnamedHost: 'spatial-tour:invite.unnamedHost',
  unnamedProperty: 'spatial-tour:invite.unnamedProperty',
  reason: 'spatial-tour:invite.reason',
  uploadUntil: 'spatial-tour:invite.uploadUntil',
  linkExpires: 'spatial-tour:invite.linkExpires',
  scope: 'spatial-tour:invite.scope',
  identityDeclared: 'spatial-tour:invite.identityDeclared',
  accept: 'spatial-tour:invite.accept',
  decline: 'spatial-tour:invite.decline',
  signIn: 'spatial-tour:invite.signIn',
  signInHint: 'spatial-tour:invite.signInHint',
  accepted: 'spatial-tour:invite.accepted',
  acceptedBody: 'spatial-tour:invite.acceptedBody',
  goToCaptures: 'spatial-tour:invite.goToCaptures',
  declined: 'spatial-tour:invite.declined',
  declinedBody: 'spatial-tour:invite.declinedBody',
  unavailable: 'spatial-tour:invite.unavailable',
  retry: 'spatial-tour:invite.retry',
  home: 'spatial-tour:invite.home',
} as const;

export const STANDING_KEY: Readonly<Record<TourGrantStanding, string>> = {
  active: 'spatial-tour:standing.active',
  revoked: 'spatial-tour:standing.revoked',
  expired: 'spatial-tour:standing.expired',
  unreadable: 'spatial-tour:standing.unreadable',
};

/** ⚠️ `accepted` = «ο πάροχος το δέχτηκε» — ποτέ «παραδόθηκε». */
export const DELIVERY_KEY: Readonly<Record<InvitationNoticeOutcome, string>> = {
  accepted: 'spatial-tour:delivery.accepted',
  unaddressable: 'spatial-tour:delivery.unaddressable',
  failed: 'spatial-tour:delivery.failed',
};

/** Οι πηγές **ανεβάσματος** — η απόδοση BIM δεν ανεβαίνει ποτέ από άνθρωπο (Φ3). */
export const UPLOAD_SOURCE_KEY = {
  'camera-360': 'spatial-tour:source.camera360',
  phone: 'spatial-tour:source.phone',
} as const;

export const AUDIENCE_KEY: Readonly<Record<TourCaptureAudience, string>> = {
  'public-listing': 'spatial-tour:audience.publicListing',
  'project-team': 'spatial-tour:audience.projectTeam',
  'unit-owner': 'spatial-tour:audience.unitOwner',
};

export const MILESTONE_KEY: Readonly<Record<TourMilestone, string>> = {
  structure: 'spatial-tour:milestone.structure',
  'mep-rough-in': 'spatial-tour:milestone.mepRoughIn',
  'pre-closure': 'spatial-tour:milestone.preClosure',
  finishes: 'spatial-tour:milestone.finishes',
  handover: 'spatial-tour:milestone.handover',
};

export const LICENSE_PURPOSE_KEY: Readonly<Record<MediaLicensePurpose, string>> = {
  'listing-marketing': 'spatial-tour:licensePurpose.listingMarketing',
  'owner-reuse': 'spatial-tour:licensePurpose.ownerReuse',
  unrestricted: 'spatial-tour:licensePurpose.unrestricted',
};

/** Οι όροι που προσφέρει η οθόνη — η `mandate` (λήξη εντολής) μπαίνει όταν η οθόνη ξέρει την εντολή (ADR-827). */
export const LICENSE_TERM_KEY = {
  perpetual: 'spatial-tour:licenseTerm.perpetual',
  date: 'spatial-tour:licenseTerm.date',
} as const;

export const PANEL_KEYS = {
  title: 'spatial-tour:panel.title',
  description: 'spatial-tour:panel.description',
  photographers: 'spatial-tour:panel.photographers',
  inviteEmail: 'spatial-tour:panel.inviteEmail',
  inviteGrantUntil: 'spatial-tour:panel.inviteGrantUntil',
  inviteReason: 'spatial-tour:panel.inviteReason',
  inviteReasonPlaceholder: 'spatial-tour:panel.inviteReasonPlaceholder',
  inviteSubmit: 'spatial-tour:panel.inviteSubmit',
  pendingInvitations: 'spatial-tour:panel.pendingInvitations',
  noPendingInvitations: 'spatial-tour:panel.noPendingInvitations',
  resend: 'spatial-tour:panel.resend',
  revoke: 'spatial-tour:panel.revoke',
  grants: 'spatial-tour:panel.grants',
  noGrants: 'spatial-tour:panel.noGrants',
  grantUntil: 'spatial-tour:panel.grantUntil',
  invitationUntil: 'spatial-tour:panel.invitationUntil',
  opened: 'spatial-tour:panel.opened',
  captures: 'spatial-tour:panel.captures',
  noCaptures: 'spatial-tour:panel.noCaptures',
  unplaced: 'spatial-tour:panel.unplaced',
  capturedAt: 'spatial-tour:panel.capturedAt',
  loadFailed: 'spatial-tour:panel.loadFailed',
  retry: 'spatial-tour:panel.retry',
} as const;

export const UPLOAD_KEYS = {
  title: 'spatial-tour:upload.title',
  chooseFile: 'spatial-tour:upload.chooseFile',
  fileHint: 'spatial-tour:upload.fileHint',
  source: 'spatial-tour:upload.source',
  milestone: 'spatial-tour:upload.milestone',
  milestoneNone: 'spatial-tour:upload.milestoneNone',
  audience: 'spatial-tour:upload.audience',
  creator: 'spatial-tour:upload.creator',
  copyright: 'spatial-tour:upload.copyright',
  licensePurpose: 'spatial-tour:upload.licensePurpose',
  licenseTerm: 'spatial-tour:upload.licenseTerm',
  licenseUntil: 'spatial-tour:upload.licenseUntil',
  submit: 'spatial-tour:upload.submit',
  progress: 'spatial-tour:upload.progress',
  paused: 'spatial-tour:upload.paused',
  resume: 'spatial-tour:upload.resume',
  cancel: 'spatial-tour:upload.cancel',
  verifying: 'spatial-tour:upload.verifying',
  done: 'spatial-tour:upload.done',
  replayed: 'spatial-tour:upload.replayed',
} as const;

export const MY_CAPTURES_KEYS = {
  title: 'spatial-tour:myCaptures.title',
  description: 'spatial-tour:myCaptures.description',
  empty: 'spatial-tour:myCaptures.empty',
  until: 'spatial-tour:myCaptures.until',
  for: 'spatial-tour:myCaptures.for',
  unnamedProperty: 'spatial-tour:myCaptures.unnamedProperty',
} as const;
