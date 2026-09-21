/**
 * @file ADR-871 §10.5 Υ11 — ΕΝΑ ενεργό στοιχείο για όλο τον κατάλογο της στήλης.
 *
 * Τι κλειδώνει:
 * - Α1: κερδίζει η μακρύτερη αντιστοίχιση (`/crm/customers` όχι `/crm`).
 * - Α2: ισοπαλία γονιού/παιδιού με ίδιο href (`/crm` → `/crm`) ⇒ κερδίζει το ΠΑΙΔΙ.
 * - Α3: ο γονιός βγαίνει από τη ΔΗΛΩΜΕΝΗ σχέση, όχι από το URL (`/obligations` → «Νομικά»).
 * - Α4: όριο τμήματος (`/crmx` ΔΕΝ είναι `/crm`).
 * - Α5: σελίδα λεπτομέρειας φωτίζει τη λίστα της (`/spaces/properties/abc`).
 * - Α6: απλό στοιχείο χωρίς παιδιά, και καμία αντιστοίχιση ⇒ `null`.
 * - Α7: ενότητες μαζί — το ενεργό είναι ΕΝΑ ακόμη κι αν το href εμφανίζεται σε δύο.
 */

import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react';

import { containsActive, resolveActiveNavigation } from '../active-navigation';
import type { MenuItem } from '@/types/sidebar';

const CRM: MenuItem = {
  title: 'pages.crm',
  icon: Users,
  href: '/crm',
  subItems: [
    { title: 'crm_overview', icon: Users, href: '/crm' },
    { title: 'customers', icon: Users, href: '/crm/customers' },
    { title: 'ai_inbox', icon: Users, href: '/admin/ai-inbox' },
  ],
};
const SPACES: MenuItem = {
  title: 'sidebar.spaces',
  icon: LayoutDashboard,
  href: '/spaces',
  subItems: [{ title: 'properties', icon: LayoutDashboard, href: '/spaces/properties' }],
};
const LEGAL: MenuItem = {
  title: 'tools.legal',
  icon: FileText,
  href: '/legal-documents',
  subItems: [{ title: 'tools.obligations', icon: FileText, href: '/obligations' }],
};
const SETTINGS: MenuItem = {
  title: 'menu.settings',
  icon: Settings,
  href: '/settings',
  subItems: [{ title: 'admin_setup', icon: Settings, href: '/admin/setup' }],
};
const DASHBOARD: MenuItem = { title: 'pages.home', icon: LayoutDashboard, href: '/dashboard' };

const CATALOG: readonly MenuItem[] = [DASHBOARD, SPACES, CRM, LEGAL, SETTINGS];

describe('resolveActiveNavigation', () => {
  it('Α1: κερδίζει η μακρύτερη αντιστοίχιση', () => {
    expect(resolveActiveNavigation(CATALOG, '/crm/customers')).toEqual({
      activeHref: '/crm/customers',
      activeParentTitle: 'pages.crm',
    });
  });

  it('Α2: ισοπαλία γονιού/παιδιού με ίδιο href ⇒ κερδίζει το παιδί', () => {
    expect(resolveActiveNavigation(CATALOG, '/crm')).toEqual({
      activeHref: '/crm',
      activeParentTitle: 'pages.crm',
    });
  });

  it('Α3: γονιός από τη δηλωμένη σχέση, όχι από το URL', () => {
    expect(resolveActiveNavigation(CATALOG, '/obligations').activeParentTitle).toBe('tools.legal');
    expect(resolveActiveNavigation(CATALOG, '/admin/setup').activeParentTitle).toBe('menu.settings');
    expect(resolveActiveNavigation(CATALOG, '/admin/ai-inbox').activeParentTitle).toBe('pages.crm');
  });

  it('Α4: όριο τμήματος — `/crmx` δεν είναι `/crm`', () => {
    expect(resolveActiveNavigation(CATALOG, '/crmx').activeHref).toBeNull();
  });

  it('Α5: σελίδα λεπτομέρειας φωτίζει τη λίστα της', () => {
    expect(resolveActiveNavigation(CATALOG, '/spaces/properties/abc').activeHref).toBe(
      '/spaces/properties',
    );
  });

  it('Α6: απλό στοιχείο ⇒ χωρίς γονιό· καμία αντιστοίχιση ⇒ null', () => {
    expect(resolveActiveNavigation(CATALOG, '/dashboard')).toEqual({
      activeHref: '/dashboard',
      activeParentTitle: null,
    });
    expect(resolveActiveNavigation(CATALOG, '/nowhere')).toEqual({
      activeHref: null,
      activeParentTitle: null,
    });
  });

  it('Α7: γονιός χωρίς αντιστοιχία παιδιού φωτίζει ο ίδιος (`/spaces`)', () => {
    expect(resolveActiveNavigation(CATALOG, '/spaces')).toEqual({
      activeHref: '/spaces',
      activeParentTitle: null,
    });
  });
});

describe('containsActive', () => {
  it('ο γονιός περιέχει το ενεργό παιδί του — και μόνο αυτός', () => {
    expect(containsActive(LEGAL, '/obligations')).toBe(true);
    expect(containsActive(CRM, '/obligations')).toBe(false);
    expect(containsActive(DASHBOARD, null)).toBe(false);
  });
});
