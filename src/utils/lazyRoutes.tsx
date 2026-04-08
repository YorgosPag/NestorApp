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

  // =========================================================================
  // ⚡ ADR-294 BATCH 1: Dynamic Imports Optimization — 10 heaviest pages
  // =========================================================================

  // Reports (recharts heavy — each imports 4-6 chart sections)
  ReportsExecutive: createLazyRoute(
    () => import('@/components/reports/pages/ReportsExecutivePageContent').then(mod => ({ default: mod.ReportsExecutivePageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsFinancial: createLazyRoute(
    () => import('@/components/reports/pages/ReportsFinancialPageContent').then(mod => ({ default: mod.ReportsFinancialPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsSales: createLazyRoute(
    () => import('@/components/reports/pages/ReportsSalesPageContent').then(mod => ({ default: mod.ReportsSalesPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsConstruction: createLazyRoute(
    () => import('@/components/reports/pages/ReportsConstructionPageContent').then(mod => ({ default: mod.ReportsConstructionPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  FinancialIntelligence: createLazyRoute(
    () => import('@/components/sales/financial-intelligence/FinancialIntelligencePageContent').then(mod => ({ default: mod.FinancialIntelligencePageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // CRM (complex client UIs — dashboards, filters, real-time)
  CrmCalendar: createLazyRoute(
    () => import('@/components/crm/calendar/CalendarPageContent').then(mod => ({ default: mod.CalendarPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmTasks: createLazyRoute(
    () => import('@/components/crm/tasks/TasksPageContent').then(mod => ({ default: mod.TasksPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmLeads: createLazyRoute(
    () => import('@/components/crm/leads/LeadsPageContent').then(mod => ({ default: mod.LeadsPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmPipeline: createLazyRoute(
    () => import('@/components/crm/pipeline/PipelinePageContent').then(mod => ({ default: mod.PipelinePageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmCommunications: createLazyRoute(
    () => import('@/components/crm/communications/CommunicationsPageContent').then(mod => ({ default: mod.CommunicationsPageContent })),
    { loadingType: 'list', ssr: false }
  ),
  // =========================================================================
  // ⚡ ADR-294 BATCH 2: Dynamic Imports — 8 remaining report pages
  // =========================================================================

  ReportsSpaces: createLazyRoute(
    () => import('@/components/reports/pages/ReportsSpacesPageContent').then(mod => ({ default: mod.ReportsSpacesPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsContacts: createLazyRoute(
    () => import('@/components/reports/pages/ReportsContactsPageContent').then(mod => ({ default: mod.ReportsContactsPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsCrm: createLazyRoute(
    () => import('@/components/reports/pages/ReportsCrmPageContent').then(mod => ({ default: mod.ReportsCrmPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsCompliance: createLazyRoute(
    () => import('@/components/reports/pages/ReportsCompliancePageContent').then(mod => ({ default: mod.ReportsCompliancePageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsProjects: createLazyRoute(
    () => import('@/components/reports/pages/ReportsProjectsPageContent').then(mod => ({ default: mod.ReportsProjectsPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsExport: createLazyRoute(
    () => import('@/components/reports/pages/ReportsExportPageContent').then(mod => ({ default: mod.ReportsExportPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsBuilder: createLazyRoute(
    () => import('@/components/reports/pages/ReportsBuilderPageContent').then(mod => ({ default: mod.ReportsBuilderPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  ReportsCashFlow: createLazyRoute(
    () => import('@/components/reports/pages/ReportsCashFlowPageContent').then(mod => ({ default: mod.ReportsCashFlowPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // =========================================================================
  // ⚡ ADR-294 BATCH 3: Dynamic Imports — Sales, Spaces, Procurement
  // =========================================================================

  // Sales
  SalesHub: createLazyRoute(
    () => import('@/components/sales/pages/SalesHubPageContent').then(mod => ({ default: mod.SalesHubPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  SalesAvailableProperties: createLazyRoute(
    () => import('@/components/sales/pages/SalesAvailablePropertiesPageContent').then(mod => ({ default: mod.SalesAvailablePropertiesPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  SalesAvailableParking: createLazyRoute(
    () => import('@/components/sales/pages/SalesAvailableParkingPageContent').then(mod => ({ default: mod.SalesAvailableParkingPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  SalesAvailableStorage: createLazyRoute(
    () => import('@/components/sales/pages/SalesAvailableStoragePageContent').then(mod => ({ default: mod.SalesAvailableStoragePageContent })),
    { loadingType: 'list', ssr: false }
  ),

  SalesSold: createLazyRoute(
    () => import('@/components/sales/pages/SalesSoldPageContent').then(mod => ({ default: mod.SalesSoldPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  // Spaces
  SpacesHub: createLazyRoute(
    () => import('@/components/spaces/pages/SpacesHubPageContent').then(mod => ({ default: mod.SpacesHubPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  SpacesCommon: createLazyRoute(
    () => import('@/components/spaces/pages/SpacesCommonPageContent').then(mod => ({ default: mod.SpacesCommonPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  SpacesParking: createLazyRoute(
    () => import('@/components/space-management/ParkingPage/ParkingPageContent').then(mod => ({ default: mod.ParkingPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  SpacesStorage: createLazyRoute(
    () => import('@/components/space-management/StoragesPage/StoragePageContent').then(mod => ({ default: mod.StoragePageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // Procurement
  Procurement: createLazyRoute(
    () => import('@/components/procurement/pages/ProcurementPageContent').then(mod => ({ default: mod.ProcurementPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  ProcurementDetail: createLazyRoute(
    () => import('@/components/procurement/pages/ProcurementDetailPageContent').then(mod => ({ default: mod.ProcurementDetailPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  // =========================================================================
  // ⚡ ADR-294 BATCH 4: Dynamic Imports — Account, CRM remaining, Obligations
  // =========================================================================

  // Account
  AccountProfile: createLazyRoute(
    () => import('@/components/account/pages/ProfilePageContent').then(mod => ({ default: mod.ProfilePageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AccountPreferences: createLazyRoute(
    () => import('@/components/account/pages/PreferencesPageContent').then(mod => ({ default: mod.PreferencesPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AccountPrivacy: createLazyRoute(
    () => import('@/components/account/pages/PrivacyPageContent').then(mod => ({ default: mod.PrivacyPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  AccountSecurity: createLazyRoute(
    () => import('@/components/account/pages/SecurityPageContent').then(mod => ({ default: mod.SecurityPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AccountNotifications: createLazyRoute(
    () => import('@/components/account/pages/NotificationsPageContent').then(mod => ({ default: mod.NotificationsPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // CRM remaining
  CrmHub: createLazyRoute(
    () => import('@/components/crm/pages/CrmHubPageContent').then(mod => ({ default: mod.CrmHubPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmTeams: createLazyRoute(
    () => import('@/components/crm/pages/CrmTeamsPageContent').then(mod => ({ default: mod.CrmTeamsPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  CrmNotifications: createLazyRoute(
    () => import('@/components/crm/pages/CrmNotificationsPageContent').then(mod => ({ default: mod.CrmNotificationsPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // Obligations
  ObligationsHub: createLazyRoute(
    () => import('@/components/obligations/pages/ObligationsHubPageContent').then(mod => ({ default: mod.ObligationsHubPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // =========================================================================
  // ⚡ ADR-294 BATCH 5: Dynamic Imports — Admin pages
  // Note: ai-inbox + operator-inbox are Server Components (SSR auth) — not lazy-loaded
  // =========================================================================

  AdminEnterpriseMigration: createLazyRoute(
    () => import('@/components/admin/pages/EnterpriseMigrationPageContent').then(mod => ({ default: mod.EnterpriseMigrationPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AdminRoleManagement: createLazyRoute(
    () => import('@/components/admin/pages/RoleManagementPageContent').then(mod => ({ default: mod.RoleManagementPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  AdminSetup: createLazyRoute(
    () => import('@/components/admin/pages/AdminSetupPageContent').then(mod => ({ default: mod.AdminSetupPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AdminPropertyStatusDemo: createLazyRoute(
    () => import('@/components/admin/pages/PropertyStatusDemoPageContent').then(mod => ({ default: mod.PropertyStatusDemoPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  AdminClaimsRepair: createLazyRoute(
    () => import('@/components/admin/pages/ClaimsRepairPageContent').then(mod => ({ default: mod.ClaimsRepairPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AdminSearchBackfill: createLazyRoute(
    () => import('@/components/admin/pages/SearchBackfillPageContent').then(mod => ({ default: mod.SearchBackfillPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  AdminDatabaseUpdate: createLazyRoute(
    () => import('@/components/admin/pages/DatabaseUpdatePageContent').then(mod => ({ default: mod.DatabaseUpdatePageContent })),
    { loadingType: 'form', ssr: false }
  ),

  AdminLinkProperties: createLazyRoute(
    () => import('@/components/admin/pages/LinkPropertiesPageContent').then(mod => ({ default: mod.LinkPropertiesPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // =========================================================================
  // ⚡ ADR-294 BATCH 6: Dynamic Imports — CRM Dynamic Routes (detail pages)
  // =========================================================================

  CrmLeadDetail: createLazyRoute(
    () => import('@/components/crm/leads/LeadDetailPageContent').then(mod => ({ default: mod.LeadDetailPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmTaskDetail: createLazyRoute(
    () => import('@/components/crm/tasks/TaskDetailPageContent').then(mod => ({ default: mod.TaskDetailPageContent })),
    { loadingType: 'form', ssr: false }
  ),
} as const;

// Export types for TypeScript support
export type LazyRouteComponent = ComponentType<Record<string, unknown>>;
export type LoadingType = 'spinner' | 'dashboard' | 'form' | 'list';