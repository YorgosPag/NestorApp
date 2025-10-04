/**
 * @module LazyLoadWrapper
 * @description Lazy loading wrapper για performance optimization
 * Conference-ready code splitting και lazy loading
 */

import React, { Suspense, lazy, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyLoadWrapperProps {
  fallback?: React.ReactNode;
  componentPath: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Loading skeleton με animation
 */
const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    <span className="ml-2 text-sm text-gray-400">Loading component...</span>
  </div>
);

/**
 * Error boundary για lazy loaded components
 */
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LazyLoadWrapper] Component failed to load:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-900 bg-red-950 rounded-lg">
          <h3 className="text-sm font-semibold text-red-400 mb-2">
            Component Loading Error
          </h3>
          <p className="text-xs text-red-300">
            {this.state.error?.message || 'Failed to load component'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-red-400 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC για lazy loading με error handling
 */
export function withLazyLoad<T extends ComponentType<React.ComponentProps<T>>>(
  importFunction: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunction);

  return React.memo((props: React.ComponentProps<T>) => (
    <LazyErrorBoundary>
      <Suspense fallback={<DefaultFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyErrorBoundary>
  ));
}

/**
 * Lazy load με preloading support
 */
export class LazyLoadManager {
  private static preloadedComponents = new Map<string, Promise<unknown>>();

  /**
   * Preload component για faster rendering
   */
  static preload(componentPath: string, importFunction: () => Promise<unknown>) {
    if (!this.preloadedComponents.has(componentPath)) {
      this.preloadedComponents.set(componentPath, importFunction());
    }
  }

  /**
   * Get preloaded component
   */
  static getPreloaded(componentPath: string) {
    return this.preloadedComponents.get(componentPath);
  }

  /**
   * Clear preloaded cache
   */
  static clearCache() {
    this.preloadedComponents.clear();
  }
}

/**
 * Main LazyLoadWrapper component
 */
export const LazyLoadWrapper: React.FC<LazyLoadWrapperProps> = ({
  fallback,
  componentPath,
  ...props
}) => {
  // This is a placeholder - actual implementation would dynamically import
  // For now, returning children or fallback
  return (
    <LazyErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback || <DefaultFallback />}>
        <div {...props}>
          {/* Component will be loaded here */}
          {props.children}
        </div>
      </Suspense>
    </LazyErrorBoundary>
  );
};

/**
 * Lazy load common DXF Viewer components
 */
export const LazyDxfCanvas = withLazyLoad(
  () => import('../../canvas-v2/dxf-canvas/DxfCanvas').then(m => ({ default: m.DxfCanvas || m }))
);

// ✅ CENTRALIZED: Debug & Testing Components
export const LazyFullLayoutDebug = withLazyLoad(
  () => import('../../debug/layout-debug').then(m => ({ default: m.FullLayoutDebug }))
);

export const LazyAdminLayerManager = withLazyLoad(
  () => import('./AdminLayerManager').then(m => ({ default: m.AdminLayerManager }))
);

export const LazyLevelPanel = withLazyLoad(
  () => import('./LevelPanel').then(m => ({ default: m.LevelPanel }))
);

export const LazyHierarchyDebugPanel = withLazyLoad(
  () => import('../../debug/panels/HierarchyDebugPanel').then(m => ({ default: m.HierarchyDebugPanel }))
);

export const LazyColorPalettePanel = withLazyLoad(
  () => import('./ColorPalettePanel').then(m => ({ default: m.ColorPalettePanel }))
);

/**
 * Utility για preloading critical components
 */
export function preloadCriticalComponents() {
  // Preload components που θα χρειαστούν σύντομα
  LazyLoadManager.preload(
    'DxfCanvas',
    () => import('../../canvas-v2/dxf-canvas/DxfCanvas')
  );
}