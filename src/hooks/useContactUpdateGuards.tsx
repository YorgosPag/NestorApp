'use client';

import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { useContactMutationImpactGuard } from '@/hooks/useContactMutationImpactGuard';
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

interface GuardMutationResult {
  readonly completed: boolean;
  readonly blockedUnsafeClear: boolean;
}

interface UseContactUpdateGuardsReturn {
  readonly previewBeforeUpdate: (
    formData: ContactFormData,
    contactData: Record<string, unknown>,
    action: () => Promise<void>,
  ) => Promise<GuardMutationResult>;
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
  ): Promise<GuardMutationResult> => {
    const editContactId = editContact?.id;
    if (!editContactId) {
      await action();
      return { completed: true, blockedUnsafeClear: false };
    }

    let guardedActionCompleted = false;

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
        return;
      }

      if (guardResult.deferred) {
        return;
      }

      await action();
      guardedActionCompleted = true;
    };

    const mutationResult = await previewContactMutationImpactBeforeMutate(formData, guardedAction);
    if (mutationResult.blockedUnsafeClear) {
      return mutationResult;
    }

    return {
      completed: mutationResult.completed && guardedActionCompleted,
      blockedUnsafeClear: false,
    };
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





