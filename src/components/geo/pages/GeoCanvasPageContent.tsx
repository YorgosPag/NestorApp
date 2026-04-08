'use client';

/**
 * GEO-CANVAS PAGE CONTENT
 * Enterprise Geo-Alert System main page
 *
 * Route: /geo/canvas
 * Access: Admin only
 * Features: DXF georeferencing, spatial alerts, map integration
 *
 * @module components/geo/pages/GeoCanvasPageContent
 * @enterprise ADR-294 Batch 7 — extracted from app/geo/canvas/page.tsx
 */

import { useUserRole } from '@/auth';
import dynamic from 'next/dynamic';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Suspense } from 'react';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import '@/lib/design-system';

const GeoCanvasApp = dynamic(
  () => import('@/subapps/geo-canvas/GeoCanvasApp'),
  {
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p className="text-foreground">Loading Geo-Canvas...</p>
        </div>
      </div>
    ),
    ssr: false
  }
);

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUserRole();
  const colors = useSemanticColors();
  const { t } = useTranslation('geo-canvas');

  if (process.env.NODE_ENV === 'development') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${colors.bg.primary}`}>
        <div className="text-center">
          <AnimatedSpinner size="medium" className="mx-auto mb-4" />
          <p className={colors.text.primary}>{t('page.checkingPermissions')}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${colors.bg.primary}`}>
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-6xl mb-4">🔒</div> {/* eslint-disable-line design-system/enforce-semantic-colors */}
          <h1 className={`text-2xl font-bold ${colors.text.primary} mb-2`}>
            {t('page.adminOnly')}
          </h1>
          <p className={`${colors.text.secondary} mb-4`}>
            {t('page.noPermission')}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {t('page.loginAsAdmin')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function GeoCanvasPageContent() {
  return (
    <AdminGuard>
      <div className="w-full h-full">
        <Suspense fallback={(
          <div className="w-full h-full flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="text-6xl mb-4">🌍</div>
              <AnimatedSpinner size="large" className="mx-auto mb-4" />
              <p className="text-foreground text-lg">Initializing Geo-Canvas...</p>
              <p className="text-muted-foreground text-sm mt-2">Enterprise Geo-Alert Platform</p>
            </div>
          </div>
        )}>
          <GeoCanvasApp
            className="w-full h-full"
            features={{
              enableDxfImport: true,
              enableMapLibre: false,
              enableAlerts: false,
              enableSpatialQueries: false
            }}
            initialConfig={{
              mapCenter: { lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE, lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE },
              mapZoom: 8,
              defaultCRS: 'EPSG:4326'
            }}
          />
        </Suspense>
      </div>
    </AdminGuard>
  );
}
