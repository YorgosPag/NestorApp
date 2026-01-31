/**
 * 🏢 ADR-082: Enterprise Number Formatting System
 * ===============================================
 *
 * Central exports for the number formatting system.
 *
 * @example
 * ```typescript
 * // Registry usage (non-React)
 * import { FormatterRegistry, getFormatter } from '@/subapps/dxf-viewer/formatting';
 *
 * const fmt = getFormatter();
 * console.log(fmt.formatDistance(1234.567));
 * console.log(fmt.formatAngle(45.5));
 *
 * // React hook usage
 * import { useFormatter } from '@/subapps/dxf-viewer/formatting';
 *
 * function MyComponent() {
 *   const { formatDistance, formatAngle } = useFormatter();
 *   return <div>{formatDistance(100)}</div>;
 * }
 * ```
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-082
 * @created 2026-01-31
 */

// ============================================================================
// REGISTRY & CORE
// ============================================================================

export {
  FormatterRegistry,
  getFormatter,
  type IFormatter,
  type FormattingContext,
} from './FormatterRegistry';

// ============================================================================
// REACT HOOKS
// ============================================================================

export {
  useFormatter,
  useDistanceFormat,
  useAngleFormat,
  useCoordinateFormat,
  useZoomFormat,
  type UseFormatterResult,
} from './useFormatter';

// ============================================================================
// CONFIGURATION (re-export from config)
// ============================================================================

export {
  // Types
  type NumberFormatConfig,
  type LinearUnitType,
  type AngularUnitType,
  type Precision,
  type PrecisionConfig,
  type FormatTemplate,
  type ZeroSuppressionConfig,
  type SupportedLocale,
  type DecimalSeparator,
  type ThousandsSeparator,

  // Default config
  DEFAULT_NUMBER_FORMAT_CONFIG,

  // Presets
  GREEK_FORMAT_PRESET,
  ENGLISH_FORMAT_PRESET,
  HIGH_PRECISION_PRESET,
  ARCHITECTURAL_PRESET,

  // Utilities
  isValidPrecision,
  isValidLinearUnit,
  isValidAngularUnit,
  mergeNumberFormatConfig,

  // Reference (documentation)
  AUTOCAD_VARIABLE_MAPPING,
} from '../config/number-format-config';
