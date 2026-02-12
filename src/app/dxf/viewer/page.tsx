// ?? i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import { useUserRole } from '@/auth';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
// ?? ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import { cn, getTypographyClass } from '@/lib/design-system';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import useSpacingTokens from '@/hooks/useSpacingTokens';
import useTypography from '@/hooks/useTypography';
import { i18n } from '@/i18n';

const DxfViewerApp = dynamic(
  () => import('@/subapps/dxf-viewer/DxfViewerApp'),
  {
    loading: () => <DxfViewerLoadingFallback />,
    ssr: false // Disable SSR to avoid localStorage issues
  }
);

function DxfViewerLoadingFallback() {
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <main
      className={cn('w-full h-full flex items-center justify-center')}
      role="main"
      aria-label={i18n.t('common:dxfViewer.loadingAriaLabel')}
    >
      <section className="text-center" role="status" aria-live="polite">
        <AnimatedSpinner size="large" className={cn('mx-auto', spacing.margin.bottom.md)} />
        <p className={cn(typography.body.base, colors.text.muted)}>
          {i18n.t('common:dxfViewer.loading')}
        </p>
      </section>
    </main>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUserRole();
  const { t } = useTranslation('common');
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const centerLayout = 'w-full h-full flex items-center justify-center';

  if (isLoading) {
    return (
      <main className={cn(centerLayout)} role="main" aria-label={t('dxfViewer.checkingPermissionsAriaLabel')}>
        <section className="text-center" role="status" aria-live="polite">
          <AnimatedSpinner size="medium" className={cn('mx-auto', spacing.margin.bottom.md)} />
          <p className={cn(typography.body.base, colors.text.muted)}>
            {t('dxfViewer.checkingPermissions')}
          </p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className={cn(centerLayout)} role="main" aria-label={t('dxfViewer.accessDeniedAriaLabel')}>
        <section
          className={cn('text-center max-w-md', spacing.padding.lg)}
          role="alert"
          aria-label={t('dxfViewer.unauthorizedAriaLabel')}
        >
          <div className={cn(iconSizes.xl6, colors.text.error, spacing.margin.bottom.sm)} role="img" aria-label={t('dxfViewer.lockedAriaLabel')}>
            LOCKED
          </div>
          <h1 className={cn(getTypographyClass('2xl', 'bold', 'tight'), colors.text.foreground, spacing.margin.bottom.sm)}>
            {t('dxfViewer.adminOnlyAccess')}
          </h1>
          <p className={cn(typography.body.base, colors.text.secondary, spacing.margin.bottom.md)}>
            {t('dxfViewer.noPermissions')}
          </p>
          <p className={cn(typography.body.sm, colors.text.tertiary)}>
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
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <AdminGuard>
      <main className="w-full h-full" role="application" aria-label="DXF Viewer">
        <Suspense
          fallback={
            <section className={cn('w-full h-full flex items-center justify-center')} role="status" aria-live="polite">
              <div className="text-center">
                <AnimatedSpinner size="large" className={cn('mx-auto', spacing.margin.bottom.md)} />
                <p className={cn(typography.body.base, colors.text.muted)}>{t('dxfViewer.loading')}</p>
              </div>
            </section>
          }
        >
          <DxfViewerApp className="w-full h-full" />
        </Suspense>
      </main>
    </AdminGuard>
  );
}
