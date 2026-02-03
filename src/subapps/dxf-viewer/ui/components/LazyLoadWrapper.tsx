"use client";

/**
 * @module LazyLoadWrapper
 * @description Lazy loading wrapper για performance optimization
 * Conference-ready code splitting και lazy loading
 *
 * 🏢 ENTERPRISE: All spacing/sizing via PANEL_LAYOUT tokens (ZERO hardcoded values)
 */

import React, { Suspense, lazy, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import ErrorBoundary from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
type DxfCanvasComponent = typeof import('../../canvas-v2/dxf-canvas/DxfCanvas').DxfCanvas;
type FullLayoutDebugComponent = typeof import('../../debug/layout-debug').FullLayoutDebug;
type AdminLayerManagerComponent = typeof import('./AdminLayerManager').AdminLayerManager;
type LevelPanelComponent = typeof import('./LevelPanel').LevelPanel;
type HierarchyDebugPanelComponent = typeof import('../../debug/panels/HierarchyDebugPanel').HierarchyDebugPanel;
type DxfSettingsPanelComponent = typeof import('./DxfSettingsPanel').DxfSettingsPanel;
type GlobalPerformanceDashboardComponent = typeof import('@/core/performance/components/GlobalPerformanceDashboard').default;

type LazyLoadableComponent<P extends object> =
  | ComponentType<P>
  | React.ExoticComponent<P>;

type NoProps = Record<string, never>;

type DxfCanvasProps = React.ComponentPropsWithoutRef<DxfCanvasComponent>;
type FullLayoutDebugProps = NoProps;
type AdminLayerManagerProps = React.ComponentPropsWithoutRef<AdminLayerManagerComponent>;
type LevelPanelProps = NonNullable<React.ComponentPropsWithoutRef<LevelPanelComponent>>;
type HierarchyDebugPanelProps = NoProps;
type DxfSettingsPanelProps = React.ComponentPropsWithoutRef<DxfSettingsPanelComponent>;
type GlobalPerformanceDashboardProps = React.ComponentPropsWithoutRef<GlobalPerformanceDashboardComponent>;

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
    <aside className={`flex items-center justify-center ${PANEL_LAYOUT.SPACING.XXXL}`}>
      <Loader2 className={`${iconSizes.lg} ${PANEL_LAYOUT.ANIMATE.SPIN} ${colors.text.muted}`} />
      <span className={`${PANEL_LAYOUT.MARGIN.LEFT_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>Loading component...</span>
    </aside>
  );
};

/**
 * Custom fallback για lazy loading errors
 */
const LazyLoadErrorFallback = (error: Error, _errorInfo: React.ErrorInfo, retry: () => void) => {
  const { getStatusBorder } = useBorderTokens();

  return (
    <article className={`${PANEL_LAYOUT.SPACING.LG} ${getStatusBorder('error')} bg-destructive/10 ${PANEL_LAYOUT.ROUNDED.LG}`}>
      <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} text-destructive ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
        Component Loading Error
      </h3>
      <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} text-muted-foreground`}>
        {error?.message || 'Failed to load component'}
      </p>
      <button
        onClick={retry}
        className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-destructive underline hover:text-destructive/80 ${PANEL_LAYOUT.TRANSITION.COLORS}`}
      >
        Retry
      </button>
    </article>
  );
};

/**
 * HOC για lazy loading με error handling
 */
export function withLazyLoad<P extends object = Record<string, unknown>>(
  importFunction: () => Promise<{ default: LazyLoadableComponent<P> }>
) {
  const LazyComponent = lazy(async () => {
    const module = await importFunction();
    return { default: module.default as ComponentType<P> };
  });

  return React.memo((props: React.PropsWithoutRef<P>) => (
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
  children
}) => {
  // This is a placeholder - actual implementation would dynamically import
  // For now, returning children or fallback
  // ✅ ENTERPRISE: Removed unnecessary wrapper div (ADR-003 Container Nesting)
  return (
    <ErrorBoundary
      componentName="LazyLoadWrapper"
      enableRetry={true}
      maxRetries={2}
      fallback={LazyLoadErrorFallback}
    >
      <Suspense fallback={fallback || <DefaultFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * Lazy load common DXF Viewer components
 */
export const LazyDxfCanvas = withLazyLoad<DxfCanvasProps>(
  () => import('../../canvas-v2/dxf-canvas/DxfCanvas').then(m => ({ default: m.DxfCanvas }))
);

// ✅ CENTRALIZED: Debug & Testing Components
export const LazyFullLayoutDebug = withLazyLoad<FullLayoutDebugProps>(
  () => import('../../debug/layout-debug').then(m => ({ default: m.FullLayoutDebug }))
);

export const LazyAdminLayerManager = withLazyLoad<AdminLayerManagerProps>(
  () => import('./AdminLayerManager').then(m => ({ default: m.AdminLayerManager }))
);

export const LazyLevelPanel = withLazyLoad<LevelPanelProps>(
  () => import('./LevelPanel').then(m => ({ default: m.LevelPanel }))
);

export const LazyHierarchyDebugPanel = withLazyLoad<HierarchyDebugPanelProps>(
  () => import('../../debug/panels/HierarchyDebugPanel').then(m => ({ default: m.HierarchyDebugPanel }))
);

export const LazyColorPalettePanel = withLazyLoad<DxfSettingsPanelProps>(
  () => import('./DxfSettingsPanel').then(m => ({ default: m.DxfSettingsPanel }))
);

/**
 * 🚀 ENTERPRISE: Performance Dashboard - Client-Only
 */
export const LazyGlobalPerformanceDashboard = withLazyLoad<GlobalPerformanceDashboardProps>(
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
