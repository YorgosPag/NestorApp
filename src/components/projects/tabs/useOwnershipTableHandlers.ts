/**
 * ============================================================================
 * Ownership Table — Event Handlers Hook
 * ============================================================================
 *
 * Extracted from OwnershipTableTab.tsx (ADR-235) for SRP compliance.
 * Custom hook encapsulating all table action handlers:
 * autoPopulate, calculate, save, finalize, unlock, deleteDraft, methodChange.
 *
 * @module components/projects/tabs/useOwnershipTableHandlers
 */

import { useCallback } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import { validateBuildingData } from '@/services/ownership/ownership-table-service';
import type { UseOwnershipTableReturn } from '@/hooks/ownership/useOwnershipTable';
import type { CalculationMethod } from '@/types/ownership-table';

// ============================================================================
// TYPES
// ============================================================================

interface HandlerDeps {
  /** The full return value from useOwnershipTable */
  ownership: UseOwnershipTableReturn;
  /** Building IDs linked to the project */
  buildingIds: string[];
  /** i18n translation function */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Notification helpers */
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  /** Auth user ID */
  userId: string | undefined;
  /** Confirm dialog — returns true if user confirms */
  confirm: (opts: {
    title: string;
    description: string;
    variant?: 'destructive';
    confirmText?: string;
  }) => Promise<boolean>;
  /** Unlock reason state setter */
  setShowUnlockInput: (v: boolean) => void;
  setUnlockReason: (v: string) => void;
  unlockReason: string;
}

export interface OwnershipTableHandlers {
  handleAutoPopulate: () => Promise<void>;
  handleCalculate: () => void;
  handleSave: () => Promise<void>;
  handleFinalize: () => Promise<void>;
  handleUnlock: () => Promise<void>;
  handleDeleteDraft: () => Promise<void>;
  handleMethodChange: (method: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOwnershipTableHandlers(deps: HandlerDeps): OwnershipTableHandlers {
  const {
    ownership,
    buildingIds,
    t,
    showSuccess,
    showError,
    userId,
    confirm,
    setShowUnlockInput,
    setUnlockReason,
    unlockReason,
  } = deps;

  const {
    table,
    autoPopulate,
    calculate,
    updateTableField,
    save,
    finalize,
    unlock,
    deleteDraft,
  } = ownership;

  // -------------------------------------------------------
  // Auto-populate rows from building data
  // -------------------------------------------------------
  const handleAutoPopulate = useCallback(async () => {
    if (buildingIds.length === 0) {
      showError(t('common:ownership.messages.noBuildings'));
      return;
    }

    try {
      const validation = await validateBuildingData(buildingIds);
      const issues: string[] = [];

      if (validation.totalFloors === 0) issues.push(t('common:ownership.messages.noFloors'));
      if (validation.totalProperties === 0) issues.push(t('common:ownership.messages.noUnits'));
      if (validation.unitsWithoutArea > 0) {
        issues.push(t('common:ownership.messages.unitsWithoutArea', { count: validation.unitsWithoutArea }));
      }
      if (validation.unitsWithoutFloor > 0) {
        issues.push(t('common:ownership.messages.unitsWithoutFloor', { count: validation.unitsWithoutFloor }));
      }

      if (validation.totalProperties === 0) {
        showError(issues.join('\n'));
        return;
      }

      const rowCount = await autoPopulate();

      if (issues.length > 0) {
        showError(
          `${t('common:ownership.messages.populateWithWarnings', { count: rowCount })}\n${issues.join('\n')}`,
        );
      } else {
        showSuccess(t('common:ownership.messages.populateSuccess', { count: rowCount }));
      }
    } catch (err) {
      showError(getErrorMessage(err, t('common:ownership.messages.dataCheckError')));
    }
  }, [autoPopulate, buildingIds, showSuccess, showError, t]);

  // -------------------------------------------------------
  // Calculate millesimal shares
  // -------------------------------------------------------
  const handleCalculate = useCallback(() => {
    const rows = table?.rows ?? [];

    // Check: air rights without millesimal shares
    const emptyAirRights = rows.filter(
      r => r.category === 'air_rights' && r.millesimalShares === 0,
    );
    if (emptyAirRights.length > 0) {
      showError(t('common:ownership.messages.airRightsNoShares', { count: emptyAirRights.length }));
      return;
    }

    // Check: participating rows without area — blocks calculation
    const noAreaRows = rows.filter(
      r => r.participatesInCalculation && !r.isManualOverride && r.areaSqm <= 0,
    );
    if (noAreaRows.length > 0) {
      const codes = noAreaRows.map(r => r.entityCode).join(', ');
      showError(t('common:ownership.messages.noAreaRows', { count: noAreaRows.length, codes }));
      return;
    }

    // Warning: linked parking/storage without area — informational only
    const warnings: string[] = [];
    for (const row of rows) {
      if (!row.linkedSpacesSummary) continue;
      for (const ls of row.linkedSpacesSummary) {
        if (ls.areaNetSqm <= 0) {
          warnings.push(
            `${ls.entityCode} (${ls.spaceType === 'parking' ? t('common:ownership.categoryInformational') : t('common:ownership.categoryAuxiliary')})`,
          );
        }
      }
    }

    calculate();

    // Record calculation method + timestamp in notes
    const methodLabels: Record<string, string> = {
      area: t('common:ownership.methodArea'),
      value: t('common:ownership.methodValue'),
      volume: t('common:ownership.methodVolume'),
    };
    const methodName = methodLabels[table?.calculationMethod ?? 'area'] ?? table?.calculationMethod;
    const timestamp = new Date().toLocaleString('el-GR');
    const note = `${t('common:ownership.messages.calculationNote', { method: methodName ?? 'area', date: timestamp })}`;
    updateTableField('notes', note);

    if (warnings.length > 0) {
      showSuccess(
        `${t('common:ownership.actions.calculate')} — ${t('common:ownership.messages.spacesNoArea', { count: warnings.length, codes: warnings.join(', ') })}`,
      );
    } else {
      showSuccess(t('common:ownership.actions.calculate'));
    }
  }, [calculate, table, showSuccess, showError, updateTableField, t]);

  // -------------------------------------------------------
  // Save
  // -------------------------------------------------------
  const handleSave = useCallback(async () => {
    await save();
    showSuccess(t('common:buttons.save'));
  }, [save, showSuccess, t]);

  // -------------------------------------------------------
  // Finalize (lock)
  // -------------------------------------------------------
  const handleFinalize = useCallback(async () => {
    if (!userId) return;
    try {
      await finalize(userId);
      showSuccess(t('common:ownership.actions.finalize'));
    } catch (err) {
      showError(getErrorMessage(err, t('common:ownership.messages.deleteError')));
    }
  }, [finalize, userId, showSuccess, showError, t]);

  // -------------------------------------------------------
  // Unlock
  // -------------------------------------------------------
  const handleUnlock = useCallback(async () => {
    if (!unlockReason.trim() || !userId) return;
    try {
      await unlock(userId, unlockReason);
      showSuccess(t('common:ownership.actions.unlock'));
      setShowUnlockInput(false);
      setUnlockReason('');
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }, [unlock, unlockReason, userId, showSuccess, showError, t, setShowUnlockInput, setUnlockReason]);

  // -------------------------------------------------------
  // Delete draft
  // -------------------------------------------------------
  const handleDeleteDraft = useCallback(async () => {
    const ok = await confirm({
      title: t('common:ownership.actions.deleteTable'),
      description: t('common:ownership.messages.orphanedAdvice'),
      variant: 'destructive',
      confirmText: t('common:ownership.actions.confirmDelete'),
    });
    if (!ok) return;
    try {
      await deleteDraft();
      showSuccess(t('common:ownership.messages.tableDeleted'));
    } catch (err) {
      showError(getErrorMessage(err, t('common:ownership.messages.deleteError')));
    }
  }, [deleteDraft, confirm, showSuccess, showError, t]);

  // -------------------------------------------------------
  // Method change (recalculates immediately)
  // -------------------------------------------------------
  const handleMethodChange = useCallback((method: string) => {
    updateTableField('calculationMethod', method);
    calculate(method as CalculationMethod);
  }, [updateTableField, calculate]);

  return {
    handleAutoPopulate,
    handleCalculate,
    handleSave,
    handleFinalize,
    handleUnlock,
    handleDeleteDraft,
    handleMethodChange,
  };
}
