'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location (not DXF Viewer)
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

// Generic loading components for different types of pages
export const PageLoadingSpinner = () => {
  const iconSizes = useIconSizes();
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();
  return (
  <main className={`min-h-screen ${colors.bg.primary} flex items-center justify-center`} role="status" aria-label="Φόρτωση σελίδας">
    <section className="text-center">
      <AnimatedSpinner size="large" className="mx-auto mb-6" aria-hidden="true" />
      <p className="text-muted-foreground">Φόρτωση σελίδας...</p>
    </section>
  </main>
  );
};

export const DashboardLoadingSkeleton = () => {
  const iconSizes = useIconSizes();
  const { quick, radius, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
  <main className={`min-h-screen ${colors.bg.primary}`} role="status" aria-label="Φόρτωση dashboard">
    <header className={`${getDirectionalBorder('muted', 'bottom')} ${colors.bg.card}`}>
      <section className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className={`${iconSizes.lg} bg-muted ${radius.md}w-48 animate-pulse`} aria-hidden="true"></div>
            <div className={`${iconSizes.sm} bg-muted ${radius.md}w-64 animate-pulse`} aria-hidden="true"></div>
          </div>
          <div className="flex space-x-3">
            <div className={`${iconSizes.xl} w-32 bg-muted ${radius.md}animate-pulse`} aria-hidden="true"></div>
            <div className={`${iconSizes.xl} bg-muted ${radius.md}animate-pulse`} aria-hidden="true"></div>
          </div>
        </div>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Φόρτωση στατιστικών">
          {Array.from({ length: 4 }).map((_, i) => (
            <article key={i} className={`${colors.bg.primary} ${quick.card} p-4`}>
              <div className="space-y-2">
                <div className={`${iconSizes.sm} bg-muted ${radius.md}${iconSizes.xl6} animate-pulse`} aria-hidden="true"></div>
                <div className={`${iconSizes.lg} bg-muted ${radius.md}w-20 animate-pulse`} aria-hidden="true"></div>
                <div className={`${iconSizes.xs} bg-muted ${radius.md}w-24 animate-pulse`} aria-hidden="true"></div>
              </div>
            </article>
          ))}
        </section>
      </section>
    </header>
    <section className="p-6" aria-label="Φόρτωση περιεχομένου">
      <div className="h-64 bg-muted ${radius.md}animate-pulse" aria-hidden="true"></div>
    </section>
  </main>
  );
};

export const FormLoadingSkeleton = () => {
  const iconSizes = useIconSizes();
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();
  return (
  <main className={`min-h-screen ${colors.bg.primary} p-6`} role="status" aria-label="Φόρτωση φόρμας">
    <section className="max-w-4xl mx-auto">
      <form className={`bg-card ${quick.card} p-6`}>
        <fieldset className="space-y-6">
          <div className={`${iconSizes.lg} bg-muted ${radius.md}w-48 animate-pulse`} aria-hidden="true"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className={`${iconSizes.sm} bg-muted ${radius.md}w-24 animate-pulse`} aria-hidden="true"></div>
                <div className={`${iconSizes.xl} bg-muted ${radius.md}animate-pulse`} aria-hidden="true"></div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className={`${iconSizes.sm} bg-muted ${radius.md}w-32 animate-pulse`} aria-hidden="true"></div>
            <div className="h-24 bg-muted ${radius.md}animate-pulse" aria-hidden="true"></div>
          </div>
          <footer className="flex justify-end space-x-3">
            <div className={`${iconSizes.xl} w-20 bg-muted ${radius.md}animate-pulse`} aria-hidden="true"></div>
            <div className={`${iconSizes.xl} w-20 bg-muted ${radius.md}animate-pulse`} aria-hidden="true"></div>
          </footer>
        </fieldset>
      </form>
    </section>
  </main>
  );
};

export const ListLoadingSkeleton = () => {
  const iconSizes = useIconSizes();
  const { quick, radius, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
  <main className={`min-h-screen ${colors.bg.primary}`} role="status" aria-label="Φόρτωση λίστας">
    <header className={`${getDirectionalBorder('muted', 'bottom')} bg-card p-6`}>
      <div className="flex items-center justify-between">
        <div className={`${iconSizes.lg} bg-muted ${radius.md}w-32 animate-pulse`} aria-hidden="true"></div>
        <div className={`${iconSizes.xl} w-32 bg-muted ${radius.md}animate-pulse`} aria-hidden="true"></div>
      </div>
    </header>
    <section className="p-6">
      <ul role="list" className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <article className={`bg-card ${quick.card} p-4`}>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className={`${iconSizes.md} bg-muted ${radius.md}w-32 animate-pulse`} aria-hidden="true"></div>
                  <div className={`${iconSizes.sm} bg-muted ${radius.md}w-48 animate-pulse`} aria-hidden="true"></div>
                </div>
                <div className={`${iconSizes.lg} ${iconSizes.xl6} bg-muted ${radius.full} animate-pulse`} aria-hidden="true"></div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  </main>
  );
};

// Utility function to create lazy routes with different loading states
export function createLazyRoute(
  importFn: () => Promise<{ default: any }>,
  options: {
    loadingType?: 'spinner' | 'dashboard' | 'form' | 'list';
    ssr?: boolean;
  } = {}
) {
  const { loadingType = 'spinner', ssr = false } = options;
  
  const LoadingComponent = {
    spinner: PageLoadingSpinner,
    dashboard: DashboardLoadingSkeleton,
    form: FormLoadingSkeleton,
    list: ListLoadingSkeleton,
  }[loadingType];

  return dynamic(importFn, {
    loading: () => <LoadingComponent />,
    ssr
  });
}

// Pre-configured lazy routes for common patterns
export const LazyRoutes = {
  // Dashboard routes (heavy with charts and data)
  CRMDashboard: createLazyRoute(
    () => import('@/components/crm/dashboard/CRMDashboardPageContent').then(mod => ({ default: mod.CRMDashboardPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),
  
  // Management/List routes
  Buildings: createLazyRoute(
    () => import('@/components/building-management/BuildingsPageContent'),
    { loadingType: 'list', ssr: false }
  ),
  
  Contacts: createLazyRoute(
    () => import('@/components/contacts/ContactsPageContent'),
    { loadingType: 'list', ssr: false }
  ),
  
  
  Properties: createLazyRoute(
    () => import('@/components/properties/PropertiesPageContent').then(mod => ({ default: mod.PropertiesPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  
  // Form routes
  ObligationsNew: createLazyRoute(
    () => import('@/components/obligations/ObligationForm').then(mod => ({ default: mod.ObligationForm })),
    { loadingType: 'form', ssr: false }
  ),

  ObligationsEdit: createLazyRoute(
    () => import('@/components/obligations/ObligationEditForm').then(mod => ({ default: mod.ObligationEditForm })),
    { loadingType: 'form', ssr: false }
  ),

  // Landing (SEO important, keep SSR)
  Landing: createLazyRoute(
    () => import('@/components/landing/LandingPage').then(mod => ({ default: mod.LandingPage })),
    { loadingType: 'spinner', ssr: true }
  ),

  // Heavy DXF Viewer (already optimized, but include for completeness)
  DXFViewer: createLazyRoute(
    () => import('@/subapps/dxf-viewer/DxfViewerApp').then(mod => ({ default: mod.default })),
    { loadingType: 'spinner', ssr: false }
  ),

  // ⚡ NEW ADDITIONS: Recently identified heavy components που χρειάζονται lazy loading

  // Projects/Audit Management (heavy with data tables και reports)
  Projects: createLazyRoute(
    () => import('@/components/projects/projects-page-content').then(mod => ({ default: mod.ProjectsPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // Email Analytics Dashboard (heavy με charts και metrics)
  EmailAnalytics: createLazyRoute(
    () => import('@/components/crm/EmailAnalyticsDashboard').then(mod => ({ default: mod.EmailAnalyticsDashboard })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // ⚡ ENTERPRISE: Units Management (heavy με PropertyGridView και complex state)
  Units: createLazyRoute(
    () => import('@/app/units/page').then(mod => ({ default: mod.default })),
    { loadingType: 'dashboard', ssr: false }
  ),
} as const;

// Export types for TypeScript support
export type LazyRouteComponent = ComponentType<any>;
export type LoadingType = 'spinner' | 'dashboard' | 'form' | 'list';