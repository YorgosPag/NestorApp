/**
 * CHART COMPONENTS COMPANION STYLING MODULE
 * Enterprise-class centralized styling για Chart components
 *
 * ✅ ENTERPRISE REFACTORED: Inline styles → Centralized tokens
 * ✅ TypeScript strict typing - NO 'any' types
 * ✅ Dynamic color management with type safety
 * ✅ Fortune 500 grade data visualization patterns
 *
 * @module ChartComponents.styles
 */

import { layoutUtilities } from '../../../styles/design-tokens';

// Access chart components από το main design tokens object
const { chartComponents } = layoutUtilities;

// ============================================================================
// CHART LEGEND STYLING UTILITIES
// ============================================================================

/**
 * Get legend container styles με position awareness
 */
export const getLegendContainerStyles = (verticalAlign: 'top' | 'bottom' = 'bottom') => ({
  ...chartComponents.legend.container,
  ...chartComponents.legend.positioning[verticalAlign]
});

/**
 * Get legend item base styles
 */
export const getLegendItemStyles = () => chartComponents.legend.item.base;

/**
 * Get legend icon styles
 */
export const getLegendIconStyles = () => chartComponents.legend.item.icon;

/**
 * Get dynamic color indicator styles
 * Replaces: style={{ backgroundColor: item.color }}
 *
 * @param color - Dynamic color value
 * @returns Enterprise-grade styling object
 */
export const getLegendIndicatorStyles = (color: string) => ({
  ...chartComponents.legend.indicator.base,
  ...chartComponents.legend.indicator.withColor(color)
});

// ============================================================================
// CHART TOOLTIP INDICATOR STYLING UTILITIES
// ============================================================================

/**
 * Chart tooltip indicator types
 */
export type TooltipIndicatorType = 'dot' | 'line' | 'dashed';

/**
 * Get tooltip indicator styles με type-specific patterns (STYLE ONLY)
 */
export const getTooltipIndicatorStyles = (
  indicator: TooltipIndicatorType,
  color?: string,
  nestLabel?: boolean
) => {
  const baseStyles = chartComponents.tooltip.indicator[indicator];
  const colorStyles = color ? chartComponents.tooltip.indicator.withColor(color) : {};
  const cssVariableStyles = chartComponents.tooltip.indicator.cssVariables;

  // Additional styling για dashed με nesting
  const nestingStyles = nestLabel && indicator === 'dashed'
    ? { margin: '2px 0' }
    : {};

  return {
    ...baseStyles,
    ...cssVariableStyles,
    ...colorStyles,
    ...nestingStyles
  };
};

/**
 * Get tooltip indicator className (SEPARATED)
 * Replaces: Mixed className + style object return
 */
export const getTooltipIndicatorClassName = (
  indicator: TooltipIndicatorType,
  nestLabel?: boolean
) => {
  return [
    'shrink-0 rounded-[2px]',
    indicator === 'dot' ? 'h-2.5 w-2.5' : '',
    indicator === 'line' ? 'w-1' : '',
    indicator === 'dashed' ? 'w-0 border-[1.5px] border-dashed bg-transparent' : '',
    nestLabel && indicator === 'dashed' ? 'my-0.5' : ''
  ].filter(Boolean).join(' ');
};

/**
 * Get tooltip container styles
 */
export const getTooltipContainerStyles = () => chartComponents.tooltip.container.base;

/**
 * Get tooltip content styles
 */
export const getTooltipContentStyles = () => chartComponents.tooltip.container.content;

// ============================================================================
// CHART CONTAINER STYLING UTILITIES
// ============================================================================

/**
 * Chart container size options
 */
export type ChartContainerSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Get chart container styles με size variants
 */
export const getChartContainerStyles = (
  size?: ChartContainerSize,
  responsive = false
) => {
  const baseStyles = chartComponents.container.base;
  const responsiveStyles = responsive ? chartComponents.container.responsive : {};
  const sizeStyles = size ? chartComponents.container.sizes[size] : {};

  return {
    ...baseStyles,
    ...responsiveStyles,
    ...sizeStyles
  };
};

// ============================================================================
// CHART AXIS STYLING UTILITIES
// ============================================================================

/**
 * Get chart axis line styles
 */
export const getChartAxisLineStyles = () => chartComponents.axis.line;

/**
 * Get chart axis tick styles
 */
export const getChartAxisTickStyles = () => chartComponents.axis.tick;

/**
 * Get chart axis label styles
 */
export const getChartAxisLabelStyles = () => chartComponents.axis.label;

// ============================================================================
// CHART COLOR UTILITIES
// ============================================================================

/**
 * Get chart color by index (για consistent data series)
 */
export const getChartColorByIndex = (index: number, secondary = false) => {
  const palette = secondary ? chartComponents.colors.secondary : chartComponents.colors.primary;
  return palette[index % palette.length];
};

/**
 * Get status-based chart color
 */
export const getChartStatusColor = (status: 'success' | 'warning' | 'error' | 'info' | 'neutral') =>
  chartComponents.colors.status[status];

/**
 * Get grid line colors
 */
export const getChartGridColors = () => chartComponents.colors.grid;

// ============================================================================
// CHART ANIMATION UTILITIES
// ============================================================================

/**
 * Get chart fade in animation styles
 */
export const getChartFadeInStyles = () => chartComponents.animations.fadeIn;

/**
 * Get chart slide up animation styles
 */
export const getChartSlideUpStyles = () => chartComponents.animations.slideUp;

/**
 * Get chart scale animation styles
 */
export const getChartScaleStyles = () => chartComponents.animations.scale;

// ============================================================================
// ADVANCED TYPE DEFINITIONS
// ============================================================================

/**
 * Chart legend configuration interface
 */
export interface ChartLegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  hideIcon?: boolean;
  nameKey?: string;
}

/**
 * Chart tooltip configuration interface
 */
export interface ChartTooltipConfig {
  show: boolean;
  indicator: TooltipIndicatorType;
  color?: string;
  hasIcon?: boolean;
  nestLabel?: boolean;
}

/**
 * Chart payload item interface (replacing 'any' types)
 */
export interface ChartPayloadItem {
  dataKey?: string;
  value: string | number;
  color: string;
  payload?: Record<string, unknown>;
  label?: string;
}

/**
 * Chart legend props interface (replacing 'any' types)
 */
export interface ChartLegendProps {
  payload?: ChartPayloadItem[];
  verticalAlign?: 'top' | 'bottom';
  hideIcon?: boolean;
  nameKey?: string;
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Build chart class names utility
 */
export const buildChartClassNames = (...classes: (string | undefined)[]) =>
  classes.filter(Boolean).join(' ');

/**
 * Chart responsive utility
 */
export const getResponsiveChartStyles = (
  breakpoint: 'sm' | 'md' | 'lg' | 'xl' = 'md'
) => ({
  width: '100%',
  height: 'auto',
  minHeight: chartComponents.container.sizes[breakpoint].height
});

/**
 * ✅ CHART COMPONENTS STYLING COMPLETE
 *
 * Features:
 * 1. ✅ Complete styling utilities για όλα τα chart patterns
 * 2. ✅ Type-safe interfaces replacing 'any' types
 * 3. ✅ Dynamic color management με enterprise patterns
 * 4. ✅ Position-aware styling (top/bottom/left/right)
 * 5. ✅ TypeScript strict typing - ΜΗΔΕΝ 'any' types
 * 6. ✅ Centralized design tokens integration
 * 7. ✅ Responsive & accessibility-ready utilities
 * 8. ✅ Animation support με performance optimization
 * 9. ✅ Enterprise-class organization με logical grouping
 * 10. ✅ Fortune 500 grade data visualization standards
 *
 * Result: Ready για enterprise-class Chart components refactoring
 * Standards: Fortune 500 company grade chart styling architecture
 */