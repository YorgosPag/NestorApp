// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import { useUserRole } from '@/auth';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';

// Dynamic import to avoid SSR issues with localStorage
// 🔧 FIXED: Import DxfViewerApp (with all providers) instead of DxfViewerContent directly
const DxfViewerApp = dynamic(
  () => import('@/subapps/dxf-viewer/DxfViewerApp'),
  {
    loading: () => {
      // 🌐 i18n: Using i18n.t() directly because hooks cannot be used in loading callbacks
      return (
        <main className="w-full h-full flex items-center justify-center" role="main" aria-label={i18n.t('common:dxfViewer.loadingAriaLabel')}>
          <section className="text-center" role="status" aria-live="polite">
            <AnimatedSpinner size="large" className="mx-auto mb-4" />
          <p className="text-gray-600">{i18n.t('common:dxfViewer.loading')}</p>
          </section>
        </main>
      );
    },
    ssr: false // Disable SSR to avoid localStorage issues
  }
);

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUserRole();
  const { t } = useTranslation('common');

  // 🛠️ DEVELOPMENT BYPASS: Allow access in development mode
  if (process.env.NODE_ENV === 'development') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <main className="w-full h-full flex items-center justify-center" role="main" aria-label={t('dxfViewer.checkingPermissionsAriaLabel')}>
        <section className="text-center" role="status" aria-live="polite">
          <AnimatedSpinner size="medium" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('dxfViewer.checkingPermissions')}</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="w-full h-full flex items-center justify-center" role="main" aria-label={t('dxfViewer.accessDeniedAriaLabel')}>
        <section className="text-center max-w-md p-6" role="alert" aria-label={t('dxfViewer.unauthorizedAriaLabel')}>
          <div className="text-red-500 text-6xl mb-4" role="img" aria-label={t('dxfViewer.lockedAriaLabel')}>🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('dxfViewer.adminOnlyAccess')}
          </h1>
          <p className="text-gray-600 mb-4">
            {t('dxfViewer.noPermissions')}
          </p>
          <p className="text-sm text-gray-500">
            {t('dxfViewer.pleaseLoginAsAdmin')}
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

export default function DxfViewerPage() {
  const { t } = useTranslation('common');
  return (
    <AdminGuard>
      <main className="w-full h-full" role="application" aria-label="DXF Viewer">
        <Suspense fallback={
          <section className="w-full h-full flex items-center justify-center" role="status" aria-live="polite">
            <div className="text-center">
              <AnimatedSpinner size="large" className="mx-auto mb-4" />
              <p className="text-gray-600">{t('dxfViewer.loading')}</p>
            </div>
          </section>
        }>
          <DxfViewerApp className="w-full h-full" />
        </Suspense>
      </main>
    </AdminGuard>
  );
}
