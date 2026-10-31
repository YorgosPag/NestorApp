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
  Boxes,
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
  FolderTree,
  Images,
  GitCompareArrows,
  HardDrive,
  Home,
  Inbox,
  Landmark,
  Layout,
  Library,
  ListTree,
  Package,
  Phone,
  PieChart,
  Percent,
  PiggyBank,
  Receipt,
  Ruler,
  Settings,
  Shield,
  ShoppingCart,
  Tags,
  Target,
  UserCheck,
  Users,
  Upload,
  Users2,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { AUTH_ROUTES } from '@/lib/routes';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { PROPERTIES_SCREEN_PATH } from '@/lib/properties/legacy-spaces-address';
import { CATALOG_PAGES } from '@/subapps/catalog/catalog-routes';
import { ADMIN_ONLY, type CatalogEntry, type NavPolicy } from './catalog-types';

/** Ένα κλειδί για κάθε «Επισκόπηση» ομάδας (Υ15). */
const OVERVIEW = 'menu.overview';

/**
 * ADR-923 Φάση 1γ — ο κατάλογος προϊόντων. Η πολιτική **επιβάλλεται** (Υ18): ανάγνωση = κανόνες Firestore
 * (`isInternalUserOfCompany`), εγγραφή = `catalog:schema:manage` στον γραφέα. Το `catalog:schema:view` το έχουν
 * υπάλληλος + διαχειριστής· ο ρόλος bypass περνά (`resolve-office-navigation` — ίδιο με τον κριτή).
 */
const CATALOG_SCHEMA_VIEW: NavPolicy = { permissions: ['catalog:schema:view'] };
/** Οι ρυθμίσεις **δομής** (κανάλια × γλώσσες) — Akeneo «manage structure», όχι «edit products». */
const CATALOG_SCHEMA_MANAGE: NavPolicy = { permissions: ['catalog:schema:manage'] };
/** Οι τιμές έχουν **δικό** τους δικαίωμα προβολής (SAP VK13 ≠ VK11 · ADR-923 §5.11 «3δ» Ζ) — όχι το δικαίωμα σχήματος. */
const CATALOG_PRICING_VIEW: NavPolicy = { permissions: ['catalog:pricing:view'] };

export const MAIN_CATALOG = [
  // «Πίνακας Ελέγχου» — το ορατό κείμενο που έδινε ήδη η αλυσίδα συμπερασμού στο `/dashboard`.
  { kind: 'link', navLabelKey: 'crm.dashboard', icon: Home, href: AUTH_ROUTES.home },
  // ADR-840 Σ3 — η ΜΙΑ οθόνη ακινήτων (πλέγμα · λίστα · κάτοψη). Η διαδρομή είναι σταθερά: τη ζητά και η
  // προειδοποιητική κουκκίδα του sidebar (`app-sidebar.tsx`) — δύο γραμμένα literal θα απέκλιναν σιωπηλά.
  { kind: 'link', navLabelKey: 'pages.properties', icon: Library, href: PROPERTIES_SCREEN_PATH },
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
      // ⛔ ADR-840 Σ3 — ΟΧΙ «Ακίνητα» εδώ: το `/spaces/properties` έγινε ανακατεύθυνση στην ΙΔΙΑ οθόνη με το κορυφαίο
      //    «Ευρετήριο Ακινήτων». Δεύτερη καταχώριση = δύο είσοδοι, αμφίσημη ενεργή κατάσταση.
      { kind: 'link', navLabelKey: 'sidebar.storage', icon: NAVIGATION_ENTITIES.storage.icon, href: '/spaces/storage' },
      { kind: 'link', navLabelKey: 'sidebar.parking', icon: NAVIGATION_ENTITIES.parking.icon, href: '/spaces/parking' },
      { kind: 'link', navLabelKey: 'sidebar.commonAreas', icon: Users, href: '/spaces/common' },
    ],
  },
  { kind: 'link', navLabelKey: 'sidebar.procurement', icon: ShoppingCart, href: '/procurement' },
  // ADR-923 Φάση 1γ — δίπλα στις Προμήθειες: ο ίδιος κόσμος (υλικά ↔ προϊόντα), άλλος ιδιοκτήτης (αγοραστής ↔ πωλητής).
  //                   Οικογένειες πρώτα: είναι ο στόχος· οι άλλες τρεις είναι τα υλικά από τα οποία χτίζεται.
  {
    kind: 'group',
    id: 'productCatalog',
    navLabelKey: 'sidebar.productCatalog',
    icon: Package,
    items: [
      { kind: 'link', navLabelKey: 'sidebar.catalogProducts', icon: Tags, href: CATALOG_PAGES.products, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogFamilies', icon: Boxes, href: CATALOG_PAGES.families, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogAttributes', icon: ListTree, href: CATALOG_PAGES.attributes, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogCategories', icon: FolderTree, href: CATALOG_PAGES.categories, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogMeasurements', icon: Ruler, href: CATALOG_PAGES.measurements, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogAssets', icon: Images, href: CATALOG_PAGES.assets, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogPriceLists', icon: Receipt, href: CATALOG_PAGES.priceLists, policy: CATALOG_PRICING_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogDiscounts', icon: Percent, href: CATALOG_PAGES.discounts, policy: CATALOG_PRICING_VIEW },
      // ADR-923 §5.5.1 — υπάρχουσα ετικέτα επίτηδες: το `navigation` στο κέλυφος έχει 3 bytes περιθώριο (14.497/14.500).
      { kind: 'link', navLabelKey: 'toolbar.tooltips.importData', icon: Upload, href: CATALOG_PAGES.imports, policy: CATALOG_SCHEMA_VIEW },
      { kind: 'link', navLabelKey: 'sidebar.catalogPublications', icon: BookOpen, href: CATALOG_PAGES.publications, policy: CATALOG_PRICING_VIEW },
      { kind: 'link', navLabelKey: 'menu.settings', icon: Settings, href: CATALOG_PAGES.settings, policy: CATALOG_SCHEMA_MANAGE },
    ],
  },
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
