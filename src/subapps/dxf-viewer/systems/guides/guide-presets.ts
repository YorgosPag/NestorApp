/**
 * @module systems/guides/guide-presets
 * @description Structural grid presets for construction engineers (ADR-189 B23)
 *
 * Predefined bay grids following common structural engineering spans.
 * Labels follow AutoCAD/Revit convention:
 * - X (vertical) → A, B, C, ...
 * - Y (horizontal) → 1, 2, 3, ...
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-03-06
 */

// ============================================================================
// TYPES
// ============================================================================

/** A predefined structural grid preset */
export interface GuideGridPreset {
  /** Unique preset identifier (e.g. 'bay-4m') */
  readonly id: string;
  /** i18n key for the preset name */
  readonly nameKey: string;
  /** Absolute X offsets in world units (meters) */
  readonly xSpacings: readonly number[];
  /** Absolute Y offsets in world units (meters) */
  readonly ySpacings: readonly number[];
  /** Optional labels for X guides — defaults to A, B, C, ... */
  readonly xLabels?: readonly string[];
  /** Optional labels for Y guides — defaults to 1, 2, 3, ... */
  readonly yLabels?: readonly string[];
  /** B72/B95/B98/B101: Preset category for filtering */
  readonly category?: 'structural' | 'eco' | 'seismic' | 'iso19650' | 'din-vob';
  /** Tooltip description for the preset */
  readonly description?: string;
}

// ============================================================================
// STRUCTURAL PRESETS
// ============================================================================

/**
 * Auto-generate letter labels (A, B, C, ... Z, AA, AB, ...) for a given count.
 */
export function generateLetterLabels(count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      labels.push(String.fromCharCode(65 + i));
    } else {
      const first = String.fromCharCode(65 + Math.floor(i / 26) - 1);
      const second = String.fromCharCode(65 + (i % 26));
      labels.push(first + second);
    }
  }
  return labels;
}

/**
 * Auto-generate number labels (1, 2, 3, ...) for a given count.
 */
export function generateNumberLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

/** Standard structural grid presets — common bay spans */
export const STRUCTURAL_PRESETS: readonly GuideGridPreset[] = [
  {
    id: 'bay-4m',
    nameKey: 'tools.presetBay4m',
    xSpacings: [0, 4, 8, 12, 16],
    ySpacings: [0, 4, 8, 12],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'bay-5m',
    nameKey: 'tools.presetBay5m',
    xSpacings: [0, 5, 10, 15, 20],
    ySpacings: [0, 5, 10, 15],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'bay-6m',
    nameKey: 'tools.presetBay6m',
    xSpacings: [0, 6, 12, 18, 24],
    ySpacings: [0, 6, 12, 18],
    xLabels: generateLetterLabels(5),
    yLabels: generateNumberLabels(4),
  },
  {
    id: 'bay-8m',
    nameKey: 'tools.presetBay8m',
    xSpacings: [0, 8, 16, 24],
    ySpacings: [0, 8, 16],
    xLabels: generateLetterLabels(4),
    yLabels: generateNumberLabels(3),
  },
] as const;

/**
 * Find a preset by ID.
 */
export function getPresetById(id: string): GuideGridPreset | undefined {
  return STRUCTURAL_PRESETS.find(p => p.id === id);
}

/**
 * Parse custom spacings string into number array.
 * Accepts comma-separated values: "0,5,10,15"
 * Returns null if invalid.
 */
export function parseCustomSpacings(input: string): number[] | null {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const values: number[] = [];
  for (const part of parts) {
    const num = parseFloat(part);
    if (isNaN(num)) return null;
    values.push(num);
  }

  return values;
}
