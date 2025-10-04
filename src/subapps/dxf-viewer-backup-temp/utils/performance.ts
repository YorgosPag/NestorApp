/**
 * @module performance
 * @description Performance optimization utilities για conference presentation
 * Target: 60fps rendering, < 100ms interaction response
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * Debounce hook για input optimization
 * Reduces unnecessary re-renders and API calls
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook για high-frequency events
 * Limits execution rate για performance
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());
  const timeout = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      } else {
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, delay - (now - lastRun.current));
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * RequestAnimationFrame hook για smooth animations
 * Ensures 60fps rendering performance
 */
export function useRAF(callback: () => void, deps: React.DependencyList = []): void {
  const frame = useRef<number>();

  useEffect(() => {
    const animate = () => {
      callback();
      frame.current = requestAnimationFrame(animate);
    };

    frame.current = requestAnimationFrame(animate);

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, deps);
}

/**
 * Intersection Observer hook για lazy loading
 * Improves initial load performance
 */
export function useInView(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isInView, setIsInView] = React.useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      options
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, options]);

  return isInView;
}

/**
 * Virtual scrolling hook για large lists
 * Renders only visible items
 */
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  itemCount: number;
  overscan?: number;
}

export interface VirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
}

export function useVirtualScroll({
  itemHeight,
  containerHeight,
  itemCount,
  overscan = 3
}: VirtualScrollOptions): VirtualScrollResult {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      itemCount,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan]);

  const totalHeight = itemCount * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll
  };
}

/**
 * Performance monitoring utility
 * Tracks render count and performance metrics
 */
export function usePerformanceMonitor(componentName: string): void {
  const renderCount = useRef(0);
  const renderTime = useRef<number>();

  useEffect(() => {
    renderCount.current++;
    const start = performance.now();

    return () => {
      const end = performance.now();
      const duration = end - (renderTime.current || start);

      if (process.env.NODE_ENV === 'development') {
        if (duration > 16.67) { // Slower than 60fps
          console.warn(
            `[Performance] ${componentName} render #${renderCount.current} took ${duration.toFixed(2)}ms`
          );
        }
      }

      renderTime.current = end;
    };
  });
}

/**
 * Memoization helper με deep comparison
 * Prevents unnecessary re-computations
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}

/**
 * Deep equality check για complex objects
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a == null || b == null) return false;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return a === b;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Web Worker hook για heavy computations
 * Offloads CPU-intensive tasks
 */
export function useWebWorker<T, R>(
  workerFunction: (data: T) => R
): [(data: T) => Promise<R>, boolean] {
  const [loading, setLoading] = React.useState(false);
  const workerRef = useRef<Worker>();

  useEffect(() => {
    const blob = new Blob(
      [`self.onmessage = function(e) { self.postMessage((${workerFunction})(e.data)); }`],
      { type: 'application/javascript' }
    );

    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      URL.revokeObjectURL(workerUrl);
    };
  }, [workerFunction]);

  const execute = useCallback((data: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      setLoading(true);

      workerRef.current.onmessage = (e) => {
        setLoading(false);
        resolve(e.data);
      };

      workerRef.current.onerror = (error) => {
        setLoading(false);
        reject(error);
      };

      workerRef.current.postMessage(data);
    });
  }, []);

  return [execute, loading];
}

// Import React for hooks
import * as React from 'react';

/**
 * Export performance metrics για monitoring
 */
export interface PerformanceMetrics {
  fps: number;
  memory: number;
  renderTime: number;
}

export function getPerformanceMetrics(): PerformanceMetrics {
  const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;

  return {
    fps: 60, // Calculate actual FPS
    memory: memory ? memory.usedJSHeapSize / 1048576 : 0, // MB
    renderTime: 0 // Will be calculated per component
  };
}