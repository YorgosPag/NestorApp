'use client';

/**
 * Μητρώο τεμπέλικων διαδρομών του τομέα «CRM» — ADR-954.
 *
 * Ο τομέας **κατέχει** τις σελίδες του (feature module, όπως το `loadChildren` του Angular / τα module
 * bundles του Odoo): η σελίδα εισάγει **μόνο** αυτό το αρχείο, άρα η μεταγλώττισή της δεν φτάνει σε
 * άλλον τομέα. Ένα κοινό μητρώο όλων των σελίδων έκανε κάθε σελίδα να μεταγλωττίζει **όλες** τις άλλες
 * (ADR-954 §1) — ⚠️ ΜΗΝ το ξαναφτιάξεις ενώνοντας μητρώα.
 *
 * ⚠️ Επίπεδο 2 (CHECK 3.80): εισάγει **μόνο** το factory. Το αρχείο είναι στο `lazyRouteRegistries`
 * (`scripts/lib/i18n-shell-slice/config.js`), ώστε το chunk να περιμένει τα κείμενά του (ADR-280 §11.8).
 *
 * @module components/crm/crm-routes
 * @enterprise ADR-954 · ADR-294 · ADR-280 §11.8
 */

import { defineLazyRoutes } from '@/utils/lazyRouteFactory';

export const CrmRoutes = defineLazyRoutes({
  CRMDashboard: {
    load: () => import('@/components/crm/dashboard/CRMDashboardPageContent').then(mod => ({ default: mod.CRMDashboardPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  // Email Analytics Dashboard (heavy με charts και metrics)
  EmailAnalytics: {
    load: () => import('@/components/crm/EmailAnalyticsDashboard').then(mod => ({ default: mod.EmailAnalyticsDashboard })),
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

  CrmLeadDetail: {
    load: () => import('@/components/crm/leads/LeadDetailPageContent').then(mod => ({ default: mod.LeadDetailPageContent })),
    loadingType: 'dashboard', ssr: false,
  },

  CrmTaskDetail: {
    load: () => import('@/components/crm/tasks/TaskDetailPageContent').then(mod => ({ default: mod.TaskDetailPageContent })),
    loadingType: 'form', ssr: false,
  },
});
