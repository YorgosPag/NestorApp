import {
  Home,
  Settings,
  Users,
  Building,
  Library,
  Briefcase,
  Archive,
  Keyboard,
  BarChart,
  Phone,
  Target,
  ClipboardList,
  Filter,
  Users2,
  Bell,
  AppWindow,
  LogIn,
  PenTool,
  FileText,
  Construction, // Added icon
  MapPin, // Added for Geo-Canvas
} from "lucide-react"
import type { MenuItem } from "@/types/sidebar"

// NOTE: This will be replaced with proper i18n translation functions in components
// For now, keeping the structure but strings will be translated in the UI components

export const mainMenuItems: MenuItem[] = [
  {
    title: process.env.NEXT_PUBLIC_NAV_HOME_TITLE || "Αρχική",
    icon: Home,
    href: "/",
    badge: null,
  },
  {
    title: process.env.NEXT_PUBLIC_NAV_PROPERTIES_TITLE || "Ευρετήριο Ακινήτων",
    icon: Library,
    href: "/properties",
    badge: "Νέο",
  },
  {
    title: process.env.NEXT_PUBLIC_NAV_CONTACTS_TITLE || "Επαφές",
    icon: Users,
    href: "/contacts",
    badge: null,
  },
  {
    title: process.env.NEXT_PUBLIC_NAV_PROJECTS_TITLE || "Έργα",
    icon: Briefcase,
    href: "/audit",
    badge: null,
  },
  {
    title: process.env.NEXT_PUBLIC_NAV_BUILDINGS_TITLE || "Κτίρια",
    icon: Building,
    href: "/buildings",
    badge: null,
  },
  {
    title: process.env.NEXT_PUBLIC_NAV_UNITS_TITLE || "Μονάδες (Units)",
    icon: Archive,
    href: "/units",
    badge: null,
  },
  {
    title: "CRM",
    icon: AppWindow,
    href: "/crm",
    badge: "PRO",
    subItems: [
        { title: 'Dashboard', icon: BarChart, href: '/crm/dashboard' },
        { title: 'Διαχείριση Πελατών', icon: Users, href: '/crm/customers' },
        { title: 'Επικοινωνίες', icon: Phone, href: '/crm/communications' },
        { title: 'Leads & Ευκαιρίες', icon: Target, href: '/crm/leads' },
        { title: 'Εργασίες & Ραντεβού', icon: ClipboardList, href: '/crm/tasks' },
        { title: 'Πωλήσεις Pipeline', icon: Filter, href: '/crm/pipeline' },
        { title: 'Ομάδες & Ρόλοι', icon: Users2, href: '/crm/teams' },
        { title: 'Ειδοποιήσεις', icon: Bell, href: '/crm/notifications' },
    ]
  },
]

export const toolsMenuItems: MenuItem[] = [
  {
    title: "Νομικά Έγγραφα",
    icon: FileText,
    href: "/legal-documents",
    badge: null,
    subItems: [
      {
        title: 'Συγγραφή Υποχρεώσεων',
        icon: PenTool,
        href: '/obligations'
      }
    ]
  },
  {
    title: "Geo-Canvas System",
    icon: MapPin,
    href: "/geo/canvas",
    badge: "ENTERPRISE",
  }
]

export const settingsMenuItem: MenuItem[] = [
    {
      title: "DXF Panel",
      icon: Construction,
      href: "/dxf/viewer",
      badge: null,
    },
    { 
      title: "Ρυθμίσεις", 
      icon: Settings, 
      href: "/settings",
      subItems: [
        { title: 'Συντομεύσεις', icon: Keyboard, href: '/settings/shortcuts' }
      ]
    },
    {
      title: "Login",
      icon: LogIn,
      href: "/login",
      badge: null,
    },
]
