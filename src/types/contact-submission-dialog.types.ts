import type { IdentityFieldChange } from '@/utils/contactForm/company-identity-guard';
import type { CommunicationFieldChange } from '@/utils/contactForm/communication-impact-guard';

/** State for the name cascade confirmation dialog (ADR-249) */
export interface NameCascadeDialogState {
  oldName: string;
  newName: string;
  properties: number;
  paymentPlans: number;
  parking: number;
  storage: number;
}

/** State for the address impact confirmation dialog (ADR-277) */
export interface AddressImpactDialogState {
  addressLabel: string;
  properties: number;
  paymentPlans: number;
  invoices: number;
  apyCertificates: number;
}

/** State for the company identity impact confirmation dialog (ADR-278) */
export interface CompanyIdentityDialogState {
  changes: ReadonlyArray<IdentityFieldChange>;
  projects: number;
  properties: number;
  obligations: number;
  parking: number;
  storage: number;
  invoices: number;
  apyCertificates: number;
}

/** State for the communication impact confirmation dialog (ADR-280) */
export interface CommunicationImpactDialogState {
  changes: ReadonlyArray<CommunicationFieldChange>;
  properties: number;
  paymentPlans: number;
  communications: number;
  projects: number;
  invoices: number;
  apyCertificates: number;
}
