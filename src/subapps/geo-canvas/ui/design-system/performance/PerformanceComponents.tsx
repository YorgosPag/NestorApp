/**
 * PERFORMANCE OPTIMIZED COMPONENTS — MAIN BARREL
 * Geo-Alert System - Phase 6: Enterprise Performance Components
 *
 * VirtualizedList/Table and AdminBoundariesPerformancePanel extracted
 * to sibling modules (ADR-065 SRP split).
 */

import React, {
  memo,
  useCallback,
  useState,
  useEffect,
  useRef,
  ReactNode,
  ComponentType,
  lazy,
  Suspense,
} from 'react';
import { useTheme } from '@/subapps/geo-canvas/ui/design-system/theme/ThemeProvider';
import {
  getVirtualizedImageContainerStyles,
  getVirtualizedImageStyles,
  getLoadingContentStyles,
  getSpinnerContainerStyles,
  getSpinnerStyles,
  getLoadingTextStyles,
} from './PerformanceComponents.styles';

// Re-export from extracted modules
export { VirtualizedList, VirtualizedTable } from './VirtualizedComponents';
export {
  AdminBoundariesPerformancePanel,
  type AdminBoundariesPerformancePanelProps,
} from './AdminBoundariesPerformancePanel';

// Import for default export object
import { VirtualizedList, VirtualizedTable } from './VirtualizedComponents';
import { AdminBoundariesPerformancePanel } from './AdminBoundariesPerformancePanel';

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
  onError,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

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
      {!inView && <div className="lazy-image-placeholder-text">📷</div>}

      {inView && !error && (
        <>
          {!loaded && (
            <div className="lazy-image-placeholder">
              {placeholder ? (
                <img src={placeholder} alt="" className="lazy-image-placeholder-img" />
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
  type = 'text',
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => { setInternalValue(value); }, [value]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInternalValue(newValue);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newValue), debounceMs);
  }, [onChange, debounceMs]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
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
  variant = 'elevated',
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
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      <div className={`card-content ${footer ? 'has-footer' : ''}`}>{content}</div>
      {footer && <div className="card-footer">{footer}</div>}
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
  keyExtractor = (_, index) => index.toString(),
}: InfiniteScrollProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadingRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div ref={containerRef} className={`infinite-scroll ${className}`}>
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)}>{renderItem(item, index)}</div>
      ))}

      {hasMore && (
        <div ref={loadingRef} style={getLoadingContentStyles()}>
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
        <div className="infinite-scroll-end-message">No more items to load</div>
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
  className = '',
}) => {
  return (
    <Suspense fallback={fallback}>
      <div className={`lazy-component-wrapper ${className}`}>{children}</div>
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
      console.debug(
        `[Performance] ${componentName} rendered ${renderCountRef.current} times. Time since last render: ${timeSinceLastRender}ms`
      );
    }
  });

  return { renderCount: renderCountRef.current, lastRenderTime: lastRenderTime.current };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const withPerformanceMonitoring = <P extends object>(
  Component: ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent: ComponentType<P> = (props: P) => {
    usePerformanceMonitor(componentName || Component.displayName || Component.name || 'Unknown');
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName || Component.displayName || Component.name})`;
  return memo(WrappedComponent);
};

export const createLazyComponent = <P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ReactNode
): React.ComponentType<P> => {
  const LazyComponent = lazy(importFn) as unknown as React.ComponentType<P>;

  const WrappedLazyComponent = (props: P) => (
    <LazyComponentWrapper fallback={fallback}>
      <LazyComponent {...props} />
    </LazyComponentWrapper>
  );

  return WrappedLazyComponent;
};

// ============================================================================
// CSS ANIMATIONS
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

if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = cssAnimations;
  document.head.appendChild(styleElement);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

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
  AdminBoundariesPerformancePanel,
};
