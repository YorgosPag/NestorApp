'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { detectIndividualIdentityChanges } from '@/utils/contactForm/individual-identity-guard';
import { detectServiceIdentityChanges } from '@/utils/contactForm/service-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { ContactIdentityImpactDialog } from '@/components/contacts/dialogs/ContactIdentityImpactDialog';

interface MutationResult {
  readonly completed: boolean;
  readonly blockedUnsafeClear: boolean;
}

interface UseContactMutationImpactGuardReturn {
  readonly previewBeforeMutate: (formData: ContactFormData, action: () => Promise<void>) => Promise<MutationResult>;
  readonly ImpactDialogs: ReactNode;
}

function logPreviewError(scope: string, error: unknown): void {
  if (ApiClientError.isApiClientError(error)) {
    console.error(`[${scope}] Preview failed (${error.statusCode}):`, error.message);
    return;
  }

  console.error(`[${scope}] Preview failed:`, error);
}

function buildUnavailablePreview(
  formData: ContactFormData,
  editContact: Contact | null | undefined,
): ContactIdentityImpactPreview | null {
  if (!editContact) {
    return null;
  }

  if (editContact.type === 'individual' && formData.type === 'individual') {
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

  if (editContact.type === 'service' && formData.type === 'service') {
    const detection = detectServiceIdentityChanges(editContact, formData);
    if (!detection.hasChanges) {
      return null;
    }

    return {
      mode: 'block',
      changes: detection.changes,
      dependencies: [],
      affectedDomains: ['searchAndReporting', 'relationshipViews'],
      messageKey: 'identityImpact.messages.unavailable',
      blockingCount: 0,
      warningCount: 0,
    };
  }

  return null;
}

export function useContactMutationImpactGuard(
  editContact?: Contact | null,
): UseContactMutationImpactGuardReturn {
  const [identityPreview, setIdentityPreview] = useState<ContactIdentityImpactPreview | null>(null);
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const deferredActionRef = useRef<(() => Promise<void>) | null>(null);

  const resetIdentityDialog = useCallback(() => {
    setIdentityDialogOpen(false);
    setIdentityPreview(null);
    deferredActionRef.current = null;
  }, []);

  // 🏢 GOOGLE-LEVEL INP: Decouple dialog dismiss from mutation execution.
  // Close dialog first, yield to browser for paint, then execute mutation.
  const handleIdentityConfirm = useCallback(() => {
    const action = deferredActionRef.current;
    resetIdentityDialog();
    if (action) {
      setTimeout(() => void action(), 0);
    }
  }, [resetIdentityDialog]);

  const previewBeforeMutate = useCallback(async (formData: ContactFormData, action: () => Promise<void>): Promise<MutationResult> => {
    if (!editContact || !editContact.id || editContact.type !== formData.type) {
      await action();
      return { completed: true, blockedUnsafeClear: false };
    }

    // Company identity is handled exclusively by runGuardChain (Guard #3, ADR-278)
    // via useContactUpdateGuards. Delegate here to avoid a duplicated dialog.
    if (editContact.type === 'company') {
      await action();
      return { completed: true, blockedUnsafeClear: false };
    }

    if (editContact.type === 'individual') {
      const detection = detectIndividualIdentityChanges(editContact, formData);
      if (!detection.requiresImpactPreview) {
        await action();
        return { completed: true, blockedUnsafeClear: false };
      }

      try {
        const preview = await apiClient.post<ContactIdentityImpactPreview>(
          API_ROUTES.CONTACTS.IDENTITY_IMPACT_PREVIEW(editContact.id),
          { changes: detection.changes },
        );

        if (preview.mode === 'allow') {
          await action();
          return { completed: true, blockedUnsafeClear: false };
        }

        deferredActionRef.current = preview.mode === 'warn' ? action : null;
        setIdentityPreview(preview);
        setIdentityDialogOpen(true);
        return { completed: false, blockedUnsafeClear: false };
      } catch (error) {
        logPreviewError('useContactMutationImpactGuard/individual', error);
        deferredActionRef.current = null;
        setIdentityPreview(buildUnavailablePreview(formData, editContact));
        setIdentityDialogOpen(true);
        return { completed: false, blockedUnsafeClear: false };
      }
    }

    const detection = detectServiceIdentityChanges(editContact, formData);
    if (!detection.requiresImpactPreview) {
      await action();
      return { completed: true, blockedUnsafeClear: false };
    }

    try {
      const preview = await apiClient.post<ContactIdentityImpactPreview>(
        API_ROUTES.CONTACTS.SERVICE_IDENTITY_IMPACT_PREVIEW(editContact.id),
        { changes: detection.changes },
      );

      if (preview.mode === 'allow') {
        await action();
        return { completed: true, blockedUnsafeClear: false };
      }

      deferredActionRef.current = preview.mode === 'warn' ? action : null;
      setIdentityPreview(preview);
      setIdentityDialogOpen(true);
      return { completed: false, blockedUnsafeClear: false };
    } catch (error) {
      logPreviewError('useContactMutationImpactGuard/service', error);
      deferredActionRef.current = null;
      setIdentityPreview(buildUnavailablePreview(formData, editContact));
      setIdentityDialogOpen(true);
      return { completed: false, blockedUnsafeClear: false };
    }
  }, [editContact]);

  const ImpactDialogs = useMemo(() => (
    <ContactIdentityImpactDialog
      open={identityDialogOpen}
      preview={identityPreview}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetIdentityDialog();
        }
      }}
      onConfirm={handleIdentityConfirm}
    />
  ), [
    handleIdentityConfirm,
    identityDialogOpen,
    identityPreview,
    resetIdentityDialog,
  ]);

  return {
    previewBeforeMutate,
    ImpactDialogs,
  };
}
