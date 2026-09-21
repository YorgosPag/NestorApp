/**
 * @file ADR-871 §10.5 Υ11 — το ενεργό στη στήλη του γραφείου, όπως το ΒΛΕΠΕΙ ο άνθρωπος.
 *
 * Τι κλειδώνει:
 * - Ε1: ακριβώς ΕΝΑ `aria-current="page"` — όχι όλα τα αδέλφια του γονιού (το παλιό bug).
 * - Ε2: ο γονιός του ενεργού ανοίγει μόνος του, με `aria-expanded="true"`.
 * - Ε3: ομάδα χωρίς διεύθυνση («Νομικά», μόνο παιδί `/obligations`) ανοίγει επίσης (ADR-871 §10.6).
 * - Ε4: ο άνθρωπος κλείνει τον γονιό ⇒ μένει κλειστός, και ο φωτισμός ανεβαίνει σε αυτόν.
 * - Ε5: πλοήγηση σε άλλη ομάδα ⇒ ανοίγει ο νέος γονιός.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText, Users } from 'lucide-react';

let mockPathname = '/crm/customers';

jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => false }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className, ...rest }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => mockPathname,
}));

import { SidebarProvider } from '@/components/ui/sidebar-context';
import { SidebarMenuSection } from '@/components/sidebar/sidebar-menu-section';
import { useSidebarState } from '@/hooks/useSidebarState';
import type { MenuEntry } from '@/types/sidebar';

// ADR-871 §10.6 Υ13 — ομάδες ΧΩΡΙΣ διεύθυνση· η «Επισκόπηση» είναι σύνδεσμος της ομάδας.
const ITEMS: MenuEntry[] = [
  {
    kind: 'group',
    id: 'crm',
    navLabelKey: 'pages.crm',
    icon: Users,
    items: [
      { kind: 'link', navLabelKey: 'menu.overview', icon: Users, href: '/crm' },
      { kind: 'link', navLabelKey: 'crm.customers', icon: Users, href: '/crm/customers' },
      { kind: 'link', navLabelKey: 'crm.leads', icon: Users, href: '/crm/leads' },
    ],
  },
  {
    kind: 'group',
    id: 'legal',
    navLabelKey: 'tools.legal',
    icon: FileText,
    items: [{ kind: 'link', navLabelKey: 'tools.obligations', icon: FileText, href: '/obligations' }],
  },
];

function Column(): React.JSX.Element {
  const { expandedItems, toggleExpanded, activeHref } = useSidebarState(ITEMS);
  return (
    <SidebarMenuSection
      items={ITEMS}
      expandedItems={expandedItems}
      onToggleExpanded={toggleExpanded}
      activeHref={activeHref}
    />
  );
}

const renderAt = (pathname: string) => {
  mockPathname = pathname;
  return render(<SidebarProvider><Column /></SidebarProvider>);
};
const current = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[aria-current="page"]'));
const groupButton = (title: string): HTMLElement => screen.getByRole('button', { name: title });

describe('στήλη γραφείου — ένα ενεργό (ADR-871 §10.5 Υ11)', () => {
  it('Ε1: ακριβώς ένα `aria-current`, στο πιο συγκεκριμένο υπο-στοιχείο', () => {
    renderAt('/crm/customers');
    expect(current().map((el) => el.getAttribute('href'))).toEqual(['/crm/customers']);
  });

  it('Ε2: ο γονιός του ενεργού ανοίγει μόνος του', () => {
    renderAt('/crm/leads');
    expect(groupButton('pages.crm').getAttribute('aria-expanded')).toBe('true');
    expect(groupButton('tools.legal').getAttribute('aria-expanded')).toBe('false');
  });

  it('Ε3: γονιός με ξένο href παιδιού ανοίγει επίσης', () => {
    renderAt('/obligations');
    expect(groupButton('tools.legal').getAttribute('aria-expanded')).toBe('true');
    expect(current().map((el) => el.getAttribute('href'))).toEqual(['/obligations']);
  });

  it('Ε4: κλείσιμο από τον άνθρωπο ⇒ μένει κλειστός, ο φωτισμός ανεβαίνει στον γονιό', async () => {
    const user = userEvent.setup();
    renderAt('/crm/customers');
    await user.click(groupButton('pages.crm'));
    expect(groupButton('pages.crm').getAttribute('aria-expanded')).toBe('false');
    expect(current()).toHaveLength(0);
    expect(groupButton('pages.crm').getAttribute('data-active')).toBe('true');
  });

  it('Ε5: πλοήγηση σε άλλη ομάδα ⇒ ανοίγει ο νέος γονιός', () => {
    const view = renderAt('/crm/customers');
    mockPathname = '/obligations';
    view.rerender(<SidebarProvider><Column /></SidebarProvider>);
    expect(groupButton('tools.legal').getAttribute('aria-expanded')).toBe('true');
    expect(current().map((el) => el.getAttribute('href'))).toEqual(['/obligations']);
  });
});
