/**
 * =============================================================================
 * Sensitivity Engine — Tornado Analysis & 2-Variable Heat Map
 * =============================================================================
 *
 * Pure math functions for sensitivity analysis on NPV calculations.
 * No side effects, no Firestore, 100% testable.
 *
 * @module lib/sensitivity-engine
 * @enterprise ADR-242 SPEC-242A - Sensitivity Analysis
 */

import { calculateFullResult } from '@/lib/npv-engine';
import type {
  CostCalculationInput,
  SensitivityVariable,
  TornadoEntry,
  SensitivityResult,
  HeatMapCell,
  HeatMapResult,
  CashFlowEntry,
} from '@/types/interest-calculator';

// =============================================================================
// VARIABLE METADATA
// =============================================================================

interface VariableMeta {
  key: SensitivityVariable;
  label: string;
  getBase: (input: CostCalculationInput, rate: number) => number;
}

const VARIABLE_META: VariableMeta[] = [
  {
    key: 'discountRate',
    label: 'costCalculator.sensitivity.varDiscountRate',
    getBase: (_input, rate) => rate,
  },
  {
    key: 'bankSpread',
    label: 'costCalculator.sensitivity.varBankSpread',
    getBase: (input) => input.bankSpread,
  },
  {
    key: 'salePrice',
    label: 'costCalculator.sensitivity.varSalePrice',
    getBase: (input) => input.salePrice,
  },
  {
    key: 'upfrontPercent',
    label: 'costCalculator.sensitivity.varUpfrontPercent',
    getBase: (input) => {
      if (input.cashFlows.length === 0) return 0;
      const firstFlow = input.cashFlows[0];
      return input.salePrice > 0
        ? (firstFlow.amount / input.salePrice) * 100
        : 0;
    },
  },
  {
    key: 'paymentMonths',
    label: 'costCalculator.sensitivity.varPaymentMonths',
    getBase: (input) => {
      if (input.cashFlows.length <= 1) return 0;
      const refMs = new Date(input.referenceDate).getTime();
      const lastCf = input.cashFlows[input.cashFlows.length - 1];
      const lastMs = new Date(lastCf.date).getTime();
      return Math.round((lastMs - refMs) / (1000 * 60 * 60 * 24 * 30.44));
    },
  },
  {
    key: 'certaintyMix',
    label: 'costCalculator.sensitivity.varCertaintyMix',
    getBase: () => 1.0, // multiplier baseline
  },
];

// =============================================================================
// PERTURBATION HELPERS
// =============================================================================

/**
 * Apply a perturbation factor to a specific variable, returning modified input + rate.
 * factor: 1.0 = base, 0.8 = -20%, 1.2 = +20%.
 */
function applyVariablePerturbation(
  input: CostCalculationInput,
  rate: number,
  variable: SensitivityVariable,
  factor: number
): { perturbedInput: CostCalculationInput; perturbedRate: number } {
  const perturbedInput = structuredClone(input);
  let perturbedRate = rate;

  switch (variable) {
    case 'discountRate': {
      perturbedRate = rate * factor;
      break;
    }
    case 'bankSpread': {
      perturbedInput.bankSpread = input.bankSpread * factor;
      // Adjust effective rate to reflect spread change
      const spreadDelta = perturbedInput.bankSpread - input.bankSpread;
      perturbedRate = rate + spreadDelta;
      break;
    }
    case 'salePrice': {
      const priceRatio = factor;
      perturbedInput.salePrice = input.salePrice * priceRatio;
      // Scale all cash flows proportionally
      perturbedInput.cashFlows = input.cashFlows.map((cf) => ({
        ...cf,
        amount: cf.amount * priceRatio,
      }));
      break;
    }
    case 'upfrontPercent': {
      if (input.cashFlows.length < 2) break;
      const totalAmount = input.cashFlows.reduce((s, cf) => s + cf.amount, 0);
      const currentUpfront = input.cashFlows[0].amount;
      const currentPercent = totalAmount > 0 ? currentUpfront / totalAmount : 0;
      const newPercent = Math.min(Math.max(currentPercent * factor, 0), 1);
      const newUpfront = totalAmount * newPercent;
      const remaining = totalAmount - newUpfront;
      const laterFlows = input.cashFlows.slice(1);
      const laterTotal = laterFlows.reduce((s, cf) => s + cf.amount, 0);

      perturbedInput.cashFlows = [
        { ...input.cashFlows[0], amount: newUpfront },
        ...laterFlows.map((cf) => ({
          ...cf,
          amount: laterTotal > 0 ? (cf.amount / laterTotal) * remaining : remaining / laterFlows.length,
        })),
      ];
      break;
    }
    case 'paymentMonths': {
      if (input.cashFlows.length < 2) break;
      const refDate = new Date(input.referenceDate);
      const laterCashFlows = input.cashFlows.slice(1);
      const monthScale = factor;

      perturbedInput.cashFlows = [
        input.cashFlows[0], // keep upfront unchanged
        ...laterCashFlows.map((cf, i) => {
          const origMs = new Date(cf.date).getTime();
          const refMs = refDate.getTime();
          const origDays = (origMs - refMs) / (1000 * 60 * 60 * 24);
          const newDays = origDays * monthScale;
          const newDate = new Date(refMs + newDays * 1000 * 60 * 60 * 24);
          return {
            ...cf,
            date: newDate.toISOString().split('T')[0],
          };
        }),
      ];
      break;
    }
    case 'certaintyMix': {
      // Shift certainty multipliers — factor > 1 makes everything more uncertain
      const certaintyMap: Record<string, 'certain' | 'probable' | 'uncertain'> = {
        certain: factor > 1.1 ? 'probable' : 'certain',
        probable: factor > 1.1 ? 'uncertain' : factor < 0.9 ? 'certain' : 'probable',
        uncertain: factor < 0.9 ? 'probable' : 'uncertain',
      };
      perturbedInput.cashFlows = input.cashFlows.map((cf) => ({
        ...cf,
        certainty: certaintyMap[cf.certainty] ?? cf.certainty,
      }));
      break;
    }
  }

  return { perturbedInput, perturbedRate };
}

// =============================================================================
// TORNADO ANALYSIS
// =============================================================================

/**
 * Run tornado sensitivity analysis — perturb each variable ±perturbation%.
 *
 * @param input — Base cost calculation input
 * @param effectiveRate — Effective annual rate (%)
 * @param perturbation — Perturbation fraction (0.20 = ±20%)
 * @returns SensitivityResult with entries sorted by impact
 */
export function runTornadoAnalysis(
  input: CostCalculationInput,
  effectiveRate: number,
  perturbation = 0.20
): SensitivityResult {
  const baseResult = calculateFullResult(input, effectiveRate);
  const baseNPV = baseResult.npv;

  const entries: TornadoEntry[] = VARIABLE_META.map((meta) => {
    const baseValue = meta.getBase(input, effectiveRate);

    // Low perturbation (variable decreases)
    const { perturbedInput: lowInput, perturbedRate: lowRate } =
      applyVariablePerturbation(input, effectiveRate, meta.key, 1 - perturbation);
    const lowResult = calculateFullResult(lowInput, lowRate);

    // High perturbation (variable increases)
    const { perturbedInput: highInput, perturbedRate: highRate } =
      applyVariablePerturbation(input, effectiveRate, meta.key, 1 + perturbation);
    const highResult = calculateFullResult(highInput, highRate);

    return {
      variable: meta.key,
      label: meta.label,
      baseValue,
      lowNPV: lowResult.npv,
      highNPV: highResult.npv,
      swingWidth: Math.abs(highResult.npv - lowResult.npv),
    };
  });

  // Sort by impact (largest swing first)
  entries.sort((a, b) => b.swingWidth - a.swingWidth);

  return { baseNPV, entries };
}

// =============================================================================
// 2-VARIABLE HEAT MAP
// =============================================================================

/**
 * Build a 2-variable heat map grid showing NPV at each combination.
 *
 * @param input — Base cost calculation input
 * @param effectiveRate — Effective annual rate (%)
 * @param rowVar — Variable for rows
 * @param colVar — Variable for columns
 * @param steps — Number of steps in each dimension (default 5 → 5×5 grid)
 * @returns HeatMapResult with cells colored by NPV bucket
 */
export function buildHeatMap(
  input: CostCalculationInput,
  effectiveRate: number,
  rowVar: SensitivityVariable,
  colVar: SensitivityVariable,
  steps = 5
): HeatMapResult {
  const rowMeta = VARIABLE_META.find((m) => m.key === rowVar)!;
  const colMeta = VARIABLE_META.find((m) => m.key === colVar)!;

  const rowBase = rowMeta.getBase(input, effectiveRate);
  const colBase = colMeta.getBase(input, effectiveRate);

  // Generate perturbation factors: e.g. [0.8, 0.9, 1.0, 1.1, 1.2] for steps=5
  const factors: number[] = [];
  const half = Math.floor(steps / 2);
  for (let i = 0; i < steps; i++) {
    factors.push(1 + (i - half) * 0.1);
  }

  const rowValues = factors.map((f) => Math.round(rowBase * f * 100) / 100);
  const colValues = factors.map((f) => Math.round(colBase * f * 100) / 100);

  // Compute all NPVs
  const allNPVs: number[] = [];
  const rawCells: number[][] = [];

  for (let r = 0; r < steps; r++) {
    rawCells[r] = [];
    for (let c = 0; c < steps; c++) {
      // Apply row perturbation first, then column perturbation on top
      const { perturbedInput: rowPerturbed, perturbedRate: rowRate } =
        applyVariablePerturbation(input, effectiveRate, rowVar, factors[r]);
      const { perturbedInput: bothPerturbed, perturbedRate: bothRate } =
        applyVariablePerturbation(rowPerturbed, rowRate, colVar, factors[c]);

      const result = calculateFullResult(bothPerturbed, bothRate);
      rawCells[r][c] = result.npv;
      allNPVs.push(result.npv);
    }
  }

  const minNPV = Math.min(...allNPVs);
  const maxNPV = Math.max(...allNPVs);
  const range = maxNPV - minNPV || 1;

  // Assign color buckets 0-4 (0=best/highest NPV, 4=worst/lowest NPV)
  const cells: HeatMapCell[][] = rawCells.map((row, r) =>
    row.map((npv, c) => ({
      rowValue: rowValues[r],
      colValue: colValues[c],
      npv,
      bucket: Math.min(4, Math.floor(((maxNPV - npv) / range) * 4.99)),
    }))
  );

  return {
    rowVariable: rowVar,
    colVariable: colVar,
    rowValues,
    colValues,
    cells,
    minNPV,
    maxNPV,
  };
}
