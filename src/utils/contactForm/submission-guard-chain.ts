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
import type { CommunicationImpactPreview, CommunicationImpactPreviewRequest } from '@/types/communication-impact-preview';

import { detectIdentifierDuplicates } from './identifier-duplicate-guard';

import type { NameCascadeDialogState, AddressImpactDialogState, CompanyIdentityDialogState, CommunicationImpactDialogState, IdentifierDuplicateDialogState } from '@/types/contact-submission-dialog.types';

const logger = createModuleLogger('SubmissionGuardChain');

// ============================================================================
// TYPES
// ============================================================================

export type GuardResult =
  | { blocked: false; deferred: false }
  /** `announced` ⇒ ο φρουρός άνοιξε ήδη δικό του διάλογο· ο καλών ΔΕΝ δείχνει δεύτερο μήνυμα. */
  | { blocked: true; errorKey: string; announced?: true }
  | { blocked: false; deferred: true; guardType: 'identifierDuplicate' | 'nameCascade' | 'addressImpact' | 'companyIdentity' | 'communicationImpact' };

/** Συνέχεια μετά από επιβεβαίωση διπλοτύπου: `true` ⇒ η επαφή γράφτηκε· `false` ⇒ ανέλαβε άλλος φρουρός. */
export type IdentifierDuplicateResume = () => Promise<boolean>;

type GuardFailureKey =
  | 'contacts-lifecycle.identityImpact.messages.unavailable'
  | 'common-shared.contacts.companyIdentityImpact.unavailableBody';

interface GuardChainDeps {
  editContact: Contact;
  editContactId: string;
  contactData: Record<string, unknown>;
  formData: ContactFormData;

  // The caller's authoritative update action. When a guard defers and the
  // user confirms in the impact dialog, we invoke THIS — not a hardcoded
  // ContactsService call — so every call site's post-update lifecycle
  // (close form, reset editing state, refresh list) runs exactly once,
  // regardless of which path (immediate vs. deferred) completes the save.
  action: () => Promise<void>;

  // Διπλό ΑΦΜ / email (ADR-944 §9) — ο ΠΡΩΤΟΣ φρουρός· η συνέχειά του ξανατρέχει την αλυσίδα.
  identifierDuplicateConfirmedRef: React.MutableRefObject<boolean>;
  identifierDuplicateResumeRef: React.MutableRefObject<IdentifierDuplicateResume | null>;
  setIdentifierDuplicateDialog: (state: IdentifierDuplicateDialogState | null) => void;

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

function wrapConfirmed(
  action: () => Promise<void>,
  confirmedRef: React.MutableRefObject<boolean>,
): () => Promise<void> {
  return async () => {
    confirmedRef.current = true;
    try {
      await action();
    } finally {
      confirmedRef.current = false;
    }
  };
}

function blockPreviewFailure(
  scope: string,
  error: unknown,
  errorKey: GuardFailureKey,
): GuardResult {
  logger.warn(`${scope} preview failed, blocking save`, { error });
  return { blocked: true, errorKey };
}

/**
 * Guard 4 — επιπτώσεις επικοινωνίας. SSoT: τρέχει για ΟΛΟΥΣ τους τύπους· το μητρώο φιλτράρει εξαρτήσεις ανά τύπο.
 *
 * ADR-944 §3.7 — **φραγμός ανά διεύθυνση, όχι ανά πλήθος**: ο πελάτης στέλνει ποια κλειδιά email αφαιρεί και ο
 * server απαντά ποια είναι άγκυρες αποδεκτού λογαριασμού. Άγκυρα ⇒ φραγμός. Αλλιώς αναφορές > 0 ⇒ διάλογος.
 * Αλλιώς περνά (`null`). Αποτυχία ερώτησης ⇒ φραγμός (fail-closed): «δεν ρώτησα» ≠ «δεν υπάρχει άγκυρα».
 */
async function runCommunicationGuard(deps: GuardChainDeps): Promise<GuardResult | null> {
  const detection = detectCommunicationChanges(deps.editContact, deps.formData);
  if (!detection.requiresImpactPreview) return null;
  try {
    const body: CommunicationImpactPreviewRequest = { removedEmailKeys: detection.removedEmailKeys };
    const cp = await apiClient.post<CommunicationImpactPreview>(
      `/api/contacts/${deps.editContactId}/communication-impact-preview`,
      body,
    );
    if (cp.anchoredEmailKeys.length > 0) {
      return { blocked: true, errorKey: 'common-shared.contacts.communicationImpact.accountAnchorRemoval' };
    }
    if (cp.totalAffected === 0) return null;
    deps.deferredCommunicationSubmitRef.current = wrapConfirmed(deps.action, deps.communicationImpactConfirmedRef);
    deps.setCommunicationImpactDialog({
      changes: detection.changes,
      properties: cp.properties,
      paymentPlans: cp.paymentPlans,
      communications: cp.communications,
      projects: cp.projects,
      invoices: cp.invoices,
      apyCertificates: cp.apyCertificates,
    });
    return { blocked: false, deferred: true, guardType: 'communicationImpact' };
  } catch (error) {
    return blockPreviewFailure('communicationImpact', error, 'contacts-lifecycle.identityImpact.messages.unavailable');
  }
}

/**
 * Μετά το «Αποθήκευση παρ' όλα αυτά»: η αλυσίδα **ξανατρέχει** με τον φρουρό 0 περασμένο, ώστε οι υπόλοιποι φρουροί
 * (επιπτώσεις ονόματος · έδρας · ταυτότητας · επικοινωνίας) να ρωτηθούν κανονικά. Η επιβεβαίωση ενός διπλοτύπου δεν
 * είναι άδεια να παρακαμφθεί, π.χ., ο φραγμός αφαίρεσης email-άγκυρας.
 */
async function resumeAfterDuplicateConfirm(deps: GuardChainDeps): Promise<boolean> {
  deps.identifierDuplicateConfirmedRef.current = true;
  const rest = await runGuardChain(deps);
  if (rest.blocked) {
    if (rest.announced !== true) deps.notifications.error(rest.errorKey);
    return false;
  }
  if (rest.deferred) return false;
  await deps.action();
  return true;
}

/**
 * Guard 0 — διπλό ΑΦΜ / email (ADR-944 §9). **Πρώτος**, ώστε καμία επιβεβαίωση άλλου φρουρού να μην τον προσπερνά.
 * `block` ⇒ διάλογος χωρίς «συνέχεια» (ο άνθρωπος βλέπει ποια επαφή έχει το ΑΦΜ)· `confirm` ⇒ διάλογος με συνέχεια.
 */
async function runIdentifierDuplicateGuard(deps: GuardChainDeps): Promise<GuardResult | null> {
  const duplicates = await detectIdentifierDuplicates(deps.editContact, deps.formData);
  if (duplicates === null) return null;
  deps.setIdentifierDuplicateDialog(duplicates);
  if (duplicates.decision === 'block') {
    return { blocked: true, errorKey: 'contacts-form:validation.identifierDuplicate.blockTitle', announced: true };
  }
  deps.identifierDuplicateResumeRef.current = () => resumeAfterDuplicateConfirm(deps);
  return { blocked: false, deferred: true, guardType: 'identifierDuplicate' };
}

// ============================================================================
// GUARD CHAIN
// ============================================================================

/**
 * Run all guards sequentially. Returns as soon as one blocks or defers.
 * If all pass, returns { blocked: false, deferred: false }.
 */
export async function runGuardChain(deps: GuardChainDeps): Promise<GuardResult> {
  const { editContact, editContactId, contactData, formData } = deps;

  // --- Guard 0: Duplicate VAT / email (ADR-944 §9) ---
  if (!deps.identifierDuplicateConfirmedRef.current) {
    const duplicateResult = await runIdentifierDuplicateGuard(deps);
    if (duplicateResult !== null) return duplicateResult;
  }
  deps.identifierDuplicateConfirmedRef.current = false;

  // --- Guard 1: Name Cascade (ADR-249) ---
  if (!deps.nameCascadeConfirmedRef.current) {
    const oldName = ContactsService.getDisplayName(editContact);
    const newName = ContactsService.getDisplayName({ ...editContact, ...contactData } as Contact);

    if (oldName !== newName && newName.length > 0) {
      try {
        const preview = await apiClient.get<{ totalAffected: number; properties: number; paymentPlans: number; parking: number; storage: number }>(
          `/api/contacts/${editContactId}/name-cascade-preview`
        );
        if (preview.totalAffected > 0) {
          deps.deferredSubmitRef.current = wrapConfirmed(deps.action, deps.nameCascadeConfirmedRef);
          deps.setNameCascadeDialog({ oldName, newName, properties: preview.properties, paymentPlans: preview.paymentPlans, parking: preview.parking, storage: preview.storage });
          return { blocked: false, deferred: true, guardType: 'nameCascade' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'nameCascade',
          error,
          'contacts-lifecycle.identityImpact.messages.unavailable',
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
          deps.deferredAddressSubmitRef.current = wrapConfirmed(deps.action, deps.addressImpactConfirmedRef);
          deps.setAddressImpactDialog({ addressLabel: 'Έδρα', properties: ap.properties, paymentPlans: ap.paymentPlans, invoices: ap.invoices, apyCertificates: ap.apyCertificates });
          return { blocked: false, deferred: true, guardType: 'addressImpact' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'addressImpact',
          error,
          'contacts-lifecycle.identityImpact.messages.unavailable',
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
      return { blocked: true, errorKey: 'common-shared.contacts.companyIdentityImpact.unsafeClear' };
    }
    if (detection.requiresImpactPreview) {
      try {
        const ip = await apiClient.get<{ totalAffected: number; projects: number; properties: number; obligations: number; parking: number; storage: number; invoices: number; apyCertificates: number }>(
          `/api/contacts/${editContactId}/company-identity-impact-preview`
        );
        if (ip.totalAffected > 0) {
          deps.deferredIdentitySubmitRef.current = wrapConfirmed(deps.action, deps.companyIdentityConfirmedRef);
          deps.setCompanyIdentityDialog({ changes: detection.changes, projects: ip.projects, properties: ip.properties, obligations: ip.obligations, parking: ip.parking, storage: ip.storage, invoices: ip.invoices, apyCertificates: ip.apyCertificates });
          return { blocked: false, deferred: true, guardType: 'companyIdentity' };
        }
      } catch (error) {
        return blockPreviewFailure(
          'companyIdentityImpact',
          error,
          'common-shared.contacts.companyIdentityImpact.unavailableBody',
        );
      }
    }
  }
  deps.companyIdentityConfirmedRef.current = false;

  // --- Guard 4: Communication Impact (ADR-280 · ADR-944 §3.7) ---
  if (!deps.communicationImpactConfirmedRef.current) {
    const communicationResult = await runCommunicationGuard(deps);
    if (communicationResult !== null) return communicationResult;
  }
  deps.communicationImpactConfirmedRef.current = false;

  // All guards passed
  return { blocked: false, deferred: false };
}
