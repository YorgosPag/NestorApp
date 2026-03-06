/**
 * @module systems/guides/guide-sustainability
 * @description Eco-optimization and sustainability analysis (ADR-189 B72 + B74 + B75 + B100)
 *
 * B72: Eco-optimized presets (minimum material for given span).
 * B74: Material waste estimation based on grid spacing.
 * B75: CO₂ estimation based on structural design.
 * B100: EU Green Deal / BREEAM / LEED basic validation.
 *
 * All emission factors from EN 15804 / EPD (Environmental Product Declaration).
 * Pure functions, zero side effects. Pattern: cost-engine.ts
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-03-06
 */

import type { Guide } from './guide-types';
import type { GuideGridPreset } from './guide-presets';
import { generateLetterLabels, generateNumberLabels } from './guide-presets';

// ============================================================================
// TYPES
// ============================================================================

/** Material quantity estimate for a structural grid */
export interface MaterialEstimate {
  /** Total concrete volume (m³) for columns + beams + slab */
  readonly concreteVolume_m3: number;
  /** Total steel reinforcement weight (kg) */
  readonly steelWeight_kg: number;
  /** Waste factor (0.05 = 5% waste) — depends on regularity */
  readonly wasteFactor: number;
  /** Estimated total cost in EUR */
  readonly totalCost_EUR: number;
}

/** Carbon footprint estimate */
export interface CarbonEstimate {
  /** CO₂ from concrete (kgCO₂) */
  readonly concreteCO2_kg: number;
  /** CO₂ from steel (kgCO₂) */
  readonly steelCO2_kg: number;
  /** Total CO₂ (kgCO₂) */
  readonly totalCO2_kg: number;
  /** Energy performance rating (A = excellent, E = poor) */
  readonly rating: 'A' | 'B' | 'C' | 'D' | 'E';
}

/** Green Deal / sustainability standard check */
export interface SustainabilityCheck {
  /** Whether all checks passed */
  readonly passed: boolean;
  /** Standard used for validation */
  readonly standard: 'BREEAM' | 'LEED' | 'EU_TAXONOMY';
  /** Individual findings */
  readonly findings: readonly SustainabilityFinding[];
}

/** A single finding in a sustainability check */
export interface SustainabilityFinding {
  /** Rule identifier */
  readonly rule: string;
  /** Pass / fail / warning */
  readonly status: 'pass' | 'fail' | 'warning';
  /** Detail description */
  readonly detail: string;
}

// ============================================================================
// EMISSION FACTORS (EN 15804 / EPD averages)
// ============================================================================

/** kgCO₂ per m³ of concrete (C30/37 typical) */
const CONCRETE_CO2_PER_M3 = 260;

/** kgCO₂ per kg of reinforcing steel (B500S typical) */
const STEEL_CO2_PER_KG = 1.5;

/** Default concrete unit cost (EUR/m³) */
const CONCRETE_COST_PER_M3 = 150;

/** Default steel unit cost (EUR/kg) */
const STEEL_COST_PER_KG = 1.2;

/** Default slab thickness (meters) */
const DEFAULT_SLAB_THICKNESS = 0.20;

/** Default column cross-section (meters × meters) */
const DEFAULT_COLUMN_SIZE = 0.40;

/** Default floor height (meters) */
const DEFAULT_FLOOR_HEIGHT = 3.2;

/** Steel reinforcement ratio (kg per m³ of concrete) — typical for RC frames */
const STEEL_RATIO_KG_PER_M3 = 100;

/** Base waste factor for regular grids */
const BASE_WASTE_FACTOR = 0.03;

/** Additional waste per unit of spacing irregularity (CV) */
const WASTE_CV_FACTOR = 0.15;

// ============================================================================
// B72: ECO-OPTIMIZED PRESETS
// ============================================================================

/**
 * Eco-optimized presets — designed for minimum material usage.
 * Based on typical optimal spans for RC frame structures:
 * - Square bays minimize steel in two-way slabs
 * - 6-7m spans optimize column-to-span ratio
 */
export const ECO_PRESETS: readonly GuideGridPreset[] = [
  {
    id: 'eco-optimal-6m',
    nameKey: 'tools.presetEcoOptimal6m',
    category: 'eco',
    description: 'Optimal 6m × 6m — minimum material for two-way slab',
    xSpacings: [0, 6, 12, 18, 24],
    ySpacings: [0, 6, 12, 18],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'eco-optimal-7m',
    nameKey: 'tools.presetEcoOptimal7m',
    category: 'eco',
    description: 'Optimal 7m × 7m — best concrete/span ratio for offices',
    xSpacings: [0, 7, 14, 21, 28],
    ySpacings: [0, 7, 14, 21],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'eco-compact-4m',
    nameKey: 'tools.presetEcoCompact4m',
    category: 'eco',
    description: 'Compact 4m × 4m — minimum CO₂ for residential, thin slab',
    xSpacings: [0, 4, 8, 12, 16, 20],
    ySpacings: [0, 4, 8, 12, 16],
    xLabels: generateLetterLabels(6),
    yLabels: generateNumberLabels(5),
  },
];

// ============================================================================
// B74: MATERIAL ESTIMATION
// ============================================================================

/**
 * Estimate material quantities based on guide grid layout.
 *
 * Simplified structural model:
 * - Columns at each grid intersection (height = floorHeight)
 * - Beams along each grid line between intersections
 * - Slab panels within each bay
 * - Waste factor based on spacing regularity
 *
 * @param guides - Current guide configuration
 * @param slabThickness - Slab thickness in meters (default: 0.20m)
 * @param columnSize - Column cross-section side length (default: 0.40m)
 */
export function estimateMaterial(
  guides: readonly Guide[],
  slabThickness: number = DEFAULT_SLAB_THICKNESS,
  columnSize: number = DEFAULT_COLUMN_SIZE,
): MaterialEstimate {
  const visible = guides.filter(g => g.visible);
  const xOffsets = visible.filter(g => g.axis === 'X').map(g => g.offset).sort((a, b) => a - b);
  const yOffsets = visible.filter(g => g.axis === 'Y').map(g => g.offset).sort((a, b) => a - b);

  if (xOffsets.length < 2 || yOffsets.length < 2) {
    return { concreteVolume_m3: 0, steelWeight_kg: 0, wasteFactor: 0, totalCost_EUR: 0 };
  }

  // Columns: one at each intersection
  const columnCount = xOffsets.length * yOffsets.length;
  const columnVolume = columnCount * columnSize * columnSize * DEFAULT_FLOOR_HEIGHT;

  // Beams along X axis (span between Y guides, at each X position)
  let beamLengthX = 0;
  for (let i = 0; i < yOffsets.length - 1; i++) {
    beamLengthX += (yOffsets[i + 1] - yOffsets[i]) * xOffsets.length;
  }
  // Beams along Y axis
  let beamLengthY = 0;
  for (let i = 0; i < xOffsets.length - 1; i++) {
    beamLengthY += (xOffsets[i + 1] - xOffsets[i]) * yOffsets.length;
  }
  const beamVolume = (beamLengthX + beamLengthY) * columnSize * slabThickness;

  // Slab area
  const totalSpanX = xOffsets[xOffsets.length - 1] - xOffsets[0];
  const totalSpanY = yOffsets[yOffsets.length - 1] - yOffsets[0];
  const slabArea = totalSpanX * totalSpanY;
  const slabVolume = slabArea * slabThickness;

  const totalConcrete = columnVolume + beamVolume + slabVolume;
  const totalSteel = totalConcrete * STEEL_RATIO_KG_PER_M3;

  // Waste factor: more regular = less waste
  const xSpans = computeSpacingArray(xOffsets);
  const ySpans = computeSpacingArray(yOffsets);
  const avgCV = averageCV(xSpans, ySpans);
  const wasteFactor = BASE_WASTE_FACTOR + avgCV * WASTE_CV_FACTOR;

  const effectiveConcrete = totalConcrete * (1 + wasteFactor);
  const effectiveSteel = totalSteel * (1 + wasteFactor);

  return {
    concreteVolume_m3: Math.round(effectiveConcrete * 100) / 100,
    steelWeight_kg: Math.round(effectiveSteel * 10) / 10,
    wasteFactor: Math.round(wasteFactor * 1000) / 1000,
    totalCost_EUR: Math.round(effectiveConcrete * CONCRETE_COST_PER_M3 + effectiveSteel * STEEL_COST_PER_KG),
  };
}

// ============================================================================
// B75: CARBON ESTIMATION
// ============================================================================

/**
 * Estimate carbon footprint from material quantities.
 *
 * Rating scale (kgCO₂/m² of floor area):
 * - A: < 200 (timber hybrid, minimal concrete)
 * - B: 200-350 (optimized RC)
 * - C: 350-500 (standard RC)
 * - D: 500-700 (heavy RC)
 * - E: > 700 (over-designed)
 */
export function estimateCarbon(material: MaterialEstimate): CarbonEstimate {
  const concreteCO2 = material.concreteVolume_m3 * CONCRETE_CO2_PER_M3;
  const steelCO2 = material.steelWeight_kg * STEEL_CO2_PER_KG;
  const totalCO2 = concreteCO2 + steelCO2;

  // Rating based on total CO₂ (simplified — assumes ~500m² floor area reference)
  let rating: CarbonEstimate['rating'];
  if (totalCO2 < 5000) rating = 'A';
  else if (totalCO2 < 15000) rating = 'B';
  else if (totalCO2 < 30000) rating = 'C';
  else if (totalCO2 < 50000) rating = 'D';
  else rating = 'E';

  return {
    concreteCO2_kg: Math.round(concreteCO2),
    steelCO2_kg: Math.round(steelCO2),
    totalCO2_kg: Math.round(totalCO2),
    rating,
  };
}

// ============================================================================
// B100: EU GREEN DEAL VALIDATION
// ============================================================================

/**
 * Basic sustainability standard check.
 *
 * Simplified rules based on BREEAM/LEED/EU Taxonomy:
 * - Material efficiency (concrete volume per m² floor area)
 * - CO₂ intensity rating
 * - Waste factor threshold
 * - Regular grid bonus (efficient formwork reuse)
 */
export function checkGreenDeal(
  guides: readonly Guide[],
  material: MaterialEstimate,
): SustainabilityCheck {
  const visible = guides.filter(g => g.visible);
  const findings: SustainabilityFinding[] = [];

  // Compute floor area for per-m² metrics
  const xOffsets = visible.filter(g => g.axis === 'X').map(g => g.offset).sort((a, b) => a - b);
  const yOffsets = visible.filter(g => g.axis === 'Y').map(g => g.offset).sort((a, b) => a - b);

  const floorArea = xOffsets.length >= 2 && yOffsets.length >= 2
    ? (xOffsets[xOffsets.length - 1] - xOffsets[0]) * (yOffsets[yOffsets.length - 1] - yOffsets[0])
    : 0;

  // Rule 1: Concrete intensity ≤ 0.25 m³/m² (typical BREEAM Mat 01 guideline)
  if (floorArea > 0) {
    const concreteIntensity = material.concreteVolume_m3 / floorArea;
    findings.push({
      rule: 'MAT-01: Concrete intensity',
      status: concreteIntensity <= 0.25 ? 'pass' : concreteIntensity <= 0.35 ? 'warning' : 'fail',
      detail: `${concreteIntensity.toFixed(3)} m³/m² (limit: 0.25 m³/m²)`,
    });
  }

  // Rule 2: CO₂ rating ≥ C
  const carbon = estimateCarbon(material);
  findings.push({
    rule: 'ENE-01: Carbon rating',
    status: carbon.rating <= 'C' ? 'pass' : 'warning',
    detail: `Rating ${carbon.rating} — ${carbon.totalCO2_kg} kgCO₂ total`,
  });

  // Rule 3: Waste factor ≤ 5%
  findings.push({
    rule: 'WST-01: Material waste',
    status: material.wasteFactor <= 0.05 ? 'pass' : material.wasteFactor <= 0.08 ? 'warning' : 'fail',
    detail: `${(material.wasteFactor * 100).toFixed(1)}% waste (limit: 5%)`,
  });

  // Rule 4: Grid regularity (formwork reuse)
  const xSpans = computeSpacingArray(xOffsets);
  const ySpans = computeSpacingArray(yOffsets);
  const cv = averageCV(xSpans, ySpans);
  findings.push({
    rule: 'MAT-02: Grid regularity (formwork reuse)',
    status: cv <= 0.05 ? 'pass' : cv <= 0.15 ? 'warning' : 'fail',
    detail: `CV=${(cv * 100).toFixed(1)}% — ${cv <= 0.05 ? 'excellent reuse' : cv <= 0.15 ? 'moderate reuse' : 'poor reuse'}`,
  });

  return {
    passed: findings.every(f => f.status !== 'fail'),
    standard: 'EU_TAXONOMY',
    findings,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function computeSpacingArray(sortedOffsets: readonly number[]): readonly number[] {
  const spacings: number[] = [];
  for (let i = 0; i < sortedOffsets.length - 1; i++) {
    spacings.push(sortedOffsets[i + 1] - sortedOffsets[i]);
  }
  return spacings;
}

function averageCV(xSpans: readonly number[], ySpans: readonly number[]): number {
  const cvX = computeSingleCV(xSpans);
  const cvY = computeSingleCV(ySpans);

  if (cvX === null && cvY === null) return 0;
  if (cvX === null) return cvY ?? 0;
  if (cvY === null) return cvX;
  return (cvX + cvY) / 2;
}

function computeSingleCV(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
