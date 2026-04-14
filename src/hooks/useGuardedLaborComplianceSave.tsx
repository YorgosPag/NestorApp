'use client';

/**
 * =============================================================================
 * useGuardedLaborComplianceSave — Thin wrapper for labor compliance save guard
 * =============================================================================
 *
 * Composes `useIkaLaborComplianceSaveImpactGuard` into a single callable.
 * Usage in LaborComplianceSettingsTabContent:
 *
 * ```tsx
 * const { checking, runSaveOperation, ImpactDialog } = useGuardedLaborComplianceSave();
 *
 * const handleSave = useCallback(async () => {
 *   await runSaveOperation(async () => {
 *     // actual save logic
 *   });
 * }, [runSaveOperation, ...deps]);
 *
 * return <>{ImpactDialog}</>;
 * ```
 *
 * @enterprise ADR-307 — IKA Mutation Impact Guards
 */

import { useCallback } from 'react';
import { useIkaLaborComplianceSaveImpactGuard } from '@/hooks/useIkaLaborComplianceSaveImpactGuard';

export function useGuardedLaborComplianceSave() {
  const { checking, previewBeforeSave, reset, ImpactDialog } =
    useIkaLaborComplianceSaveImpactGuard();

  const runSaveOperation = useCallback(
    (action: () => Promise<void>) => previewBeforeSave(action),
    [previewBeforeSave],
  );

  return {
    checking,
    reset,
    ImpactDialog,
    runSaveOperation,
  };
}
