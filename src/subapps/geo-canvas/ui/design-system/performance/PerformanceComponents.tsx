/**
 * PERFORMANCE OPTIMIZED COMPONENTS
 * Geo-Alert System - Phase 6: Enterprise Performance Components
 *
 * High-performance React components με virtualization, memoization,
 * lazy loading, και advanced optimization techniques.
 */

import React, {
  memo,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  ReactNode,
  ComponentType,
  lazy,
  Suspense
} from 'react';
import { Flame, AlertCircle, AlertTriangle, FileText } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTheme } from '@/subapps/geo-canvas/ui/design-system/theme/ThemeProvider';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { GEO_COLORS } from '../../../config/color-config';
import {
  getVirtualizedTableContainerStyles,
  getVirtualListStyles,
  getTableRowStyles,
  getTableCellStyles,
  getVirtualizedTableClass,
  getVirtualizedImageContainerStyles,
  getVirtualizedImageStyles,
  getImagePlaceholderStyles,
  getLoadingContainerStyles,
  getLoadingContentStyles,
  getSpinnerContainerStyles,
  getSpinnerStyles,
  getLoadingTextStyles,
  getPerformanceMetricsContainerStyles,
  getSectionBorderStyles,
  getSectionTitleStyles,
  getMetricLabelStyles,
  getMetricTimestampStyles,
  getAlertSeverityColor,
  getAlertItemStyles,
  getAlertTitleStyles,
  getAlertDescriptionStyles,
  getAlertTimestampStyles,
  getDynamicHeaderStyles
} from './PerformanceComponents.styles';

// Type definitions για admin boundaries metrics
interface AdminBoundariesMetrics {
  search: {
    averageSearchTime: number;
    searchSuccessRate: number;
    cacheHitRate: number;
    totalSearches: number;
  };
  overpassApi: {
    averageResponseTime: number;
    totalRequests: number;
    failedRequests: number;
    dataSize: number;
  };
  boundaries: {
    averageProcessingTime: number;
    renderingTime: number;
    processedBoundaries: number;
    geometryComplexity: number;
  };
}

interface AdminBoundariesAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
  timestamp: number;
}

// Temporary analytics object για type compatibility
const adminBoundariesAnalytics = {
  startMonitoring: (interval: number) => {},
  stopMonitoring: () => {},
  getLatestMetrics: (): AdminBoundariesMetrics | null => null,
  getAlerts: (): AdminBoundariesAlert[] => []
};

// ============================================================================
// VIRTUALIZED LIST COMPONENT
// ============================================================================

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  keyExtractor?: (item: T, index: number) => string;
}

export const VirtualizedList = memo(<T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  keyExtractor = (_, index) => index.toString()
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const visibleItemCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length - 1, start + visibleItemCount + 2 * overscan);

    return {
      startIndex: start,
      endIndex: end,
      totalHeight: items.length * itemHeight
    };
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  // Visible items
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      originalIndex: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  // Scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={getVirtualizedTableContainerStyles(containerHeight)}
      onScroll={handleScroll}
    >
      {/* Total height spacer */}
      <div
        className=""
        style={getVirtualListStyles(totalHeight)}
      >
        {/* Visible items */}
        {visibleItems.map(({ item, originalIndex }) => (
          <div
            key={keyExtractor(item, originalIndex)}
            className=""
            style={{
              top: `${originalIndex * itemHeight}px`,
              height: `${itemHeight}px`
            }}
          >
            {renderItem(item, originalIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}) as <T>(props: VirtualizedListProps<T>) => JSX.Element;

// ============================================================================
// VIRTUALIZED TABLE COMPONENT
// ============================================================================

interface Column<T> {
  key: string;
  title: string;
  width?: number;
  render: (item: T, index: number) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight: number;
  containerHeight: number;
  headerHeight?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
}

export const VirtualizedTable = memo(<T,>({
  data,
  columns,
  rowHeight,
  containerHeight,
  headerHeight = 40,
  className = '',
  keyExtractor = (_, index) => index.toString(),
  onRowClick,
  sortBy,
  sortDirection = 'asc',
  onSort
}: VirtualizedTableProps<T>) => {
  const { isDark } = useTheme();

  // Calculate column widths
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => sum + (col.width || 150), 0);
  }, [columns]);

  // Handle sort
  const handleSort = useCallback((columnKey: string) => {
    if (!onSort) return;

    const newDirection = sortBy === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  }, [sortBy, sortDirection, onSort]);

  // Render table row
  const renderRow = useCallback((item: T, index: number) => (
    <div
      className=""
      style={getTableRowStyles(onRowClick)}
      onClick={() => onRowClick?.(item, index)}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={`table-cell ${
            column.align === 'center' ? 'text-center' :
            column.align === 'right' ? 'text-right' : ''
          }`}
          style={getTableCellStyles(column.width)}
        >
          {column.render(item, index)}
        </div>
      ))}
    </div>
  ), [columns, onRowClick]);

  return (
    <div className={getVirtualizedTableClass(className)} style={getVirtualizedTableContainerStyles(containerHeight, className)}>
      {/* Header */}
      <div
        className="table-header"
        style={{ height: `${headerHeight}px`, display: 'flex', alignItems: 'center' }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={`table-header-cell ${
              column.align === 'center' ? 'text-center' :
              column.align === 'right' ? 'text-right' : ''
            }`}
            style={{
              ...getTableCellStyles(column.width),
              cursor: column.sortable ? 'pointer' : 'default'
            }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            {column.title}
            {column.sortable && sortBy === column.key && (
              <span className="sort-indicator ml-1">
                {sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Virtual list for rows */}
      <VirtualizedList
        items={data}
        itemHeight={rowHeight}
        containerHeight={containerHeight - headerHeight}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
      />
    </div>
  );
}) as <T>(props: VirtualizedTableProps<T>) => JSX.Element;

// ============================================================================
// LAZY IMAGE COMPONENT
// ============================================================================

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = memo(({
  src,
  alt,
  width,
  height,
  placeholder,
  className = '',
  onLoad,
  onError
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer για lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={getVirtualizedImageContainerStyles(width, height)}
    >
      {!inView && (
        <div className="lazy-image-placeholder-text">
          📷
        </div>
      )}

      {inView && !error && (
        <>
          {!loaded && (
            <div className="lazy-image-placeholder">
              {placeholder ? (
                <img
                  src={placeholder}
                  alt=""
                  className="lazy-image-placeholder-img"
                />
              ) : (
                <div className="lazy-image-placeholder-text">Loading...</div>
              )}
            </div>
          )}
          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`lazy-image ${loaded ? 'lazy-image-fade-in' : ''}`}
            style={getVirtualizedImageStyles(loaded)}
          />
        </>
      )}

      {error && (
        <div className="lazy-image-error">
          <div className="lazy-image-error-icon">❌</div>
          Failed to load
        </div>
      )}
    </div>
  );
});

// ============================================================================
// DEBOUNCED INPUT COMPONENT
// ============================================================================

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
  type?: 'text' | 'email' | 'password' | 'search';
}

export const DebouncedInput: React.FC<DebouncedInputProps> = memo(({
  value,
  onChange,
  debounceMs = 300,
  placeholder,
  className = '',
  type = 'text'
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update internal value when external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Debounced change handler
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInternalValue(newValue);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      type={type}
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={`debounced-input ${className}`}
      style={getLoadingTextStyles()}
    />
  );
});

// ============================================================================
// MEMOIZED CARD COMPONENT
// ============================================================================

interface CardProps {
  title: string;
  subtitle?: string;
  content: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'elevated' | 'outlined' | 'filled';
}

export const Card: React.FC<CardProps> = memo(({
  title,
  subtitle,
  content,
  footer,
  onClick,
  className = '',
  variant = 'elevated'
}) => {
  const { isDark } = useTheme();

  const getCardVariantClass = () => {
    switch (variant) {
      case 'elevated': return 'card-elevated';
      case 'outlined': return 'card-outlined';
      case 'filled': return 'card-filled';
      default: return 'card-default';
    }
  };

  return (
    <div
      className={`card ${getCardVariantClass()} ${onClick ? 'card-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="card-header">
        <h3 className="card-title">
          {title}
        </h3>
        {subtitle && (
          <p className="card-subtitle">
            {subtitle}
          </p>
        )}
      </div>

      {/* Content */}
      <div className={`card-content ${footer ? 'has-footer' : ''}`}>
        {content}
      </div>

      {/* Footer */}
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// INFINITE SCROLL COMPONENT
// ============================================================================

interface InfiniteScrollProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  hasMore: boolean;
  loadMore: () => void;
  loading?: boolean;
  threshold?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string;
}

export const InfiniteScroll = memo(<T,>({
  items,
  renderItem,
  hasMore,
  loadMore,
  loading = false,
  threshold = 200,
  className = '',
  keyExtractor = (_, index) => index.toString()
}: InfiniteScrollProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Intersection observer για infinite loading
  useEffect(() => {
    if (!loadingRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);

    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div ref={containerRef} className={`infinite-scroll ${className}`}>
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </div>
      ))}

      {/* Loading indicator */}
      {hasMore && (
        <div
          ref={loadingRef}
          style={getLoadingContentStyles()}
        >
          {loading ? (
            <div style={getSpinnerContainerStyles()}>
              <div className="spinner" style={getSpinnerStyles()} />
              Loading more...
            </div>
          ) : (
            'Load more'
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="infinite-scroll-end-message">
          No more items to load
        </div>
      )}
    </div>
  );
}) as <T>(props: InfiniteScrollProps<T>) => JSX.Element;

// ============================================================================
// LAZY COMPONENT WRAPPER
// ============================================================================

interface LazyComponentWrapperProps {
  fallback?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const LazyComponentWrapper: React.FC<LazyComponentWrapperProps> = ({
  fallback = <div>Loading...</div>,
  children,
  className = ''
}) => {
  return (
    <Suspense fallback={fallback}>
      <div className={`lazy-component-wrapper ${className}`}>
        {children}
      </div>
    </Suspense>
  );
};

// ============================================================================
// PERFORMANCE HOOK
// ============================================================================

export const usePerformanceMonitor = (componentName: string) => {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCountRef.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} rendered ${renderCountRef.current} times. Time since last render: ${timeSinceLastRender}ms`);
    }
  });

  return {
    renderCount: renderCountRef.current,
    lastRenderTime: lastRenderTime.current
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Higher-order component για performance monitoring
 */
export const withPerformanceMonitoring = <P extends object>(
  Component: ComponentType<P>,
  componentName?: string
): ComponentType<P> => {
  const WrappedComponent = (props: P) => {
    usePerformanceMonitor(componentName || Component.displayName || Component.name || 'Unknown');
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName || Component.displayName || Component.name})`;

  return memo(WrappedComponent);
};

/**
 * Utility για creating lazy components
 */
export const createLazyComponent = <P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ReactNode
) => {
  const LazyComponent = lazy(importFn);

  const WrappedLazyComponent = (props: P) => (
    <LazyComponentWrapper fallback={fallback}>
      <LazyComponent {...props} />
    </LazyComponentWrapper>
  );

  return WrappedLazyComponent;
};

// ============================================================================
// CSS ANIMATIONS (to be added to CSS)
// ============================================================================

const cssAnimations = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fade-in {
  animation: fadeIn var(--duration-base) var(--easing-ease-out);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.slide-up {
  animation: slideUp var(--duration-base) var(--easing-ease-out);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
`;

// Inject CSS animations
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssAnimations;
  document.head.appendChild(styleElement);
}

// ============================================================================
// ADMINISTRATIVE BOUNDARIES PERFORMANCE PANEL - Phase 7.1
// ============================================================================

/**
 * Real-time performance monitoring panel για Administrative Boundaries
 * Displays metrics, alerts, και recommendations
 */
export interface AdminBoundariesPerformancePanelProps {
  isVisible?: boolean;
  onClose?: () => void;
  className?: string;
  refreshInterval?: number; // milliseconds
}

export const AdminBoundariesPerformancePanel = memo(({
  isVisible = false,
  onClose,
  className = '',
  refreshInterval = 5000
}: AdminBoundariesPerformancePanelProps) => {
  const { theme } = useTheme();
  const iconSizes = useIconSizes();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [metrics, setMetrics] = useState<AdminBoundariesMetrics | null>(null);
  const [alerts, setAlerts] = useState<AdminBoundariesAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start monitoring when panel becomes visible
  useEffect(() => {
    if (isVisible && !isMonitoring) {
      setIsMonitoring(true);
      adminBoundariesAnalytics.startMonitoring(refreshInterval);

      // Update metrics immediately
      const updateMetrics = () => {
        const latestMetrics = adminBoundariesAnalytics.getLatestMetrics();
        const latestAlerts = adminBoundariesAnalytics.getAlerts();
        setMetrics(latestMetrics);
        setAlerts(latestAlerts);
      };

      updateMetrics();

      // Set up interval for regular updates
      intervalRef.current = setInterval(updateMetrics, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, refreshInterval, isMonitoring]);

  // Stop monitoring when panel is closed
  useEffect(() => {
    if (!isVisible && isMonitoring) {
      setIsMonitoring(false);
      adminBoundariesAnalytics.stopMonitoring();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isVisible, isMonitoring]);

  const formatTime = useCallback((ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, []);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }, []);

  const getAlertColor = useCallback((severity: AdminBoundariesAlert['severity']) => {
    switch (severity) {
      case 'critical': return GEO_COLORS.OPTIMIZATION.CRITICAL_PRIORITY;
      case 'high': return GEO_COLORS.OPTIMIZATION.HIGH_PRIORITY;
      case 'medium': return GEO_COLORS.OPTIMIZATION.MEDIUM_PRIORITY;
      case 'low': return GEO_COLORS.OPTIMIZATION.LOW_PRIORITY;
      default: return semanticColors.text.primary;
    }
  }, [semanticColors.text.primary]);

  const getAlertIcon = useCallback((severity: AdminBoundariesAlert['severity']) => {
    const iconProps = { className: iconSizes.sm };
    switch (severity) {
      case 'critical': return <Flame {...iconProps} />;
      case 'high': return <AlertCircle {...iconProps} />;
      case 'medium': return <AlertTriangle {...iconProps} />;
      case 'low': return <FileText {...iconProps} />;
      default: return <span>•</span>;
    }
  }, [iconSizes.sm]);

  if (!isVisible) return null;

  return (
    <div
      className={`performance-monitor performance-monitor-container ${className}`}
      style={getPerformanceMetricsContainerStyles()}
    >
      {/* Header */}
      <div
        className={`performance-monitor-header ${getDirectionalBorder('muted', 'bottom')}`}
        style={getDynamicHeaderStyles()}
      >
        <h3 className={`performance-monitor-title ${getSectionTitleStyles()}`}>
          🏛️ Admin Boundaries Performance
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className={`performance-monitor-close-btn ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
          >
            ✕
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {/* Real-time Metrics */}
        {metrics && (
          <div className="p-4 space-y-4">
            {/* Search Performance */}
            <div className="space-y-2">
              <h4 className="performance-section-title">
                🔍 Search Performance
              </h4>
              <div className="performance-metrics-grid">
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Avg Time:</span>
                  <span className="performance-metric-value">{formatTime(metrics.search.averageSearchTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Success Rate:</span>
                  <span className="performance-metric-value">{metrics.search.searchSuccessRate}%</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Cache Hit:</span>
                  <span className="performance-metric-value">{metrics.search.cacheHitRate}%</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Total:</span>
                  <span className="performance-metric-value">{metrics.search.totalSearches}</span>
                </div>
              </div>
            </div>

            {/* API Performance */}
            <div className="space-y-2">
              <h4 className="performance-section-title">
                🌍 Overpass API
              </h4>
              <div className="performance-metrics-grid">
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Response Time:</span>
                  <span className="performance-metric-value">{formatTime(metrics.overpassApi.averageResponseTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Requests:</span>
                  <span className="performance-metric-value">{metrics.overpassApi.totalRequests}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Failed:</span>
                  <span className="performance-metric-value">{metrics.overpassApi.failedRequests}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Data Size:</span>
                  <span className="performance-metric-value">{metrics.overpassApi.dataSize}MB</span>
                </div>
              </div>
            </div>

            {/* Boundary Processing */}
            <div className="space-y-2">
              <h4 className="performance-section-title">
                🗺️ Boundary Processing
              </h4>
              <div className="performance-metrics-grid">
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Processing:</span>
                  <span className="performance-metric-value">{formatTime(metrics.boundaries.averageProcessingTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Rendering:</span>
                  <span className="performance-metric-value">{formatTime(metrics.boundaries.renderingTime)}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Processed:</span>
                  <span className="performance-metric-value">{metrics.boundaries.processedBoundaries}</span>
                </div>
                <div className="performance-metric-item">
                  <span className="performance-metric-label">Complexity:</span>
                  <span className="performance-metric-value">{Math.round(metrics.boundaries.geometryComplexity)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className={`performance-alerts-section ${getDirectionalBorder('muted', 'top')}`} style={getSectionBorderStyles()}>
            <div className="performance-alerts-container">
              <h4 className="performance-section-title">
                🚨 Active Alerts ({alerts.length})
              </h4>
              <div className="performance-alerts-list">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="performance-alert-item"
                    style={getAlertItemStyles(getAlertSeverityColor(alert.severity))}
                  >
                    <span>{getAlertIcon(alert.severity)}</span>
                    <div className="performance-alert-content">
                      <div className="performance-alert-title" style={getAlertTitleStyles(getAlertSeverityColor(alert.severity))}>
                        {alert.message}
                      </div>
                      {alert.suggestion && (
                        <div className="performance-alert-suggestion">
                          💡 {alert.suggestion}
                        </div>
                      )}
                      <div className="performance-alert-timestamp" style={getAlertTimestampStyles()}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {alerts.length > 5 && (
                <div className="performance-alerts-more">
                  +{alerts.length - 5} more alerts
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        <div
          className={`performance-monitor-status ${getDirectionalBorder('muted', 'top')}`}
        >
          {isMonitoring ? (
            <span className="performance-monitor-status-active">
              <span className={`performance-status-indicator ${colors.bg.success}`}></span>
              Monitoring Active • Updates every {refreshInterval / 1000}s
            </span>
          ) : (
            <span className="performance-monitor-status-inactive">Monitoring Stopped</span>
          )}
        </div>
      </div>
    </div>
  );
});

AdminBoundariesPerformancePanel.displayName = 'AdminBoundariesPerformancePanel';

export default {
  VirtualizedList,
  VirtualizedTable,
  LazyImage,
  DebouncedInput,
  Card,
  InfiniteScroll,
  LazyComponentWrapper,
  withPerformanceMonitoring,
  createLazyComponent,
  usePerformanceMonitor,
  AdminBoundariesPerformancePanel
};