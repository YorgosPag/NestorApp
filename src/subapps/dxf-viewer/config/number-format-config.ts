/**
 * 🏢 ADR-082: Enterprise Number Formatting Configuration
 * ======================================================
 *
 * AutoCAD-grade unit and precision settings for DXF Viewer.
 * Single source of truth για number formatting configuration.
 *
 * ✅ ENTERPRISE FEATURES:
 * - AutoCAD LUNITS/LUPREC equivalent
 * - Locale-aware decimal separators
 * - Per-category precision settings
 * - Format templates (DIMPOST equivalent)
 * - Zero suppression options (DIMZIN equivalent)
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-082
 * @created 2026-01-31
 */

// ============================================================================
// UNIT TYPES (AutoCAD LUNITS equivalent)
// ============================================================================

/**
 * Linear unit type - equivalent to AutoCAD LUNITS system variable
 *
 * Values:
 * - scientific: 1.55E+01 (LUNITS=1)
 * - decimal: 15.50 (LUNITS=2) - DEFAULT
 * - engineering: 1'-3.50" (LUNITS=3)
 * - architectural: 1'-3 1/2" (LUNITS=4)
 * - fractional: 15 1/2 (LUNITS=5)
 */
export type LinearUnitType =
  | 'scientific'
  | 'decimal'
  | 'engineering'
  | 'architectural'
  | 'fractional';

/**
 * Angular unit type - equivalent to AutoCAD AUNITS system variable
 *
 * Values:
 * - degrees: 45.50° (AUNITS=0) - DEFAULT
 * - dms: 45°30'0" (AUNITS=1)
 * - grads: 50.00g (AUNITS=2)
 * - radians: 0.7854r (AUNITS=3)
 * - surveyor: N 45°0'0" E (AUNITS=4)
 */
export type AngularUnitType =
  | 'degrees'
  | 'dms'
  | 'grads'
  | 'radians'
  | 'surveyor';

// ============================================================================
// PRECISION CONFIGURATION
// ============================================================================

/**
 * Precision levels (0-8 decimal places)
 * Equivalent to AutoCAD LUPREC/AUPREC system variables
 */
export type Precision = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Per-category precision settings
 * Each category can have its own decimal precision
 */
export interface PrecisionConfig {
  /** Linear measurements (distances, lengths) - default: 2 */
  linear: Precision;
  /** Angular measurements (degrees, radians) - default: 1 */
  angular: Precision;
  /** Area measurements (m², ft²) - default: 2 */
  area: Precision;
  /** Coordinate display (X, Y values) - default: 2 */
  coordinate: Precision;
  /** Percentage values (opacity, zoom) - default: 0 */
  percentage: Precision;
}

// ============================================================================
// ZERO SUPPRESSION (AutoCAD DIMZIN equivalent)
// ============================================================================

/**
 * Zero suppression configuration - equivalent to AutoCAD DIMZIN
 *
 * Controls suppression of leading and trailing zeros in formatted numbers.
 * DIMZIN values: 0-12 (bitfield combinations)
 */
export interface ZeroSuppressionConfig {
  /** Suppress leading zeros (.5 instead of 0.5) - DIMZIN bit 1 */
  suppressLeadingZeros: boolean;
  /** Suppress trailing zeros (12.5 instead of 12.50) - DIMZIN bit 2 */
  suppressTrailingZeros: boolean;
  /** Suppress zero feet in engineering/architectural (3" instead of 0'-3") - DIMZIN bit 3 */
  suppressZeroFeet: boolean;
  /** Suppress zero inches in engineering/architectural (1' instead of 1'-0") - DIMZIN bit 4 */
  suppressZeroInches: boolean;
}

// ============================================================================
// FORMAT TEMPLATE (AutoCAD DIMPOST equivalent)
// ============================================================================

/**
 * Format template for value decoration
 * Equivalent to AutoCAD DIMPOST system variable
 *
 * DIMPOST examples:
 * - "<>mm" → suffix "mm"
 * - "Ø<>" → prefix "Ø" (diameter)
 * - "R<>" → prefix "R" (radius)
 */
export interface FormatTemplate {
  /** Prefix before the value (e.g., "Ø" for diameter, "R" for radius) */
  prefix?: string;
  /** Suffix after the value (e.g., "mm", " m²") */
  suffix?: string;
  /** Symbol immediately after the number (e.g., "°" for degrees) */
  symbol?: string;
}

// ============================================================================
// LOCALE TYPES
// ============================================================================

/**
 * Supported locale identifiers
 */
export type SupportedLocale = 'el-GR' | 'en-US';

/**
 * Decimal separator options
 */
export type DecimalSeparator = '.' | ',' | 'auto';

/**
 * Thousands separator options
 */
export type ThousandsSeparator = ',' | '.' | ' ' | "'" | 'none';

// ============================================================================
// MAIN CONFIGURATION INTERFACE
// ============================================================================

/**
 * 🏢 ENTERPRISE: Complete number formatting configuration
 *
 * This is the main configuration interface for the FormatterRegistry.
 * Follows AutoCAD system variable patterns:
 * - LUNITS/LUPREC for linear units
 * - AUNITS/AUPREC for angular units
 * - DIMZIN for zero suppression
 * - DIMPOST for templates
 * - DIMDSEP for decimal separator
 */
export interface NumberFormatConfig {
  // === UNIT TYPES ===
  /** Linear unit format (AutoCAD LUNITS) */
  linearUnits: LinearUnitType;
  /** Angular unit format (AutoCAD AUNITS) */
  angularUnits: AngularUnitType;

  // === PRECISION ===
  /** Per-category precision settings (AutoCAD LUPREC/AUPREC) */
  precision: PrecisionConfig;

  // === LOCALE ===
  /** Display locale ('auto' = from i18n) */
  locale: SupportedLocale | 'auto';
  /** Decimal separator ('auto' = from locale) */
  decimalSeparator: DecimalSeparator;
  /** Thousands separator ('none' = no grouping) */
  thousandsSeparator: ThousandsSeparator;

  // === ZERO SUPPRESSION ===
  /** Zero suppression options (AutoCAD DIMZIN) */
  zeroSuppression: ZeroSuppressionConfig;

  // === FORMAT TEMPLATES ===
  /** Category-specific format templates (AutoCAD DIMPOST) */
  templates: {
    /** Distance/length template */
    distance: FormatTemplate;
    /** Angle template */
    angle: FormatTemplate;
    /** Area template */
    area: FormatTemplate;
    /** Radius template */
    radius: FormatTemplate;
    /** Diameter template */
    diameter: FormatTemplate;
    /** Coordinate template */
    coordinate: FormatTemplate;
    /** Percentage template */
    percentage: FormatTemplate;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Default number formatting configuration
 *
 * Industry-standard defaults matching AutoCAD behavior:
 * - Decimal units with 2-digit precision
 * - Degrees for angles with 1-digit precision
 * - Locale-aware decimal separator
 * - No trailing zero suppression (CAD standard)
 */
export const DEFAULT_NUMBER_FORMAT_CONFIG: NumberFormatConfig = {
  // Unit types (AutoCAD defaults)
  linearUnits: 'decimal',
  angularUnits: 'degrees',

  // Precision (CAD-standard values)
  precision: {
    linear: 2,      // 12.34
    angular: 1,     // 45.5°
    area: 2,        // 123.45 m²
    coordinate: 2,  // X: 100.00, Y: 200.00
    percentage: 0,  // 75% (no decimals for zoom/opacity)
  },

  // Locale (auto-detect from i18n)
  locale: 'auto',
  decimalSeparator: 'auto',
  thousandsSeparator: 'none', // CAD apps typically don't use thousands separator

  // Zero suppression (AutoCAD defaults - no suppression)
  zeroSuppression: {
    suppressLeadingZeros: false,  // Show 0.5 not .5
    suppressTrailingZeros: false, // Show 12.50 not 12.5
    suppressZeroFeet: true,       // Engineering/Architectural only
    suppressZeroInches: true,     // Engineering/Architectural only
  },

  // Format templates (AutoCAD DIMPOST equivalent)
  templates: {
    distance: { suffix: '' },           // Plain distance
    angle: { symbol: '°' },             // 45.5°
    area: { suffix: ' m²' },            // 123.45 m²
    radius: { prefix: 'R' },            // R50.00
    diameter: { prefix: 'Ø' },          // Ø100.00
    coordinate: { suffix: '' },         // Plain coordinate
    percentage: { symbol: '%' },        // 75%
  },
};

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Greek locale preset
 *
 * Standard Greek formatting:
 * - Comma as decimal separator (1.234,56)
 * - Period as thousands separator (optional)
 */
export const GREEK_FORMAT_PRESET: Partial<NumberFormatConfig> = {
  locale: 'el-GR',
  decimalSeparator: ',',
  thousandsSeparator: '.',
};

/**
 * 🏢 ENTERPRISE: English locale preset
 *
 * Standard English (US) formatting:
 * - Period as decimal separator (1,234.56)
 * - Comma as thousands separator
 */
export const ENGLISH_FORMAT_PRESET: Partial<NumberFormatConfig> = {
  locale: 'en-US',
  decimalSeparator: '.',
  thousandsSeparator: ',',
};

/**
 * 🏢 ENTERPRISE: High precision preset
 *
 * For precise CAD work:
 * - 4-digit linear precision
 * - 2-digit angular precision
 * - 4-digit coordinate precision
 */
export const HIGH_PRECISION_PRESET: Partial<NumberFormatConfig> = {
  precision: {
    linear: 4,
    angular: 2,
    area: 4,
    coordinate: 4,
    percentage: 1,
  },
};

/**
 * 🏢 ENTERPRISE: Architectural preset
 *
 * For architectural drawings:
 * - Architectural units (feet-inches)
 * - DMS angles
 */
export const ARCHITECTURAL_PRESET: Partial<NumberFormatConfig> = {
  linearUnits: 'architectural',
  angularUnits: 'dms',
  templates: {
    distance: { suffix: '' },
    angle: { symbol: '' }, // DMS includes its own symbols
    area: { suffix: ' ft²' },
    radius: { prefix: 'R' },
    diameter: { prefix: 'Ø' },
    coordinate: { suffix: '' },
    percentage: { symbol: '%' },
  },
};

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Check if value is a valid Precision (0-8)
 */
export function isValidPrecision(value: number): value is Precision {
  return Number.isInteger(value) && value >= 0 && value <= 8;
}

/**
 * Check if value is a valid LinearUnitType
 */
export function isValidLinearUnit(value: string): value is LinearUnitType {
  return ['scientific', 'decimal', 'engineering', 'architectural', 'fractional'].includes(value);
}

/**
 * Check if value is a valid AngularUnitType
 */
export function isValidAngularUnit(value: string): value is AngularUnitType {
  return ['degrees', 'dms', 'grads', 'radians', 'surveyor'].includes(value);
}

/**
 * Merge partial config with defaults
 */
export function mergeNumberFormatConfig(
  partial: Partial<NumberFormatConfig>
): NumberFormatConfig {
  return {
    ...DEFAULT_NUMBER_FORMAT_CONFIG,
    ...partial,
    precision: {
      ...DEFAULT_NUMBER_FORMAT_CONFIG.precision,
      ...(partial.precision ?? {}),
    },
    zeroSuppression: {
      ...DEFAULT_NUMBER_FORMAT_CONFIG.zeroSuppression,
      ...(partial.zeroSuppression ?? {}),
    },
    templates: {
      ...DEFAULT_NUMBER_FORMAT_CONFIG.templates,
      ...(partial.templates ?? {}),
    },
  };
}

// ============================================================================
// AUTOCAD SYSTEM VARIABLE MAPPING (Reference)
// ============================================================================

/**
 * AutoCAD System Variable Reference
 *
 * This is documentation-only for developers familiar with AutoCAD.
 *
 * | AutoCAD Variable | This Config Property     | Values                     |
 * |------------------|--------------------------|----------------------------|
 * | LUNITS           | linearUnits              | 1-5 → scientific-fractional|
 * | LUPREC           | precision.linear         | 0-8                        |
 * | AUNITS           | angularUnits             | 0-4 → degrees-surveyor     |
 * | AUPREC           | precision.angular        | 0-8                        |
 * | DIMZIN           | zeroSuppression          | Bitfield 0-12              |
 * | DIMDSEP          | decimalSeparator         | '.' or ','                 |
 * | DIMPOST          | templates.*              | Prefix/suffix strings      |
 */
export const AUTOCAD_VARIABLE_MAPPING = {
  LUNITS: 'linearUnits',
  LUPREC: 'precision.linear',
  AUNITS: 'angularUnits',
  AUPREC: 'precision.angular',
  DIMZIN: 'zeroSuppression',
  DIMDSEP: 'decimalSeparator',
  DIMPOST: 'templates',
} as const;
