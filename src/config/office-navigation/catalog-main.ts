/**
 * ADR-871 §10.6 — ο **κύριος** κατάλογος της στήλης του γραφείου, ως δεδομένα.
 *
 * 🔑 **Σειρά = σειρά δήλωσης** (Υ17). Ήταν `priority` + `displayOrder` + ταξινόμηση· η σειρά
 *    που έβγαζε εκείνη η μηχανή είναι γραμμένη εδώ αυτούσια, και το αποδεικνύει η χρυσή
 *    ισοδυναμία (`__tests__/office-navigation-golden.test.ts`).
 * 🔑 **Τίτλος δηλωμένος** (Υ16) — ποτέ συμπέρασμα από τη διεύθυνση.
 * 🔑 **Ομάδα = κουμπί χωρίς διεύθυνση** (Υ13). Το hub της ομάδας είναι **ρητό** πρώτο
 *    παιδί «Επισκόπηση» (Υ15, όπως ήταν ήδη στο CRM).
 *
 * `satisfies` ⇒ κάθε `href` ελέγχεται **εδώ**, στη δήλωση, απέναντι στον κατάλογο διαδρομών
 * του Next (`WorkspaceHref`, ADR-787 Γ5) — όχι στο σημείο κλήσης.
 */

import {
  AppWindow,
  Archive,
  Banknote,
  BarChart,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building,
  Calculator,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Construction,
  DollarSign,
  FileBarChart,
  FileSignature,
  FileText,
  Filter,
  GitCompareArrows,
  HardDrive,
  Home,
  Inbox,
  Landmark,
  Layout,
  Library,
  Phone,
  PieChart,
  PiggyBank,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  Target,
  UserCheck,
  Users,
  Users2,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { AUTH_ROUTES } from '@/lib/routes';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { ADMIN_ONLY, type CatalogEntry } from './catalog-types';

/** Ένα κλειδί για κάθε «Επισκόπηση» ομάδας (Υ15). */
const OVERVIEW = 'menu.overview';

export const MAIN_CATALOG = [
  // «Πίνακας Ελέγχου» — το ορατό κείμενο που έδινε ήδη η αλυσίδα συμπερασμού στο `/dashboard`.
  { kind: 'link', navLabelKey: 'crm.dashboard', icon: Home, href: AUTH_ROUTES.home },
  { kind: 'link', navLabelKey: 'pages.properties', icon: Library, href: '/properties' },
  { kind: 'link', navLabelKey: 'pages.contacts', icon: Users, href: '/contacts' },
  { kind: 'link', navLabelKey: 'sidebar.mandates', icon: FileSignature, href: '/listings/mandates' },
  { kind: 'link', navLabelKey: 'pages.projects', icon: Briefcase, href: '/projects' },
  { kind: 'link', navLabelKey: 'pages.buildings', icon: Building, href: '/buildings' },
  {
    kind: 'link',
    navLabelKey: 'pages.construction_portfolio',
    icon: BarChart3,
    href: '/construction/portfolio',
  },
  {
    kind: 'group',
    id: 'spaces',
    navLabelKey: 'sidebar.spaces',
    icon: Layout,
    items: [
      { kind: 'link', navLabelKey: OVERVIEW, icon: Layout, href: '/spaces' },
      { kind: 'link', navLabelKey: 'sidebar.properties', icon: NAVIGATION_ENTITIES.property.icon, href: '/spaces/properties' },
      { kind: 'link', navLabelKey: 'sidebar.storage', icon: NAVIGATION_ENTITIES.storage.icon, href: '/spaces/storage' },
      { kind: 'link', navLabelKey: 'sidebar.parking', icon: NAVIGATION_ENTITIES.parking.icon, href: '/spaces/parking' },
      { kind: 'link', navLabelKey: 'sidebar.commonAreas', icon: Users, href: '/spaces/common' },
    ],
  },
  { kind: 'link', navLabelKey: 'sidebar.procurement', icon: ShoppingCart, href: '/procurement' },
  {
    kind: 'group',
    id: 'sales',
    navLabelKey: 'sidebar.sales',
    icon: DollarSign,
    items: [
      { kind: 'link', navLabelKey: OVERVIEW, icon: Layout, href: '/sales' },
      { kind: 'link', navLabelKey: 'sidebar.availableProperties', icon: NAVIGATION_ENTITIES.property.icon, href: '/sales/available-properties' },
      { kind: 'link', navLabelKey: 'sidebar.availableStorage', icon: NAVIGATION_ENTITIES.storage.icon, href: '/sales/available-storage' },
      { kind: 'link', navLabelKey: 'sidebar.availableParking', icon: NAVIGATION_ENTITIES.parking.icon, href: '/sales/available-parking' },
      { kind: 'link', navLabelKey: 'sidebar.soldProperties', icon: CheckCircle, href: '/sales/sold' },
      { kind: 'link', navLabelKey: 'sidebar.financialIntelligence', icon: BarChart3, href: '/sales/financial-intelligence' },
    ],
  },
  {
    kind: 'group',
    id: 'crm',
    navLabelKey: 'pages.crm',
    icon: AppWindow,
    items: [
      { kind: 'link', navLabelKey: 'admin.aiInbox', icon: Inbox, href: '/admin/ai-inbox', policy: ADMIN_ONLY },
      { kind: 'link', navLabelKey: 'admin.operatorInbox', icon: UserCheck, href: '/admin/operator-inbox', policy: ADMIN_ONLY },
      { kind: 'link', navLabelKey: OVERVIEW, icon: Layout, href: '/crm' },
      { kind: 'link', navLabelKey: 'crm.dashboard', icon: BarChart, href: '/crm/dashboard' },
      { kind: 'link', navLabelKey: 'crm.customers', icon: Users, href: '/crm/customers' },
      { kind: 'link', navLabelKey: 'crm.communications', icon: Phone, href: '/crm/communications' },
      { kind: 'link', navLabelKey: 'crm.leads', icon: Target, href: '/crm/leads' },
      { kind: 'link', navLabelKey: 'crm.tasks', icon: ClipboardList, href: '/crm/tasks' },
      { kind: 'link', navLabelKey: 'crm.calendar', icon: CalendarDays, href: '/crm/calendar' },
      { kind: 'link', navLabelKey: 'crm.pipeline', icon: Filter, href: '/crm/pipeline' },
      { kind: 'link', navLabelKey: 'crm.teams', icon: Users2, href: '/crm/teams' },
      { kind: 'link', navLabelKey: 'crm.notifications', icon: Bell, href: '/crm/notifications' },
    ],
  },
  {
    kind: 'group',
    id: 'reports',
    // Ήταν «Διοικητική Σύνοψη» — ο συμπερασμός έδινε στην ΟΜΑΔΑ το κλειδί του πρώτου παιδιού.
    navLabelKey: 'pages.reports',
    icon: PieChart,
    items: [
      { kind: 'link', navLabelKey: 'reports.overview', icon: PieChart, href: '/reports' },
      { kind: 'link', navLabelKey: 'reports.financial', icon: DollarSign, href: '/reports/financial' },
      { kind: 'link', navLabelKey: 'reports.projects', icon: Building, href: '/reports/projects' },
      { kind: 'link', navLabelKey: 'reports.sales', icon: BarChart3, href: '/reports/sales' },
      { kind: 'link', navLabelKey: 'reports.contacts', icon: Users, href: '/reports/contacts' },
      { kind: 'link', navLabelKey: 'reports.crm', icon: Phone, href: '/reports/crm' },
      { kind: 'link', navLabelKey: 'reports.spaces', icon: Archive, href: '/reports/spaces' },
      { kind: 'link', navLabelKey: 'reports.construction', icon: Construction, href: '/reports/construction' },
      { kind: 'link', navLabelKey: 'reports.compliance', icon: Shield, href: '/reports/compliance' },
      { kind: 'link', navLabelKey: 'reports.export', icon: FileBarChart, href: '/reports/export' },
      { kind: 'link', navLabelKey: 'reports.cashFlow', icon: Banknote, href: '/reports/cash-flow' },
    ],
  },
  {
    kind: 'group',
    id: 'accounting',
    navLabelKey: 'sidebar.accounting',
    icon: Calculator,
    items: [
      { kind: 'link', navLabelKey: OVERVIEW, icon: Layout, href: '/accounting' },
      { kind: 'link', navLabelKey: 'accounting.setup', icon: Settings, href: APP_ROUTES.accountingSetup },
      { kind: 'link', navLabelKey: 'accounting.invoices', icon: Receipt, href: '/accounting/invoices' },
      { kind: 'link', navLabelKey: 'accounting.journal', icon: BookOpen, href: '/accounting/journal' },
      { kind: 'link', navLabelKey: 'accounting.vat', icon: DollarSign, href: '/accounting/vat' },
      { kind: 'link', navLabelKey: 'accounting.bank', icon: Landmark, href: '/accounting/bank' },
      { kind: 'link', navLabelKey: 'accounting.reconciliation', icon: GitCompareArrows, href: '/accounting/reconciliation' },
      { kind: 'link', navLabelKey: 'accounting.efka', icon: PiggyBank, href: '/accounting/efka' },
      { kind: 'link', navLabelKey: 'accounting.assets', icon: HardDrive, href: '/accounting/assets' },
      { kind: 'link', navLabelKey: 'accounting.documents', icon: FileText, href: '/accounting/documents' },
      { kind: 'link', navLabelKey: 'accounting.apyCertificates', icon: ClipboardCheck, href: '/accounting/apy-certificates' },
      { kind: 'link', navLabelKey: 'accounting.reports', icon: FileBarChart, href: '/accounting/reports' },
    ],
  },
] as const satisfies readonly CatalogEntry[];
