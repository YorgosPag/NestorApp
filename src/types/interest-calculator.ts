/**
 * =============================================================================
 * Interest Cost Calculator Types — ADR-234 Phase 4 (SPEC-234E)
 * =============================================================================
 *
 * Types for NPV-based cost-of-money calculator. Helps builders price properties
 * correctly based on payment method (cash vs installments vs loan).
 *
 * @module types/interest-calculator
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator
 */

// =============================================================================
// 🏦 EURIBOR RATES
// =============================================================================

/** ECB Euribor tenor periods */
export type EuriborTenor = '1W' | '1M' | '3M' | '6M' | '12M';

/** Cached Euribor rates from ECB SDMX API */
export interface EuriborRatesCache {
  /** Euribor 1 Week (%) */
  euribor1W: number;
  /** Euribor 1 Month (%) */
  euribor1M: number;
  /** Euribor 3 Months (%) */
  euribor3M: number;
  /** Euribor 6 Months (%) */
  euribor6M: number;
  /** Euribor 12 Months (%) */
  euribor12M: number;
  /** ECB Main Refinancing Rate (%) */
  ecbMainRate: number;
  /** Date of the rates (ISO string) */
  rateDate: string;
  /** When rates were last fetched (ISO string) */
  lastFetchedAt: string;
  /** Data source identifier */
  source: 'ecb_api' | 'manual' | 'fallback';
}

// =============================================================================
// 🏦 BANK SPREADS
// =============================================================================

/** Single bank spread entry */
export interface BankSpreadEntry {
  /** Bank name (e.g. "Εθνική Τράπεζα") */
  bankName: string;
  /** Spread in percentage points (e.g. 2.40 = 2.40%) */
  spread: number;
}

/** Bank spread configuration — stored in Firestore settings/bank_spreads */
export interface BankSpreadConfig {
  /** Configured banks with their spreads */
  banks: BankSpreadEntry[];
  /** Default spread when bank not specified (%) */
  defaultSpread: number;
}

/** Default spreads for Greek banks (2026 market data) */
export const DEFAULT_BANK_SPREADS: BankSpreadConfig = {
  banks: [
    { bankName: 'Εθνική Τράπεζα', spread: 2.30 },
    { bankName: 'Τράπεζα Πειραιώς', spread: 2.50 },
    { bankName: 'Alpha Bank', spread: 2.40 },
    { bankName: 'Eurobank', spread: 2.45 },
  ],
  defaultSpread: 2.40,
};

// =============================================================================
// 📊 CALCULATION INPUT / OUTPUT
// =============================================================================

/** Source for discount rate */
export type DiscountRateSource =
  | 'euribor_1M'
  | 'euribor_3M'
  | 'euribor_6M'
  | 'euribor_12M'
  | 'ecb_main'
  | 'manual';

/** Certainty level of a cash flow */
export type CashFlowCertainty = 'certain' | 'probable' | 'uncertain';

/**
 * Risk multipliers for cash flow certainty.
 * Uncertain payments get discounted more aggressively.
 */
export const CERTAINTY_MULTIPLIERS: Record<CashFlowCertainty, number> = {
  certain: 1.0,
  probable: 1.1,
  uncertain: 1.3,
} as const;

/** Single cash flow entry */
export interface CashFlowEntry {
  /** Display label (e.g. "Κράτηση", "Δόση 3") */
  label: string;
  /** Amount in euros */
  amount: number;
  /** Expected payment date (ISO string) */
  date: string;
  /** Certainty level — affects discount factor */
  certainty: CashFlowCertainty;
}

/** Input for cost calculation */
export interface CostCalculationInput {
  /** Nominal sale price (€) */
  salePrice: number;
  /** Reference date for NPV (usually today or contract date, ISO string) */
  referenceDate: string;
  /** Cash flow entries */
  cashFlows: CashFlowEntry[];
  /** Source for discount rate */
  discountRateSource: DiscountRateSource;
  /** Manual discount rate (%) — used only when source = 'manual' */
  manualDiscountRate?: number;
  /** Bank spread to add on top of Euribor (%) */
  bankSpread: number;
}

/** Analysis of a single cash flow entry */
export interface CashFlowAnalysisEntry extends CashFlowEntry {
  /** Days from reference date */
  daysDelta: number;
  /** Discount factor (0-1) */
  discountFactor: number;
  /** Present value (€) */
  presentValue: number;
}

/** Full result of cost calculation */
export interface CostCalculationResult {
  /** Net Present Value (€) */
  npv: number;
  /** NPV as percentage of sale price */
  npvPercentage: number;
  /** Time cost = salePrice - NPV (€) */
  timeCost: number;
  /** Time cost as percentage of sale price */
  timeCostPercentage: number;
  /** Recommended minimum price to compensate for time cost (€) */
  recommendedPrice: number;
  /** Price adjustment = recommendedPrice - salePrice (€) */
  priceAdjustment: number;
  /** Price adjustment as percentage */
  priceAdjustmentPercentage: number;
  /** Weighted Average Collection Period in days */
  weightedAverageDays: number;
  /** Effective annual discount rate used (%) */
  effectiveRate: number;
  /** Per-installment breakdown */
  cashFlowAnalysis: CashFlowAnalysisEntry[];
}

// =============================================================================
// 📊 SCENARIOS
// =============================================================================

/** Named scenario result */
export interface ScenarioResult {
  /** Scenario name (e.g. "Μετρητά", "Off-Plan") */
  name: string;
  /** Description */
  description: string;
  /** Calculated result */
  result: CostCalculationResult;
}

/** Comparison of multiple scenarios */
export interface ScenarioComparison {
  /** Effective discount rate used (%) */
  discountRate: number;
  /** Reference date (ISO string) */
  referenceDate: string;
  /** Scenario results */
  scenarios: ScenarioResult[];
  /** Index of best scenario (highest NPV) */
  bestScenarioIndex: number;
}

// =============================================================================
// 🔄 API TYPES
// =============================================================================

/** POST /api/calculator/cost request body */
export interface CostCalculationRequest extends CostCalculationInput {
  /** If true, also return scenario comparison */
  scenarios?: boolean;
}

/** POST /api/calculator/cost response body */
export interface CostCalculationResponse {
  success: boolean;
  result?: CostCalculationResult;
  comparison?: ScenarioComparison;
  error?: string;
}

/** GET /api/euribor/rates response */
export interface EuriborRatesResponse {
  success: boolean;
  rates?: EuriborRatesCache;
  error?: string;
}

/** PUT /api/settings/bank-spreads response */
export interface BankSpreadsResponse {
  success: boolean;
  config?: BankSpreadConfig;
  error?: string;
}
