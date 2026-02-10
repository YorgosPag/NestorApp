/**
 * 🏢 ADR-082: Enterprise FormatterRegistry
 * =========================================
 *
 * AutoCAD rtos()/angtos() equivalent for TypeScript.
 * Central registry for all number formatting operations in DXF Viewer.
 *
 * ✅ ENTERPRISE FEATURES:
 * - Singleton pattern for consistent formatting
 * - Locale-aware via Intl.NumberFormat
 * - Cached formatters for performance
 * - Hierarchical overrides (Global → Context → Per-call)
 * - Full TypeScript (ZERO any)
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-082
 * @see AutoCAD: rtos() - Real TO String conversion
 * @see AutoCAD: angtos() - ANGle TO String conversion
 * @created 2026-01-31
 */

import { getCurrentLocale } from '@/lib/intl-utils';
// 🏢 ADR-100: Centralized Degrees-to-Radians Conversion
import { degToRad } from '../rendering/entities/shared/geometry-utils';
import type {
  NumberFormatConfig,
  LinearUnitType,
  AngularUnitType,
  Precision,
  FormatTemplate,
  SupportedLocale,
} from '../config/number-format-config';
import {
  mergeNumberFormatConfig,
} from '../config/number-format-config';

// ============================================================================
// FORMATTING CONTEXT (Per-call overrides)
// ============================================================================

/**
 * Context for per-call formatting overrides
 *
 * This allows overriding any aspect of formatting for a single call.
 * Follows the AutoCAD pattern where dimension styles can override drawing settings.
 */
export interface FormattingContext {
  /** Override precision for this call */
  precision?: Precision;
  /** Override locale for this call */
  locale?: SupportedLocale;
  /** Override template for this call */
  template?: FormatTemplate;
  /** Override unit type for this call */
  unitType?: LinearUnitType | AngularUnitType;
  /** Suppress trailing zeros for this call */
  suppressZeros?: boolean;
  /** Use grouping (thousands separator) */
  useGrouping?: boolean;
}

// ============================================================================
// FORMATTER INTERFACE
// ============================================================================

/**
 * Interface for pluggable formatters
 *
 * Allows extending the registry with custom formatters.
 */
export interface IFormatter<T = number> {
  /** Unique formatter name */
  readonly name: string;
  /** Formatter category (linear, angular, etc.) */
  readonly category: string;
  /** Check if this formatter can handle the value */
  canHandle(value: unknown): boolean;
  /** Format the value to string */
  format(value: T, context?: FormattingContext): string;
}

// ============================================================================
// REGISTRY CLASS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Central Number Formatting Registry
 *
 * Singleton class that manages all number formatting for DXF Viewer.
 * Replaces scattered .toFixed() calls with locale-aware, configurable formatting.
 *
 * Usage:
 * ```typescript
 * const registry = FormatterRegistry.getInstance();
 *
 * // Basic formatting
 * registry.formatDistance(1234.567);  // "1.234,57" (el-GR) or "1,234.57" (en-US)
 *
 * // With context override
 * registry.formatLinear(1234.567, { precision: 4 });  // "1.234,5670"
 *
 * // Update global config
 * registry.updateConfig({ locale: 'en-US' });
 * ```
 */
export class FormatterRegistry {
  // Singleton instance
  private static instance: FormatterRegistry | null = null;

  // Custom formatters registry
  private formatters: Map<string, IFormatter> = new Map();

  // Current configuration
  private config: NumberFormatConfig;

  // Cached Intl.NumberFormat instances for performance
  private intlCache: Map<string, Intl.NumberFormat> = new Map();

  // ========================================================================
  // CONSTRUCTOR & SINGLETON
  // ========================================================================

  private constructor(config?: Partial<NumberFormatConfig>) {
    this.config = mergeNumberFormatConfig(config ?? {});
  }

  /**
   * Get the singleton instance
   *
   * @param config - Optional initial configuration (only used on first call)
   */
  static getInstance(config?: Partial<NumberFormatConfig>): FormatterRegistry {
    if (!FormatterRegistry.instance) {
      FormatterRegistry.instance = new FormatterRegistry(config);
    }
    return FormatterRegistry.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    FormatterRegistry.instance = null;
  }

  // ========================================================================
  // CONFIGURATION MANAGEMENT
  // ========================================================================

  /**
   * Get current configuration
   */
  getConfig(): Readonly<NumberFormatConfig> {
    return this.config;
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<NumberFormatConfig>): void {
    this.config = mergeNumberFormatConfig({ ...this.config, ...config });
    this.intlCache.clear(); // Clear cache on config change
  }

  // ========================================================================
  // CUSTOM FORMATTER REGISTRATION
  // ========================================================================

  /**
   * Register a custom formatter
   *
   * @param formatter - Formatter implementing IFormatter interface
   */
  register(formatter: IFormatter): this {
    this.formatters.set(formatter.name, formatter);
    return this;
  }

  /**
   * Get a registered formatter by name
   */
  get(name: string): IFormatter | undefined {
    return this.formatters.get(name);
  }

  // ========================================================================
  // PUBLIC FORMATTING METHODS - LINEAR (AutoCAD rtos equivalent)
  // ========================================================================

  /**
   * Format linear value (distance, radius, etc.)
   *
   * Equivalent to AutoCAD's rtos() function.
   * Respects LUNITS and LUPREC settings.
   *
   * @param value - Numeric value to format
   * @param context - Optional formatting overrides
   */
  formatLinear(value: number, context?: FormattingContext): string {
    const precision = context?.precision ?? this.config.precision.linear;
    const unitType = (context?.unitType ?? this.config.linearUnits) as LinearUnitType;
    const template = context?.template ?? this.config.templates.distance;

    let result = this.formatByUnitType(value, unitType, precision, context);
    result = this.applyTemplate(result, template);
    result = this.applyZeroSuppression(result, context?.suppressZeros);

    return result;
  }

  /**
   * Format angular value
   *
   * Equivalent to AutoCAD's angtos() function.
   * Respects AUNITS and AUPREC settings.
   *
   * @param value - Angle value in degrees
   * @param context - Optional formatting overrides
   */
  formatAngular(value: number, context?: FormattingContext): string {
    const precision = context?.precision ?? this.config.precision.angular;
    const unitType = (context?.unitType ?? this.config.angularUnits) as AngularUnitType;
    const template = context?.template ?? this.config.templates.angle;

    let result = this.formatAngleByType(value, unitType, precision, context);
    result = this.applyTemplate(result, template);

    return result;
  }

  // ========================================================================
  // CONVENIENCE METHODS
  // ========================================================================

  /**
   * Format distance value
   *
   * Uses linear formatting with distance template.
   *
   * @param value - Distance value
   * @param precision - Optional precision override
   */
  formatDistance(value: number, precision?: Precision): string {
    return this.formatLinear(value, {
      precision,
      template: this.config.templates.distance,
    });
  }

  /**
   * Format radius value (with R prefix)
   *
   * @param value - Radius value
   * @param precision - Optional precision override
   */
  formatRadius(value: number, precision?: Precision): string {
    return this.formatLinear(value, {
      precision,
      template: this.config.templates.radius,
    });
  }

  /**
   * Format diameter value (with Ø prefix)
   *
   * @param value - Diameter value
   * @param precision - Optional precision override
   */
  formatDiameter(value: number, precision?: Precision): string {
    return this.formatLinear(value, {
      precision,
      template: this.config.templates.diameter,
    });
  }

  /**
   * Format area value
   *
   * @param value - Area value
   * @param precision - Optional precision override
   */
  formatArea(value: number, precision?: Precision): string {
    const effectivePrecision = precision ?? this.config.precision.area;
    const template = this.config.templates.area;

    let result = this.formatDecimal(value, effectivePrecision);
    result = this.applyTemplate(result, template);

    return result;
  }

  /**
   * Format angle value (with degree symbol)
   *
   * @param value - Angle in degrees
   * @param precision - Optional precision override
   */
  formatAngle(value: number, precision?: Precision): string {
    return this.formatAngular(value, {
      precision,
      template: this.config.templates.angle,
    });
  }

  /**
   * Format coordinate value
   *
   * @param value - Coordinate value (X or Y)
   * @param precision - Optional precision override
   */
  formatCoordinate(value: number, precision?: Precision): string {
    const effectivePrecision = precision ?? this.config.precision.coordinate;
    const template = this.config.templates.coordinate;

    let result = this.formatDecimal(value, effectivePrecision);
    result = this.applyTemplate(result, template);

    return result;
  }

  /**
   * Format percentage value
   *
   * Converts decimal (0-1) to percentage (0%-100%).
   *
   * @param value - Decimal value (0.75 → 75%)
   * @param includeSymbol - Include % symbol (default: true)
   */
  formatPercent(value: number, includeSymbol: boolean = true): string {
    const percent = Math.round(value * 100);
    return includeSymbol ? `${percent}%` : String(percent);
  }

  /**
   * Format zoom level as percentage
   *
   * @param scale - Zoom scale (1.0 = 100%)
   */
  formatZoom(scale: number): string {
    return this.formatPercent(scale);
  }

  // ========================================================================
  // PRIVATE FORMATTING HELPERS
  // ========================================================================

  /**
   * Format value based on linear unit type
   */
  private formatByUnitType(
    value: number,
    unitType: LinearUnitType,
    precision: Precision,
    context?: FormattingContext
  ): string {
    switch (unitType) {
      case 'scientific':
        return this.formatScientific(value, precision);
      case 'decimal':
        return this.formatDecimal(value, precision, context);
      case 'engineering':
        return this.formatEngineering(value, precision);
      case 'architectural':
        return this.formatArchitectural(value, precision);
      case 'fractional':
        return this.formatFractional(value, precision);
      default:
        return this.formatDecimal(value, precision, context);
    }
  }

  /**
   * Format angle based on angular unit type
   */
  private formatAngleByType(
    value: number,
    unitType: AngularUnitType,
    precision: Precision,
    context?: FormattingContext
  ): string {
    switch (unitType) {
      case 'degrees':
        return this.formatDecimal(value, precision, context);
      case 'dms':
        return this.formatDMS(value, precision);
      case 'grads':
        return this.formatGrads(value, precision);
      case 'radians':
        return this.formatRadians(value, precision);
      case 'surveyor':
        return this.formatSurveyor(value, precision);
      default:
        return this.formatDecimal(value, precision, context);
    }
  }

  /**
   * Format as decimal number with locale-aware separators
   */
  private formatDecimal(
    value: number,
    precision: Precision,
    context?: FormattingContext
  ): string {
    const locale = this.getEffectiveLocale(context?.locale);
    const useGrouping = context?.useGrouping ?? this.config.thousandsSeparator !== 'none';
    const cacheKey = `decimal-${locale}-${precision}-${useGrouping}`;

    let formatter = this.intlCache.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
        useGrouping,
      });
      this.intlCache.set(cacheKey, formatter);
    }

    return formatter.format(value);
  }

  /**
   * Format as scientific notation (1.55E+01)
   */
  private formatScientific(value: number, precision: Precision): string {
    return value.toExponential(precision).toUpperCase();
  }

  /**
   * Format as engineering units (feet-inches decimal)
   *
   * Example: 15.5 inches → 1'-3.50"
   */
  private formatEngineering(value: number, precision: Precision): string {
    // Value is assumed to be in inches
    const feet = Math.floor(Math.abs(value) / 12);
    const inches = Math.abs(value) % 12;
    const sign = value < 0 ? '-' : '';

    const suppress = this.config.zeroSuppression;

    if (feet === 0 && suppress.suppressZeroFeet) {
      return `${sign}${inches.toFixed(precision)}"`;
    }

    if (inches === 0 && suppress.suppressZeroInches) {
      return `${sign}${feet}'`;
    }

    return `${sign}${feet}'-${inches.toFixed(precision)}"`;
  }

  /**
   * Format as architectural units (feet-inches fractional)
   *
   * Example: 15.5 inches → 1'-3 1/2"
   */
  private formatArchitectural(value: number, precision: Precision): string {
    // Value is assumed to be in inches
    const feet = Math.floor(Math.abs(value) / 12);
    const inches = Math.floor(Math.abs(value) % 12);
    const fraction = (Math.abs(value) % 1);
    const sign = value < 0 ? '-' : '';

    const suppress = this.config.zeroSuppression;

    // Convert fraction to nearest power of 2 based on precision
    const denominator = Math.pow(2, precision);
    const numerator = Math.round(fraction * denominator);
    const fractionStr = numerator > 0 ? ` ${numerator}/${denominator}` : '';

    if (feet === 0 && suppress.suppressZeroFeet) {
      return `${sign}${inches}${fractionStr}"`;
    }

    if (inches === 0 && fractionStr === '' && suppress.suppressZeroInches) {
      return `${sign}${feet}'`;
    }

    return `${sign}${feet}'-${inches}${fractionStr}"`;
  }

  /**
   * Format as fractional (15 1/2)
   */
  private formatFractional(value: number, precision: Precision): string {
    const whole = Math.floor(Math.abs(value));
    const fraction = Math.abs(value) % 1;
    const sign = value < 0 ? '-' : '';

    // Convert fraction to nearest power of 2 based on precision
    const denominator = Math.pow(2, Math.max(1, precision));
    const numerator = Math.round(fraction * denominator);

    if (numerator === 0) {
      return `${sign}${whole}`;
    }

    // Simplify fraction
    const gcd = this.gcd(numerator, denominator);
    const simplifiedNum = numerator / gcd;
    const simplifiedDen = denominator / gcd;

    if (whole === 0) {
      return `${sign}${simplifiedNum}/${simplifiedDen}`;
    }

    return `${sign}${whole} ${simplifiedNum}/${simplifiedDen}`;
  }

  /**
   * Format as degrees-minutes-seconds (45°30'0")
   */
  private formatDMS(degrees: number, precision: Precision): string {
    const sign = degrees < 0 ? '-' : '';
    const absDeg = Math.abs(degrees);
    const d = Math.floor(absDeg);
    const minFloat = (absDeg - d) * 60;
    const m = Math.floor(minFloat);
    const s = (minFloat - m) * 60;

    return `${sign}${d}°${m}'${s.toFixed(precision)}"`;
  }

  /**
   * Format as grads (50.00g)
   */
  private formatGrads(degrees: number, precision: Precision): string {
    const grads = degrees * (400 / 360);
    return `${grads.toFixed(precision)}g`;
  }

  /**
   * Format as radians (0.7854r)
   * 🏢 ADR-100: Uses centralized degToRad() conversion
   */
  private formatRadians(degrees: number, precision: Precision): string {
    const radians = degToRad(degrees);
    return `${radians.toFixed(precision)}r`;
  }

  /**
   * Format as surveyor angle (N 45°0'0" E)
   */
  private formatSurveyor(degrees: number, precision: Precision): string {
    // Normalize to 0-360
    let angle = ((degrees % 360) + 360) % 360;

    let ns: string;
    let ew: string;
    let bearing: number;

    if (angle <= 90) {
      ns = 'N';
      ew = 'E';
      bearing = angle;
    } else if (angle <= 180) {
      ns = 'S';
      ew = 'E';
      bearing = 180 - angle;
    } else if (angle <= 270) {
      ns = 'S';
      ew = 'W';
      bearing = angle - 180;
    } else {
      ns = 'N';
      ew = 'W';
      bearing = 360 - angle;
    }

    // Format bearing as DMS without sign
    const d = Math.floor(bearing);
    const minFloat = (bearing - d) * 60;
    const m = Math.floor(minFloat);
    const s = (minFloat - m) * 60;

    return `${ns} ${d}°${m}'${s.toFixed(precision)}" ${ew}`;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get effective locale
   */
  private getEffectiveLocale(override?: SupportedLocale): string {
    if (override) {
      return override;
    }

    if (this.config.locale === 'auto') {
      const i18nLocale = getCurrentLocale();
      // Map i18n locale to full locale code
      if (i18nLocale === 'el' || i18nLocale.startsWith('el')) {
        return 'el-GR';
      }
      return 'en-US';
    }

    return this.config.locale;
  }

  /**
   * Apply format template (prefix/suffix/symbol)
   */
  private applyTemplate(value: string, template: FormatTemplate): string {
    const prefix = template.prefix ?? '';
    const suffix = template.suffix ?? '';
    const symbol = template.symbol ?? '';
    return `${prefix}${value}${symbol}${suffix}`;
  }

  /**
   * Apply zero suppression
   */
  private applyZeroSuppression(value: string, suppress?: boolean): string {
    const shouldSuppress = suppress ?? this.config.zeroSuppression.suppressTrailingZeros;

    if (!shouldSuppress) {
      return value;
    }

    // Remove trailing zeros after decimal point
    // Handle both '.' and ',' decimal separators
    return value
      .replace(/([.,]\d*?)0+$/, '$1')
      .replace(/[.,]$/, '');
  }

  /**
   * Calculate greatest common divisor (for fraction simplification)
   */
  private gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Get the FormatterRegistry singleton instance
 *
 * Convenience function for accessing the registry.
 *
 * @example
 * ```typescript
 * import { getFormatter } from './FormatterRegistry';
 *
 * const fmt = getFormatter();
 * console.log(fmt.formatDistance(1234.567));
 * ```
 */
export function getFormatter(): FormatterRegistry {
  return FormatterRegistry.getInstance();
}
