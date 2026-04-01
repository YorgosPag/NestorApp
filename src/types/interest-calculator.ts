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
  /** Scenario name — i18n key (e.g. "costCalculator.scenarios.cashName") */
  name: string;
  /** Description — i18n key */
  description: string;
  /** Optional interpolation params for description (e.g. { count: "5" }) */
  descriptionParams?: Record<string, string>;
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

// =============================================================================
// 📊 SENSITIVITY ANALYSIS (SPEC-242A)
// =============================================================================

/** Variables available for sensitivity perturbation */
export type SensitivityVariable =
  | 'discountRate'
  | 'bankSpread'
  | 'salePrice'
  | 'upfrontPercent'
  | 'paymentMonths'
  | 'certaintyMix';

/** Single tornado bar entry — one variable's impact on NPV */
export interface TornadoEntry {
  /** Variable key */
  variable: SensitivityVariable;
  /** Human-readable label (i18n key) */
  label: string;
  /** Base value of the variable */
  baseValue: number;
  /** NPV when variable is at its low extreme */
  lowNPV: number;
  /** NPV when variable is at its high extreme */
  highNPV: number;
  /** Total swing width |highNPV - lowNPV| */
  swingWidth: number;
}

/** Result of tornado sensitivity analysis */
export interface SensitivityResult {
  /** NPV at base-case values */
  baseNPV: number;
  /** Entries sorted by swingWidth descending (most impactful first) */
  entries: TornadoEntry[];
}

/** Single cell in 2-variable heat map */
export interface HeatMapCell {
  /** Row variable value */
  rowValue: number;
  /** Column variable value */
  colValue: number;
  /** Calculated NPV */
  npv: number;
  /** Color intensity bucket 0-4 (0=best/green, 4=worst/red) */
  bucket: number;
}

/** Result of 2-variable heat map */
export interface HeatMapResult {
  /** Row variable key */
  rowVariable: SensitivityVariable;
  /** Column variable key */
  colVariable: SensitivityVariable;
  /** Row header values */
  rowValues: number[];
  /** Column header values */
  colValues: number[];
  /** 2D grid of cells [row][col] */
  cells: HeatMapCell[][];
  /** Min NPV in grid */
  minNPV: number;
  /** Max NPV in grid */
  maxNPV: number;
}

// =============================================================================
// 🛡️ DSCR STRESS TESTING (SPEC-242A)
// =============================================================================

/** Input for Debt Service Coverage Ratio calculation */
export interface DSCRInput {
  /** Annual Net Operating Income (€) */
  annualNOI: number;
  /** Total loan amount (€) */
  loanAmount: number;
  /** Annual interest rate (%, e.g. 5.0 for 5%) */
  annualRate: number;
  /** Loan term in years */
  loanTermYears: number;
}

/** Result of single DSCR calculation */
export interface DSCRResult {
  /** DSCR ratio (NOI / annual debt service) */
  dscr: number;
  /** Annual debt service = 12 × monthly payment */
  annualDebtService: number;
  /** Monthly mortgage payment */
  monthlyPayment: number;
  /** Status classification */
  status: 'safe' | 'adequate' | 'warning' | 'danger';
}

/** Single row in rate stress test */
export interface StressTestRow {
  /** Rate shock in basis points */
  shockBps: number;
  /** Stressed rate (%) */
  stressedRate: number;
  /** DSCR at stressed rate */
  dscr: number;
  /** Status at stressed rate */
  status: 'safe' | 'adequate' | 'warning' | 'danger';
}

/** Full stress test result */
export interface StressTestResult {
  /** Base case result */
  baseResult: DSCRResult;
  /** Stress test rows */
  rows: StressTestRow[];
  /** Maximum rate (%) that still maintains DSCR ≥ 1.0 */
  maxRateForDSCR1: number;
}

// =============================================================================
// 🏗️ CONSTRUCTION LOAN DRAW SCHEDULE (SPEC-242B)
// =============================================================================

/** Construction draw phase type — stages of a typical build */
export type DrawPhaseType =
  | 'land_acquisition'
  | 'permits'
  | 'foundation'
  | 'structure'
  | 'masonry'
  | 'mechanical'
  | 'finishes'
  | 'landscaping'
  | 'custom';

/** Single draw event in the construction loan schedule */
export interface DrawScheduleEntry {
  /** Construction phase identifier */
  phase: DrawPhaseType;
  /** Human-readable label (e.g. "Foundation Pour") */
  label: string;
  /** Amount drawn (€) */
  drawAmount: number;
  /** Date of draw (ISO string) */
  drawDate: string;
  /** Cumulative completion percentage at this draw (0-100) */
  completionPercent: number;
}

/** Interest accrual method */
export type InterestAccrualMethod = 'simple' | 'compound';

/** Construction loan terms */
export interface LoanTerms {
  /** Total loan commitment (€) — max amount available */
  totalCommitment: number;
  /** Annual interest rate (%, e.g. 5.0 for 5%) */
  annualRate: number;
  /** Interest reserve set aside at closing (€) */
  interestReserve: number;
  /** Loan maturity date (ISO string) */
  maturityDate: string;
  /** Origination fee (%, e.g. 1.0 for 1%) */
  originationFee: number;
  /** Interest accrual method */
  interestAccrual: InterestAccrualMethod;
  /** Loan closing date (ISO string) — start of interest clock */
  closingDate: string;
}

/** Monthly period analysis for draw schedule */
export interface DrawPeriodAnalysis {
  /** Month index (0-based from closing) */
  month: number;
  /** Period date (ISO string, 1st of month) */
  date: string;
  /** Cumulative amount drawn at end of period (€) */
  cumulativeDrawn: number;
  /** Interest accrued in this period (€) */
  periodInterest: number;
  /** Cumulative interest accrued (€) */
  cumulativeInterest: number;
  /** Remaining interest reserve balance (€) */
  reserveBalance: number;
  /** Draw event that occurred in this period, if any */
  drawEvent: DrawScheduleEntry | null;
}

/** Interest reserve depletion status */
export interface InterestReserveStatus {
  /** Initial reserve amount (€) */
  initialReserve: number;
  /** Final reserve balance (€) — negative means shortfall */
  finalBalance: number;
  /** Whether reserve is sufficient for full term */
  sufficient: boolean;
  /** Month index when reserve is exhausted (null if sufficient) */
  exhaustionMonth: number | null;
  /** Date when reserve is exhausted (null if sufficient) */
  exhaustionDate: string | null;
  /** Cash shortfall if reserve insufficient (€, 0 if sufficient) */
  cashShortfall: number;
}

/** Full draw schedule analysis result */
export interface DrawScheduleResult {
  /** Monthly period breakdown */
  periods: DrawPeriodAnalysis[];
  /** Total interest over loan term (€) */
  totalInterest: number;
  /** Total amount drawn (€) */
  totalDrawn: number;
  /** Interest reserve depletion analysis */
  reserveStatus: InterestReserveStatus;
  /** Total cost of capital = interest + origination fee (€) */
  totalCostOfCapital: number;
  /** Cost of capital as % of total commitment */
  costOfCapitalPercent: number;
  /** Origination fee in euros (€) */
  originationFeeAmount: number;
  /** Weighted average outstanding balance (€) */
  weightedAverageBalance: number;
}

// =============================================================================
// 📊 SPEC-242C — Portfolio Dashboard & Debt Maturity Wall
// =============================================================================

/** Health status traffic-light for project financial health */
export type HealthStatus = 'excellent' | 'good' | 'warning' | 'critical';

/** Portfolio-level aggregate summary across all projects */
export interface PortfolioSummary {
  /** Number of active projects */
  activeProjects: number;
  /** Total properties across all projects */
  totalProperties: number;
  /** Total sold properties across all projects */
  soldProperties: number;
  /** Total portfolio value (€) — sum of all unit sale prices */
  totalPortfolioValue: number;
  /** Total collected amount (€) */
  totalCollected: number;
  /** Total outstanding amount (€) */
  totalOutstanding: number;
  /** Weighted average cost of money across portfolio (%) */
  weightedAvgCostOfMoney: number;
  /** Weighted average collection period (days) */
  weightedAvgCollectionDays: number;
  /** Total NPV across all units (€) */
  totalNPV: number;
  /** Total time cost across portfolio (€) */
  totalTimeCost: number;
  /** ISO timestamp when this summary was calculated */
  calculatedAt: string;
}

/** Per-project financial summary for portfolio table */
export interface ProjectFinancialSummary {
  /** Project document ID */
  projectId: string;
  /** Project display name */
  projectName: string;
  /** Total properties in project */
  totalProperties: number;
  /** Sold properties in project */
  soldProperties: number;
  /** Total value of all units (€) */
  totalValue: number;
  /** Total collected (€) */
  collected: number;
  /** Effective cost of money (%) */
  costOfMoney: number;
  /** Average collection period (days) */
  avgCollectionDays: number;
  /** Overall health status (worst of 3 metrics) */
  healthStatus: HealthStatus;
}

/** Loan type for debt maturity wall */
export type LoanType = 'construction' | 'mortgage' | 'bridge' | 'mezzanine';

/** Single debt entry in the maturity wall */
export interface DebtMaturityEntry {
  /** Unique loan ID (dmt_ prefix) */
  loanId: string;
  /** Associated project name */
  projectName: string;
  /** Type of loan */
  loanType: LoanType;
  /** Outstanding balance (€) */
  outstandingBalance: number;
  /** Current interest rate (%) */
  currentRate: number;
  /** Maturity date (ISO string) */
  maturityDate: string;
  /** Months remaining to maturity */
  monthsToMaturity: number;
  /** Estimated refinancing rate (%) */
  estimatedRefiRate: number;
  /** Loan-to-value at maturity (%) */
  ltvAtMaturity: number;
  /** Current DSCR ratio */
  currentDSCR: number;
  /** Risk level based on proximity and metrics */
  riskLevel: HealthStatus;
}

/** Aggregated year view for stacked bar chart */
export interface MaturityWallYear {
  /** Calendar year */
  year: number;
  /** Total maturing amount (€) */
  totalMaturing: number;
  /** Individual entries maturing in this year */
  entries: DebtMaturityEntry[];
  /** Average refinancing gap in basis points */
  avgRefiGapBps: number;
}

/** Budget vs actual variance trend */
export type VarianceTrend = 'improving' | 'stable' | 'worsening';

/** Single budget variance line item */
export interface BudgetVarianceEntry {
  /** Display label (e.g. "Land Acquisition") */
  category: string;
  /** Machine-readable key */
  categoryKey: string;
  /** Budgeted amount (€) */
  budgetAmount: number;
  /** Actual spend (€) */
  actualAmount: number;
  /** Variance (€) = actual − budget (positive = over budget) */
  variance: number;
  /** Variance as percentage */
  variancePercent: number;
  /** Trend direction */
  trend: VarianceTrend;
}

/** Full budget variance analysis for a project */
export interface BudgetVarianceAnalysis {
  /** Project document ID */
  projectId: string;
  /** Project display name */
  projectName: string;
  /** Total budgeted (€) */
  totalBudget: number;
  /** Total actual spend (€) */
  totalActual: number;
  /** Total variance (€) */
  totalVariance: number;
  /** Total variance (%) */
  totalVariancePercent: number;
  /** Individual category breakdowns */
  categories: BudgetVarianceEntry[];
  /** Top 3 categories by absolute variance */
  topVariances: BudgetVarianceEntry[];
}

// =============================================================================
// 🎲 SPEC-242D — Monte Carlo Simulation
// =============================================================================

/** Distribution type for Monte Carlo variable sampling */
export type MonteCarloDistribution = 'normal' | 'triangular' | 'uniform';

/** Configuration for a single Monte Carlo variable */
export interface MonteCarloVariable {
  /** Variable key (must match SensitivityVariable) */
  key: SensitivityVariable;
  /** Whether this variable is enabled for simulation */
  enabled: boolean;
  /** Distribution type */
  distribution: MonteCarloDistribution;
  /** Mean or base value */
  mean: number;
  /** Standard deviation (for normal dist) or half-range */
  stdDev: number;
  /** Minimum value (for triangular/uniform) */
  min: number;
  /** Maximum value (for triangular/uniform) */
  max: number;
}

/** Monte Carlo simulation configuration */
export interface MonteCarloConfig {
  /** Number of simulation scenarios */
  scenarioCount: number;
  /** Random seed for reproducibility */
  seed: number;
  /** Variables to perturb */
  variables: MonteCarloVariable[];
}

/** Single bin in NPV histogram */
export interface HistogramBin {
  /** Lower edge of bin (€) */
  binStart: number;
  /** Upper edge of bin (€) */
  binEnd: number;
  /** Midpoint label */
  midpoint: number;
  /** Number of scenarios in this bin */
  count: number;
  /** Frequency (count / total) */
  frequency: number;
  /** Cumulative frequency (CDF) */
  cumulativeFrequency: number;
}

/** Single point in fan chart (percentile bands over time) */
export interface FanChartPoint {
  /** Month index from reference date */
  month: number;
  /** P10 cumulative cash flow */
  p10: number;
  /** P25 cumulative cash flow */
  p25: number;
  /** P50 (median) cumulative cash flow */
  p50: number;
  /** P75 cumulative cash flow */
  p75: number;
  /** P90 cumulative cash flow */
  p90: number;
}

/** Full Monte Carlo simulation result */
export interface MonteCarloResult {
  /** Number of scenarios run */
  scenarioCount: number;
  /** Mean NPV across all scenarios (€) */
  meanNPV: number;
  /** Standard deviation of NPV */
  stdDevNPV: number;
  /** Percentile NPV values */
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** Min/Max NPV observed */
  minNPV: number;
  maxNPV: number;
  /** Probability that NPV > salePrice (%) */
  probAboveSalePrice: number;
  /** Probability that NPV > 0 (%) */
  probPositive: number;
  /** Histogram bins for NPV distribution */
  histogram: HistogramBin[];
  /** Fan chart data points */
  fanChart: FanChartPoint[];
  /** Execution time in ms */
  executionTimeMs: number;
}

// =============================================================================
// 💰 SPEC-242D — Equity Waterfall Distribution
// =============================================================================

/** Single tier in equity waterfall */
export interface WaterfallTier {
  /** Tier name (e.g. "Return of Capital", "8% Preferred") */
  name: string;
  /** Hurdle rate for this tier (%, 0 for return of capital) */
  hurdleRate: number;
  /** LP share in this tier (0-1) */
  lpShare: number;
  /** GP share in this tier (0-1) */
  gpShare: number;
}

/** Input for waterfall calculation */
export interface WaterfallInput {
  /** Total equity invested by LP (€) */
  lpEquity: number;
  /** Total equity invested by GP (€) */
  gpEquity: number;
  /** Total distributable proceeds (€) */
  totalProceeds: number;
  /** Project duration in years (for IRR) */
  projectYears: number;
  /** Waterfall tiers (ordered) */
  tiers: WaterfallTier[];
  /** Whether LP gets capital back first (true) or pari-passu (false) */
  lpFirstReturn: boolean;
}

/** Result for a single waterfall tier */
export interface WaterfallTierResult {
  /** Tier name */
  name: string;
  /** Amount distributed to LP in this tier (€) */
  lpAmount: number;
  /** Amount distributed to GP in this tier (€) */
  gpAmount: number;
  /** Total distributed in this tier */
  totalAmount: number;
}

/** Full waterfall distribution result */
export interface WaterfallResult {
  /** Per-tier breakdown */
  tiers: WaterfallTierResult[];
  /** Total distributed to LP (€) */
  totalLP: number;
  /** Total distributed to GP (€) */
  totalGP: number;
  /** LP multiple on invested capital */
  lpMultiple: number;
  /** GP multiple on invested capital */
  gpMultiple: number;
  /** LP IRR approximation (%) */
  lpIRR: number;
  /** GP IRR approximation (%) */
  gpIRR: number;
  /** Undistributed remainder (should be 0) */
  remainder: number;
}

// =============================================================================
// 🤝 COUNTERPROPOSAL ANALYSIS (SPEC-234F)
// =============================================================================

/** Single counterproposal scenario */
export interface CounterproposalScenario {
  /** i18n key for scenario name */
  nameKey: string;
  /** i18n key for scenario description */
  descriptionKey: string;
  /** Upfront payment as % of sale price (0-100) */
  upfrontPercent: number;
  /** Months for remaining balance (0 = lump sum) */
  remainingMonths: number;
  /** Net Present Value (€) */
  npv: number;
  /** Time cost = salePrice - NPV (€) */
  timeCost: number;
  /** Time cost saved vs baseline (€) */
  timeCostSaved: number;
  /** Maximum discount the builder could offer (= timeCostSaved) (€) */
  maxDiscount: number;
  /** Maximum discount as % of sale price */
  maxDiscountPercent: number;
  /** Suggested discount = maxDiscount × (1 - builderRetainRatio) (€) */
  suggestedDiscount: number;
  /** Suggested discount as % of sale price */
  suggestedDiscountPercent: number;
  /** Final discounted price (€) */
  finalPrice: number;
  /** Builder's net gain = timeCostSaved - suggestedDiscount (€) */
  builderNetGain: number;
  /** Builder's net gain as % of sale price */
  builderNetGainPercent: number;
  /** Weighted average days to payment */
  weightedAvgDays: number;
}

/** Full counterproposal analysis result */
export interface CounterproposalResult {
  /** Baseline scenario (current installment plan) */
  baseline: CounterproposalScenario;
  /** Alternative faster-payment scenarios */
  alternatives: CounterproposalScenario[];
  /** Index into alternatives of the "sweet spot" recommendation */
  sweetSpotIndex: number;
  /** Fraction of savings the builder retains (0-1) */
  builderRetainRatio: number;
}

/** Slider input for interactive counterproposal mode */
export interface CounterproposalSliderInput {
  /** Upfront payment percentage (0-100) */
  upfrontPercent: number;
  /** Remaining payment months (0 = lump sum) */
  remainingMonths: number;
}

// =============================================================================
// 📈 SPEC-242E: FORWARD CURVES
// =============================================================================

/** A single spot rate point on the yield curve */
export interface SpotRatePoint {
  /** Tenor label (e.g. '1W', '1M', '3M', '6M', '12M') */
  tenor: EuriborTenor;
  /** Tenor in years (e.g. 1/52, 1/12, 0.25, 0.5, 1.0) */
  tenorYears: number;
  /** Spot rate (%) */
  rate: number;
}

/** A derived forward rate between two tenors */
export interface ForwardRatePoint {
  /** Starting tenor label (e.g. '1M') */
  fromTenor: EuriborTenor;
  /** Ending tenor label (e.g. '3M') */
  toTenor: EuriborTenor;
  /** Forward period label (e.g. '1M→3M') */
  label: string;
  /** Forward rate (%) */
  rate: number;
  /** Period start in years */
  fromYears: number;
  /** Period end in years */
  toYears: number;
}

/** Classification of yield curve shape */
export type CurveShape = 'normal' | 'inverted' | 'flat' | 'humped';

/** Complete forward curve analysis result */
export interface ForwardCurveResult {
  /** Spot rates extracted from ECB data */
  spotRates: SpotRatePoint[];
  /** Derived forward rates */
  forwardRates: ForwardRatePoint[];
  /** Detected curve shape */
  curveShape: CurveShape;
  /** Rate date from ECB */
  rateDate: string;
  /** Source identifier */
  source: string;
}

// =============================================================================
// 🛡️ SPEC-242E: HEDGING STRATEGIES
// =============================================================================

/** Available hedging strategy types */
export type HedgingStrategy = 'floating' | 'swap' | 'cap' | 'collar';

/** Input parameters for hedging comparison */
export interface HedgingInput {
  /** Outstanding loan notional (€) */
  notional: number;
  /** Loan term in years */
  termYears: number;
  /** Current floating rate (%) */
  currentFloatingRate: number;
  /** Fixed swap rate (%) */
  swapRate: number;
  /** Cap strike rate (%) */
  capStrike: number;
  /** Cap annual premium (€) */
  capPremium: number;
  /** Collar cap rate (%) */
  collarCap: number;
  /** Collar floor rate (%) */
  collarFloor: number;
  /** Collar annual premium (€) */
  collarPremium: number;
  /** Rate scenario per year (%) — length = termYears */
  rateScenario: number[];
}

/** Annual cost breakdown for one strategy */
export interface HedgingAnnualEntry {
  /** Year number (1-based) */
  year: number;
  /** Rate applied this year (%) */
  effectiveRate: number;
  /** Interest cost this year (€) */
  interestCost: number;
  /** Premium cost this year (€) */
  premiumCost: number;
  /** Total cost this year (€) */
  totalCost: number;
}

/** Result for a single hedging strategy */
export interface HedgingStrategyResult {
  /** Strategy type */
  strategy: HedgingStrategy;
  /** Per-year breakdown */
  annualBreakdown: HedgingAnnualEntry[];
  /** Total cost over loan term (€) */
  totalCost: number;
  /** Average annual cost (€) */
  averageAnnualCost: number;
  /** Effective average rate (%) */
  effectiveAverageRate: number;
}

/** Comparison result of all hedging strategies */
export interface HedgingComparisonResult {
  /** All strategy results */
  strategies: HedgingStrategyResult[];
  /** Index of cheapest strategy in strategies array */
  cheapestIndex: number;
  /** Break-even rate: where swap cost equals floating cost (%) */
  breakEvenRate: number;
  /** Input parameters used */
  input: HedgingInput;
}
