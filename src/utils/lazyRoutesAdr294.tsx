'use client';

/**
 * =============================================================================
 * LAZY ROUTES — ADR-294 Dynamic Imports Optimization (Batch 1-7)
 * =============================================================================
 *
 * Route entries added during ADR-294 incremental code splitting.
 * Merged into the main LazyRoutes registry via spread in lazyRoutes.tsx.
 *
 * @module utils/lazyRoutesAdr294
 * @enterprise ADR-294 - Dynamic Imports Optimization
 */

import { createLazyRoute } from './lazyRoutes';

export const lazyRoutesAdr294 = {

  // =========================================================================
  // ⚡ BATCH 1: 10 heaviest pages (reports + CRM)
  // =========================================================================

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
  // ⚡ BATCH 2: 8 remaining report pages
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
  // ⚡ BATCH 3: Sales, Spaces, Procurement
  // =========================================================================

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

  Procurement: createLazyRoute(
    () => import('@/components/procurement/pages/ProcurementPageContent').then(mod => ({ default: mod.ProcurementPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  ProcurementDetail: createLazyRoute(
    () => import('@/components/procurement/pages/ProcurementDetailPageContent').then(mod => ({ default: mod.ProcurementDetailPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  // =========================================================================
  // ⚡ BATCH 4: Account, CRM remaining, Obligations
  // =========================================================================

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

  ObligationsHub: createLazyRoute(
    () => import('@/components/obligations/pages/ObligationsHubPageContent').then(mod => ({ default: mod.ObligationsHubPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  // =========================================================================
  // ⚡ BATCH 5: Admin pages
  // Note: ai-inbox + operator-inbox are Server Components — not lazy-loaded
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
  // ⚡ BATCH 6: CRM Dynamic Routes (detail pages)
  // =========================================================================

  CrmLeadDetail: createLazyRoute(
    () => import('@/components/crm/leads/LeadDetailPageContent').then(mod => ({ default: mod.LeadDetailPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  CrmTaskDetail: createLazyRoute(
    () => import('@/components/crm/tasks/TaskDetailPageContent').then(mod => ({ default: mod.TaskDetailPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  // =========================================================================
  // ⚡ BATCH 7: Settings, Navigation, Storage, Geo-Canvas, Public Share
  // =========================================================================

  SettingsShortcuts: createLazyRoute(
    () => import('@/components/settings/pages/ShortcutsPageContent').then(mod => ({ default: mod.ShortcutsPageContent })),
    { loadingType: 'list', ssr: false }
  ),

  Navigation: createLazyRoute(
    () => import('@/components/navigation/pages/NavigationPageContent').then(mod => ({ default: mod.NavigationPageContent })),
    { loadingType: 'dashboard', ssr: false }
  ),

  StorageDetail: createLazyRoute(
    () => import('@/components/storage/pages/StorageDetailPageContent').then(mod => ({ default: mod.StorageDetailPageContent })),
    { loadingType: 'form', ssr: false }
  ),

  GeoCanvas: createLazyRoute(
    () => import('@/components/geo/pages/GeoCanvasPageContent').then(mod => ({ default: mod.GeoCanvasPageContent })),
    { loadingType: 'spinner', ssr: false }
  ),

  PublicPO: createLazyRoute(
    () => import('@/components/shared/pages/PublicPOPageContent').then(mod => ({ default: mod.PublicPOPageContent })),
    { loadingType: 'spinner', ssr: false }
  ),

  SharedFile: createLazyRoute(
    () => import('@/components/shared/pages/SharedFilePageContent').then(mod => ({ default: mod.SharedFilePageContent })),
    { loadingType: 'spinner', ssr: false }
  ),

  PhotoShare: createLazyRoute(
    () => import('@/components/shared/pages/PhotoSharePageContent').then(mod => ({ default: mod.PhotoSharePageContent })),
    { loadingType: 'spinner', ssr: false }
  ),
} as const;
