'use client';

import { useUserRole } from '@/contexts/UserRoleContext';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// RESTORED: Real GeoCanvasApp (working interface)
const GeoCanvasApp = dynamic(
  () => import('@/subapps/geo-canvas/GeoCanvasApp'),
  {
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white">Loading Geo-Canvas...</p>
        </div>
      </div>
    ),
    ssr: false
  }
);

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white">Έλεγχος δικαιωμάτων...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Πρόσβαση Μόνο για Διαχειριστές
          </h1>
          <p className="text-gray-400 mb-4">
            Δεν έχετε τα απαραίτητα δικαιώματα για πρόσβαση στο Geo-Canvas System.
          </p>
          <p className="text-sm text-gray-500">
            Παρακαλώ συνδεθείτε με λογαριασμό διαχειριστή.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * GEO-CANVAS PAGE
 * Enterprise Geo-Alert System main page
 *
 * Route: /geo/canvas
 * Access: Admin only
 * Features: DXF georeferencing, spatial alerts, map integration
 */
export default function GeoCanvasPage() {
  return (
    <AdminGuard>
      <div className="w-full h-full">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="text-6xl mb-4">🌍</div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-white text-lg">Αρχικοποίηση Geo-Canvas...</p>
              <p className="text-gray-400 text-sm mt-2">Enterprise Geo-Alert Platform</p>
            </div>
          </div>
        }>
          <GeoCanvasApp
            className="w-full h-full"
            features={{
              enableDxfImport: true,     // Phase 2
              enableMapLibre: false,     // Phase 3
              enableAlerts: false,       // Phase 5
              enableSpatialQueries: false // Phase 4
            }}
            initialConfig={{
              mapCenter: { lng: 23.7275, lat: 37.9755 }, // Athens, Greece
              mapZoom: 8,
              defaultCRS: 'EPSG:4326'
            }}
          />
        </Suspense>
      </div>
    </AdminGuard>
  );
}