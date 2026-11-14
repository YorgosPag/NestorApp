/**
 * @fileoverview Τα κλειδιά του **βήματος λογαριασμού** κάθε σελίδας πρόσκλησης (ADR-915 §39, 2026-11-14).
 * @module components/invitations/invitation-account-labels
 *
 * 🔑 **Ένα namespace για όλα τα είδη** (`auth`): το «δημιουργήστε λογαριασμό με αυτή τη διεύθυνση» δεν διαφέρει
 * ανάμεσα σε υπόθεση, ανάθεση ΠΕΑ, φωτογράφο ή προμηθευτή — γράφεται μία φορά, όχι ανά είδος.
 */

export const INVITATION_ACCOUNT_NS = 'auth';

export const INVITATION_ACCOUNT_KEYS = {
  createTitle: 'auth:invitationAccount.createTitle',
  createBody: 'auth:invitationAccount.createBody',
  createAction: 'auth:invitationAccount.createAction',
  signInTitle: 'auth:invitationAccount.signInTitle',
  signInBody: 'auth:invitationAccount.signInBody',
  signInAction: 'auth:invitationAccount.signInAction',
  googleHint: 'auth:invitationAccount.googleHint',
  otherAccount: 'auth:invitationAccount.otherAccount',
  switchAction: 'auth:invitationAccount.switchAction',
  stepsLabel: 'auth:invitationAccount.stepsLabel',
  stepAccount: 'auth:invitationAccount.stepAccount',
  loginBanner: 'auth:invitationAccount.loginBanner',
  loginNoAccountHint: 'auth:invitationAccount.loginNoAccountHint',
  loginNoAccountAction: 'auth:invitationAccount.loginNoAccountAction',
} as const;
