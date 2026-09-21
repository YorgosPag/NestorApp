/**
 * ADR-871 §10.6 — ο κατάλογος **«Ρυθμίσεις»** της στήλης του γραφείου.
 * Κανόνες: βλ. `catalog-main.ts` (σειρά δήλωσης · δηλωμένος τίτλος · ομάδα χωρίς διεύθυνση).
 */

import {
  Archive,
  Construction,
  DatabaseBackup,
  History,
  Keyboard,
  Network,
  Settings,
  Shield,
  Store,
  Users,
} from 'lucide-react';
import { AGENCY_SHOWCASE_ROUTE } from '@/lib/mandate/mandate-routes';
import { ADMIN_ONLY, type CatalogEntry } from './catalog-types';

export const SETTINGS_CATALOG = [
  { kind: 'link', navLabelKey: 'tools.dxf', icon: Construction, href: '/dxf/viewer' },
  {
    kind: 'group',
    id: 'settings',
    navLabelKey: 'menu.settings',
    icon: Settings,
    // Χωρίς παιδί-ρίζα: το `/settings` είναι ανακατεύθυνση (Υ15).
    items: [
      // 🔴 Υ18 — το `environments` δηλωνόταν και ΔΕΝ επιβαλλόταν: το «Debug» φαινόταν στην
      //    παραγωγή σε κάθε `admin_access`. Πλέον το επιβάλλει η μηχανή.
      {
        kind: 'link',
        navLabelKey: 'sidebar.debug',
        icon: Archive,
        href: '/debug',
        badge: 'DEBUG',
        policy: { permissions: ['admin_access'], environments: ['development'] },
      },
      { kind: 'link', navLabelKey: 'admin.setup', icon: Shield, href: '/admin/setup', policy: ADMIN_ONLY },
      { kind: 'link', navLabelKey: 'admin.roleManagement', icon: Users, href: '/admin/role-management', policy: ADMIN_ONLY },
      { kind: 'link', navLabelKey: 'admin.auditLog', icon: History, href: '/admin/audit-log', policy: ADMIN_ONLY },
      { kind: 'link', navLabelKey: 'admin.backup', icon: DatabaseBackup, href: '/admin/backup', policy: ADMIN_ONLY },
      // 🏆 ADR-841 §7 Α21.11 — η βιτρίνα **ΧΩΡΙΣ** `admin_access`, και είναι απόφαση: είναι το
      //    πρόσωπο του ίδιου του επαγγελματία (ο υδραυλικός που δουλεύει μόνος δεν είναι
      //    «διαχειριστής» πουθενά). Όπως το «My Zillow»: ποτέ πίσω από ρυθμίσεις οργανισμού.
      { kind: 'link', navLabelKey: 'sidebar.agencyShowcase', icon: Store, href: AGENCY_SHOWCASE_ROUTE },
      { kind: 'link', navLabelKey: 'admin.companySettings', icon: Network, href: '/settings/company', policy: ADMIN_ONLY },
      { kind: 'link', navLabelKey: 'tools.shortcuts', icon: Keyboard, href: '/settings/shortcuts' },
    ],
  },
] as const satisfies readonly CatalogEntry[];
