'use client';

/**
 * usePropertyMutationImpactGuard — ο φύλακας επιπτώσεων για αλλαγές ακινήτου.
 *
 * 🔗 ADR-777 §8.69.13 — η μηχανή «preview → απόφαση → πράξη» ζει στο `useImpactDecision`,
 * κοινή με έργα και επαφές. Εδώ μόνο: **ποιο** endpoint, **ποιος** διάλογος, και η παράκαμψη για
 * ακίνητο που δεν υπάρχει ακόμη. Η υπόσχεση λύνεται **μετά** την πράξη, με ονομασμένη έκβαση.
 *
 * @enterprise ADR-664 (impact-guard SSoT)
 */

import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { PropertyMutationImpactPreview } from '@/types/property-mutation-impact';
import { PropertyMutationImpactDialog } from '@/components/properties/dialogs/PropertyMutationImpactDialog';
import { runGuardedAction, type GuardResult } from '@/hooks/impact-guard/guard-result';
import { useImpactDecision } from '@/hooks/impact-guard/useImpactDecision';

interface PropertyMutationPreviewTarget {
  readonly id: string;
}

interface UsePropertyMutationImpactGuardReturn {
  readonly checking: boolean;
  readonly previewBeforeMutate: (updates: Record<string, unknown>, action: () => Promise<void>) => Promise<GuardResult>;
  readonly reset: () => void;
  readonly ImpactDialog: ReactNode;
}

function buildUnavailablePreview(): PropertyMutationImpactPreview {
  return {
    mode: 'block',
    mutationKinds: [],
    changes: [],
    dependencies: [],
    messageKey: 'mutationImpact.unavailable',
    blockingCount: 0,
    warningCount: 0,
  };
}

export function usePropertyMutationImpactGuard(
  property?: PropertyMutationPreviewTarget | null,
): UsePropertyMutationImpactGuardReturn {
  const { checking, guard, reset, dialogProps } =
    useImpactDecision<PropertyMutationImpactPreview>('usePropertyMutationImpactGuard');
  const propertyId = property?.id;

  const previewBeforeMutate = useCallback(
    (updates: Record<string, unknown>, action: () => Promise<void>): Promise<GuardResult> => {
      // Ακίνητο που δεν υπάρχει ακόμη: δεν υπάρχουν εξαρτήσεις να προβλεφθούν.
      if (!propertyId || propertyId === '__new__') return runGuardedAction(action);

      return guard({
        fetchPreview: () =>
          apiClient.post<PropertyMutationImpactPreview>(API_ROUTES.PROPERTIES.IMPACT_PREVIEW(propertyId), updates),
        unavailablePreview: buildUnavailablePreview,
        action,
      });
    },
    [guard, propertyId],
  );

  const ImpactDialog = useMemo(() => <PropertyMutationImpactDialog {...dialogProps} />, [dialogProps]);

  return { checking, previewBeforeMutate, reset, ImpactDialog };
}
