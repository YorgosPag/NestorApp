/**
 * @file ADR-871 §10.5 Υ11 + §10.6 Υ13/Υ20 — ΕΝΑ ενεργό στοιχείο για όλο τον κατάλογο της στήλης.
 *
 * Τι κλειδώνει:
 * - Α1: κερδίζει η μακρύτερη αντιστοίχιση (`/crm/customers` όχι `/crm`).
 * - Α2: η «Επισκόπηση» (`/crm`) είναι σύνδεσμος — ενεργή στο `/crm`, μέσα στην ομάδα της.
 * - Α3: η ομάδα βγαίνει από τη ΔΗΛΩΜΕΝΗ σχέση, όχι από το URL (`/obligations` → «Νομικά»).
 * - Α4: όριο τμήματος (`/crmx` ΔΕΝ είναι `/crm`).
 * - Α5: σελίδα λεπτομέρειας φωτίζει τη λίστα της (`/spaces/properties/abc`).
 * - Α6: απλός σύνδεσμος χωρίς ομάδα, και καμία αντιστοίχιση ⇒ `null`.
 * - Α7: 🔑 η ΟΜΑΔΑ ΔΕΝ ΕΙΝΑΙ ΥΠΟΨΗΦΙΑ — δεν έχει διεύθυνση (Υ13). Βαθιά σελίδα χωρίς δικό της
 *        σύνδεσμο φωτίζει τον πλησιέστερο πρόγονο («Επισκόπηση»), ποτέ «την ομάδα».
 *
 * ⛔ ΜΕΤΑΛΛΑΞΗ (Α2/Α7): κάνε την ομάδα υποψήφια με ψεύτικο href ⇒ κόκκινο.
 */

import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react';

import { containsActive, resolveActiveNavigation } from '../active-navigation';
import type { MenuEntry, MenuGroup, MenuLink } from '@/types/sidebar';

const OVERVIEW: MenuLink = { kind: 'link', navLabelKey: 'menu.overview', icon: Users, href: '/crm' };
const CRM: MenuGroup = {
  kind: 'group',
  id: 'crm',
  navLabelKey: 'pages.crm',
  icon: Users,
  items: [
    OVERVIEW,
    { kind: 'link', navLabelKey: 'crm.customers', icon: Users, href: '/crm/customers' },
    { kind: 'link', navLabelKey: 'admin.aiInbox', icon: Users, href: '/admin/ai-inbox' },
  ],
};
const SPACES: MenuGroup = {
  kind: 'group',
  id: 'spaces',
  navLabelKey: 'sidebar.spaces',
  icon: LayoutDashboard,
  items: [
    { kind: 'link', navLabelKey: 'menu.overview', icon: LayoutDashboard, href: '/spaces' },
    { kind: 'link', navLabelKey: 'sidebar.properties', icon: LayoutDashboard, href: '/spaces/properties' },
  ],
};
const LEGAL: MenuGroup = {
  kind: 'group',
  id: 'legal',
  navLabelKey: 'tools.legal',
  icon: FileText,
  items: [{ kind: 'link', navLabelKey: 'tools.obligations', icon: FileText, href: '/obligations' }],
};
const SETTINGS: MenuGroup = {
  kind: 'group',
  id: 'settings',
  navLabelKey: 'menu.settings',
  icon: Settings,
  items: [{ kind: 'link', navLabelKey: 'admin.setup', icon: Settings, href: '/admin/setup' }],
};
const DASHBOARD: MenuLink = { kind: 'link', navLabelKey: 'crm.dashboard', icon: LayoutDashboard, href: '/dashboard' };

const CATALOG: readonly MenuEntry[] = [DASHBOARD, SPACES, CRM, LEGAL, SETTINGS];

describe('resolveActiveNavigation', () => {
  it('Α1: κερδίζει η μακρύτερη αντιστοίχιση', () => {
    expect(resolveActiveNavigation(CATALOG, '/crm/customers')).toEqual({
      activeHref: '/crm/customers',
      activeGroupId: 'crm',
    });
  });

  it('Α2: η «Επισκόπηση» είναι σύνδεσμος της ομάδας — ενεργή στο `/crm`', () => {
    expect(resolveActiveNavigation(CATALOG, '/crm')).toEqual({ activeHref: '/crm', activeGroupId: 'crm' });
  });

  it('Α3: ομάδα από τη δηλωμένη σχέση, όχι από το URL', () => {
    expect(resolveActiveNavigation(CATALOG, '/obligations').activeGroupId).toBe('legal');
    expect(resolveActiveNavigation(CATALOG, '/admin/setup').activeGroupId).toBe('settings');
    expect(resolveActiveNavigation(CATALOG, '/admin/ai-inbox').activeGroupId).toBe('crm');
  });

  it('Α4: όριο τμήματος — `/crmx` δεν είναι `/crm`', () => {
    expect(resolveActiveNavigation(CATALOG, '/crmx').activeHref).toBeNull();
  });

  it('Α5: σελίδα λεπτομέρειας φωτίζει τη λίστα της', () => {
    expect(resolveActiveNavigation(CATALOG, '/spaces/properties/abc').activeHref).toBe('/spaces/properties');
  });

  it('Α6: απλός σύνδεσμος ⇒ χωρίς ομάδα· καμία αντιστοίχιση ⇒ null', () => {
    expect(resolveActiveNavigation(CATALOG, '/dashboard')).toEqual({ activeHref: '/dashboard', activeGroupId: null });
    expect(resolveActiveNavigation(CATALOG, '/nowhere')).toEqual({ activeHref: null, activeGroupId: null });
  });

  it('Α7: η ομάδα δεν είναι υποψήφια — βαθιά σελίδα φωτίζει τον πλησιέστερο πρόγονο', () => {
    expect(resolveActiveNavigation(CATALOG, '/spaces/storage/xyz')).toEqual({
      activeHref: '/spaces',
      activeGroupId: 'spaces',
    });
    // Ομάδα χωρίς παιδί-ρίζα (`settings` → ανακατεύθυνση): τίποτα δεν ισχυρίζεται το `/settings/x`.
    expect(resolveActiveNavigation(CATALOG, '/settings/x').activeHref).toBeNull();
  });
});

describe('containsActive', () => {
  it('η ομάδα περιέχει το ενεργό παιδί της — και μόνο αυτή', () => {
    expect(containsActive(LEGAL, '/obligations')).toBe(true);
    expect(containsActive(CRM, '/obligations')).toBe(false);
    expect(containsActive(DASHBOARD, null)).toBe(false);
    expect(containsActive(DASHBOARD, '/dashboard')).toBe(true);
  });
});
