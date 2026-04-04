/**
 * 🛡️ Submission Guard Chain — Pre-save safety checks
 *
 * Runs the 4 guard checks (name cascade, address impact, company identity,
 * communication impact) before allowing a contact update to proceed.
 *
 * Each guard can:
 * - Block the save (unsafe clear) → returns { blocked: true }
 * - Defer the save (impact preview) → returns { deferred: true, guardType }
 * - Allow passage → returns { blocked: false, deferred: false }
 *
 * @module utils/contactForm/submission-guard-chain
 * @enterprise ADR-249, ADR-277, ADR-278, ADR-280
 */

import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { extractHeadquartersAddress, hasHQAddressChanged } from './address-impact-helpers';
import { detectCompanyIdentityChanges } from './company-identity-guard';
import { detectCommunicationChanges } from './communication-impact-guard';

import type { NameCascadeDialogState, AddressImpactDialogState, CompanyIdentityDialogState, CommunicationImpactDialogState } from '@/types/contact-submission-dialog.types';

const logger = createModuleLogger('SubmissionGuardChain');

// ============================================================================
// TYPES
// ============================================================================

export type GuardResult =
  | { blocked: false; deferred: false }
  | { blocked: true; errorKey: string }
  | { blocked: false; deferred: true; guardType: 'nameCascade' | 'addressImpact' | 'companyIdentity' | 'communicationImpact' };

type GuardFailureKey =
  | 'contacts.identityImpact.messages.unavailable'
  | 'contacts.companyIdentityImpact.unavailableBody';

interface GuardChainDeps {
  editContact: Contact;
  editContactId: string;
  contactData: Record<string, unknown>;
  formData: ContactFormData;

  // Confirmed refs (skip guard if already confirmed)
  nameCascadeConfirmedRef: React.MutableRefObject<boolean>;
  addressImpactConfirmedRef: React.MutableRefObject<boolean>;
  companyIdentityConfirmedRef: React.MutableRefObject<boolean>;
  communicationImpactConfirmedRef: React.MutableRefObject<boolean>;

  // Deferred submit refs
  deferredSubmitRef: React.MutableRefObject<(() => Promise<void>) | null>;
  deferredAddressSubmitRef: React.MutableRefObject<(() => Promise<void>) | null>;
  deferredIdentitySubmitRef: React.MutableRefObject<(() => Promise<void>) | null>;
  deferredCommunicationSubmitRef: React.MutableRefObject<(() => Promise<void>) | null>;

  // Dialog state setters
  setNameCascadeDialog: (state: NameCascadeDialogState | null) => void;
  setAddressImpactDialog: (state: AddressImpactDialogState | null) => void;
  setCompanyIdentityDialog: (state: CompanyIdentityDialogState | null) => void;
  setCommunicationImpactDialog: (state: CommunicationImpactDialogState | null) => void;

  // Services
  notifications: { success: (msg: string) => void; error: (msg: string) => void };
}

function blockPreviewFailure(
  scope: string,
  error: unknown,
  errorKey: GuardFailureKey,
): GuardResult {
  logger.warn(`${scope} preview failed, blocking save`, { error });
  return { blocked: true, errorKey };
}

// ============================================================================
// GUARD CHAIN
// ============================================================================

/**
 * Run all 4 guards sequentially. Returns as soon as one blocks or defers.
 * If all pass, returns { blocked: false, deferred: false }.
 */
export async function runGuardChain(deps: GuardChainDeps): Promise<GuardResult> {
  const { editContact, editContactId, contactData, formData } = deps;

  // --- Guard 1: Name Cascade (ADR-249) ---
  if (!deps.nameCascadeConfirmedRef.current) {
    const oldName = ContactsService.getDisplayName(editContact);
    const newName = ContactsService.getDisplayName({ ...editContact, ...contactData } as Contact);

    if (oldName !== newName && newName.length > 0) {
      try {
        const preview = await apiClient.get<{ totalAffected: number; properties: number; paymentPlans: number }>(
          `/api/contacts/${editContactId}/name-cascade-preview`
        );
        if (preview.totalAffected > 0) {
          deps.deferredSubmitRef.current = async () => {
            deps.nameCascadeConfirmedRef.current = true;
            await ContactsService.updateExistingContactFromForm(editContact, formData);
            deps.notifications.success('contacts-form.submission.updateSuccess');
            deps.nameCascadeConfirmedRef.current = false;
          };
          deps.setNameCascadeDialog({ oldName, newName, properties: preview.properties, paymentPlans: preview.paymentPlans });
          return { blocked: false, deferred: true, guardType: 'nameCascade' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'nameCascade',
          error,
          'contacts.identityImpact.messages.unavailable',
        );
      }
    }
  }
  deps.nameCascadeConfirmedRef.current = false;

  // --- Guard 2: Address Impact (ADR-277) ---
  if (!deps.addressImpactConfirmedRef.current && editContact.type === 'company') {
    const oldHQ = extractHeadquartersAddress(editContact);
    const newHQ = extractHeadquartersAddress({ ...editContact, ...contactData } as Contact);
    if (hasHQAddressChanged(oldHQ, newHQ)) {
      try {
        const ap = await apiClient.get<{ totalAffected: number; properties: number; paymentPlans: number; invoices: number; apyCertificates: number }>(
          `/api/contacts/${editContactId}/address-impact-preview`
        );
        if (ap.totalAffected > 0) {
          deps.deferredAddressSubmitRef.current = async () => {
            deps.addressImpactConfirmedRef.current = true;
            await ContactsService.updateExistingContactFromForm(editContact, formData);
            deps.notifications.success('contacts-form.submission.updateSuccess');
            deps.addressImpactConfirmedRef.current = false;
          };
          deps.setAddressImpactDialog({ addressLabel: 'Έδρα', properties: ap.properties, paymentPlans: ap.paymentPlans, invoices: ap.invoices, apyCertificates: ap.apyCertificates });
          return { blocked: false, deferred: true, guardType: 'addressImpact' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'addressImpact',
          error,
          'contacts.identityImpact.messages.unavailable',
        );
      }
    }
  }
  deps.addressImpactConfirmedRef.current = false;

  // --- Guard 3: Company Identity (ADR-278) ---
  if (!deps.companyIdentityConfirmedRef.current && editContact.type === 'company') {
    const detection = detectCompanyIdentityChanges(editContact, formData);
    if (detection.hasUnsafeClear) {
      logger.warn('Blocked unsafe clear of identity fields:', detection.unsafeClearFields.join(', '));
      return { blocked: true, errorKey: 'contacts.companyIdentityImpact.unsafeClear' };
    }
    if (detection.requiresImpactPreview) {
      try {
        const ip = await apiClient.get<{ totalAffected: number; projects: number; properties: number; obligations: number; invoices: number; apyCertificates: number }>(
          `/api/contacts/${editContactId}/company-identity-impact-preview`
        );
        if (ip.totalAffected > 0) {
          deps.deferredIdentitySubmitRef.current = async () => {
            deps.companyIdentityConfirmedRef.current = true;
            await ContactsService.updateExistingContactFromForm(editContact, formData);
            deps.notifications.success('contacts-form.submission.updateSuccess');
            deps.companyIdentityConfirmedRef.current = false;
          };
          deps.setCompanyIdentityDialog({ changes: detection.changes, projects: ip.projects, properties: ip.properties, obligations: ip.obligations, invoices: ip.invoices, apyCertificates: ip.apyCertificates });
          return { blocked: false, deferred: true, guardType: 'companyIdentity' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'companyIdentityImpact',
          error,
          'contacts.companyIdentityImpact.unavailableBody',
        );
      }
    }
  }
  deps.companyIdentityConfirmedRef.current = false;

  // --- Guard 4: Communication Impact (ADR-280) ---
  if (!deps.communicationImpactConfirmedRef.current && editContact.type === 'company') {
    const commDetection = detectCommunicationChanges(editContact, formData);
    if (commDetection.hasUnsafeRemoval) {
      return { blocked: true, errorKey: 'contacts.communicationImpact.unsafeRemoval' };
    }
    if (commDetection.requiresImpactPreview) {
      try {
        const cp = await apiClient.get<{ totalAffected: number; properties: number; paymentPlans: number; projects: number; invoices: number; apyCertificates: number }>(
          `/api/contacts/${editContactId}/communication-impact-preview`
        );
        if (cp.totalAffected > 0) {
          deps.deferredCommunicationSubmitRef.current = async () => {
            deps.communicationImpactConfirmedRef.current = true;
            await ContactsService.updateExistingContactFromForm(editContact, formData);
            deps.notifications.success('contacts-form.submission.updateSuccess');
            deps.communicationImpactConfirmedRef.current = false;
          };
          deps.setCommunicationImpactDialog({ changes: commDetection.changes, properties: cp.properties, paymentPlans: cp.paymentPlans, projects: cp.projects, invoices: cp.invoices, apyCertificates: cp.apyCertificates });
          return { blocked: false, deferred: true, guardType: 'communicationImpact' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'communicationImpact',
          error,
          'contacts.identityImpact.messages.unavailable',
        );
      }
    }
  }
  deps.communicationImpactConfirmedRef.current = false;

  // All guards passed
  return { blocked: false, deferred: false };
}
