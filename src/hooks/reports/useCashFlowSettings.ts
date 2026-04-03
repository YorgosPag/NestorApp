'use client';

/**
 * @module hooks/reports/useCashFlowSettings
 * @enterprise ADR-268 Phase 8 — Cash Flow Settings CRUD hook
 * @description Manages initial balance + recurring payments with optimistic updates.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type {
  CashFlowConfig,
  RecurringPayment,
} from '@/services/cash-flow/cash-flow.types';
import { DEFAULT_CASH_FLOW_CONFIG } from '@/services/cash-flow/cash-flow.types';
import { getErrorMessage } from '@/lib/error-utils';
import { updateCashFlowConfigWithPolicy } from '@/services/cash-flow/cash-flow-mutation-gateway';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseCashFlowSettingsReturn {
  config: CashFlowConfig;
  saving: boolean;
  setInitialBalance: (balance: number) => void;
  addRecurringPayment: (payment: RecurringPayment) => void;
  updateRecurringPayment: (id: string, payment: RecurringPayment) => void;
  removeRecurringPayment: (id: string) => void;
  saveConfig: () => Promise<void>;
  resetConfig: (serverConfig: CashFlowConfig | null) => void;
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCashFlowSettings(
  serverConfig: CashFlowConfig | null,
  onSaved?: () => void,
): UseCashFlowSettingsReturn {
  const { t } = useTranslation('cash-flow');

  const [config, setConfig] = useState<CashFlowConfig>(
    serverConfig ?? { ...DEFAULT_CASH_FLOW_CONFIG },
  );
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const setInitialBalance = useCallback((balance: number) => {
    setConfig((prev) => ({ ...prev, initialBalance: balance }));
    setHasChanges(true);
  }, []);

  const addRecurringPayment = useCallback((payment: RecurringPayment) => {
    setConfig((prev) => ({
      ...prev,
      recurringPayments: [...prev.recurringPayments, payment],
    }));
    setHasChanges(true);
  }, []);

  const updateRecurringPayment = useCallback((id: string, payment: RecurringPayment) => {
    setConfig((prev) => ({
      ...prev,
      recurringPayments: prev.recurringPayments.map((p) =>
        p.id === id ? payment : p,
      ),
    }));
    setHasChanges(true);
  }, []);

  const removeRecurringPayment = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      recurringPayments: prev.recurringPayments.filter((p) => p.id !== id),
    }));
    setHasChanges(true);
  }, []);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    const snapshot = { ...config };

    try {
      await updateCashFlowConfigWithPolicy({
        initialBalance: config.initialBalance,
        recurringPayments: config.recurringPayments,
      });

      setHasChanges(false);
      toast.success(t('settings.saved'));
      onSaved?.();
    } catch (err) {
      // Rollback on failure
      setConfig(snapshot);
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [config, t, onSaved]);

  const resetConfig = useCallback((newConfig: CashFlowConfig | null) => {
    setConfig(newConfig ?? { ...DEFAULT_CASH_FLOW_CONFIG });
    setHasChanges(false);
  }, []);

  return {
    config,
    saving,
    setInitialBalance,
    addRecurringPayment,
    updateRecurringPayment,
    removeRecurringPayment,
    saveConfig,
    resetConfig,
    hasChanges,
  };
}
