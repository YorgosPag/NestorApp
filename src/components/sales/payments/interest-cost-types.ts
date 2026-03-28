/**
 * interest-cost-types.ts — Shared types for InterestCostDialog and its sub-components
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import type { Installment } from '@/types/payment-plan';
import type {
  EuriborRatesCache,
  BankSpreadConfig,
  CostCalculationResult,
  ScenarioComparison,
  DiscountRateSource,
  CashFlowAnalysisEntry,
} from '@/types/interest-calculator';

// =============================================================================
// DIALOG PROPS
// =============================================================================

export interface InterestCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  salePrice: number;
  installments?: Installment[];
  rates: EuriborRatesCache | null;
  spreads: BankSpreadConfig | null;
  result: CostCalculationResult | null;
  comparison: ScenarioComparison | null;
  isLoading: boolean;
  onRefreshRates: () => Promise<{ success: boolean; error?: string }>;
  onCompare: (salePrice: number, referenceDate: string, installments?: Installment[]) => Promise<void>;
  onUpdateSpreads: (config: BankSpreadConfig) => Promise<{ success: boolean; error?: string }>;
}

// =============================================================================
// TRANSLATION FUNCTION TYPE
// =============================================================================

export type TranslationFn = (key: string, opts?: Record<string, string>) => string;

// =============================================================================
// TAB PROPS
// =============================================================================

export interface CashFlowTabProps {
  analysis: CashFlowAnalysisEntry[];
  salePrice: number;
  t: TranslationFn;
}

export interface ScenarioTabProps {
  comparison: ScenarioComparison;
  t: TranslationFn;
}

export interface PricingTabProps {
  result: CostCalculationResult;
  salePrice: number;
  t: TranslationFn;
}

export interface SettingsTabProps {
  rates: EuriborRatesCache | null;
  spreads: BankSpreadConfig | null;
  isLoading: boolean;
  onRefreshRates: () => Promise<{ success: boolean; error?: string }>;
  onUpdateSpreads: (config: BankSpreadConfig) => Promise<{ success: boolean; error?: string }>;
  onDiscountSourceChange: (source: DiscountRateSource) => void;
  discountSource: DiscountRateSource;
  manualRate: number;
  onManualRateChange: (rate: number) => void;
  t: TranslationFn;
}

// =============================================================================
// HELPER COMPONENT PROPS
// =============================================================================

export interface LossBarChartProps {
  analysis: CashFlowAnalysisEntry[];
  t: TranslationFn;
}

export interface BankComparisonSectionProps {
  salePrice: number;
  npv: number;
  weightedDays: number;
  discountRate: number;
  t: TranslationFn;
}

export interface WhatIfTabProps {
  salePrice: number;
  currentResult: CostCalculationResult | null;
  discountRate: number;
  t: TranslationFn;
}

export interface LossAlertBannerProps {
  lossPercent: number;
  threshold: number;
  t: TranslationFn;
}
