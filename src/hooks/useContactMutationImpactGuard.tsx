'use client';

import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { detectIndividualIdentityChanges } from '@/utils/contactForm/individual-identity-guard';
import { detectCompanyIdentityChanges } from '@/utils/contactForm/company-identity-guard';
import { detectServiceIdentityChanges } from '@/utils/contactForm/service-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { ContactIdentityImpactDialog } from '@/components/contacts/dialogs/ContactIdentityImpactDialog';
import { CompanyIdentityImpactDialog } from '@/components/contacts/dialogs/CompanyIdentityImpactDialog';
import type { CompanyIdentityImpactPreview } from '@/lib/firestore/company-identity-impact-preview.service';

interface MutationResult {
  readonly completed: boolean;
  readonly blockedUnsafeClear: boolean;
}

interface CompanyDialogState {
  readonly changes: ReturnType<typeof detectCompanyIdentityChanges>['changes'];
  readonly preview: CompanyIdentityImpactPreview;
  readonly mode: 'warn' | 'block';
  readonly message?: string;
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
  const [companyDialogState, setCompanyDialogState] = useState<CompanyDialogState | null>(null);
  const deferredActionRef = useRef<(() => Promise<void>) | null>(null);

  const resetIdentityDialog = useCallback(() => {
    setIdentityDialogOpen(false);
    setIdentityPreview(null);
    deferredActionRef.current = null;
  }, []);

  const resetCompanyDialog = useCallback(() => {
    setCompanyDialogState(null);
    deferredActionRef.current = null;
  }, []);

  const handleIdentityConfirm = useCallback(async () => {
    const action = deferredActionRef.current;
    resetIdentityDialog();
    if (action) {
      await action();
    }
  }, [resetIdentityDialog]);

  const handleCompanyConfirm = useCallback(async () => {
    const action = deferredActionRef.current;
    resetCompanyDialog();
    if (action) {
      await action();
    }
  }, [resetCompanyDialog]);

  const previewBeforeMutate = useCallback(async (formData: ContactFormData, action: () => Promise<void>): Promise<MutationResult> => {
    if (!editContact || !editContact.id || editContact.type !== formData.type) {
      await action();
      return { completed: true, blockedUnsafeClear: false };
    }

    if (editContact.type === 'company') {
      const detection = detectCompanyIdentityChanges(editContact, formData);
      if (detection.hasUnsafeClear) {
        return { completed: false, blockedUnsafeClear: true };
      }
      if (!detection.requiresImpactPreview) {
        await action();
        return { completed: true, blockedUnsafeClear: false };
      }

      try {
        const preview = await apiClient.get<CompanyIdentityImpactPreview>(
          API_ROUTES.CONTACTS.COMPANY_IDENTITY_IMPACT_PREVIEW(editContact.id),
        );

        if (preview.totalAffected === 0) {
          await action();
          return { completed: true, blockedUnsafeClear: false };
        }

        deferredActionRef.current = action;
        setCompanyDialogState({ changes: detection.changes, preview, mode: 'warn' });
        return { completed: false, blockedUnsafeClear: false };
      } catch (error) {
        logPreviewError('useContactMutationImpactGuard/company', error);
        deferredActionRef.current = null;
        setCompanyDialogState({
          changes: detection.changes,
          preview: {
            totalAffected: 0,
            projects: 0,
            properties: 0,
            obligations: 0,
            invoices: 0,
            apyCertificates: 0,
          },
          mode: 'block',
          message: 'contacts.companyIdentityImpact.unavailableBody',
        });
        return { completed: false, blockedUnsafeClear: false };
      }
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
    <Fragment>
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
      {companyDialogState && (
        <CompanyIdentityImpactDialog
          open={!!companyDialogState}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              resetCompanyDialog();
            }
          }}
          changes={companyDialogState.changes}
          projects={companyDialogState.preview.projects}
          properties={companyDialogState.preview.properties}
          obligations={companyDialogState.preview.obligations}
          invoices={companyDialogState.preview.invoices}
          apyCertificates={companyDialogState.preview.apyCertificates}
          onConfirm={handleCompanyConfirm}
          mode={companyDialogState.mode}
          message={companyDialogState.message}
        />
      )}
    </Fragment>
  ), [
    companyDialogState,
    handleCompanyConfirm,
    handleIdentityConfirm,
    identityDialogOpen,
    identityPreview,
    resetCompanyDialog,
    resetIdentityDialog,
  ]);

  return {
    previewBeforeMutate,
    ImpactDialogs,
  };
}
