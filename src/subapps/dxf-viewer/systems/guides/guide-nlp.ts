/**
 * @module systems/guides/guide-nlp
 * @description Natural Language grid command parsing (ADR-189 B60)
 *
 * Parses free-text grid commands into structured grid definitions.
 * Uses regex patterns only — NO LLM dependency.
 *
 * Supported inputs (EN + EL):
 * - "κάνναβος 5x5μ 20x30"  → grid 5m spacing, 20×30m area
 * - "4 αξονες ανα 6 μετρα"  → 4 X guides at 6m spacing
 * - "grid 5m bay"           → bay-5m preset
 * - "6x8 grid"              → 6m × 8m bay
 * - "10 columns 5m apart"   → 10 X guides at 5m spacing
 *
 * Pure functions, zero side effects. Pattern: cost-engine.ts
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-03-06
 */

import { STRUCTURAL_PRESETS, type GuideGridPreset } from './guide-presets';
import { SEISMIC_PRESETS, ISO_19650_TEMPLATES, DIN_VOB_TEMPLATES } from './guide-compliance';
import { ECO_PRESETS } from './guide-sustainability';

// ============================================================================
// TYPES
// ============================================================================

/** Result of parsing a natural-language grid command */
export interface NLPGridResult {
  /** Whether this matched a known preset or is a custom grid */
  readonly type: 'preset' | 'custom' | 'unknown';
  /** Matched preset ID (if type === 'preset') */
  readonly presetId?: string;
  /** X axis positions in meters (if type === 'custom') */
  readonly xSpacings?: readonly number[];
  /** Y axis positions in meters (if type === 'custom') */
  readonly ySpacings?: readonly number[];
  /** X axis labels (if type === 'custom') */
  readonly xLabels?: readonly string[];
  /** Y axis labels (if type === 'custom') */
  readonly yLabels?: readonly string[];
  /** Confidence score (0 = no match, 1 = exact match) */
  readonly confidence: number;
}

// ============================================================================
// ALL PRESETS (combined for lookup)
// ============================================================================

const ALL_PRESETS: readonly GuideGridPreset[] = [
  ...STRUCTURAL_PRESETS,
  ...SEISMIC_PRESETS,
  ...ISO_19650_TEMPLATES,
  ...DIN_VOB_TEMPLATES,
  ...ECO_PRESETS,
];

// ============================================================================
// REGEX PATTERNS
// ============================================================================

/**
 * Pattern: "grid Xm bay" or "bay Xm" or "κάνναβος Xμ"
 * Groups: [spacing_m]
 */
const PRESET_PATTERN = /(?:grid|bay|κάνν?αβος|πλέγμα)\s*(\d+(?:\.\d+)?)\s*(?:m|μ|meter|μέτρ)/i;

/**
 * Pattern: "XxY grid" or "XxYm" or "κάνναβος XxY"
 * Groups: [spacingX, spacingY]
 */
const GRID_XY_PATTERN = /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:m|μ|grid|πλ|κάν)?/i;

/**
 * Pattern: "N axes/columns every M meters"
 * EN: "4 columns 6m apart" / "4 axes at 6m spacing"
 * EL: "4 αξονες ανα 6 μετρα" / "4 στύλοι κάθε 6μ"
 * Groups: [count, spacing]
 */
const AXES_PATTERN = /(\d+)\s*(?:axes|axis|columns?|στ[υύ]λο[ιυ]?|[αά]ξον[εα]ς?)\s*(?:every|at|ανά|ανα|κάθε|καθε|@)?\s*(\d+(?:\.\d+)?)\s*(?:m|μ|meter|μέτρ)/i;

/**
 * Pattern: "κάνναβος AxBμ CxD" (spacing A×B in area C×D)
 * Groups: [spacingX, spacingY, areaX, areaY]
 */
const FULL_GRID_PATTERN = /(?:κάνν?αβος|grid|πλέγμα)\s*(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:m|μ)?\s+(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/i;

/**
 * Pattern: seismic zone reference
 * EN: "seismic zone 3" / EL: "σεισμική ζώνη 3"
 */
const SEISMIC_PATTERN = /(?:seismic|σεισμ)\s*(?:zone|ζ[ωώ]νη)\s*(?:i{1,4}|[1-4])/i;

/**
 * Pattern: eco/green
 */
const ECO_PATTERN = /(?:eco|green|οικ[οό]|πράσιν)/i;

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a natural-language grid command into a structured result.
 *
 * Tries patterns in order of specificity (most specific first).
 * Returns `{ type: 'unknown', confidence: 0 }` if no pattern matches.
 */
export function parseGridCommand(input: string): NLPGridResult {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'unknown', confidence: 0 };

  // 1. Try full grid pattern: "κάνναβος 5x5μ 20x30"
  const fullMatch = trimmed.match(FULL_GRID_PATTERN);
  if (fullMatch) {
    const spacingX = parseFloat(fullMatch[1]);
    const spacingY = parseFloat(fullMatch[2]);
    const areaX = parseFloat(fullMatch[3]);
    const areaY = parseFloat(fullMatch[4]);

    return buildCustomGrid(spacingX, spacingY, areaX, areaY, 0.9);
  }

  // 2. Try seismic zone
  const seismicMatch = trimmed.match(SEISMIC_PATTERN);
  if (seismicMatch) {
    const zoneText = seismicMatch[0].toLowerCase();
    let presetId: string;
    if (zoneText.includes('4') || zoneText.includes('iv')) {
      presetId = 'seismic-zone-iv';
    } else if (zoneText.includes('3') || zoneText.includes('iii')) {
      presetId = 'seismic-zone-iii';
    } else {
      presetId = 'seismic-zone-ii';
    }

    const preset = ALL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      return { type: 'preset', presetId, confidence: 0.85 };
    }
  }

  // 3. Try eco pattern
  if (ECO_PATTERN.test(trimmed)) {
    // Default to optimal 6m
    return { type: 'preset', presetId: 'eco-optimal-6m', confidence: 0.7 };
  }

  // 4. Try axes/columns pattern: "4 αξονες ανα 6 μετρα"
  const axesMatch = trimmed.match(AXES_PATTERN);
  if (axesMatch) {
    const count = parseInt(axesMatch[1], 10);
    const spacing = parseFloat(axesMatch[2]);

    if (count >= 2 && count <= 50 && spacing > 0) {
      const positions: number[] = [];
      for (let i = 0; i < count; i++) {
        positions.push(Math.round(i * spacing * 10000) / 10000);
      }

      return {
        type: 'custom',
        xSpacings: positions,
        ySpacings: [0, spacing * Math.min(count - 1, 3)],
        xLabels: generateLabels(count, 'letter'),
        yLabels: generateLabels(2, 'number'),
        confidence: 0.85,
      };
    }
  }

  // 5. Try preset bay pattern: "grid 5m bay" or "bay 6m"
  const presetMatch = trimmed.match(PRESET_PATTERN);
  if (presetMatch) {
    const spacing = parseFloat(presetMatch[1]);
    const presetId = `bay-${spacing}m`;
    const preset = STRUCTURAL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      return { type: 'preset', presetId, confidence: 0.9 };
    }
    // No exact preset — build custom with that spacing
    return buildCustomGrid(spacing, spacing, spacing * 4, spacing * 3, 0.7);
  }

  // 6. Try XxY grid pattern: "6x8" or "6x8m"
  const xyMatch = trimmed.match(GRID_XY_PATTERN);
  if (xyMatch) {
    const spacingX = parseFloat(xyMatch[1]);
    const spacingY = parseFloat(xyMatch[2]);

    // Check if it matches a known preset
    const presetId = `bay-${spacingX}m`;
    if (spacingX === spacingY && STRUCTURAL_PRESETS.some(p => p.id === presetId)) {
      return { type: 'preset', presetId, confidence: 0.8 };
    }

    return buildCustomGrid(spacingX, spacingY, spacingX * 4, spacingY * 3, 0.75);
  }

  // 7. Try direct preset name match (fuzzy)
  const directMatch = findPresetByName(trimmed);
  if (directMatch) {
    return { type: 'preset', presetId: directMatch.id, confidence: 0.6 };
  }

  return { type: 'unknown', confidence: 0 };
}

// ============================================================================
// HELPERS
// ============================================================================

function buildCustomGrid(
  spacingX: number,
  spacingY: number,
  totalX: number,
  totalY: number,
  confidence: number,
): NLPGridResult {
  if (spacingX <= 0 || spacingY <= 0 || totalX <= 0 || totalY <= 0) {
    return { type: 'unknown', confidence: 0 };
  }

  const xCount = Math.max(2, Math.floor(totalX / spacingX) + 1);
  const yCount = Math.max(2, Math.floor(totalY / spacingY) + 1);

  const xPositions: number[] = [];
  for (let i = 0; i < xCount; i++) {
    xPositions.push(Math.round(i * spacingX * 10000) / 10000);
  }
  const yPositions: number[] = [];
  for (let i = 0; i < yCount; i++) {
    yPositions.push(Math.round(i * spacingY * 10000) / 10000);
  }

  return {
    type: 'custom',
    xSpacings: xPositions,
    ySpacings: yPositions,
    xLabels: generateLabels(xCount, 'letter'),
    yLabels: generateLabels(yCount, 'number'),
    confidence,
  };
}

function generateLabels(count: number, mode: 'letter' | 'number'): readonly string[] {
  if (mode === 'letter') {
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      if (i < 26) {
        labels.push(String.fromCharCode(65 + i));
      } else {
        labels.push(String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
      }
    }
    return labels;
  }
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

function findPresetByName(input: string): GuideGridPreset | undefined {
  const lower = input.toLowerCase().replace(/[^a-zα-ωά-ώ0-9]/g, '');
  return ALL_PRESETS.find(p => {
    const presetLower = p.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    return lower.includes(presetLower) || presetLower.includes(lower);
  });
}
