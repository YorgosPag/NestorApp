/**
 * =============================================================================
 * Monte Carlo Simulation Engine — SPEC-242D
 * =============================================================================
 *
 * Pure math engine for Monte Carlo NPV simulation.
 * Uses seeded PRNG (Mulberry32) for reproducibility.
 * Supports Normal, Triangular, and Uniform distributions.
 *
 * @module lib/monte-carlo-engine
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 */

import { calculateFullResult } from '@/lib/npv-engine';
import { applyVariablePerturbation } from '@/lib/sensitivity-engine';
import type {
  CostCalculationInput,
  MonteCarloConfig,
  MonteCarloResult,
  MonteCarloVariable,
  HistogramBin,
  FanChartPoint,
} from '@/types/interest-calculator';

// =============================================================================
// SEEDED PRNG — Mulberry32 (fast, deterministic, 32-bit state)
// =============================================================================

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================================
// DISTRIBUTION SAMPLERS
// =============================================================================

/**
 * Box-Muller transform — generates a standard normal variate from two uniforms.
 */
function sampleNormal(rng: () => number, mean: number, stdDev: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Triangular distribution sample.
 */
function sampleTriangular(rng: () => number, min: number, mode: number, max: number): number {
  const u = rng();
  const range = max - min;
  if (range === 0) return min;
  const fc = (mode - min) / range;
  if (u < fc) {
    return min + Math.sqrt(u * range * (mode - min));
  }
  return max - Math.sqrt((1 - u) * range * (max - mode));
}

/**
 * Uniform distribution sample.
 */
function sampleUniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Sample a value for a given variable configuration.
 */
function sampleVariable(rng: () => number, variable: MonteCarloVariable): number {
  switch (variable.distribution) {
    case 'normal':
      return sampleNormal(rng, variable.mean, variable.stdDev);
    case 'triangular':
      return sampleTriangular(rng, variable.min, variable.mean, variable.max);
    case 'uniform':
      return sampleUniform(rng, variable.min, variable.max);
  }
}

// =============================================================================
// HISTOGRAM BUILDER — Sturges' Rule
// =============================================================================

function buildHistogram(values: number[]): HistogramBin[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];

  // Sturges' rule: k = ceil(1 + log2(n))
  const binCount = Math.max(1, Math.ceil(1 + Math.log2(n)));
  const binWidth = (max - min) / binCount || 1;

  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    bins.push({
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
      midpoint: min + (i + 0.5) * binWidth,
      count: 0,
      frequency: 0,
      cumulativeFrequency: 0,
    });
  }

  // Populate bin counts
  for (const val of sorted) {
    let idx = Math.floor((val - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }

  // Calculate frequencies and CDF
  let cumulative = 0;
  for (const bin of bins) {
    bin.frequency = bin.count / n;
    cumulative += bin.frequency;
    bin.cumulativeFrequency = cumulative;
  }

  return bins;
}

// =============================================================================
// FAN CHART BUILDER
// =============================================================================

function buildFanChart(
  input: CostCalculationInput,
  npvScenarios: number[]
): FanChartPoint[] {
  if (input.cashFlows.length === 0) return [];

  const refMs = new Date(input.referenceDate).getTime();
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;

  // Find max month span
  const maxMonth = input.cashFlows.reduce((max, cf) => {
    const months = Math.ceil((new Date(cf.date).getTime() - refMs) / msPerMonth);
    return Math.max(max, months);
  }, 0);

  if (maxMonth <= 0) return [];

  const sorted = [...npvScenarios].sort((a, b) => a - b);
  const n = sorted.length;
  const getPercentile = (p: number) => sorted[Math.min(Math.floor(p * n), n - 1)];

  // Generate fan chart points — interpolate between 0 and final NPV per month
  const points: FanChartPoint[] = [];
  const totalMonths = Math.min(maxMonth, 60); // cap at 5 years

  for (let m = 0; m <= totalMonths; m++) {
    const fraction = m / totalMonths;
    points.push({
      month: m,
      p10: getPercentile(0.10) * fraction,
      p25: getPercentile(0.25) * fraction,
      p50: getPercentile(0.50) * fraction,
      p75: getPercentile(0.75) * fraction,
      p90: getPercentile(0.90) * fraction,
    });
  }

  return points;
}

// =============================================================================
// PERCENTILE HELPER
// =============================================================================

function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = Math.min(Math.floor(p * n), n - 1);
  return sorted[idx];
}

// =============================================================================
// MAIN SIMULATION
// =============================================================================

/**
 * Run Monte Carlo simulation on NPV calculation.
 *
 * @param input — Base cost calculation input
 * @param effectiveRate — Effective annual rate (%)
 * @param config — Monte Carlo configuration
 * @returns MonteCarloResult with statistics, histogram, and fan chart
 */
export function runMonteCarloSimulation(
  input: CostCalculationInput,
  effectiveRate: number,
  config: MonteCarloConfig
): MonteCarloResult {
  const startTime = performance.now();
  const rng = mulberry32(config.seed);
  const enabledVars = config.variables.filter(v => v.enabled);
  const npvValues: number[] = [];

  for (let s = 0; s < config.scenarioCount; s++) {
    let perturbedInput = input;
    let perturbedRate = effectiveRate;

    // Apply perturbation for each enabled variable
    for (const variable of enabledVars) {
      const sampledValue = sampleVariable(rng, variable);
      // Convert sampled value to perturbation factor relative to mean
      const factor = variable.mean !== 0 ? sampledValue / variable.mean : 1;

      const result = applyVariablePerturbation(
        perturbedInput,
        perturbedRate,
        variable.key,
        Math.max(0.01, factor) // prevent negative/zero factors
      );
      perturbedInput = result.perturbedInput;
      perturbedRate = result.perturbedRate;
    }

    const calcResult = calculateFullResult(perturbedInput, Math.max(0.01, perturbedRate));
    npvValues.push(calcResult.npv);
  }

  // Sort for percentile calculations
  const sorted = [...npvValues].sort((a, b) => a - b);
  const n = sorted.length;

  // Statistics
  const sum = npvValues.reduce((s, v) => s + v, 0);
  const meanNPV = n > 0 ? sum / n : 0;
  const variance = n > 1
    ? npvValues.reduce((s, v) => s + (v - meanNPV) ** 2, 0) / (n - 1)
    : 0;
  const stdDevNPV = Math.sqrt(variance);

  // Probabilities
  const probAboveSalePrice = n > 0
    ? (npvValues.filter(v => v > input.salePrice).length / n) * 100
    : 0;
  const probPositive = n > 0
    ? (npvValues.filter(v => v > 0).length / n) * 100
    : 0;

  const histogram = buildHistogram(npvValues);
  const fanChart = buildFanChart(input, npvValues);
  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    scenarioCount: config.scenarioCount,
    meanNPV: Math.round(meanNPV * 100) / 100,
    stdDevNPV: Math.round(stdDevNPV * 100) / 100,
    p10: Math.round(percentile(sorted, 0.10) * 100) / 100,
    p25: Math.round(percentile(sorted, 0.25) * 100) / 100,
    p50: Math.round(percentile(sorted, 0.50) * 100) / 100,
    p75: Math.round(percentile(sorted, 0.75) * 100) / 100,
    p90: Math.round(percentile(sorted, 0.90) * 100) / 100,
    minNPV: Math.round((sorted[0] ?? 0) * 100) / 100,
    maxNPV: Math.round((sorted[n - 1] ?? 0) * 100) / 100,
    probAboveSalePrice: Math.round(probAboveSalePrice * 100) / 100,
    probPositive: Math.round(probPositive * 100) / 100,
    histogram,
    fanChart,
    executionTimeMs,
  };
}
