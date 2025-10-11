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
import { useTheme } from '../theme/ThemeProvider';

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
      className={`virtualized-list ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {/* Total height spacer */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items */}
        {visibleItems.map(({ item, originalIndex }) => (
          <div
            key={keyExtractor(item, originalIndex)}
            style={{
              position: 'absolute',
              top: originalIndex * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight
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
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border-primary)',
        cursor: onRowClick ? 'pointer' : 'default',
        backgroundColor: index % 2 === 0 ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)'
      }}
      onClick={() => onRowClick?.(item, index)}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          style={{
            width: column.width || 150,
            padding: 'var(--spacing-2) var(--spacing-3)',
            textAlign: column.align || 'left',
            fontSize: '14px',
            color: 'var(--color-text-primary)'
          }}
        >
          {column.render(item, index)}
        </div>
      ))}
    </div>
  ), [columns, onRowClick]);

  return (
    <div className={`virtualized-table ${className}`} style={{ height: containerHeight }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          height: headerHeight,
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '2px solid var(--color-border-primary)',
          alignItems: 'center'
        }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            style={{
              width: column.width || 150,
              padding: 'var(--spacing-2) var(--spacing-3)',
              textAlign: column.align || 'left',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              cursor: column.sortable ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-1)'
            }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            {column.title}
            {column.sortable && sortBy === column.key && (
              <span style={{ fontSize: '10px' }}>
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

  const containerStyle: React.CSSProperties = {
    width,
    height,
    backgroundColor: 'var(--color-bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    position: 'relative'
  };

  return (
    <div ref={imgRef} className={`lazy-image ${className}`} style={containerStyle}>
      {!inView && (
        <div style={{
          color: 'var(--color-text-tertiary)',
          fontSize: '24px'
        }}>
          📷
        </div>
      )}

      {inView && !error && (
        <>
          {!loaded && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-bg-secondary)'
            }}>
              {placeholder ? (
                <img src={placeholder} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(5px)' }} />
              ) : (
                <div style={{ color: 'var(--color-text-tertiary)' }}>Loading...</div>
              )}
            </div>
          )}
          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
              transition: 'opacity var(--duration-base) var(--easing-ease-in-out)'
            }}
          />
        </>
      )}

      {error && (
        <div style={{
          color: 'var(--color-text-tertiary)',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: 'var(--spacing-1)' }}>❌</div>
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
      style={{
        width: '100%',
        padding: 'var(--spacing-2) var(--spacing-3)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color var(--duration-fast) var(--easing-ease-in-out)'
      }}
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

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: 'var(--color-bg-primary)',
          boxShadow: 'var(--shadow-card)',
          border: 'none'
        };
      case 'outlined':
        return {
          backgroundColor: 'var(--color-bg-primary)',
          boxShadow: 'none',
          border: '1px solid var(--color-border-primary)'
        };
      case 'filled':
        return {
          backgroundColor: 'var(--color-bg-secondary)',
          boxShadow: 'none',
          border: 'none'
        };
      default:
        return {};
    }
  };

  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--duration-fast) var(--easing-ease-in-out)',
        ...getVariantStyles()
      }}
    >
      {/* Header */}
      <div style={{
        padding: 'var(--spacing-4) var(--spacing-4) var(--spacing-2)',
        borderBottom: subtitle || footer ? '1px solid var(--color-border-primary)' : 'none'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--color-text-primary)'
        }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{
            margin: 'var(--spacing-1) 0 0',
            fontSize: '14px',
            color: 'var(--color-text-secondary)'
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{
        padding: 'var(--spacing-4)'
      }}>
        {content}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{
          padding: 'var(--spacing-2) var(--spacing-4) var(--spacing-4)',
          borderTop: '1px solid var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-secondary)'
        }}>
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
          style={{
            padding: 'var(--spacing-4)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-2)' }}>
              <div className="spinner" style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--color-border-primary)',
                borderTop: '2px solid var(--color-primary-500)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Loading more...
            </div>
          ) : (
            'Load more'
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div style={{
          padding: 'var(--spacing-4)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: '14px'
        }}>
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
  usePerformanceMonitor
};