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
 * SCOPE: this is the GENERIC locale/precision/template engine (DXF-agnostic). It
 * does NOT convert to the user-selected display unit nor follow the status-bar
 * selector. For READ-ONLY DXF readouts that must follow the cm/m/mm selector
 * (lengths, areas, coordinates) use the display-measurement SSoT
 * `config/display-length-format.ts` (`formatLengthForDisplay` /
 * `formatAreaForDisplay` / `formatCoordinateForDisplay`) — it is the binding layer
 * built ON TOP of this engine (ADR-462). The registry's `formatArea` /
 * `formatCoordinate` / `formatRadius` / `formatDiameter` are @deprecated for that
 * use. Editable INPUTS stay parseable via `config/units.ts` `formatDisplayValue`.
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-082
 * @see config/display-length-format.ts — DXF display-unit binding layer (ADR-462)
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
