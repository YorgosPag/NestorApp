/**
 * 🏢 ADR-082: React Hook for FormatterRegistry
 * =============================================
 *
 * Provides locale-aware formatting in React components.
 * Integrates with i18n for automatic locale updates.
 *
 * ✅ ENTERPRISE FEATURES:
 * - Automatic locale synchronization with i18n
 * - Memoized formatter functions
 * - Full TypeScript support
 * - Re-renders on locale change
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-082
 * @created 2026-01-31
 */

import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FormatterRegistry, FormattingContext } from './FormatterRegistry';
import type { Precision, SupportedLocale } from '../config/number-format-config';

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

/**
 * Return type for useFormatter hook
 */
export interface UseFormatterResult {
  /** The FormatterRegistry instance */
  registry: FormatterRegistry;

  /** Current effective locale */
  locale: SupportedLocale;

  // === LINEAR FORMATTING ===
  /** Format distance value */
  formatDistance: (value: number, precision?: Precision) => string;
  /** Format radius value (with R prefix) */
  formatRadius: (value: number, precision?: Precision) => string;
  /** Format diameter value (with Ø prefix) */
  formatDiameter: (value: number, precision?: Precision) => string;
  /** Format area value (with m² suffix) */
  formatArea: (value: number, precision?: Precision) => string;

  // === ANGULAR FORMATTING ===
  /** Format angle value (with ° symbol) */
  formatAngle: (value: number, precision?: Precision) => string;

  // === COORDINATE FORMATTING ===
  /** Format coordinate value */
  formatCoordinate: (value: number, precision?: Precision) => string;

  // === PERCENTAGE FORMATTING ===
  /** Format percentage value (decimal 0-1 → 0%-100%) */
  formatPercent: (value: number, includeSymbol?: boolean) => string;
  /** Format zoom level as percentage */
  formatZoom: (scale: number) => string;

  // === GENERIC FORMATTING ===
  /** Format any linear value with context */
  formatLinear: (value: number, context?: FormattingContext) => string;
  /** Format any angular value with context */
  formatAngular: (value: number, context?: FormattingContext) => string;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: React hook for number formatting
 *
 * Provides memoized formatting functions that respect the current i18n locale.
 * Automatically updates when the language changes.
 *
 * @example
 * ```tsx
 * function DistanceDisplay({ value }: { value: number }) {
 *   const { formatDistance } = useFormatter();
 *   return <span>{formatDistance(value)}</span>;
 * }
 *
 * // With precision override
 * function PreciseDistance({ value }: { value: number }) {
 *   const { formatDistance } = useFormatter();
 *   return <span>{formatDistance(value, 4)}</span>;
 * }
 * ```
 */
export function useFormatter(): UseFormatterResult {
  // Get i18n language for locale synchronization
  const { i18n } = useTranslation();

  // Determine effective locale from i18n
  const locale: SupportedLocale = useMemo(() => {
    const lang = i18n.language;
    if (lang === 'el' || lang.startsWith('el')) {
      return 'el-GR';
    }
    return 'en-US';
  }, [i18n.language]);

  // Get/update registry with current locale
  const registry = useMemo(() => {
    const reg = FormatterRegistry.getInstance();
    reg.updateConfig({ locale });
    return reg;
  }, [locale]);

  // === MEMOIZED FORMATTING FUNCTIONS ===

  const formatDistance = useCallback(
    (value: number, precision?: Precision) => registry.formatDistance(value, precision),
    [registry]
  );

  const formatRadius = useCallback(
    (value: number, precision?: Precision) => registry.formatRadius(value, precision),
    [registry]
  );

  const formatDiameter = useCallback(
    (value: number, precision?: Precision) => registry.formatDiameter(value, precision),
    [registry]
  );

  const formatArea = useCallback(
    (value: number, precision?: Precision) => registry.formatArea(value, precision),
    [registry]
  );

  const formatAngle = useCallback(
    (value: number, precision?: Precision) => registry.formatAngle(value, precision),
    [registry]
  );

  const formatCoordinate = useCallback(
    (value: number, precision?: Precision) => registry.formatCoordinate(value, precision),
    [registry]
  );

  const formatPercent = useCallback(
    (value: number, includeSymbol?: boolean) => registry.formatPercent(value, includeSymbol),
    [registry]
  );

  const formatZoom = useCallback(
    (scale: number) => registry.formatZoom(scale),
    [registry]
  );

  const formatLinear = useCallback(
    (value: number, context?: FormattingContext) => registry.formatLinear(value, context),
    [registry]
  );

  const formatAngular = useCallback(
    (value: number, context?: FormattingContext) => registry.formatAngular(value, context),
    [registry]
  );

  return {
    registry,
    locale,
    formatDistance,
    formatRadius,
    formatDiameter,
    formatArea,
    formatAngle,
    formatCoordinate,
    formatPercent,
    formatZoom,
    formatLinear,
    formatAngular,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for distance formatting only
 *
 * Lighter-weight alternative when only distance formatting is needed.
 *
 * @example
 * ```tsx
 * function LineLabel({ distance }: { distance: number }) {
 *   const format = useDistanceFormat();
 *   return <span>{format(distance)}</span>;
 * }
 * ```
 */
export function useDistanceFormat(): (value: number, precision?: Precision) => string {
  const { formatDistance } = useFormatter();
  return formatDistance;
}

/**
 * Hook for angle formatting only
 *
 * @example
 * ```tsx
 * function AngleLabel({ angle }: { angle: number }) {
 *   const format = useAngleFormat();
 *   return <span>{format(angle)}</span>;
 * }
 * ```
 */
export function useAngleFormat(): (value: number, precision?: Precision) => string {
  const { formatAngle } = useFormatter();
  return formatAngle;
}

/**
 * Hook for coordinate formatting only
 *
 * @example
 * ```tsx
 * function CoordinateDisplay({ x, y }: { x: number; y: number }) {
 *   const format = useCoordinateFormat();
 *   return <span>({format(x)}, {format(y)})</span>;
 * }
 * ```
 */
export function useCoordinateFormat(): (value: number, precision?: Precision) => string {
  const { formatCoordinate } = useFormatter();
  return formatCoordinate;
}

/**
 * Hook for zoom/percentage formatting only
 *
 * @example
 * ```tsx
 * function ZoomIndicator({ scale }: { scale: number }) {
 *   const format = useZoomFormat();
 *   return <span>{format(scale)}</span>;
 * }
 * ```
 */
export function useZoomFormat(): (scale: number) => string {
  const { formatZoom } = useFormatter();
  return formatZoom;
}
