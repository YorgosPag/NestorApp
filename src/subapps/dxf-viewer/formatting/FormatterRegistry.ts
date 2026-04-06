/**
 * ADR-082: Enterprise FormatterRegistry
 *
 * AutoCAD rtos()/angtos() equivalent for TypeScript.
 * Central registry for all number formatting operations in DXF Viewer.
 *
 * Split: ADR-065 — Unit-specific formatters extracted to formatter-unit-formats.ts
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-082
 */

import { getCurrentLocale } from '@/lib/intl-utils';
import type {
  NumberFormatConfig,
  LinearUnitType,
  AngularUnitType,
  Precision,
  FormatTemplate,
  SupportedLocale,
} from '../config/number-format-config';
import { mergeNumberFormatConfig } from '../config/number-format-config';
import {
  formatScientific,
  formatEngineering,
  formatArchitectural,
  formatFractional,
  formatDMS,
  formatGrads,
  formatRadians,
  formatSurveyor,
  applyTemplate,
  applyZeroSuppression,
} from './formatter-unit-formats';

// ── Types ────────────────────────────────────────────────────────────

export interface FormattingContext {
  precision?: Precision;
  locale?: SupportedLocale;
  template?: FormatTemplate;
  unitType?: LinearUnitType | AngularUnitType;
  suppressZeros?: boolean;
  useGrouping?: boolean;
}

export interface IFormatter<T = number> {
  readonly name: string;
  readonly category: string;
  canHandle(value: unknown): boolean;
  format(value: T, context?: FormattingContext): string;
}

// ── Registry Class ───────────────────────────────────────────────────

export class FormatterRegistry {
  private static instance: FormatterRegistry | null = null;
  private formatters: Map<string, IFormatter> = new Map();
  private config: NumberFormatConfig;
  private intlCache: Map<string, Intl.NumberFormat> = new Map();

  private constructor(config?: Partial<NumberFormatConfig>) {
    this.config = mergeNumberFormatConfig(config ?? {});
  }

  static getInstance(config?: Partial<NumberFormatConfig>): FormatterRegistry {
    if (!FormatterRegistry.instance) {
      FormatterRegistry.instance = new FormatterRegistry(config);
    }
    return FormatterRegistry.instance;
  }

  static resetInstance(): void {
    FormatterRegistry.instance = null;
  }

  // ── Configuration ──────────────────────────────────────────────────

  getConfig(): Readonly<NumberFormatConfig> {
    return this.config;
  }

  updateConfig(config: Partial<NumberFormatConfig>): void {
    this.config = mergeNumberFormatConfig({ ...this.config, ...config });
    this.intlCache.clear();
  }

  // ── Custom Formatter Registration ──────────────────────────────────

  register(formatter: IFormatter): this {
    this.formatters.set(formatter.name, formatter);
    return this;
  }

  get(name: string): IFormatter | undefined {
    return this.formatters.get(name);
  }

  // ── Public Formatting — Linear (AutoCAD rtos equivalent) ───────────

  formatLinear(value: number, context?: FormattingContext): string {
    const precision = context?.precision ?? this.config.precision.linear;
    const unitType = (context?.unitType ?? this.config.linearUnits) as LinearUnitType;
    const template = context?.template ?? this.config.templates.distance;

    let result = this.formatByUnitType(value, unitType, precision, context);
    result = applyTemplate(result, template);
    result = applyZeroSuppression(result, context?.suppressZeros ?? this.config.zeroSuppression.suppressTrailingZeros);

    return result;
  }

  formatAngular(value: number, context?: FormattingContext): string {
    const precision = context?.precision ?? this.config.precision.angular;
    const unitType = (context?.unitType ?? this.config.angularUnits) as AngularUnitType;
    const template = context?.template ?? this.config.templates.angle;

    let result = this.formatAngleByType(value, unitType, precision, context);
    result = applyTemplate(result, template);

    return result;
  }

  // ── Convenience Methods ────────────────────────────────────────────

  formatDistance(value: number, precision?: Precision): string {
    return this.formatLinear(value, { precision, template: this.config.templates.distance });
  }

  formatRadius(value: number, precision?: Precision): string {
    return this.formatLinear(value, { precision, template: this.config.templates.radius });
  }

  formatDiameter(value: number, precision?: Precision): string {
    return this.formatLinear(value, { precision, template: this.config.templates.diameter });
  }

  formatArea(value: number, precision?: Precision): string {
    const p = precision ?? this.config.precision.area;
    let result = this.formatDecimal(value, p);
    result = applyTemplate(result, this.config.templates.area);
    return result;
  }

  formatAngle(value: number, precision?: Precision): string {
    return this.formatAngular(value, { precision, template: this.config.templates.angle });
  }

  formatCoordinate(value: number, precision?: Precision): string {
    const p = precision ?? this.config.precision.coordinate;
    let result = this.formatDecimal(value, p);
    result = applyTemplate(result, this.config.templates.coordinate);
    return result;
  }

  formatPercent(value: number, includeSymbol: boolean = true): string {
    const percent = Math.round(value * 100);
    return includeSymbol ? `${percent}%` : String(percent);
  }

  formatZoom(scale: number): string {
    return this.formatPercent(scale);
  }

  // ── Private Dispatchers ────────────────────────────────────────────

  private formatByUnitType(
    value: number, unitType: LinearUnitType, precision: Precision, context?: FormattingContext,
  ): string {
    switch (unitType) {
      case 'scientific': return formatScientific(value, precision);
      case 'decimal': return this.formatDecimal(value, precision, context);
      case 'engineering': return formatEngineering(value, precision, this.config.zeroSuppression);
      case 'architectural': return formatArchitectural(value, precision, this.config.zeroSuppression);
      case 'fractional': return formatFractional(value, precision);
      default: return this.formatDecimal(value, precision, context);
    }
  }

  private formatAngleByType(
    value: number, unitType: AngularUnitType, precision: Precision, context?: FormattingContext,
  ): string {
    switch (unitType) {
      case 'degrees': return this.formatDecimal(value, precision, context);
      case 'dms': return formatDMS(value, precision);
      case 'grads': return formatGrads(value, precision);
      case 'radians': return formatRadians(value, precision);
      case 'surveyor': return formatSurveyor(value, precision);
      default: return this.formatDecimal(value, precision, context);
    }
  }

  private formatDecimal(value: number, precision: Precision, context?: FormattingContext): string {
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

  private getEffectiveLocale(override?: SupportedLocale): string {
    if (override) return override;
    if (this.config.locale === 'auto') {
      const i18nLocale = getCurrentLocale();
      return i18nLocale === 'el' || i18nLocale.startsWith('el') ? 'el-GR' : 'en-US';
    }
    return this.config.locale;
  }
}

// ── Singleton Export ──────────────────────────────────────────────────

export function getFormatter(): FormatterRegistry {
  return FormatterRegistry.getInstance();
}
