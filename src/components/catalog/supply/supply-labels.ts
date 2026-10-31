/**
 * @fileoverview **Οι ετικέτες της σχέσης προμήθειας** (ADR-923 §5.12): κλειστοί πίνακες κλειδιών i18n.
 * @related `case-invite-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/catalog/supply/supply-labels
 *
 * ⚠️ Μέλη αντικειμένων, ποτέ σκέτες σταθερές ή δυναμικό `${…}`: ο εξαγωγέας του slice ακολουθεί μέλη πινάκων ετικετών.
 * `Record` πάνω σε κλειστά σύνολα: νέα άρνηση ή νέα κατάσταση δεν μεταγλωττίζεται χωρίς τα λόγια της.
 */

import type { SupplyAccessRefusal } from '@/services/catalog/supply-api.client';
import type { SupplyRelationshipState } from '@/subapps/catalog/types/supply-relationship';
import type { BuyerRelationshipState } from '@/subapps/catalog/types/supply-views';

/** Το namespace της σελίδας-πύλης: εκεί δεν υπάρχει `useCatalogText`, το κέλυφος του καταλόγου. */
export const SUPPLY_NS = 'catalog';

export const SUPPLY_ACCESS_KEYS = {
  inviteTitle: 'catalog:supply.access.inviteTitle',
  requestTitle: 'catalog:supply.access.requestTitle',
  inviteIntro: 'catalog:supply.access.inviteIntro',
  requestIntro: 'catalog:supply.access.requestIntro',
  unnamedSupplier: 'catalog:supply.access.unnamedSupplier',
  scope: 'catalog:supply.access.scope',
  linkExpires: 'catalog:supply.access.linkExpires',
  signIn: 'catalog:supply.access.signIn',
  signInHint: 'catalog:supply.access.signInHint',
  customerRefLabel: 'catalog:supply.access.customerRefLabel',
  customerRefHint: 'catalog:supply.access.customerRefHint',
  accept: 'catalog:supply.access.accept',
  decline: 'catalog:supply.access.decline',
  request: 'catalog:supply.access.request',
  officeRequired: 'catalog:supply.access.officeRequired',
  unavailable: 'catalog:supply.access.unavailable',
  retry: 'catalog:supply.access.retry',
  home: 'catalog:supply.access.home',
} as const;

export const SUPPLY_DONE_TITLE_KEY = {
  accepted: 'catalog:supply.access.acceptedTitle',
  declined: 'catalog:supply.access.declinedTitle',
  requested: 'catalog:supply.access.requestedTitle',
} as const;

export const SUPPLY_DONE_BODY_KEY = {
  accepted: 'catalog:supply.access.acceptedBody',
  declined: 'catalog:supply.access.declinedBody',
  requested: 'catalog:supply.access.requestedBody',
} as const;

export const SUPPLY_REFUSAL_KEY: Readonly<Record<SupplyAccessRefusal, string>> = {
  'link-invalid': 'catalog:supply.refusals.linkInvalid',
  'link-foreign': 'catalog:supply.refusals.linkForeign',
  'invitation-unknown': 'catalog:supply.refusals.invitationUnknown',
  expired: 'catalog:supply.refusals.expired',
  'already-used': 'catalog:supply.refusals.alreadyUsed',
  revoked: 'catalog:supply.refusals.revoked',
  'wrong-recipient': 'catalog:supply.refusals.wrongRecipient',
  'already-connected': 'catalog:supply.refusals.alreadyConnected',
  'request-limit': 'catalog:supply.refusals.requestLimit',
  'not-requested': 'catalog:supply.refusals.notRequested',
  'office-required': 'catalog:supply.refusals.officeRequired',
  'office-choice-required': 'catalog:supply.refusals.officeChoiceRequired',
  'office-refused': 'catalog:supply.refusals.officeRefused',
  'same-workspace': 'catalog:supply.refusals.sameWorkspace',
  'contact-bound': 'catalog:supply.refusals.contactBound',
};

export const SUPPLIER_STATE_KEY: Readonly<Record<SupplyRelationshipState, string>> = {
  requested: 'catalog:supply.states.requested',
  active: 'catalog:supply.states.active',
  declined: 'catalog:supply.states.declined',
  revoked: 'catalog:supply.states.revoked',
};

export const BUYER_STATE_KEY: Readonly<Record<BuyerRelationshipState, string>> = {
  requested: 'catalog:supply.states.requested',
  active: 'catalog:supply.states.active',
  ended: 'catalog:supply.states.ended',
};

export const SUPPLY_DELIVERY_KEY = {
  accepted: 'catalog:supply.customers.deliveryAccepted',
  unaddressable: 'catalog:supply.customers.deliveryFailed',
  failed: 'catalog:supply.customers.deliveryFailed',
} as const;
