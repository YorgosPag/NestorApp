'use client';

/**
 * =============================================================================
 * LAZY ROUTES REGISTRY - CENTRALIZED DYNAMIC IMPORT CONFIGURATION
 * =============================================================================
 *
 * SSoT for all lazy-loaded page routes in the application — **ΕΠΙΠΕΔΟ 3**, το κορυφαίο.
 * Είναι το μόνο αρχείο της οικογένειας που ζητούν οι σελίδες (75 καταναλωτές του
 * `LazyRoutes`, μετρημένο 2026-09-12).
 *
 *     lazyRouteSkeletons → lazyRouteFactory → lazyRoutesAdr294 → lazyRoutes
 *          (επίπεδο 0)        (επίπεδο 1)        (επίπεδο 2)       (εδώ)
 *
 * ⚠️ **ΜΗΝ εισαγάγεις τίποτα από αυτό το αρχείο σε κατώτερο επίπεδο.** Μέχρι τις
 * 2026-09-12 το `createLazyRoute` ζούσε εδώ και το `lazyRoutesAdr294` το εισήγαγε πίσω:
 * αμοιβαίος κύκλος όπου το top-level `...lazyRoutesAdr294` (πηγή `export const` ⇒ **TDZ**)
 * μπορούσε να δώσει `Cannot access … before initialization` ανάλογα με τη σειρά που
 * επιλέγει ο bundler. Το primitive μετακόμισε στο `lazyRouteFactory.tsx` («demotion»
 * κατά Lakos) και ο κύκλος έγινε **δομικά αδύνατος**. Φύλακας: **CHECK 3.80**.
 *
 * @module utils/lazyRoutes
 * @enterprise ADR-294 (dynamic imports) · ADR-858 §6α.2 (αρχή αξιολόγησης modules)
 */

import { defineLazyRoutes } from './lazyRouteFactory';
import { lazyRoutesAdr294 } from './lazyRoutesAdr294';

// Pre-configured lazy routes for common patterns
export const LazyRoutes = {
  ...defineLazyRoutes({
    // Dashboard routes (heavy with charts and data)
    CRMDashboard: {
      load: () => import('@/components/crm/dashboard/CRMDashboardPageContent').then(mod => ({ default: mod.CRMDashboardPageContent })),
      loadingType: 'dashboard', ssr: false,
    },

    // Management/List routes
    Buildings: {
      load: () => import('@/components/building-management/BuildingsPageContent'),
      loadingType: 'list', ssr: false,
    },

    Contacts: {
      load: () => import('@/components/contacts/ContactsPageContent'),
      loadingType: 'list', ssr: false,
    },


    Properties: {
      load: () => import('@/components/properties/PropertiesPageContent').then(mod => ({ default: mod.PropertiesPageContent })),
      loadingType: 'list', ssr: false,
    },

    // Form routes (ADR-294 Batch 8 — replaced placeholder components with real implementations)
    ObligationsNew: {
      load: () => import('@/components/obligations/pages/NewObligationPageContent').then(mod => ({ default: mod.NewObligationPageContent })),
      loadingType: 'form', ssr: false,
    },

    ObligationsEdit: {
      load: () => import('@/components/obligations/pages/EditObligationPageContent').then(mod => ({ default: mod.EditObligationPageContent })),
      loadingType: 'form', ssr: false,
    },

    // Landing (SEO important, keep SSR)
    Landing: {
      load: () => import('@/components/landing/LandingPage').then(mod => ({ default: mod.LandingPage })),
      loadingType: 'spinner', ssr: true,
    },

    // Heavy DXF Viewer (already optimized, but include for completeness)
    DXFViewer: {
      load: () => import('@/subapps/dxf-viewer/DxfViewerApp').then(mod => ({ default: mod.default })),
      loadingType: 'spinner', ssr: false,
    },

    // ⚡ NEW ADDITIONS: Recently identified heavy components που χρειάζονται lazy loading

    // Projects Management (heavy with data tables και reports)
    Projects: {
      load: () => import('@/components/projects/projects-page-content').then(mod => ({ default: mod.ProjectsPageContent })),
      loadingType: 'dashboard', ssr: false,
    },

    // Email Analytics Dashboard (heavy με charts και metrics)
    EmailAnalytics: {
      load: () => import('@/components/crm/EmailAnalyticsDashboard').then(mod => ({ default: mod.EmailAnalyticsDashboard })),
      loadingType: 'dashboard', ssr: false,
    },

    // ⚡ ENTERPRISE: Properties Management (ADR-269: Unit → Property)
    PropertiesManagement: {
      load: () => import('@/components/properties/UnitsPageContent').then(mod => ({ default: mod.PropertiesManagementContent })),
      loadingType: 'dashboard', ssr: false,
    },

    // 🏢 ENTERPRISE: File Manager (company-wide file tree view)
    FileManager: {
      load: () => import('@/components/file-manager/FileManagerPageContent').then(mod => ({ default: mod.FileManagerPageContent })),
      loadingType: 'list', ssr: false,
    },
    // 🏢 ENTERPRISE: Accounting Subapp (Phase 5A — Company Setup)
    AccountingSetup: {
      load: () => import('@/subapps/accounting/components/setup/SetupPageContent').then(mod => ({ default: mod.SetupPageContent })),
      loadingType: 'form', ssr: false,
    },

    // 🏢 ENTERPRISE: Accounting Subapp (Phase 4)
    AccountingDashboard: {
      load: () => import('@/subapps/accounting/components/dashboard/AccountingDashboard').then(mod => ({ default: mod.AccountingDashboard })),
      loadingType: 'dashboard', ssr: false,
    },

    AccountingInvoices: {
      load: () => import('@/subapps/accounting/components/invoices/InvoicesPageContent').then(mod => ({ default: mod.InvoicesPageContent })),
      loadingType: 'list', ssr: false,
    },

    AccountingNewInvoice: {
      load: () => import('@/subapps/accounting/components/invoices/NewInvoicePageContent').then(mod => ({ default: mod.NewInvoicePageContent })),
      loadingType: 'form', ssr: false,
    },

    AccountingEditInvoice: {
      load: () => import('@/subapps/accounting/components/invoices/EditInvoicePageContent').then(mod => ({ default: mod.EditInvoicePageContent })),
      loadingType: 'form', ssr: false,
    },

    AccountingJournal: {
      load: () => import('@/subapps/accounting/components/journal/JournalPageContent').then(mod => ({ default: mod.JournalPageContent })),
      loadingType: 'list', ssr: false,
    },

    AccountingVAT: {
      load: () => import('@/subapps/accounting/components/vat/VATPageContent').then(mod => ({ default: mod.VATPageContent })),
      loadingType: 'dashboard', ssr: false,
    },

    AccountingBank: {
      load: () => import('@/subapps/accounting/components/bank/BankPageContent').then(mod => ({ default: mod.BankPageContent })),
      loadingType: 'list', ssr: false,
    },

    AccountingReconciliation: {
      load: () => import('@/subapps/accounting/components/reconciliation/ReconciliationPageContent').then(mod => ({ default: mod.ReconciliationPageContent })),
      loadingType: 'list', ssr: false,
    },

    AccountingEFKA: {
      load: () => import('@/subapps/accounting/components/efka/EFKAPageContent').then(mod => ({ default: mod.EFKAPageContent })),
      loadingType: 'dashboard', ssr: false,
    },

    AccountingAssets: {
      load: () => import('@/subapps/accounting/components/assets/AssetsPageContent').then(mod => ({ default: mod.AssetsPageContent })),
      loadingType: 'list', ssr: false,
    },

    AccountingReports: {
      load: () => import('@/subapps/accounting/components/reports/ReportsPageContent').then(mod => ({ default: mod.ReportsPageContent })),
      loadingType: 'dashboard', ssr: false,
    },

    AccountingReportDetail: {
      load: () => import('@/subapps/accounting/components/reports/ReportDetailView').then(mod => ({ default: mod.ReportDetailView })),
      loadingType: 'dashboard', ssr: false,
    },

    // 🏢 ENTERPRISE: Accounting Subapp (Phase 5B — AI Document Processing)
    AccountingDocuments: {
      load: () => import('@/subapps/accounting/components/documents/DocumentsPageContent').then(mod => ({ default: mod.DocumentsPageContent })),
      loadingType: 'list', ssr: false,
    },

    // 🏢 ENTERPRISE: Accounting Subapp (ADR-ACC-020 — APY Certificates)
    AccountingAPYCertificates: {
      load: () => import('@/subapps/accounting/components/apy-certificates/APYCertificatesPageContent').then(mod => ({ default: mod.APYCertificatesPageContent })),
      loadingType: 'list', ssr: false,
    },
  }),

  // ADR-294 entries (Batch 1-7) — extracted to lazyRoutesAdr294.tsx for SRP
  ...lazyRoutesAdr294,
} as const;