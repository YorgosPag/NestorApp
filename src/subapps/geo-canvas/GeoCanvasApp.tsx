'use client';

import React from 'react';
import { NotificationProvider } from '../../providers/NotificationProvider';
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
      <GeoCanvasErrorBoundary>
        {/* 🏢 ENTERPRISE PROVIDERS STACK */}
        {/* TODO Phase 2: GeoTransformProvider */}
        {/* TODO Phase 3: MapLibreProvider */}
        {/* TODO Phase 4: SpatialDatabaseProvider */}
        {/* TODO Phase 5: AlertEngineProvider */}

        {/* 📍 CORE APPLICATION CONTENT */}
        <GeoCanvasContent {...props} />

      </GeoCanvasErrorBoundary>
    </NotificationProvider>
  );
}

export default GeoCanvasApp;