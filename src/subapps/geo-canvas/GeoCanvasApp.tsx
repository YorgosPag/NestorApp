'use client';

import React, { Suspense } from 'react';
import { NotificationProvider } from '../../providers/NotificationProvider';
import { CacheProvider } from '../../contexts/CacheProvider';
import { OptimizedUserRoleProvider } from '../../contexts/OptimizedUserRoleContext';
import { GeoCanvasContent } from './app/GeoCanvasContent';
import { GeoCanvasErrorBoundary } from './components/ErrorBoundary';
import type { GeoCanvasAppProps } from './types';

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
  return (
    <NotificationProvider>
      <CacheProvider>
        <OptimizedUserRoleProvider>
          <GeoCanvasErrorBoundary>
            {/* 🏢 ENTERPRISE PROVIDERS STACK */}
            {/* TODO Phase 2: GeoTransformProvider */}
            {/* TODO Phase 3: MapLibreProvider */}
            {/* TODO Phase 4: SpatialDatabaseProvider */}
            {/* TODO Phase 5: AlertEngineProvider */}

            {/* 📍 CORE APPLICATION CONTENT */}
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-white">Loading Geo-Canvas...</p>
                </div>
              </div>
            }>
              <GeoCanvasContent {...props} />
            </Suspense>

          </GeoCanvasErrorBoundary>
        </OptimizedUserRoleProvider>
      </CacheProvider>
    </NotificationProvider>
  );
}

export default GeoCanvasApp;