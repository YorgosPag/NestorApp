/* eslint-disable custom/no-hardcoded-strings */

/**
 * Monte Carlo Helpers — Types, constants, variable utilities, and helper functions
 *
 * Pure functions and type definitions extracted from MonteCarloTab
 * for the Monte Carlo NPV simulation feature.
 *
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 * @module monte-carlo-helpers
 */

import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import type {
  CostCalculationInput,
  MonteCarloDistribution,
  MonteCarloVariable,
  MonteCarloResult,
  SensitivityVariable,
} from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

export interface MonteCarloTabProps {
  input: CostCalculationInput;
  effectiveRate: number;
  result: import('@/types/interest-calculator').CostCalculationResult;
  t: (key: string, opts?: Record<string, string>) => string;
}

/** Metric keys that map to help panel dynamic explanations */
export type HelpMetricKey = 'meanNpv' | 'p10' | 'p50' | 'p90' | 'stdDev' | 'minMax' | 'probPositive' | 'executionTime';

/** Hovered item — either a result metric or a config variable field */
export type HoveredItem =
  | { source: 'metric'; key: HelpMetricKey }
  | { source: 'config'; variable: SensitivityVariable; field: 'main' | 'stdDev' | 'min' | 'max'; value: string };

export type RiskLevel = 'low' | 'medium' | 'high';

// =============================================================================
// VARIABLE DEFINITIONS
// =============================================================================

export const VARIABLE_KEYS: SensitivityVariable[] = [
  'discountRate',
  'bankSpread',
  'salePrice',
  'upfrontPercent',
  'paymentMonths',
  'certaintyMix',
];

export function getVariableLabel(key: SensitivityVariable, t: MonteCarloTabProps['t']): string {
  const labels: Record<SensitivityVariable, string> = {
    discountRate: 'costCalculator.sensitivity.varDiscountRate',
    bankSpread: 'costCalculator.sensitivity.varBankSpread',
    salePrice: 'costCalculator.sensitivity.varSalePrice',
    upfrontPercent: 'costCalculator.sensitivity.varUpfrontPercent',
    paymentMonths: 'costCalculator.sensitivity.varPaymentMonths',
    certaintyMix: 'costCalculator.sensitivity.varCertaintyMix',
  };
  return t(labels[key]);
}

export function getBaseValue(key: SensitivityVariable, input: CostCalculationInput, rate: number): number {
  switch (key) {
    case 'discountRate': return rate;
    case 'bankSpread': return input.bankSpread;
    case 'salePrice': return input.salePrice;
    case 'upfrontPercent': {
      if (input.cashFlows.length === 0 || input.salePrice === 0) return 0;
      return (input.cashFlows[0].amount / input.salePrice) * 100;
    }
    case 'paymentMonths': {
      if (input.cashFlows.length <= 1) return 0;
      const refMs = new Date(input.referenceDate).getTime();
      const lastCf = input.cashFlows[input.cashFlows.length - 1];
      const lastMs = new Date(lastCf.date).getTime();
      return Math.round((lastMs - refMs) / (1000 * 60 * 60 * 24 * 30.44));
    }
    case 'certaintyMix': return 1.0;
  }
}

export function createDefaultVariables(input: CostCalculationInput, rate: number): MonteCarloVariable[] {
  return VARIABLE_KEYS.map(key => {
    const base = getBaseValue(key, input, rate);
    const spread = base * 0.2; // +/-20%
    return {
      key,
      enabled: key === 'discountRate' || key === 'salePrice',
      distribution: 'normal' as MonteCarloDistribution,
      mean: base,
      stdDev: spread > 0 ? spread : 1,
      min: base - spread,
      max: base + spread,
    };
  });
}

// =============================================================================
// RISK ASSESSMENT
// =============================================================================

export function assessRisk(mcResult: MonteCarloResult): RiskLevel {
  if (mcResult.p10 > 0 && mcResult.probPositive >= 90) return 'low';
  if (mcResult.meanNPV > 0 && mcResult.probPositive >= 70) return 'medium';
  return 'high';
}

// eslint-disable-next-line design-system/enforce-semantic-colors -- risk-level colors need exact shades for visual hierarchy
export const RISK_ICONS: Record<RiskLevel, React.ReactNode> = {
  low: React.createElement(ShieldCheck, { className: 'h-4 w-4 text-[hsl(var(--text-success))]' }),
  medium: React.createElement(AlertTriangle, { className: 'h-4 w-4 text-[hsl(var(--text-warning))]' }),
  high: React.createElement(ShieldAlert, { className: 'h-4 w-4 text-[hsl(var(--text-error))]' }),
};

// eslint-disable-next-line design-system/enforce-semantic-colors -- risk-level borders need exact shades
export const RISK_BORDER: Record<RiskLevel, string> = {
  low: 'border-[hsl(var(--border-success))] bg-[hsl(var(--bg-success))]/50',
  medium: 'border-[hsl(var(--border-warning))] bg-[hsl(var(--bg-warning))]/50',
  high: 'border-[hsl(var(--border-error))] bg-[hsl(var(--bg-error))]/50',
};

export const RISK_I18N: Record<RiskLevel, string> = {
  low: 'recommendationLowRisk',
  medium: 'recommendationMediumRisk',
  high: 'recommendationHighRisk',
};

// =============================================================================
// I18N MAPS
// =============================================================================

/** Map metric keys to i18n dynamic explanation keys */
export const METRIC_I18N_MAP: Record<HelpMetricKey, string> = {
  meanNpv: 'dynamicMeanNpv',
  p10: 'dynamicP10',
  p50: 'dynamicP50',
  p90: 'dynamicP90',
  stdDev: 'dynamicStdDev',
  minMax: 'dynamicMinMax',
  probPositive: 'dynamicProbPositive',
  executionTime: 'dynamicExecutionTime',
};

/** Map metric keys to display label keys */
export const METRIC_LABEL_MAP: Record<HelpMetricKey, string> = {
  meanNpv: 'meanNpv',
  p10: 'p10',
  p50: 'p50',
  p90: 'p90',
  stdDev: 'stdDevNpv',
  minMax: 'minMax',
  probPositive: 'probPositive',
  executionTime: 'executionTime',
};

/** Config variable i18n key mapping */
export const CONFIG_I18N_MAP: Record<SensitivityVariable, string> = {
  discountRate: 'configDiscountRate',
  bankSpread: 'configBankSpread',
  salePrice: 'configSalePrice',
  upfrontPercent: 'configUpfrontPercent',
  paymentMonths: 'configPaymentMonths',
  certaintyMix: 'configCertaintyMix',
};

export const CONFIG_FIELD_I18N: Record<string, string> = {
  stdDev: 'configStdDev',
  min: 'configMin',
  max: 'configMax',
};
