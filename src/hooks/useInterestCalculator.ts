'use client';

/**
 * =============================================================================
 * useInterestCalculator — Hook for Interest Cost Calculator
 * =============================================================================
 *
 * Auto-fetches Euribor rates on mount. Provides calculate + compare actions.
 * Pattern: useChequeRegistry / useLoanTracking.
 *
 * @module hooks/useInterestCalculator
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import { useState, useCallback, useEffect } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  EuriborRatesCache,
  BankSpreadConfig,
  CostCalculationInput,
  CostCalculationResult,
  ScenarioComparison,
  CostCalculationRequest,
  EuriborRatesResponse,
  BankSpreadsResponse,
} from '@/types/interest-calculator';
import type { Installment } from '@/types/payment-plan';
import { getErrorMessage } from '@/lib/error-utils';
import {
  calculateInterestCostWithPolicy,
  refreshEuriborRatesWithPolicy,
  updateBankSpreadsWithPolicy,
} from '@/services/interest-calculator/interest-calculator-mutation-gateway';

// =============================================================================
// FETCH HELPER
// =============================================================================

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}

// =============================================================================
// RETURN TYPE
// =============================================================================

interface ActionResult {
  success: boolean;
  error?: string;
}

export interface UseInterestCalculatorReturn {
  rates: EuriborRatesCache | null;
  spreads: BankSpreadConfig | null;
  result: CostCalculationResult | null;
  comparison: ScenarioComparison | null;
  isLoading: boolean;
  error: string | null;
  fetchRates: () => Promise<void>;
  refreshRates: () => Promise<ActionResult>;
  calculate: (input: CostCalculationInput) => Promise<void>;
  compare: (salePrice: number, referenceDate: string, installments?: Installment[]) => Promise<void>;
  updateSpreads: (config: BankSpreadConfig) => Promise<ActionResult>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useInterestCalculator(): UseInterestCalculatorReturn {
  const [rates, setRates] = useState<EuriborRatesCache | null>(null);
  const [spreads, setSpreads] = useState<BankSpreadConfig | null>(null);
  const [result, setResult] = useState<CostCalculationResult | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch rates + spreads on mount ---
  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ratesRes, spreadsRes] = await Promise.all([
        fetchJson<EuriborRatesResponse>(API_ROUTES.EURIBOR.RATES),
        fetchJson<BankSpreadsResponse>(API_ROUTES.SETTINGS.BANK_SPREADS),
      ]);

      if (ratesRes.success && ratesRes.rates) {
        setRates(ratesRes.rates);
      }
      if (spreadsRes.success && spreadsRes.config) {
        setSpreads(spreadsRes.config);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch rates'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // --- Force refresh from ECB ---
  const refreshRates = useCallback(async (): Promise<ActionResult> => {
    try {
      const res = await refreshEuriborRatesWithPolicy();
      if (res.success && res.rates) {
        setRates(res.rates);
        return { success: true };
      }
      return { success: false, error: res.error ?? 'Refresh failed' };
    } catch (err) {
      const msg = getErrorMessage(err, 'Refresh failed');
      return { success: false, error: msg };
    }
  }, []);

  // --- Calculate NPV ---
  const calculate = useCallback(async (input: CostCalculationInput): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const body: CostCalculationRequest = { ...input, scenarios: false };
      const res = await calculateInterestCostWithPolicy(body);

      if (res.success && res.result) {
        setResult(res.result);
      } else {
        setError(res.error ?? 'Calculation failed');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Calculation failed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Compare scenarios ---
  const compare = useCallback(async (
    salePrice: number,
    referenceDate: string,
    installments?: Installment[]
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // Build cash flows from installments (if provided)
      const cashFlows = installments
        ? installments.map((inst) => ({
            label: inst.label,
            amount: inst.amount,
            date: inst.dueDate,
            certainty: 'certain' as const,
          }))
        : [{ label: 'Μετρητά', amount: salePrice, date: referenceDate, certainty: 'certain' as const }];

      const body: CostCalculationRequest = {
        salePrice,
        referenceDate,
        cashFlows,
        discountRateSource: spreads ? 'euribor_3M' : 'manual',
        manualDiscountRate: 5,
        bankSpread: spreads?.defaultSpread ?? 2.40,
        scenarios: true,
      };

      const res = await calculateInterestCostWithPolicy(body);

      if (res.success) {
        if (res.result) setResult(res.result);
        if (res.comparison) setComparison(res.comparison);
      } else {
        setError(res.error ?? 'Comparison failed');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Comparison failed'));
    } finally {
      setIsLoading(false);
    }
  }, [spreads]);

  // --- Update spreads ---
  const updateSpreads = useCallback(async (config: BankSpreadConfig): Promise<ActionResult> => {
    try {
      const res = await updateBankSpreadsWithPolicy(config);
      if (res.success && res.config) {
        setSpreads(res.config);
        return { success: true };
      }
      return { success: false, error: res.error ?? 'Update failed' };
    } catch (err) {
      const msg = getErrorMessage(err, 'Update failed');
      return { success: false, error: msg };
    }
  }, []);

  return {
    rates,
    spreads,
    result,
    comparison,
    isLoading,
    error,
    fetchRates,
    refreshRates,
    calculate,
    compare,
    updateSpreads,
  };
}
