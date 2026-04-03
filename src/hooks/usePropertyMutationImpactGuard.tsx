'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { PropertyMutationImpactPreview } from '@/types/property-mutation-impact';
import { PropertyMutationImpactDialog } from '@/components/properties/dialogs/PropertyMutationImpactDialog';

interface PropertyMutationPreviewTarget {
  readonly id: string;
}

interface UsePropertyMutationImpactGuardReturn {
  checking: boolean;
  previewBeforeMutate: (updates: Record<string, unknown>, action: () => Promise<void>) => Promise<boolean>;
  reset: () => void;
  ImpactDialog: ReactNode;
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
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<PropertyMutationImpactPreview | null>(null);
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

  const previewBeforeMutate = useCallback(async (updates: Record<string, unknown>, action: () => Promise<void>) => {
    if (!property?.id || property.id === '__new__') {
      await action();
      return true;
    }

    setChecking(true);
    try {
      const impactPreview = await apiClient.post<PropertyMutationImpactPreview>(
        API_ROUTES.PROPERTIES.IMPACT_PREVIEW(property.id),
        updates,
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
        console.error(`[usePropertyMutationImpactGuard] Preview failed (${error.statusCode}):`, error.message);
      } else {
        console.error('[usePropertyMutationImpactGuard] Preview failed:', error);
      }

      deferredActionRef.current = null;
      setPreview(buildUnavailablePreview());
      setOpen(true);
      setChecking(false);
      return false;
    }
  }, [property?.id]);

  const ImpactDialog = useMemo(() => (
    <PropertyMutationImpactDialog
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
