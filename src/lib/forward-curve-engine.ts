/**
 * Forward Curve Engine — SPEC-242E
 *
 * Pure math functions for deriving forward rates from spot rates
 * and detecting yield curve shape. Zero side effects.
 *
 * @module lib/forward-curve-engine
 * @enterprise ADR-242 SPEC-242E - Forward Curves
 */

import type {
  EuriborRatesCache,
  EuriborTenor,
  SpotRatePoint,
  ForwardRatePoint,
  CurveShape,
  ForwardCurveResult,
} from '@/types/interest-calculator';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Map tenor label to years */
const TENOR_YEARS: Record<EuriborTenor, number> = {
  '1W': 1 / 52,
  '1M': 1 / 12,
  '3M': 3 / 12,
  '6M': 6 / 12,
  '12M': 1.0,
};

/** Ordered tenors for iteration */
const ORDERED_TENORS: EuriborTenor[] = ['1W', '1M', '3M', '6M', '12M'];

/** Flat curve threshold in basis points */
const FLAT_THRESHOLD_BPS = 15;

// =============================================================================
// SPOT RATE EXTRACTION
// =============================================================================

/**
 * Extract ordered spot rate points from ECB cached data.
 */
export function extractSpotRates(rates: EuriborRatesCache): SpotRatePoint[] {
  const rateMap: Record<EuriborTenor, number> = {
    '1W': rates.euribor1W,
    '1M': rates.euribor1M,
    '3M': rates.euribor3M,
    '6M': rates.euribor6M,
    '12M': rates.euribor12M,
  };

  return ORDERED_TENORS.map((tenor) => ({
    tenor,
    tenorYears: TENOR_YEARS[tenor],
    rate: rateMap[tenor],
  }));
}

// =============================================================================
// FORWARD RATE DERIVATION
// =============================================================================

/**
 * Derive forward rates from spot rates using the no-arbitrage formula:
 *
 *   f(t1,t2) = [(1 + s2)^t2 / (1 + s1)^t1]^(1/(t2-t1)) - 1
 *
 * where s1, s2 are annualized spot rates and t1, t2 are in years.
 *
 * Returns forward rates for each adjacent tenor pair.
 */
export function deriveForwardRates(spotRates: SpotRatePoint[]): ForwardRatePoint[] {
  const forwards: ForwardRatePoint[] = [];

  for (let i = 0; i < spotRates.length - 1; i++) {
    const s1 = spotRates[i];
    const s2 = spotRates[i + 1];

    const t1 = s1.tenorYears;
    const t2 = s2.tenorYears;
    const dt = t2 - t1;

    if (dt <= 0) continue;

    // Convert percentage to decimal for calculation
    const r1 = s1.rate / 100;
    const r2 = s2.rate / 100;

    // No-arbitrage forward rate formula
    const compoundS1 = Math.pow(1 + r1, t1);
    const compoundS2 = Math.pow(1 + r2, t2);

    const forwardDecimal = Math.pow(compoundS2 / compoundS1, 1 / dt) - 1;
    const forwardPercent = forwardDecimal * 100;

    forwards.push({
      fromTenor: s1.tenor,
      toTenor: s2.tenor,
      label: `${s1.tenor}→${s2.tenor}`,
      rate: Math.round(forwardPercent * 10000) / 10000, // 4 decimal places
      fromYears: t1,
      toYears: t2,
    });
  }

  return forwards;
}

// =============================================================================
// CURVE SHAPE DETECTION
// =============================================================================

/**
 * Detect the shape of the yield curve:
 * - normal: rates increase with tenor (upward sloping)
 * - inverted: rates decrease with tenor (downward sloping)
 * - flat: rates vary by less than FLAT_THRESHOLD_BPS
 * - humped: rates increase then decrease (or vice versa)
 */
export function detectCurveShape(spotRates: SpotRatePoint[]): CurveShape {
  if (spotRates.length < 2) return 'flat';

  const rates = spotRates.map((s) => s.rate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);

  // Flat check: total range < threshold
  const rangeBps = (maxRate - minRate) * 100; // convert % to bps
  if (rangeBps < FLAT_THRESHOLD_BPS) return 'flat';

  // Check monotonicity
  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < rates.length; i++) {
    const diff = rates[i] - rates[i - 1];
    if (diff > 0.001) increasing++;
    else if (diff < -0.001) decreasing++;
  }

  if (increasing > 0 && decreasing === 0) return 'normal';
  if (decreasing > 0 && increasing === 0) return 'inverted';

  // Mixed direction → humped
  return 'humped';
}

// =============================================================================
// ORCHESTRATOR
// =============================================================================

/**
 * Build complete forward curve analysis from ECB cached rates.
 *
 * @param rates - Cached Euribor rates from EuriborService
 * @returns ForwardCurveResult with spot rates, forward rates, and shape
 */
export function buildForwardCurveResult(rates: EuriborRatesCache): ForwardCurveResult {
  const spotRates = extractSpotRates(rates);
  const forwardRates = deriveForwardRates(spotRates);
  const curveShape = detectCurveShape(spotRates);

  return {
    spotRates,
    forwardRates,
    curveShape,
    rateDate: rates.rateDate,
    source: rates.source,
  };
}
