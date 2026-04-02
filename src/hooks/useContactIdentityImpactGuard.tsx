'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { detectIndividualIdentityChanges } from '@/utils/contactForm/individual-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { ContactIdentityImpactDialog } from '@/components/contacts/dialogs/ContactIdentityImpactDialog';

interface UseContactIdentityImpactGuardReturn {
  checking: boolean;
  previewBeforeMutate: (formData: ContactFormData, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
}

function buildUnavailablePreview(
  formData: ContactFormData,
  editContact: Contact | null | undefined,
): ContactIdentityImpactPreview | null {
  if (!editContact) {
    return null;
  }

  const detection = detectIndividualIdentityChanges(editContact, formData);
  if (!detection.hasChanges) {
    return null;
  }

  return {
    mode: 'block',
    changes: detection.changes,
    dependencies: [],
    affectedDomains: [],
    messageKey: 'identityImpact.messages.unavailable',
    blockingCount: 0,
    warningCount: 0,
  };
}

export function useContactIdentityImpactGuard(
  editContact?: Contact | null,
): UseContactIdentityImpactGuardReturn {
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<ContactIdentityImpactPreview | null>(null);
  const [open, setOpen] = useState(false);
  const deferredActionRef = useRef<(() => Promise<void>) | null>(null);

  const reset = useCallback(() => {
    setOpen(false);
    setPreview(null);
    deferredActionRef.current = null;
  }, []);

  const handleConfirm = useCallback(async () => {
    const action = deferredActionRef.current;
    reset();
    if (action) {
      await action();
    }
  }, [reset]);

  const previewBeforeMutate = useCallback(async (formData: ContactFormData, action: () => Promise<void>) => {
    if (!editContact || editContact.type !== 'individual' || formData.type !== 'individual' || !editContact.id) {
      await action();
      return true;
    }

    const detection = detectIndividualIdentityChanges(editContact, formData);
    if (!detection.requiresImpactPreview) {
      await action();
      return true;
    }

    setChecking(true);
    try {
      const impactPreview = await apiClient.post<ContactIdentityImpactPreview>(
        API_ROUTES.CONTACTS.IDENTITY_IMPACT_PREVIEW(editContact.id),
        { changes: detection.changes },
      );

      if (impactPreview.mode === 'allow') {
        setChecking(false);
        await action();
        return true;
      }

      deferredActionRef.current = impactPreview.mode === 'warn' ? action : null;
      setPreview(impactPreview);
      setOpen(true);
      setChecking(false);
      return false;
    } catch (error) {
      if (ApiClientError.isApiClientError(error)) {
        console.error(`[useContactIdentityImpactGuard] Preview failed (${error.statusCode}):`, error.message);
      } else {
        console.error('[useContactIdentityImpactGuard] Preview failed:', error);
      }

      deferredActionRef.current = null;
      setPreview(buildUnavailablePreview(formData, editContact));
      setOpen(true);
      setChecking(false);
      return false;
    }
  }, [editContact]);

  const ImpactDialog = useMemo(() => (
    <ContactIdentityImpactDialog
      open={open}
      preview={preview}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reset();
        }
      }}
      onConfirm={handleConfirm}
    />
  ), [handleConfirm, open, preview, reset]);

  return {
    checking,
    previewBeforeMutate,
    reset,
    ImpactDialog,
  };
}
