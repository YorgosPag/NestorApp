"use client";

/**
 * @module LazyLoadWrapper
 * @description Lazy loading wrapper για performance optimization
 * Conference-ready code splitting και lazy loading
 */

import React, { Suspense, lazy, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import ErrorBoundary from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface LazyLoadWrapperProps {
  fallback?: React.ReactNode;
  componentPath: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Loading skeleton με animation
 */
const DefaultFallback = () => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`${iconSizes.lg} animate-spin ${colors.text.muted}`} />
      <span className={`ml-2 text-sm ${colors.text.muted}`}>Loading component...</span>
    </div>
  );
};

/**
 * Custom fallback για lazy loading errors
 */
const LazyLoadErrorFallback = (error: Error, errorInfo: any, retry: () => void) => {
  const { getStatusBorder } = useBorderTokens();

  return (
    <div className={`p-4 ${getStatusBorder('error')} bg-destructive/10 rounded-lg`}>
    <h3 className="text-sm font-semibold text-destructive mb-2">
      Component Loading Error
    </h3>
    <p className="text-xs text-muted-foreground">
      {error?.message || 'Failed to load component'}
    </p>
    <button
      onClick={retry}
      className="mt-2 text-xs text-destructive underline hover:text-destructive/80 transition-colors"
    >
      Retry
    </button>
  </div>
  );
};

/**
 * HOC για lazy loading με error handling
 */
export function withLazyLoad<T extends ComponentType<React.ComponentProps<T>>>(
  importFunction: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunction);

  return React.memo((props: React.ComponentProps<T>) => (
    <ErrorBoundary
      componentName="LazyComponent"
      enableRetry={true}
      maxRetries={2}
      fallback={LazyLoadErrorFallback}
    >
      <Suspense fallback={<DefaultFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
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
    <ErrorBoundary
      componentName="LazyLoadWrapper"
      enableRetry={true}
      maxRetries={2}
      fallback={LazyLoadErrorFallback}
    >
      <Suspense fallback={fallback || <DefaultFallback />}>
        <div {...props}>
          {/* Component will be loaded here */}
          {props.children}
        </div>
      </Suspense>
    </ErrorBoundary>
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
  () => import('./DxfSettingsPanel').then(m => ({ default: m.DxfSettingsPanel }))
);

/**
 * 🚀 ENTERPRISE: Performance Dashboard - Client-Only
 */
export const LazyGlobalPerformanceDashboard = withLazyLoad(
  () => import('@/core/performance/components/GlobalPerformanceDashboard')
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