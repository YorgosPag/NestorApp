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

