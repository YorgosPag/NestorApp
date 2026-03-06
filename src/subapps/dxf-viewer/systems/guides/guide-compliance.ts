/**
 * @module systems/guides/guide-compliance
 * @description Regulatory compliance checks for guide grids (ADR-189 B93 + B95 + B98 + B101)
 *
 * B93: Basic building code checks (min/max spacing, guide overlap).
 * B95: Seismic code compliance (EN 1998 / EAK 2000 / GB 50011).
 * B98: ISO 19650 information delivery grid templates.
 * B101: DIN/VOB German construction standard templates.
 *
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

/** Result of a single compliance check */
export interface ComplianceCheck {
  /** Rule code (e.g. "EN-MAX-SPAN", "SEISMIC-Z3") */
  readonly code: string;
  /** Human-readable description */
  readonly description: string;
  /** Pass / fail status */
  readonly status: 'pass' | 'fail';
  /** Measured value (optional) */
  readonly value?: number;
  /** Code limit (optional) */
  readonly limit?: number;
}

/** Overall compliance result for a standard */
export interface ComplianceResult {
  /** Whether all checks passed */
  readonly passed: boolean;
  /** Standard name */
  readonly standard: string;
  /** Individual checks */
  readonly checks: readonly ComplianceCheck[];
}

/** Seismic zone parameters */
export interface SeismicZone {
  /** Zone classification (I = low, IV = high) */
  readonly zone: 'I' | 'II' | 'III' | 'IV';
  /** Peak ground acceleration (g) */
  readonly pga: number;
}

/** Building code identifier */
export type BuildingCodeType = 'generic' | 'EN' | 'DIN';

// ============================================================================
// BUILDING CODE LIMITS
// ============================================================================

interface CodeLimits {
  readonly maxSpan_m: number;
  readonly minSpan_m: number;
  readonly maxAspectRatio: number;
}

const CODE_LIMITS: Record<BuildingCodeType, CodeLimits> = {
  generic: { maxSpan_m: 12, minSpan_m: 2, maxAspectRatio: 3 },
  EN: { maxSpan_m: 10, minSpan_m: 2.5, maxAspectRatio: 2.5 },
  DIN: { maxSpan_m: 9, minSpan_m: 2.4, maxAspectRatio: 2 },
};

// ============================================================================
// B93: BUILDING CODE COMPLIANCE
// ============================================================================

/**
 * Check guide grid against building code spacing requirements.
 *
 * Checks:
 * - Maximum span between guides (prevents excessive structural spans)
 * - Minimum span (prevents impractical column spacing)
 * - Bay aspect ratio (span_x / span_y should be reasonable)
 * - No overlapping guides (duplicate offsets on same axis)
 */
export function checkBuildingCode(
  guides: readonly Guide[],
  code: BuildingCodeType = 'generic',
): ComplianceResult {
  const limits = CODE_LIMITS[code];
  const visible = guides.filter(g => g.visible);
  const checks: ComplianceCheck[] = [];

  // Sort by axis and offset
  const xOffsets = visible.filter(g => g.axis === 'X').map(g => g.offset).sort((a, b) => a - b);
  const yOffsets = visible.filter(g => g.axis === 'Y').map(g => g.offset).sort((a, b) => a - b);

  // Check max/min span for X axis
  const xSpans = computeSpans(xOffsets);
  for (let i = 0; i < xSpans.length; i++) {
    checks.push({
      code: `${code.toUpperCase()}-X-MAX-SPAN-${i + 1}`,
      description: `X bay ${i + 1} span ≤ ${limits.maxSpan_m}m`,
      status: xSpans[i] <= limits.maxSpan_m ? 'pass' : 'fail',
      value: Math.round(xSpans[i] * 1000) / 1000,
      limit: limits.maxSpan_m,
    });
    checks.push({
      code: `${code.toUpperCase()}-X-MIN-SPAN-${i + 1}`,
      description: `X bay ${i + 1} span ≥ ${limits.minSpan_m}m`,
      status: xSpans[i] >= limits.minSpan_m ? 'pass' : 'fail',
      value: Math.round(xSpans[i] * 1000) / 1000,
      limit: limits.minSpan_m,
    });
  }

  // Check max/min span for Y axis
  const ySpans = computeSpans(yOffsets);
  for (let i = 0; i < ySpans.length; i++) {
    checks.push({
      code: `${code.toUpperCase()}-Y-MAX-SPAN-${i + 1}`,
      description: `Y bay ${i + 1} span ≤ ${limits.maxSpan_m}m`,
      status: ySpans[i] <= limits.maxSpan_m ? 'pass' : 'fail',
      value: Math.round(ySpans[i] * 1000) / 1000,
      limit: limits.maxSpan_m,
    });
    checks.push({
      code: `${code.toUpperCase()}-Y-MIN-SPAN-${i + 1}`,
      description: `Y bay ${i + 1} span ≥ ${limits.minSpan_m}m`,
      status: ySpans[i] >= limits.minSpan_m ? 'pass' : 'fail',
      value: Math.round(ySpans[i] * 1000) / 1000,
      limit: limits.minSpan_m,
    });
  }

  // Check bay aspect ratio
  if (xSpans.length > 0 && ySpans.length > 0) {
    for (let xi = 0; xi < xSpans.length; xi++) {
      for (let yi = 0; yi < ySpans.length; yi++) {
        const ratio = Math.max(xSpans[xi], ySpans[yi]) / Math.min(xSpans[xi], ySpans[yi]);
        checks.push({
          code: `${code.toUpperCase()}-ASPECT-X${xi + 1}Y${yi + 1}`,
          description: `Bay X${xi + 1}×Y${yi + 1} aspect ratio ≤ ${limits.maxAspectRatio}`,
          status: ratio <= limits.maxAspectRatio ? 'pass' : 'fail',
          value: Math.round(ratio * 100) / 100,
          limit: limits.maxAspectRatio,
        });
      }
    }
  }

  // Check for duplicate offsets (overlapping guides)
  const xDuplicates = findDuplicateOffsets(xOffsets);
  if (xDuplicates.length > 0) {
    checks.push({
      code: `${code.toUpperCase()}-X-DUPLICATE`,
      description: `No duplicate X guide offsets`,
      status: 'fail',
      value: xDuplicates.length,
    });
  }

  const yDuplicates = findDuplicateOffsets(yOffsets);
  if (yDuplicates.length > 0) {
    checks.push({
      code: `${code.toUpperCase()}-Y-DUPLICATE`,
      description: `No duplicate Y guide offsets`,
      status: 'fail',
      value: yDuplicates.length,
    });
  }

  return {
    passed: checks.every(c => c.status === 'pass'),
    standard: `Building Code (${code.toUpperCase()})`,
    checks,
  };
}

// ============================================================================
// B95: SEISMIC COMPLIANCE
// ============================================================================

/** Maximum recommended bay span per seismic zone (meters) */
const SEISMIC_MAX_SPAN: Record<SeismicZone['zone'], number> = {
  I: 10,   // Low seismicity
  II: 8,   // Moderate
  III: 6,  // High
  IV: 5,   // Very high (e.g. Greece zone III/IV)
};

/** Minimum columns per frame direction per seismic zone */
const SEISMIC_MIN_FRAMES: Record<SeismicZone['zone'], number> = {
  I: 2,
  II: 3,
  III: 3,
  IV: 4,
};

/**
 * Check guide grid against seismic design requirements.
 *
 * Based on simplified rules from EN 1998 / EAK 2000:
 * - Maximum span decreases with higher seismic zone
 * - Minimum frame count increases
 * - Regularity: uniform spacing preferred (CV < 20%)
 */
export function checkSeismicCompliance(
  guides: readonly Guide[],
  zone: SeismicZone,
): ComplianceResult {
  const visible = guides.filter(g => g.visible);
  const checks: ComplianceCheck[] = [];

  const maxSpan = SEISMIC_MAX_SPAN[zone.zone];
  const minFrames = SEISMIC_MIN_FRAMES[zone.zone];

  const xOffsets = visible.filter(g => g.axis === 'X').map(g => g.offset).sort((a, b) => a - b);
  const yOffsets = visible.filter(g => g.axis === 'Y').map(g => g.offset).sort((a, b) => a - b);

  // Max span checks
  const xSpans = computeSpans(xOffsets);
  const ySpans = computeSpans(yOffsets);

  const maxXSpan = xSpans.length > 0 ? Math.max(...xSpans) : 0;
  const maxYSpan = ySpans.length > 0 ? Math.max(...ySpans) : 0;

  checks.push({
    code: `SEISMIC-Z${zone.zone}-X-SPAN`,
    description: `Max X span ≤ ${maxSpan}m (Zone ${zone.zone}, PGA=${zone.pga}g)`,
    status: maxXSpan <= maxSpan ? 'pass' : 'fail',
    value: Math.round(maxXSpan * 1000) / 1000,
    limit: maxSpan,
  });

  checks.push({
    code: `SEISMIC-Z${zone.zone}-Y-SPAN`,
    description: `Max Y span ≤ ${maxSpan}m (Zone ${zone.zone})`,
    status: maxYSpan <= maxSpan ? 'pass' : 'fail',
    value: Math.round(maxYSpan * 1000) / 1000,
    limit: maxSpan,
  });

  // Minimum frame count
  checks.push({
    code: `SEISMIC-Z${zone.zone}-X-FRAMES`,
    description: `X frames ≥ ${minFrames} (Zone ${zone.zone})`,
    status: xOffsets.length >= minFrames ? 'pass' : 'fail',
    value: xOffsets.length,
    limit: minFrames,
  });

  checks.push({
    code: `SEISMIC-Z${zone.zone}-Y-FRAMES`,
    description: `Y frames ≥ ${minFrames} (Zone ${zone.zone})`,
    status: yOffsets.length >= minFrames ? 'pass' : 'fail',
    value: yOffsets.length,
    limit: minFrames,
  });

  // Regularity check: coefficient of variation < 20%
  const xCV = computeCV(xSpans);
  if (xCV !== null) {
    checks.push({
      code: `SEISMIC-Z${zone.zone}-X-REGULARITY`,
      description: `X spacing regularity (CV ≤ 20%)`,
      status: xCV <= 0.2 ? 'pass' : 'fail',
      value: Math.round(xCV * 1000) / 10,
      limit: 20,
    });
  }

  const yCV = computeCV(ySpans);
  if (yCV !== null) {
    checks.push({
      code: `SEISMIC-Z${zone.zone}-Y-REGULARITY`,
      description: `Y spacing regularity (CV ≤ 20%)`,
      status: yCV <= 0.2 ? 'pass' : 'fail',
      value: Math.round(yCV * 1000) / 10,
      limit: 20,
    });
  }

  return {
    passed: checks.every(c => c.status === 'pass'),
    standard: `Seismic Code EN 1998 (Zone ${zone.zone}, PGA=${zone.pga}g)`,
    checks,
  };
}

/** Seismic zone-specific presets — conservative spacing for earthquake-prone areas */
export const SEISMIC_PRESETS: readonly GuideGridPreset[] = [
  {
    id: 'seismic-zone-ii',
    nameKey: 'tools.presetSeismicZoneII',
    category: 'seismic',
    description: 'Moderate seismicity — 8m max span, EN 1998',
    xSpacings: [0, 6, 12, 18, 24],
    ySpacings: [0, 6, 12, 18],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'seismic-zone-iii',
    nameKey: 'tools.presetSeismicZoneIII',
    category: 'seismic',
    description: 'High seismicity — 6m max span, EN 1998 / EAK 2000',
    xSpacings: [0, 5, 10, 15, 20],
    ySpacings: [0, 5, 10, 15],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'seismic-zone-iv',
    nameKey: 'tools.presetSeismicZoneIV',
    category: 'seismic',
    description: 'Very high seismicity — 5m max span, EAK 2000 Zone III',
    xSpacings: [0, 4, 8, 12, 16, 20],
    ySpacings: [0, 4, 8, 12],
    xLabels: generateLetterLabels(6),
    yLabels: generateNumberLabels(4),
  },
];

// ============================================================================
// B98: ISO 19650 TEMPLATES
// ============================================================================

/** ISO 19650 information delivery grid templates — BIM standard grids */
export const ISO_19650_TEMPLATES: readonly GuideGridPreset[] = [
  {
    id: 'iso19650-residential',
    nameKey: 'tools.presetISO19650Residential',
    category: 'iso19650',
    description: 'ISO 19650 residential — 4.5m × 4.5m structural grid',
    xSpacings: [0, 4.5, 9, 13.5, 18],
    ySpacings: [0, 4.5, 9, 13.5],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'iso19650-office',
    nameKey: 'tools.presetISO19650Office',
    category: 'iso19650',
    description: 'ISO 19650 office — 7.5m × 7.5m open-plan grid',
    xSpacings: [0, 7.5, 15, 22.5, 30],
    ySpacings: [0, 7.5, 15, 22.5],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'iso19650-industrial',
    nameKey: 'tools.presetISO19650Industrial',
    category: 'iso19650',
    description: 'ISO 19650 industrial — 10m × 10m warehouse grid',
    xSpacings: [0, 10, 20, 30],
    ySpacings: [0, 10, 20],
    xLabels: generateLetterLabels(4),
    yLabels: generateNumberLabels(3),
  },
];

// ============================================================================
// B101: DIN/VOB TEMPLATES
// ============================================================================

/** DIN/VOB German construction standard templates */
export const DIN_VOB_TEMPLATES: readonly GuideGridPreset[] = [
  {
    id: 'din-wohnungsbau',
    nameKey: 'tools.presetDINWohnungsbau',
    category: 'din-vob',
    description: 'DIN 18040 Wohnungsbau — 3.6m × 4.2m residential',
    xSpacings: [0, 3.6, 7.2, 10.8, 14.4],
    ySpacings: [0, 4.2, 8.4, 12.6],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'din-buero',
    nameKey: 'tools.presetDINBuero',
    category: 'din-vob',
    description: 'DIN 18040 Bürobau — 5.4m × 7.2m office',
    xSpacings: [0, 5.4, 10.8, 16.2, 21.6],
    ySpacings: [0, 7.2, 14.4, 21.6],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'din-industriebau',
    nameKey: 'tools.presetDINIndustriebau',
    category: 'din-vob',
    description: 'DIN 18230 Industriebau — 9m × 12m industrial hall',
    xSpacings: [0, 9, 18, 27],
    ySpacings: [0, 12, 24],
    xLabels: generateLetterLabels(4),
    yLabels: generateNumberLabels(3),
  },
];

// ============================================================================
// UTILITIES
// ============================================================================

/** Compute spacing deltas from sorted offset array */
function computeSpans(sortedOffsets: readonly number[]): number[] {
  const spans: number[] = [];
  for (let i = 0; i < sortedOffsets.length - 1; i++) {
    spans.push(sortedOffsets[i + 1] - sortedOffsets[i]);
  }
  return spans;
}

/** Coefficient of variation (stddev / mean). Returns null if < 2 values. */
function computeCV(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Find duplicate values in a sorted number array (within MIN_OFFSET_DELTA tolerance) */
function findDuplicateOffsets(sorted: readonly number[]): number[] {
  const duplicates: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (Math.abs(sorted[i + 1] - sorted[i]) < 0.001) {
      duplicates.push(sorted[i]);
    }
  }
  return duplicates;
}
