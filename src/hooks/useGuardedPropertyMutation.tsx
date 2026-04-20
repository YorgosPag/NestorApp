'use client';

import { useCallback } from 'react';
import { usePropertyMutationImpactGuard } from '@/hooks/usePropertyMutationImpactGuard';
import {
  updatePropertyWithPolicy,
  revertPropertySaleWithPolicy,
} from '@/services/property/property-mutation-gateway';

interface PropertyMutationPreviewTarget {
  readonly id: string;
}

interface PropertyMutationCurrentState {
  readonly commercialStatus?: string | null;
  readonly buildingId?: string | null;
  readonly floorId?: string | null;
  readonly name?: string | null;
}

export function useGuardedPropertyMutation(
  property?: PropertyMutationPreviewTarget | null,
) {
  const { checking, previewBeforeMutate, reset, ImpactDialog } = usePropertyMutationImpactGuard(property);

  const runPreviewedMutation = useCallback(
    async (
      updates: Record<string, unknown>,
      action: () => Promise<void>,
      onError?: (err: unknown) => void,
    ) => {
      if (!property?.id) {
        return false;
      }

      return previewBeforeMutate(updates, action, onError);
    },
    [previewBeforeMutate, property?.id],
  );

  const runExistingPropertyUpdate = useCallback(
    async (
      currentProperty: PropertyMutationCurrentState,
      updates: Record<string, unknown>,
      postUpdateAction?: () => Promise<void>,
    ) => {
      return runPreviewedMutation(updates, async () => {
        await updatePropertyWithPolicy({
          propertyId: property!.id,
          currentProperty,
          updates,
        });

        if (postUpdateAction) {
          await postUpdateAction();
        }
      });
    },
    [property, runPreviewedMutation],
  );

  const runRevertUpdate = useCallback(
    async (
      currentProperty: PropertyMutationCurrentState,
      updates: Record<string, unknown>,
      onError?: (err: unknown) => void,
      postUpdateAction?: () => Promise<void>,
    ) => {
      return runPreviewedMutation(updates, async () => {
        await revertPropertySaleWithPolicy({
          propertyId: property!.id,
          currentProperty,
          updates,
        });

        if (postUpdateAction) {
          await postUpdateAction();
        }
      }, onError);
    },
    [property, runPreviewedMutation],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runPreviewedMutation,
    runExistingPropertyUpdate,
    runRevertUpdate,
  };
}
