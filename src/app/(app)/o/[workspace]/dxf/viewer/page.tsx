// ?? i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useUserRole } from '@/auth';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
// ?? ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import { cn, getTypographyClass } from '@/lib/design-system';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import useSpacingTokens from '@/hooks/useSpacingTokens';
import useTypography from '@/hooks/useTypography';
import { i18n } from '@/i18n';
import { PageLoadingState, StaticPageLoading } from '@/core/states';
import { FullBleedSurface } from '@/core/containers';

const DxfViewerApp = dynamic(
  () => import('@/subapps/dxf-viewer/DxfViewerApp'),
  {
    loading: () => <DxfViewerLoadingFallback />,
    ssr: false // Disable SSR to avoid localStorage issues
  }
);

function DxfViewerLoadingFallback() {
  return (
    // eslint-disable-next-line custom/no-hardcoded-strings
    <PageLoadingState message={i18n.t('common:dxfViewer.loading')} layout="contained" />
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useUserRole();
  const { t } = useTranslation(COMMON_NAMESPACES);
  const spacing = useSpacingTokens();
  const typography = useTypography();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const centerLayout = 'w-full h-full flex items-center justify-center';

  if (isLoading) {
    return <PageLoadingState message={t('dxfViewer.checkingPermissions')} layout="contained" />;
  }

  if (!isAdmin) {
    return (
      <main className={cn(centerLayout)} role="main" aria-label={t('dxfViewer.accessDeniedAriaLabel')}>
        <section
          className={cn('text-center max-w-md', spacing.padding.lg)}
          role="alert"
          aria-label={t('dxfViewer.unauthorizedAriaLabel')}
        >
          {/* eslint-disable-next-line custom/no-hardcoded-strings */}
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
  const { t } = useTranslation(COMMON_NAMESPACES);
  const _spacing = useSpacingTokens();
  const _typography = useTypography();
  const _colors = useSemanticColors();

  return (
    <AdminGuard>
      {/*
        🖼️ ADR-793 — ΚΑΜΒΑΣ: ΜΗΔΕΝ ΔΙΑΔΡΟΜΟΣ, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ.

        Το κέλυφος δίνει ρευστό διάδρομο σε **κάθε** σελίδα — σωστά, γιατί η
        προεπιλογή είναι fail-closed. Εδώ όμως η επιφάνεια **είναι** το προϊόν:
        μετρήθηκε ζωντανά (2400×1200, μπάρα σε εικονίδια) ότι ο διάδρομος κόβει
        **64px πλάτος × 48px ύψος = 6,9% της επιφάνειας σχεδίασης**.

        Σε εργαλείο CAD αυτό δεν είναι αισθητική επιλογή· είναι χαμένος καμβάς.

        ⚠️ Το opt-out ζει **μόνο** στο κλαδί του viewer. Η οθόνη «δεν έχεις
        δικαίωμα» του `AdminGuard` από πάνω κρατά τον διάδρομό της — είναι
        **κείμενο**, και το κείμενο θέλει κενό.
      */}
      <FullBleedSurface className="h-full" ariaLabel="DXF Viewer">
        <Suspense
          fallback={<StaticPageLoading message={t('dxfViewer.loading')} />}
        >
          <DxfViewerApp className="w-full h-full" />
        </Suspense>
      </FullBleedSurface>
    </AdminGuard>
  );
}
