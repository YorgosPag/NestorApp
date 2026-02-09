'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
// 🏢 ENTERPRISE: Import from canonical location (not DXF Viewer)
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

// ⚡ ENTERPRISE PERFORMANCE OPTIMIZATION (2026-01-27)
// =========================================================================
// REMOVED HOOKS FROM LOADING SKELETONS:
// - useIconSizes, useBorderTokens, useSemanticColors, useTranslation
//
// REASON: Hooks were causing 200-400ms delay before skeleton could render
// Pattern: Vercel, Google Cloud Console, Microsoft Azure Portal use static skeletons
// RESULT: Instant skeleton render → better perceived performance
// =========================================================================

// ⚡ ENTERPRISE: Static loading components - ZERO hooks for instant render
export const PageLoadingSpinner = () => (
  <main className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
    <section className="text-center">
      <AnimatedSpinner size="large" className="mx-auto mb-6" aria-hidden="true" />
      <p className="text-muted-foreground">Loading...</p>
    </section>
  </main>
);

// ⚡ ENTERPRISE PERFORMANCE: Static skeleton - no hooks for instant render
export const DashboardLoadingSkeleton = () => (
  <main className="min-h-screen bg-background" role="status" aria-label="Loading dashboard">
    <header className="border-b border-border bg-card">
      <section className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded-md w-48 animate-pulse" aria-hidden="true" />
            <div className="h-4 bg-muted rounded-md w-64 animate-pulse" aria-hidden="true" />
          </div>
          <div className="flex space-x-3">
            <div className="h-10 w-32 bg-muted rounded-md animate-pulse" aria-hidden="true" />
            <div className="h-10 w-10 bg-muted rounded-md animate-pulse" aria-hidden="true" />
          </div>
        </div>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Loading statistics">
          {[0, 1, 2, 3].map((i) => (
            <article key={i} className="bg-background border border-border rounded-lg p-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded-md w-16 animate-pulse" aria-hidden="true" />
                <div className="h-8 bg-muted rounded-md w-20 animate-pulse" aria-hidden="true" />
                <div className="h-3 bg-muted rounded-md w-24 animate-pulse" aria-hidden="true" />
              </div>
            </article>
          ))}
        </section>
      </section>
    </header>
    <section className="p-6" aria-label="Loading content">
      <div className="h-64 bg-muted rounded-md animate-pulse" aria-hidden="true" />
    </section>
  </main>
);

// ⚡ ENTERPRISE PERFORMANCE: Static form skeleton
export const FormLoadingSkeleton = () => (
  <main className="min-h-screen bg-background p-6" role="status" aria-label="Loading form">
    <section className="max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded-md w-48 animate-pulse" aria-hidden="true" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded-md w-24 animate-pulse" aria-hidden="true" />
                <div className="h-10 bg-muted rounded-md animate-pulse" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded-md w-32 animate-pulse" aria-hidden="true" />
            <div className="h-24 bg-muted rounded-md animate-pulse" aria-hidden="true" />
          </div>
          <div className="flex justify-end space-x-3">
            <div className="h-10 w-20 bg-muted rounded-md animate-pulse" aria-hidden="true" />
            <div className="h-10 w-20 bg-muted rounded-md animate-pulse" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  </main>
);

// ⚡ ENTERPRISE PERFORMANCE: Static list skeleton
export const ListLoadingSkeleton = () => (
  <main className="min-h-screen bg-background" role="status" aria-label="Loading list">
    <header className="border-b border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-muted rounded-md w-32 animate-pulse" aria-hidden="true" />
        <div className="h-10 w-32 bg-muted rounded-md animate-pulse" aria-hidden="true" />
      </div>
    </header>
    <section className="p-6">
      <ul role="list" className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <li key={i}>
            <article className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 bg-muted rounded-md w-32 animate-pulse" aria-hidden="true" />
                  <div className="h-4 bg-muted rounded-md w-48 animate-pulse" aria-hidden="true" />
                </div>
                <div className="h-10 w-10 bg-muted rounded-full animate-pulse" aria-hidden="true" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  </main>
);

/** Type for lazy-loaded component modules */
type LazyComponentModule = { default: ComponentType<Record<string, unknown>> };

// Utility function to create lazy routes with different loading states
export function createLazyRoute(
  importFn: () => Promise<LazyComponentModule>,
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

  // 🏢 ENTERPRISE: File Manager (company-wide file tree view)
  FileManager: createLazyRoute(
    () => import('@/components/file-manager/FileManagerPageContent').then(mod => ({ default: mod.FileManagerPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  // 🏢 ENTERPRISE: Accounting Subapp (Phase 4)
  AccountingDashboard: createLazyRoute(
    () => import('@/subapps/accounting/components/dashboard/AccountingDashboard').then(mod => ({ default: mod.AccountingDashboard })),
    { loadingType: 'dashboard', ssr: false }
  ),

  AccountingInvoices: createLazyRoute(
    () => import('@/subapps/accounting/components/invoices/InvoicesPageContent').then(mod => ({ default: mod.InvoicesPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  AccountingNewInvoice: createLazyRoute(
    () => import('@/subapps/accounting/components/invoices/NewInvoicePageContent').then(mod => ({ default: mod.NewInvoicePageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AccountingJournal: createLazyRoute(
    () => import('@/subapps/accounting/components/journal/JournalPageContent').then(mod => ({ default: mod.JournalPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  AccountingVAT: createLazyRoute(
    () => import('@/subapps/accounting/components/vat/VATPageContent').then(mod => ({ default: mod.VATPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  AccountingBank: createLazyRoute(
    () => import('@/subapps/accounting/components/bank/BankPageContent').then(mod => ({ default: mod.BankPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  AccountingEFKA: createLazyRoute(
    () => import('@/subapps/accounting/components/efka/EFKAPageContent').then(mod => ({ default: mod.EFKAPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  AccountingAssets: createLazyRoute(
    () => import('@/subapps/accounting/components/assets/AssetsPageContent').then(mod => ({ default: mod.AssetsPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  AccountingReports: createLazyRoute(
    () => import('@/subapps/accounting/components/reports/ReportsPageContent').then(mod => ({ default: mod.ReportsPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),
} as const;

// Export types for TypeScript support
export type LazyRouteComponent = ComponentType<Record<string, unknown>>;
export type LoadingType = 'spinner' | 'dashboard' | 'form' | 'list';