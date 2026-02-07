/**
 * PERFORMANCE COMPONENTS COMPANION STYLING MODULE
 * Enterprise-class centralized styling για PerformanceComponents.tsx
 *
 * ✅ ENTERPRISE REFACTORED: Inline styles → Centralized tokens
 * ✅ Performance-optimized styling utilities
 * ✅ Dynamic state-based styling for virtualized components
 * ✅ TypeScript strict typing - NO 'any' types
 *
 * @module PerformanceComponents.styles
 */

import { performanceComponents } from '../../../../../styles/design-tokens';

// ============================================================================
// VIRTUALIZED TABLE STYLING UTILITIES
// ============================================================================

/**
 * Get container styles για VirtualizedTable
 */
export const getVirtualizedTableContainerStyles = (
  containerHeight: number,
  className?: string
) => ({
  ...performanceComponents.virtualizedTable.container,
  height: containerHeight
});

/**
 * Get header styles για VirtualizedTable
 */
export const getVirtualizedTableHeaderStyles = () => ({
  ...performanceComponents.virtualizedTable.header.container
});

/**
 * Get virtual list styles για scrollable content
 */
export const getVirtualListStyles = (totalHeight: number) => ({
  ...performanceComponents.virtualizedTable.virtualList,
  height: totalHeight
});

/**
 * Get table row styles με conditional styling
 */
export const getTableRowStyles = (isClickable: boolean) => ({
  ...performanceComponents.virtualizedTable.row.base,
  cursor: isClickable ? 'pointer' : 'default'
});

/**
 * Get table cell styles με dynamic width
 */
export const getTableCellStyles = (width?: number) => ({
  ...performanceComponents.virtualizedTable.cell.base,
  width: width || 150
});

/**
 * Get virtualized table class με optional className
 */
export const getVirtualizedTableClass = (className?: string) =>
  `${performanceComponents.virtualizedTable.className} ${className || ''}`.trim();

// ============================================================================
// VIRTUALIZED IMAGE STYLING UTILITIES
// ============================================================================

/**
 * Get container styles για VirtualizedImage
 */
export const getVirtualizedImageContainerStyles = (
  width?: number,
  height?: number
) => ({
  ...performanceComponents.virtualizedImage.container.base,
  ...(width !== undefined ? { width } : {}),
  ...(height !== undefined ? { height } : {})
});

/**
 * Get image styles με loading state
 */
export const getVirtualizedImageStyles = (loaded: boolean) => ({
  ...performanceComponents.virtualizedImage.image.base,
  opacity: loaded ? 1 : 0
});

/**
 * Get placeholder styles για image loading
 */
export const getImagePlaceholderStyles = () => ({
  ...performanceComponents.virtualizedImage.placeholder
});

// ============================================================================
// METRICS DASHBOARD STYLING UTILITIES
// ============================================================================

/**
 * Get metrics dashboard container styles
 */
export const getMetricsDashboardContainerStyles = () => ({
  ...performanceComponents.metrics.dashboard.container
});

/**
 * Get metrics card styles με theme integration
 */
export const getMetricsCardStyles = (borderColor: string) => ({
  ...performanceComponents.metrics.card.base,
  borderColor
});

/**
 * Get metrics title styles με dynamic color
 */
export const getMetricsTitleStyles = (color: string) => ({
  ...performanceComponents.metrics.card.title,
  color
});

/**
 * Get metrics value styles με theme colors
 */
export const getMetricsValueStyles = (color: string) => ({
  ...performanceComponents.metrics.card.value,
  color
});

// ============================================================================
// LOADING ANIMATIONS STYLING UTILITIES
// ============================================================================

/**
 * Get loading container styles
 */
export const getLoadingContainerStyles = () => ({
  ...performanceComponents.loading.container
});

/**
 * Get loading content wrapper styles
 */
export const getLoadingContentStyles = () => ({
  ...performanceComponents.loading.content
});

/**
 * Get spinner container styles με centered alignment
 */
export const getSpinnerContainerStyles = () => ({
  ...performanceComponents.loading.spinner.container
});

/**
 * Get spinner styles με animation
 */
export const getSpinnerStyles = () => ({
  ...performanceComponents.loading.spinner.element
});

/**
 * Get loading text styles
 */
export const getLoadingTextStyles = () => ({
  ...performanceComponents.loading.text
});

// ============================================================================
// PERFORMANCE METRICS SPECIFIC STYLING
// ============================================================================

/**
 * Get performance metrics container styles
 */
export const getPerformanceMetricsContainerStyles = () => ({
  ...performanceComponents.performanceMetrics.container
});

/**
 * Get section border styles με theme colors
 */
export const getSectionBorderStyles = (borderColor?: string) => ({
  ...performanceComponents.performanceMetrics.section.border,
  ...(borderColor ? { borderColor } : {})
});

/**
 * Get section title styles με primary color
 */
export const getSectionTitleStyles = (color?: string) => ({
  ...performanceComponents.performanceMetrics.section.title,
  ...(color ? { color } : {})
});

/**
 * Get metric label styles με secondary color
 */
export const getMetricLabelStyles = (color?: string) => ({
  ...performanceComponents.performanceMetrics.metric.label,
  ...(color ? { color } : {})
});

/**
 * Get metric value styles με tertiary color για timestamps
 */
export const getMetricTimestampStyles = (color?: string) => ({
  ...performanceComponents.performanceMetrics.metric.timestamp,
  ...(color ? { color } : {})
});

/**
 * Get alert severity color utility
 */
export const getAlertSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical') => {
  switch (severity) {
    case 'critical':
      return performanceComponents.performanceMetrics.alerts.severity.critical;
    case 'high':
      return performanceComponents.performanceMetrics.alerts.severity.high;
    case 'medium':
      return performanceComponents.performanceMetrics.alerts.severity.medium;
    case 'low':
    default:
      return performanceComponents.performanceMetrics.alerts.severity.low;
  }
};

/**
 * Get alert item styles με severity-based styling
 */
export const getAlertItemStyles = (
  borderColor: string,
  backgroundColor?: string
) => ({
  ...performanceComponents.performanceMetrics.alerts.item.base,
  borderColor,
  ...(backgroundColor && { backgroundColor })
});

/**
 * Get alert title styles με severity color
 */
export const getAlertTitleStyles = (severityColor?: string) => ({
  ...performanceComponents.performanceMetrics.alerts.item.title,
  ...(severityColor ? { color: severityColor } : {})
});

/**
 * Get alert description styles με secondary color
 */
export const getAlertDescriptionStyles = (color?: string) => ({
  ...performanceComponents.performanceMetrics.alerts.item.description,
  ...(color ? { color } : {})
});

/**
 * Get alert timestamp styles με tertiary color
 */
export const getAlertTimestampStyles = (color?: string) => ({
  ...performanceComponents.performanceMetrics.alerts.item.timestamp,
  ...(color ? { color } : {})
});

// ============================================================================
// DYNAMIC STYLING UTILITIES
// ============================================================================

/**
 * Get dynamic header height styles
 */
export const getDynamicHeaderStyles = (headerHeight?: number) => ({
  ...performanceComponents.virtualizedTable.header.container,
  ...(headerHeight !== undefined ? { height: headerHeight } : {})
});

/**
 * Get dynamic row styles με index-based styling
 */
export const getDynamicRowStyles = (
  index: number,
  isSelected?: boolean,
  isHovered?: boolean
) => ({
  ...performanceComponents.virtualizedTable.row.base,
  ...(index % 2 === 0 && performanceComponents.virtualizedTable.row.even),
  ...(isSelected && performanceComponents.virtualizedTable.row.selected),
  ...(isHovered && performanceComponents.virtualizedTable.row.hover)
});

/**
 * Get responsive container styles με viewport awareness
 */
export const getResponsiveContainerStyles = (
  containerHeight: number,
  isMobile?: boolean
) => ({
  ...performanceComponents.virtualizedTable.container,
  height: containerHeight,
  ...(isMobile && performanceComponents.virtualizedTable.mobile)
});

// ============================================================================
// PERFORMANCE OPTIMIZATION UTILITIES
// ============================================================================

/**
 * Memoized style generator για virtualized components
 * Optimized για high-frequency rerenders
 */
export const memoizedStyles = {
  /**
   * Cache για frequently used table styles
   */
  tableRowCache: new Map<string, React.CSSProperties>(),

  /**
   * Get cached table row styles
   */
  getCachedRowStyles: (
    key: string,
    generator: () => React.CSSProperties
  ): React.CSSProperties => {
    if (!memoizedStyles.tableRowCache.has(key)) {
      memoizedStyles.tableRowCache.set(key, generator());
    }
    return memoizedStyles.tableRowCache.get(key)!;
  },

  /**
   * Clear cache για memory management
   */
  clearCache: () => {
    memoizedStyles.tableRowCache.clear();
  }
};

/**
 * Performance-optimized class name builder
 */
export const buildClassNames = (...classes: (string | undefined)[]) =>
  classes.filter(Boolean).join(' ');

/**
 * ✅ PERFORMANCE COMPONENTS STYLING COMPLETE
 *
 * Features:
 * 1. ✅ Complete styling utilities για all PerformanceComponents patterns
 * 2. ✅ Dynamic state-based styling (loaded, selected, hover states)
 * 3. ✅ Severity-based alert styling με proper color management
 * 4. ✅ Performance-optimized memoization for high-frequency renders
 * 5. ✅ TypeScript strict typing - NO 'any' types anywhere
 * 6. ✅ Centralized design tokens integration
 * 7. ✅ Responsive styling utilities με mobile awareness
 * 8. ✅ Virtualized table optimization με proper cache management
 * 9. ✅ Enterprise-class organization με logical grouping
 * 10. ✅ Memory management utilities για performance-critical components
 *
 * Result: Ready για enterprise-class PerformanceComponents refactoring
 * Standards: Fortune 500 company grade performance component styling
 */
