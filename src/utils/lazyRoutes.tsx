'use client';

/**
 * =============================================================================
 * LAZY ROUTES REGISTRY - CENTRALIZED DYNAMIC IMPORT CONFIGURATION
 * =============================================================================
 *
 * SSoT for all lazy-loaded page routes in the application.
 * Skeletons extracted to lazyRouteSkeletons.tsx (SRP).
 *
 * @module utils/lazyRoutes
 * @enterprise ADR-294 - Dynamic Imports Optimization
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';
import {
  PageLoadingSpinner,
  DashboardLoadingSkeleton,
  FormLoadingSkeleton,
  ListLoadingSkeleton,
} from './lazyRouteSkeletons';
import { lazyRoutesAdr294 } from './lazyRoutesAdr294';

// Re-export skeletons for backward compatibility
export { PageLoadingSpinner, DashboardLoadingSkeleton, FormLoadingSkeleton, ListLoadingSkeleton };

/** Type for lazy-loaded component modules — permissive to accept named/default exports */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyComponentModule = { default: ComponentType<any> };

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

  // Projects Management (heavy with data tables και reports)
  Projects: createLazyRoute(
    () => import('@/components/projects/projects-page-content').then(mod => ({ default: mod.ProjectsPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // Email Analytics Dashboard (heavy με charts και metrics)
  EmailAnalytics: createLazyRoute(
    () => import('@/components/crm/EmailAnalyticsDashboard').then(mod => ({ default: mod.EmailAnalyticsDashboard })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // ⚡ ENTERPRISE: Properties Management (ADR-269: Unit → Property)
  PropertiesManagement: createLazyRoute(
    () => import('@/components/properties/UnitsPageContent').then(mod => ({ default: mod.PropertiesManagementContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // 🏢 ENTERPRISE: File Manager (company-wide file tree view)
  FileManager: createLazyRoute(
    () => import('@/components/file-manager/FileManagerPageContent').then(mod => ({ default: mod.FileManagerPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  // 🏢 ENTERPRISE: Accounting Subapp (Phase 5A — Company Setup)
  AccountingSetup: createLazyRoute(
    () => import('@/subapps/accounting/components/setup/SetupPageContent').then(mod => ({ default: mod.SetupPageContent })),
    { loadingType: 'form', ssr: false }
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

  AccountingEditInvoice: createLazyRoute(
    () => import('@/subapps/accounting/components/invoices/EditInvoicePageContent').then(mod => ({ default: mod.EditInvoicePageContent })),
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

  AccountingReconciliation: createLazyRoute(
    () => import('@/subapps/accounting/components/reconciliation/ReconciliationPageContent').then(mod => ({ default: mod.ReconciliationPageContent })),
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

  AccountingReportDetail: createLazyRoute(
    () => import('@/subapps/accounting/components/reports/ReportDetailView').then(mod => ({ default: mod.ReportDetailView })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // 🏢 ENTERPRISE: Accounting Subapp (Phase 5B — AI Document Processing)
  AccountingDocuments: createLazyRoute(
    () => import('@/subapps/accounting/components/documents/DocumentsPageContent').then(mod => ({ default: mod.DocumentsPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // 🏢 ENTERPRISE: Accounting Subapp (ADR-ACC-020 — APY Certificates)
  AccountingAPYCertificates: createLazyRoute(
    () => import('@/subapps/accounting/components/apy-certificates/APYCertificatesPageContent').then(mod => ({ default: mod.APYCertificatesPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // ADR-294 entries (Batch 1-7) — extracted to lazyRoutesAdr294.tsx for SRP
  ...lazyRoutesAdr294,
} as const;

// Export types for TypeScript support
export type LazyRouteComponent = ComponentType<Record<string, unknown>>;
export type LoadingType = 'spinner' | 'dashboard' | 'form' | 'list';