/**
 * @fileoverview ADR-943 §5.9 · §5.14 — τα **κλειδιά i18n** της κάρτας «Λήψη πληρωμών», σε ΕΝΑ σημείο για όλα τα
 *   μέρη της (κατάσταση · εγγραφή · αλλαγή στοιχείων). Πίνακες σταθερών κλειδιών, **ποτέ** παρεμβολή (N.11 · CHECK 3.8).
 * @module components/account/payouts/payout-labels
 */

import type { PayeeKycRequirement } from '@/lib/payments/payee-kyc';
import type { PayoutAccountState, PayoutRegistration } from '@/lib/payments/payout-account';

export const PAYOUT_NS = 'common-account';
const K = 'common-account:account.payouts';

export const CARD_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  loading: `${K}.loading`,
  failed: `${K}.failed`,
  continueKyc: `${K}.continueKyc`,
  consumerToConsumer: `${K}.field.consumerToConsumer`,
  privacy: `${K}.privacy`,
  submit: `${K}.submit`,
} as const;

export const STATE_KEYS: Readonly<Record<PayoutAccountState, string>> = {
  unavailable: `${K}.state.unavailable`,
  none: `${K}.state.none`,
  registering: `${K}.state.registering`,
  'action-required': `${K}.state.action-required`,
  verifying: `${K}.state.verifying`,
  rejected: `${K}.state.rejected`,
  ready: `${K}.state.ready`,
  blocked: `${K}.state.blocked`,
};

export const CAPABILITY_KEYS = {
  chargesOn: `${K}.capability.chargesOn`,
  chargesOff: `${K}.capability.chargesOff`,
  payoutsOn: `${K}.capability.payoutsOn`,
  payoutsOff: `${K}.capability.payoutsOff`,
} as const;

export const DUE_KEYS = {
  title: `${K}.due.title`,
  linkPending: `${K}.due.linkPending`,
} as const;

export const REQUIREMENT_KEYS: Readonly<Record<PayeeKycRequirement, string>> = {
  company_info: `${K}.due.requirement.company_info`,
  gov_kyc: `${K}.due.requirement.gov_kyc`,
  gov_kyb: `${K}.due.requirement.gov_kyb`,
  proof_of_id: `${K}.due.requirement.proof_of_id`,
  proof_of_residence: `${K}.due.requirement.proof_of_residence`,
  proof_of_financials: `${K}.due.requirement.proof_of_financials`,
  proof_of_business_establishment: `${K}.due.requirement.proof_of_business_establishment`,
  proof_of_funds: `${K}.due.requirement.proof_of_funds`,
  proof_of_funds_individual: `${K}.due.requirement.proof_of_funds_individual`,
  other_documents: `${K}.due.requirement.other_documents`,
};

export const DETAIL_KEYS = {
  title: `${K}.details.title`,
  iban: `${K}.details.iban`,
  ibanMasked: `${K}.details.ibanMasked`,
  taxNumberMasked: `${K}.details.taxNumberMasked`,
  taxNumberLocked: `${K}.details.taxNumberLocked`,
} as const;

export const EDIT_KEYS = {
  open: `${K}.edit.open`,
  cancel: `${K}.edit.cancel`,
  save: `${K}.edit.save`,
  changeBank: `${K}.edit.changeBank`,
  bankNotice: `${K}.edit.bankNotice`,
  saved: `${K}.edit.saved`,
  failed: `${K}.edit.failed`,
} as const;

export type PayoutTextField = Exclude<keyof PayoutRegistration, 'iban' | 'consumerToConsumer'>;

export const FIELD_KEYS: Readonly<Record<PayoutTextField, string>> = {
  legalName: `${K}.field.legalName`,
  tradeName: `${K}.field.tradeName`,
  taxNumber: `${K}.field.taxNumber`,
  address: `${K}.field.address`,
  ibanBeneficiary: `${K}.field.ibanBeneficiary`,
  phone: `${K}.field.phone`,
  description: `${K}.field.description`,
};
