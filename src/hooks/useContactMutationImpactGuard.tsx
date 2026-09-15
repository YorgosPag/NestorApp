'use client';

/**
 * useContactMutationImpactGuard — φύλακας επιπτώσεων ταυτότητας επαφής (φυσικό πρόσωπο / υπηρεσία).
 *
 * 🔗 ADR-777 §8.69.13 — η μηχανή «preview → απόφαση → πράξη» ζει στο `useImpactDecision`, κοινή με
 * ακίνητα και έργα. Εδώ μόνο: **πότε** χρειάζεται preview, **ποιο** endpoint, **ποιος** διάλογος.
 * Η υπόσχεση λύνεται **μετά** την πράξη, με ονομασμένη έκβαση (ήταν `{ completed: false }`
 * **πριν** την απόφαση, και η πράξη μετά την επιβεβαίωση έτρεχε fire-and-forget).
 *
 * @enterprise ADR-664 (impact-guard SSoT) · ADR-278 (η εταιρεία ανήκει στο `runGuardChain`)
 */

import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { detectIndividualIdentityChanges } from '@/utils/contactForm/individual-identity-guard';
import { detectServiceIdentityChanges } from '@/utils/contactForm/service-identity-guard';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { ContactIdentityImpactDialog } from '@/components/contacts/dialogs/ContactIdentityImpactDialog';
import { runGuardedAction, type GuardResult } from '@/hooks/impact-guard/guard-result';
import { useImpactDecision } from '@/hooks/impact-guard/useImpactDecision';

interface UseContactMutationImpactGuardReturn {
  readonly previewBeforeMutate: (formData: ContactFormData, action: () => Promise<void>) => Promise<GuardResult>;
  readonly ImpactDialogs: ReactNode;
}

/** Πού και τι ρωτάμε — ή `null` όταν η αλλαγή δεν χρειάζεται preview. */
interface IdentityPreviewTarget {
  readonly endpoint: string;
  readonly changes: unknown;
}

function identityPreviewTarget(
  editContact: Contact | null | undefined,
  formData: ContactFormData,
): IdentityPreviewTarget | null {
  if (!editContact?.id || editContact.type !== formData.type) return null;

  if (editContact.type === 'individual') {
    const detection = detectIndividualIdentityChanges(editContact, formData);
    return detection.requiresImpactPreview
      ? { endpoint: API_ROUTES.CONTACTS.IDENTITY_IMPACT_PREVIEW(editContact.id), changes: detection.changes }
      : null;
  }

  if (editContact.type === 'service') {
    const detection = detectServiceIdentityChanges(editContact, formData);
    return detection.requiresImpactPreview
      ? { endpoint: API_ROUTES.CONTACTS.SERVICE_IDENTITY_IMPACT_PREVIEW(editContact.id), changes: detection.changes }
      : null;
  }

  // Company identity is handled exclusively by runGuardChain (Guard #3, ADR-278)
  // via useContactUpdateGuards. Delegate here to avoid a duplicated dialog.
  return null;
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
  const { guard, dialogProps } = useImpactDecision<ContactIdentityImpactPreview>('useContactMutationImpactGuard');

  const previewBeforeMutate = useCallback(
    (formData: ContactFormData, action: () => Promise<void>): Promise<GuardResult> => {
      const target = identityPreviewTarget(editContact, formData);
      if (target === null) return runGuardedAction(action);

      return guard({
        fetchPreview: () =>
          apiClient.post<ContactIdentityImpactPreview>(target.endpoint, { changes: target.changes }),
        unavailablePreview: () => buildUnavailablePreview(formData, editContact),
        action,
      });
    },
    [editContact, guard],
  );

  const ImpactDialogs = useMemo(() => <ContactIdentityImpactDialog {...dialogProps} />, [dialogProps]);

  return { previewBeforeMutate, ImpactDialogs };
}
