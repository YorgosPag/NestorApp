'use client';

import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { useContactMutationImpactGuard } from '@/hooks/useContactMutationImpactGuard';
import {
  GUARD_BLOCKED,
  GUARD_CANCELLED,
  GUARD_COMPLETED,
  runGuardedAction,
  type GuardResult,
} from '@/hooks/impact-guard/guard-result';
import { runGuardChain } from '@/utils/contactForm/submission-guard-chain';
import { createGuardHandlers } from '@/utils/contactForm/guard-confirm-factory';
import { NameChangeCascadeDialog } from '@/components/contacts/dialogs/NameChangeCascadeDialog';
import { AddressImpactDialog } from '@/components/contacts/dialogs/AddressImpactDialog';
import { CompanyIdentityImpactDialog } from '@/components/contacts/dialogs/CompanyIdentityImpactDialog';
import { CommunicationImpactDialog } from '@/components/contacts/dialogs/CommunicationImpactDialog';
import type {
  NameCascadeDialogState,
  AddressImpactDialogState,
  CompanyIdentityDialogState,
  CommunicationImpactDialogState,
} from '@/types/contact-submission-dialog.types';

interface NotificationApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface UseContactUpdateGuardsProps {
  editContact?: Contact | null;
  notifications: NotificationApi;
  onUpdateSucceeded?: () => void;
  setLoading?: (loading: boolean) => void;
}

interface UseContactUpdateGuardsReturn {
  readonly previewBeforeUpdate: (
    formData: ContactFormData,
    contactData: Record<string, unknown>,
    action: () => Promise<void>,
  ) => Promise<GuardResult>;
  readonly GuardDialogs: React.ReactNode;
}

const noop = (): void => {};

export function useContactUpdateGuards({
  editContact,
  notifications,
  onUpdateSucceeded = noop,
  setLoading = noop,
}: UseContactUpdateGuardsProps): UseContactUpdateGuardsReturn {
  const [nameCascadeDialog, setNameCascadeDialog] = useState<NameCascadeDialogState | null>(null);
  const [addressImpactDialog, setAddressImpactDialog] = useState<AddressImpactDialogState | null>(null);
  const [companyIdentityDialog, setCompanyIdentityDialog] = useState<CompanyIdentityDialogState | null>(null);
  const [communicationImpactDialog, setCommunicationImpactDialog] = useState<CommunicationImpactDialogState | null>(null);

  const deferredSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const nameCascadeConfirmedRef = useRef(false);
  const addressImpactConfirmedRef = useRef(false);
  const companyIdentityConfirmedRef = useRef(false);
  const communicationImpactConfirmedRef = useRef(false);
  const deferredAddressSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const deferredIdentitySubmitRef = useRef<(() => Promise<void>) | null>(null);
  const deferredCommunicationSubmitRef = useRef<(() => Promise<void>) | null>(null);

  const {
    previewBeforeMutate: previewContactMutationImpactBeforeMutate,
    ImpactDialogs: contactMutationImpactDialogs,
  } = useContactMutationImpactGuard(editContact);

  const { confirm: confirmNameCascade, cancel: cancelNameCascade } = createGuardHandlers({
    setDialogState: () => setNameCascadeDialog(null),
    deferredSubmitRef,
    confirmedRef: nameCascadeConfirmedRef,
    setLoading,
    onContactAdded: onUpdateSucceeded,
    notifyError: notifications.error,
  });

  const { confirm: confirmAddressImpact, cancel: cancelAddressImpact } = createGuardHandlers({
    setDialogState: () => setAddressImpactDialog(null),
    deferredSubmitRef: deferredAddressSubmitRef,
    confirmedRef: addressImpactConfirmedRef,
    setLoading,
    onContactAdded: onUpdateSucceeded,
    notifyError: notifications.error,
  });

  const { confirm: confirmCompanyIdentity, cancel: cancelCompanyIdentity } = createGuardHandlers({
    setDialogState: () => setCompanyIdentityDialog(null),
    deferredSubmitRef: deferredIdentitySubmitRef,
    confirmedRef: companyIdentityConfirmedRef,
    setLoading,
    onContactAdded: onUpdateSucceeded,
    notifyError: notifications.error,
  });

  const { confirm: confirmCommunicationImpact, cancel: cancelCommunicationImpact } = createGuardHandlers({
    setDialogState: () => setCommunicationImpactDialog(null),
    deferredSubmitRef: deferredCommunicationSubmitRef,
    confirmedRef: communicationImpactConfirmedRef,
    setLoading,
    onContactAdded: onUpdateSucceeded,
    notifyError: notifications.error,
  });

  const previewBeforeUpdate = async (
    formData: ContactFormData,
    contactData: Record<string, unknown>,
    action: () => Promise<void>,
  ): Promise<GuardResult> => {
    const editContactId = editContact?.id;
    if (!editContactId) {
      return runGuardedAction(action);
    }

    // Τι έκανε η αλυσίδα φυλάκων ΜΕΣΑ στην πράξη. `deferred` = παρέδωσε σε δικό της διάλογο
    // (`createGuardHandlers`), που αναφέρει μόνος του την έκβαση (onUpdateSucceeded / notifyError).
    let chainOutcome: 'completed' | 'blocked' | 'deferred' = 'deferred';

    const guardedAction = async (): Promise<void> => {
      const guardResult = await runGuardChain({
        editContact,
        editContactId,
        contactData,
        formData,
        action,
        nameCascadeConfirmedRef,
        addressImpactConfirmedRef,
        companyIdentityConfirmedRef,
        communicationImpactConfirmedRef,
        deferredSubmitRef,
        deferredAddressSubmitRef,
        deferredIdentitySubmitRef,
        deferredCommunicationSubmitRef,
        setNameCascadeDialog,
        setAddressImpactDialog,
        setCompanyIdentityDialog,
        setCommunicationImpactDialog,
        notifications,
      });

      if (guardResult.blocked) {
        const errorKey = 'errorKey' in guardResult ? guardResult.errorKey : 'contacts-form.submission.updateError';
        notifications.error(errorKey);
        chainOutcome = 'blocked';
        return;
      }

      if (guardResult.deferred) {
        return;
      }

      await action();
      chainOutcome = 'completed';
    };

    // 🔗 ADR-777 §8.69.13 — η έκβαση του φύλακα ταυτότητας έρχεται ΜΕΤΑ την απόφαση και την πράξη.
    const identityResult = await previewContactMutationImpactBeforeMutate(formData, guardedAction);
    if (identityResult.outcome !== 'completed') return identityResult;
    if (chainOutcome === 'completed') return GUARD_COMPLETED;
    // Μπλοκαρισμένο ⇒ το σφάλμα ειπώθηκε ήδη· παραδομένο ⇒ τίποτα άλλο για ΑΥΤΟΝ τον καλούντα.
    return chainOutcome === 'blocked' ? GUARD_BLOCKED : GUARD_CANCELLED;
  };

  const GuardDialogs = useMemo(() => (
    <>
      {nameCascadeDialog && (
        <NameChangeCascadeDialog
          open={!!nameCascadeDialog}
          onOpenChange={(open) => { if (!open) cancelNameCascade(); }}
          oldName={nameCascadeDialog.oldName}
          newName={nameCascadeDialog.newName}
          properties={nameCascadeDialog.properties}
          paymentPlans={nameCascadeDialog.paymentPlans}
          onConfirm={confirmNameCascade}
        />
      )}

      {addressImpactDialog && (
        <AddressImpactDialog
          open={!!addressImpactDialog}
          onOpenChange={(open) => { if (!open) cancelAddressImpact(); }}
          addressLabel={addressImpactDialog.addressLabel}
          properties={addressImpactDialog.properties}
          paymentPlans={addressImpactDialog.paymentPlans}
          invoices={addressImpactDialog.invoices}
          apyCertificates={addressImpactDialog.apyCertificates}
          onConfirm={confirmAddressImpact}
        />
      )}

      {companyIdentityDialog && (
        <CompanyIdentityImpactDialog
          open={!!companyIdentityDialog}
          onOpenChange={(open) => { if (!open) cancelCompanyIdentity(); }}
          changes={companyIdentityDialog.changes}
          projects={companyIdentityDialog.projects}
          properties={companyIdentityDialog.properties}
          obligations={companyIdentityDialog.obligations}
          parking={companyIdentityDialog.parking}
          storage={companyIdentityDialog.storage}
          invoices={companyIdentityDialog.invoices}
          apyCertificates={companyIdentityDialog.apyCertificates}
          onConfirm={confirmCompanyIdentity}
        />
      )}

      {communicationImpactDialog && (
        <CommunicationImpactDialog
          open={!!communicationImpactDialog}
          onOpenChange={(open) => { if (!open) cancelCommunicationImpact(); }}
          changes={communicationImpactDialog.changes}
          properties={communicationImpactDialog.properties}
          paymentPlans={communicationImpactDialog.paymentPlans}
          communications={communicationImpactDialog.communications}
          projects={communicationImpactDialog.projects}
          invoices={communicationImpactDialog.invoices}
          apyCertificates={communicationImpactDialog.apyCertificates}
          onConfirm={confirmCommunicationImpact}
        />
      )}

      {contactMutationImpactDialogs}
    </>
  ), [
    addressImpactDialog,
    cancelAddressImpact,
    cancelCommunicationImpact,
    cancelCompanyIdentity,
    cancelNameCascade,
    communicationImpactDialog,
    companyIdentityDialog,
    confirmAddressImpact,
    confirmCommunicationImpact,
    confirmCompanyIdentity,
    confirmNameCascade,
    contactMutationImpactDialogs,
    nameCascadeDialog,
  ]);

  return {
    previewBeforeUpdate,
    GuardDialogs,
  };
}





