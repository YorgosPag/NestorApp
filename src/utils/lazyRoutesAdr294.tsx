'use client';

/**
 * =============================================================================
 * LAZY ROUTES — ADR-294 Dynamic Imports Optimization (Batch 1-7)
 * =============================================================================
 *
 * Route entries added during ADR-294 incremental code splitting — **ΕΠΙΠΕΔΟ 2**.
 * Ενώνεται στο κύριο registry με spread μέσα στο `lazyRoutes.tsx`.
 *
 * ⚠️ **ΤΟ `createLazyRoute` ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ `lazyRouteFactory`, ΟΧΙ ΑΠΟ ΤΟ `lazyRoutes`.**
 * Η δεύτερη μορφή ήταν **η ανάποδη ακμή που έκλεινε τον κύκλο** (ADR-858 §6α.2): το
 * `lazyRoutes` διαβάζει αυτό εδώ το `export const` σε **χρόνο αξιολόγησης** (top-level
 * spread), άρα αν ο bundler αξιολογούσε πρώτο αυτό το αρχείο έπεφτε σε TDZ —
 * `Cannot access 'lazyRoutesAdr294' before initialization`. Ένα αρχείο επιπέδου 2 δεν
 * εισάγει **ποτέ** από το επίπεδο 3. Φύλακας: **CHECK 3.80** (`npm run test:module-init`).
 *
 * @module utils/lazyRoutesAdr294
 * @enterprise ADR-294 (dynamic imports) · ADR-858 §6α.2 (αρχή αξιολόγησης modules)
 */

import { defineLazyRoutes } from './lazyRouteFactory';

export const lazyRoutesAdr294 = defineLazyRoutes({

  // =========================================================================
  // ⚡ BATCH 1: 10 heaviest pages (reports + CRM)
  // =========================================================================

  ReportsExecutive: {
    load: () => import('@/components/reports/pages/ReportsExecutivePageContent').then(mod => ({ default: mod.ReportsExecutivePageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsFinancial: {
    load: () => import('@/components/reports/pages/ReportsFinancialPageContent').then(mod => ({ default: mod.ReportsFinancialPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsSales: {
    load: () => import('@/components/reports/pages/ReportsSalesPageContent').then(mod => ({ default: mod.ReportsSalesPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsConstruction: {
    load: () => import('@/components/reports/pages/ReportsConstructionPageContent').then(mod => ({ default: mod.ReportsConstructionPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  FinancialIntelligence: {
    load: () => import('@/components/sales/financial-intelligence/FinancialIntelligencePageContent').then(mod => ({ default: mod.FinancialIntelligencePageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmCalendar: {
    load: () => import('@/components/crm/calendar/CalendarPageContent').then(mod => ({ default: mod.CalendarPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmTasks: {
    load: () => import('@/components/crm/tasks/TasksPageContent').then(mod => ({ default: mod.TasksPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmLeads: {
    load: () => import('@/components/crm/leads/LeadsPageContent').then(mod => ({ default: mod.LeadsPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmPipeline: {
    load: () => import('@/components/crm/pipeline/PipelinePageContent').then(mod => ({ default: mod.PipelinePageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmCommunications: {
    load: () => import('@/components/crm/communications/CommunicationsPageContent').then(mod => ({ default: mod.CommunicationsPageContent })),
    loadingType: 'list', ssr: false,
  },

  // =========================================================================
  // ⚡ BATCH 2: 8 remaining report pages
  // =========================================================================

  ReportsSpaces: {
    load: () => import('@/components/reports/pages/ReportsSpacesPageContent').then(mod => ({ default: mod.ReportsSpacesPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsContacts: {
    load: () => import('@/components/reports/pages/ReportsContactsPageContent').then(mod => ({ default: mod.ReportsContactsPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsCrm: {
    load: () => import('@/components/reports/pages/ReportsCrmPageContent').then(mod => ({ default: mod.ReportsCrmPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsCompliance: {
    load: () => import('@/components/reports/pages/ReportsCompliancePageContent').then(mod => ({ default: mod.ReportsCompliancePageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsProjects: {
    load: () => import('@/components/reports/pages/ReportsProjectsPageContent').then(mod => ({ default: mod.ReportsProjectsPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsExport: {
    load: () => import('@/components/reports/pages/ReportsExportPageContent').then(mod => ({ default: mod.ReportsExportPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  ReportsBuilder: {
    load: () => import('@/components/reports/pages/ReportsBuilderPageContent').then(mod => ({ default: mod.ReportsBuilderPageContent })),
    // ADR-884 §9.1 Α4 — ο builder καλεί το ωμό `react-i18next` hook, που ΔΕΝ φορτώνει namespace· ίδια αιτία με το cash-flow.
    loadingType: 'dashboard', ssr: false, namespaces: ['report-builder', 'report-builder-domains'],
  },

  ReportsCashFlow: {
    load: () => import('@/components/reports/pages/ReportsCashFlowPageContent').then(mod => ({ default: mod.ReportsCashFlowPageContent })),
    // ADR-884 §9.1 Α4 — το `cash-flow` δεν είναι CRITICAL και η σελίδα καλεί το ωμό `react-i18next` hook, που ΔΕΝ
    // φορτώνει namespace: ζωγράφιζε ωμά κλειδιά (`kpi.currentBalance`) και αγγλικές ενσωματωμένες εφεδρείες.
    loadingType: 'dashboard', ssr: false, namespaces: ['cash-flow'],
  },

  // =========================================================================
  // ⚡ BATCH 3: Sales, Spaces, Procurement
  // =========================================================================

  SalesHub: {
    load: () => import('@/components/sales/pages/SalesHubPageContent').then(mod => ({ default: mod.SalesHubPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  SalesAvailableProperties: {
    load: () => import('@/components/sales/pages/SalesAvailablePropertiesPageContent').then(mod => ({ default: mod.SalesAvailablePropertiesPageContent })),
    loadingType: 'list', ssr: false,
  },

  SalesAvailableParking: {
    load: () => import('@/components/sales/pages/SalesAvailableParkingPageContent').then(mod => ({ default: mod.SalesAvailableParkingPageContent })),
    loadingType: 'list', ssr: false,
  },

  SalesAvailableStorage: {
    load: () => import('@/components/sales/pages/SalesAvailableStoragePageContent').then(mod => ({ default: mod.SalesAvailableStoragePageContent })),
    loadingType: 'list', ssr: false,
  },

  SalesSold: {
    load: () => import('@/components/sales/pages/SalesSoldPageContent').then(mod => ({ default: mod.SalesSoldPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  SpacesHub: {
    load: () => import('@/components/spaces/pages/SpacesHubPageContent').then(mod => ({ default: mod.SpacesHubPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  SpacesCommon: {
    load: () => import('@/components/spaces/pages/SpacesCommonPageContent').then(mod => ({ default: mod.SpacesCommonPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  SpacesParking: {
    load: () => import('@/components/space-management/ParkingPage/ParkingPageContent').then(mod => ({ default: mod.ParkingPageContent })),
    loadingType: 'list', ssr: false,
  },

  SpacesStorage: {
    load: () => import('@/components/space-management/StoragesPage/StoragePageContent').then(mod => ({ default: mod.StoragePageContent })),
    loadingType: 'list', ssr: false,
  },

  Procurement: {
    load: () => import('@/components/procurement/pages/ProcurementPageContent').then(mod => ({ default: mod.ProcurementPageContent })),
    loadingType: 'list', ssr: false,
  },

  ProcurementDetail: {
    load: () => import('@/components/procurement/pages/ProcurementDetailPageContent').then(mod => ({ default: mod.ProcurementDetailPageContent })),
    loadingType: 'form', ssr: false,
  },

  // =========================================================================
  // ⚡ BATCH 4: Account, CRM remaining, Obligations
  // =========================================================================

  AccountProfile: {
    load: () => import('@/components/account/pages/ProfilePageContent').then(mod => ({ default: mod.ProfilePageContent })),
    loadingType: 'form', ssr: false,
  },

  AccountPreferences: {
    load: () => import('@/components/account/pages/PreferencesPageContent').then(mod => ({ default: mod.PreferencesPageContent })),
    loadingType: 'form', ssr: false,
  },

  AccountPrivacy: {
    load: () => import('@/components/account/pages/PrivacyPageContent').then(mod => ({ default: mod.PrivacyPageContent })),
    loadingType: 'list', ssr: false,
  },

  AccountSecurity: {
    load: () => import('@/components/account/pages/SecurityPageContent').then(mod => ({ default: mod.SecurityPageContent })),
    loadingType: 'form', ssr: false,
  },

  AccountNotifications: {
    load: () => import('@/components/account/pages/NotificationsPageContent').then(mod => ({ default: mod.NotificationsPageContent })),
    loadingType: 'list', ssr: false,
  },

  // 🏢 ENTERPRISE: Company Settings (ADR-326 Phase 2)
  CompanySettings: {
    load: () => import('@/components/settings/company/CompanySettingsPageContent').then(mod => ({ default: mod.CompanySettingsPageContent })),
    loadingType: 'form', ssr: false,
  },

  CrmHub: {
    load: () => import('@/components/crm/pages/CrmHubPageContent').then(mod => ({ default: mod.CrmHubPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmTeams: {
    load: () => import('@/components/crm/pages/CrmTeamsPageContent').then(mod => ({ default: mod.CrmTeamsPageContent })),
    loadingType: 'list', ssr: false,
  },

  CrmNotifications: {
    load: () => import('@/components/crm/pages/CrmNotificationsPageContent').then(mod => ({ default: mod.CrmNotificationsPageContent })),
    loadingType: 'list', ssr: false,
  },

  ObligationsHub: {
    load: () => import('@/components/obligations/pages/ObligationsHubPageContent').then(mod => ({ default: mod.ObligationsHubPageContent })),
    loadingType: 'list', ssr: false,
  },

  // =========================================================================
  // ⚡ BATCH 5: Admin pages
  // Note: ai-inbox + operator-inbox are Server Components — not lazy-loaded
  // =========================================================================

  AdminEnterpriseMigration: {
    load: () => import('@/components/admin/pages/EnterpriseMigrationPageContent').then(mod => ({ default: mod.EnterpriseMigrationPageContent })),
    loadingType: 'form', ssr: false,
  },

  AdminRoleManagement: {
    load: () => import('@/components/admin/pages/RoleManagementPageContent').then(mod => ({ default: mod.RoleManagementPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  AdminSetup: {
    load: () => import('@/components/admin/pages/AdminSetupPageContent').then(mod => ({ default: mod.AdminSetupPageContent })),
    loadingType: 'form', ssr: false,
  },

  AdminPropertyStatusDemo: {
    load: () => import('@/components/admin/pages/PropertyStatusDemoPageContent').then(mod => ({ default: mod.PropertyStatusDemoPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  AdminClaimsRepair: {
    load: () => import('@/components/admin/pages/ClaimsRepairPageContent').then(mod => ({ default: mod.ClaimsRepairPageContent })),
    loadingType: 'form', ssr: false,
  },

  AdminSearchBackfill: {
    load: () => import('@/components/admin/pages/SearchBackfillPageContent').then(mod => ({ default: mod.SearchBackfillPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  // ADR-881 — εικόνες ήρωα των δημόσιων σελίδων (εργαλείο παρόχου).
  AdminLandingHeroes: {
    load: () => import('@/components/admin/pages/LandingHeroesPageContent').then(mod => ({ default: mod.LandingHeroesPageContent })),
    loadingType: 'form', ssr: false,
  },

  // ADR-900 §3.8 — η ουρά ελέγχου επαληθεύσεων κατοχής (εργαλείο παρόχου, μόνο super_admin).
  // Οι καρτέλες βάφονται από το `property-market` στο πρώτο καρέ: μετρημένο ζωντανά 2026-10-05, ωμά κλειδιά
  // 560ms → 2.586ms. Το `admin` ταξιδεύει ολόκληρο στο κέλυφος — δεν δηλώνεται.
  AdminOwnershipVerifications: {
    load: () => import('@/components/admin/pages/OwnershipVerificationsPageContent').then(mod => ({ default: mod.OwnershipVerificationsPageContent })),
    loadingType: 'dashboard', ssr: false, namespaces: ['property-market'],
  },

  AdminDatabaseUpdate: {
    load: () => import('@/components/admin/pages/DatabaseUpdatePageContent').then(mod => ({ default: mod.DatabaseUpdatePageContent })),
    loadingType: 'form', ssr: false,
  },

  AdminBackup: {
    load: () => import('@/components/admin/pages/BackupPageContent').then(mod => ({ default: mod.BackupPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  // =========================================================================
  // ⚡ BATCH 6: CRM Dynamic Routes (detail pages)
  // =========================================================================

  CrmLeadDetail: {
    load: () => import('@/components/crm/leads/LeadDetailPageContent').then(mod => ({ default: mod.LeadDetailPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmTaskDetail: {
    load: () => import('@/components/crm/tasks/TaskDetailPageContent').then(mod => ({ default: mod.TaskDetailPageContent })),
    loadingType: 'form', ssr: false,
  },

  // =========================================================================
  // ⚡ BATCH 7: Settings, Navigation, Storage, Geo-Canvas, Public Share
  // =========================================================================

  SettingsShortcuts: {
    load: () => import('@/components/settings/pages/ShortcutsPageContent').then(mod => ({ default: mod.ShortcutsPageContent })),
    loadingType: 'list', ssr: false,
  },

  Navigation: {
    load: () => import('@/components/navigation/pages/NavigationPageContent').then(mod => ({ default: mod.NavigationPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  StorageDetail: {
    load: () => import('@/components/storage/pages/StorageDetailPageContent').then(mod => ({ default: mod.StorageDetailPageContent })),
    loadingType: 'form', ssr: false,
  },

  PublicPO: {
    load: () => import('@/components/shared/pages/PublicPOPageContent').then(mod => ({ default: mod.PublicPOPageContent })),
    loadingType: 'spinner', ssr: false,
  },

  SharedFile: {
    load: () => import('@/components/shared/pages/SharedFilePageContent').then(mod => ({ default: mod.SharedFilePageContent })),
    // ADR-884 §9.1 Α4 — η περιήγηση (`spatial_tour`) δεν ζωγραφίζει πριν φτάσει το namespace της.
    loadingType: 'spinner', ssr: false, namespaces: ['spatial-tour'],
  },

  PhotoShare: {
    load: () => import('@/components/shared/pages/PhotoSharePageContent').then(mod => ({ default: mod.PhotoSharePageContent })),
    loadingType: 'spinner', ssr: false,
  },
});
