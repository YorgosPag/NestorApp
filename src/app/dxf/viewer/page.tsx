'use client';

import { useUserRole } from '@/contexts/UserRoleContext';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { UnifiedProviders } from '@/subapps/dxf-viewer/providers/UnifiedProviders';
import { useIconSizes } from '@/hooks/useIconSizes';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';

// Dynamic import to avoid SSR issues with localStorage
// 🔧 FIXED: Import DxfViewerApp (with all providers) instead of DxfViewerContent directly
const DxfViewerApp = dynamic(
  () => import('@/subapps/dxf-viewer/DxfViewerApp').then(mod => ({ default: mod.DxfViewerApp })),
  {
    loading: () => {
      const iconSizes = useIconSizes();
      return (
        <main className="w-full h-full flex items-center justify-center" role="main" aria-label="Φόρτωση DXF Viewer">
          <section className="text-center" role="status" aria-live="polite">
            <AnimatedSpinner size="extra-large" variant="info" className="mx-auto mb-4" />
          <p className="text-gray-600">Φόρτωση DXF Viewer...</p>
          </section>
        </main>
      );
    },
    ssr: false // Disable SSR to avoid localStorage issues
  }
);

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUserRole();
  const iconSizes = useIconSizes();

  // 🛠️ DEVELOPMENT BYPASS: Allow access in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('🛠️ DEVELOPMENT MODE: Bypassing authentication for DXF Viewer');
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <main className="w-full h-full flex items-center justify-center" role="main" aria-label="Έλεγχος Δικαιωμάτων">
        <section className="text-center" role="status" aria-live="polite">
          <AnimatedSpinner size="medium" className="mx-auto mb-4" />
          <p className="text-gray-600">Έλεγχος δικαιωμάτων...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="w-full h-full flex items-center justify-center" role="main" aria-label="Άρνηση Πρόσβασης">
        <section className="text-center max-w-md p-6" role="alert" aria-label="Μη Εξουσιοδοτημένη Πρόσβαση">
          <div className="text-red-500 text-6xl mb-4" role="img" aria-label="Κλειδωμένο">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Πρόσβαση Μόνο για Διαχειριστές
          </h1>
          <p className="text-gray-600 mb-4">
            Δεν έχετε τα απαραίτητα δικαιώματα για πρόσβαση στον DXF Viewer.
          </p>
          <p className="text-sm text-gray-500">
            Παρακαλώ συνδεθείτε με λογαριασμό διαχειριστή.
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

export default function DxfViewerPage() {
  const iconSizes = useIconSizes();
  return (
    <AdminGuard>
      {/* UnifiedProviders includes all required contexts: Levels, Overlay, Selection, Cursor, etc. */}
      <UnifiedProviders enableLegacyMode={true}>
        <main className="w-full h-full" role="application" aria-label="DXF Viewer">
          <Suspense fallback={
            <section className="w-full h-full flex items-center justify-center" role="status" aria-live="polite">
              <div className="text-center">
                <AnimatedSpinner size="extra-large" variant="info" className="mx-auto mb-4" />
                <p className="text-gray-600">Φόρτωση DXF Viewer...</p>
              </div>
            </section>
          }>
            <DxfViewerApp className="w-full h-full" />
          </Suspense>
        </main>
      </UnifiedProviders>
    </AdminGuard>
  );
}
