/**
 * EVM Calculator — Pure Functions
 *
 * Earned Value Management υπολογισμοί χωρίς side effects.
 * Χρησιμοποιεί τα existing BOQ cost-engine functions.
 *
 * @module services/report-engine/evm-calculator
 * @see ADR-265 §8.5 (Earned Value Management)
 */

import type { BOQItem } from '@/types/boq';
import type { ConstructionPhase } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import { computeItemCost, computeGrossQuantity } from '@/services/measurements/cost-engine';
import { sumBy } from '@/utils/collection-utils';

// ============================================================================
// TYPES
// ============================================================================

/** Traffic light health status — ADR-265 §8.5 thresholds */
export type TrafficLight = 'green' | 'amber' | 'red';

/** Single S-curve data point for charting (monthly granularity) */
export interface SCurveDataPoint {
  /** ISO date string (first day of month) */
  date: string;
  /** Planned Value — cumulative budget for planned work */
  plannedValue: number;
  /** Earned Value — cumulative value of completed work */
  earnedValue: number;
  /** Actual Cost — cumulative actual expenditure */
  actualCost: number;
}

/** Complete EVM metrics for a building or project */
export interface EVMResult {
  /** Budget At Completion — total planned budget */
  budgetAtCompletion: number;
  /** Planned Value as of analysis date */
  plannedValue: number;
  /** Earned Value as of analysis date */
  earnedValue: number;
  /** Actual Cost as of analysis date */
  actualCost: number;

  /** Cost Variance = EV - AC (positive = under budget) */
  costVariance: number;
  /** Schedule Variance = EV - PV (positive = ahead of schedule) */
  scheduleVariance: number;

  /** Cost Performance Index = EV / AC (>1 = under budget) */
  cpi: number;
  /** Schedule Performance Index = EV / PV (>1 = ahead of schedule) */
  spi: number;

  /** Estimate At Completion = BAC / CPI */
  estimateAtCompletion: number;
  /** To-Complete Performance Index = (BAC - EV) / (BAC - AC) */
  toCompletePI: number;

  /** CPI health indicator */
  cpiHealth: TrafficLight;
  /** SPI health indicator */
  spiHealth: TrafficLight;

  /** Monthly S-curve data points for charting */
  sCurveData: SCurveDataPoint[];
}

// ============================================================================
// HELPERS
// ============================================================================

/** Industry-standard thresholds: Green ≥0.95, Amber 0.85-0.94, Red <0.85 */
export function getTrafficLight(index: number): TrafficLight {
  if (index >= 0.95) return 'green';
  if (index >= 0.85) return 'amber';
  return 'red';
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Get elapsed fraction of a phase as of a given date (0-1) */
function phaseElapsedFraction(phase: ConstructionPhase, asOfDate: Date): number {
  const start = new Date(phase.plannedStartDate).getTime();
  const end = new Date(phase.plannedEndDate).getTime();
  const now = asOfDate.getTime();

  if (end <= start) return now >= start ? 1 : 0;
  return clamp((now - start) / (end - start), 0, 1);
}

/** Compute total budget for items linked to a specific phase */
function phaseBudget(items: BOQItem[], phaseId: string): number {
  return sumBy(
    items.filter(i => i.linkedPhaseId === phaseId),
    i => computeItemCost(i).totalCost,
  );
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/** BAC = SUM of all estimated item costs */
export function computeBudgetAtCompletion(items: BOQItem[]): number {
  return sumBy(items, i => computeItemCost(i).totalCost);
}

/** AC = SUM of actual costs for items with actual measurements */
export function computeActualCost(items: BOQItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.actualQuantity !== null && item.actualQuantity !== undefined) {
      const grossActual = computeGrossQuantity(item.actualQuantity, item.wasteFactor);
      const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
      total += grossActual * unitCost;
    }
  }
  return total;
}

/** EV = SUM of (phase.progress/100 × phaseBudget) for each phase */
export function computeEarnedValue(
  phases: ConstructionPhase[],
  items: BOQItem[],
): number {
  let total = 0;
  for (const phase of phases) {
    const budget = phaseBudget(items, phase.id);
    total += (phase.progress / 100) * budget;
  }
  return total;
}

/** PV = SUM of (elapsed % × phaseBudget) for each phase as of asOfDate */
export function computePlannedValue(
  phases: ConstructionPhase[],
  items: BOQItem[],
  asOfDate: Date,
): number {
  let total = 0;
  for (const phase of phases) {
    const budget = phaseBudget(items, phase.id);
    const elapsed = phaseElapsedFraction(phase, asOfDate);
    total += elapsed * budget;
  }
  return total;
}

/** Generate monthly S-curve data points from earliest start to latest end */
export function generateSCurveData(
  phases: ConstructionPhase[],
  items: BOQItem[],
  _milestones: BuildingMilestone[],
): SCurveDataPoint[] {
  if (phases.length === 0) return [];

  const timestamps = phases.flatMap(p => [
    new Date(p.plannedStartDate).getTime(),
    new Date(p.plannedEndDate).getTime(),
  ]);
  const earliest = new Date(Math.min(...timestamps));
  const latest = new Date(Math.max(...timestamps, Date.now()));

  const startMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const endMonth = new Date(latest.getFullYear(), latest.getMonth() + 1, 1);

  const points: SCurveDataPoint[] = [];
  const current = new Date(startMonth);

  while (current <= endMonth) {
    const lastDayOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    points.push({
      date: current.toISOString().slice(0, 10),
      plannedValue: computePlannedValue(phases, items, lastDayOfMonth),
      earnedValue: computeEarnedValue(phases, items),
      actualCost: computeActualCost(items),
    });

    current.setMonth(current.getMonth() + 1);
  }

  return points;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/** Compute complete EVM metrics for a set of BOQ items and construction phases */
export function computeEVM(
  items: BOQItem[],
  phases: ConstructionPhase[],
  milestones: BuildingMilestone[],
  asOfDate: Date = new Date(),
): EVMResult {
  const bac = computeBudgetAtCompletion(items);
  const pv = computePlannedValue(phases, items, asOfDate);
  const ev = computeEarnedValue(phases, items);
  const ac = computeActualCost(items);

  const cv = ev - ac;
  const sv = ev - pv;

  const cpi = ac > 0 ? ev / ac : 0;
  const spi = pv > 0 ? ev / pv : 0;

  const eac = cpi > 0 ? bac / cpi : bac;
  const tcpiDenom = bac - ac;
  const tcpi = tcpiDenom > 0 ? (bac - ev) / tcpiDenom : 99.99;

  return {
    budgetAtCompletion: bac,
    plannedValue: pv,
    earnedValue: ev,
    actualCost: ac,
    costVariance: cv,
    scheduleVariance: sv,
    cpi,
    spi,
    estimateAtCompletion: eac,
    toCompletePI: Math.min(tcpi, 99.99),
    cpiHealth: getTrafficLight(cpi),
    spiHealth: getTrafficLight(spi),
    sCurveData: generateSCurveData(phases, items, milestones),
  };
}
