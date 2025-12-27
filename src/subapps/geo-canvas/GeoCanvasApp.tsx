'use client';

import React, { Suspense } from 'react';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { CacheProvider } from '@/contexts/CacheProvider';
import { OptimizedUserRoleProvider } from '@/contexts/OptimizedUserRoleContext';
import { GeoCanvasContent } from './app/GeoCanvasContent';
import ErrorBoundary from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { GlobalPerformanceDashboard } from '@/core/performance/components/GlobalPerformanceDashboard';
import { PerformanceCategory } from '@/core/performance/types/performance.types';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import type { GeoCanvasAppProps } from './types/components';

/**
 * GEO-CANVAS APPLICATION
 * Enterprise-class Geo-Alert system για DXF georeferencing
 *
 * Architecture:
 * - Κεντρικοποιημένη provider structure
 * - Error boundaries για robust operation
 * - Enterprise patterns από DXF Viewer
 * - Future-ready για MapLibre GL JS integration
 */
export function GeoCanvasApp(props: GeoCanvasAppProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <NotificationProvider>
      <CacheProvider>
        <OptimizedUserRoleProvider>
          <ErrorBoundary
            componentName="GeoCanvas"
            enableRetry={true}
            maxRetries={3}
            enableReporting={true}
            showErrorDetails={true}
          >
            {/* 🏢 ENTERPRISE PROVIDERS STACK */}
            {/* TODO Phase 2: GeoTransformProvider */}
            {/* TODO Phase 3: MapLibreProvider */}
            {/* TODO Phase 4: SpatialDatabaseProvider */}
            {/* TODO Phase 5: AlertEngineProvider */}

            {/* 📍 CORE APPLICATION CONTENT */}
            <Suspense fallback={
              <div className={`w-full h-full flex items-center justify-center ${colors.bg.secondary} text-white`}>
                <div className="text-center">
                  <AnimatedSpinner size="large" className="mx-auto mb-4" />
                  <p className="text-white">Loading Geo-Canvas...</p>
                </div>
              </div>
            }>
              <GeoCanvasContent {...props} />
            </Suspense>

            {/* 🚀 ENTERPRISE PERFORMANCE SYSTEM - GEO-CANVAS MONITORING */}
            <GlobalPerformanceDashboard
              position="bottom-left"
              minimizable={true}
              defaultMinimized={true}
              showDetails={false}
              updateInterval={3000}
              categories={[
                PerformanceCategory.RENDERING,
                PerformanceCategory.MEMORY,
                PerformanceCategory.CACHE_HIT,
                PerformanceCategory.APPLICATION
              ]}
              theme="dark"
            />

          </ErrorBoundary>
        </OptimizedUserRoleProvider>
      </CacheProvider>
    </NotificationProvider>
  );
}

export default GeoCanvasApp;