/**
 * @file ADR-871 §5.4 — η στήλη του προσωπικού χώρου **στο κινητό** (συρτάρι).
 *
 * Τι κλειδώνει:
 * - Κ1: κλειστό συρτάρι ⇒ κανένας σύνδεσμος της στήλης στο δέντρο.
 * - Κ2: ☰ ⇒ ανοίγει (dialog) με τους προορισμούς του καταλόγου.
 * - Κ3: πάτημα συνδέσμου ⇒ κλείνει (αλλιώς ο άνθρωπος πλοηγείται ΠΙΣΩ από ανοιχτό συρτάρι).
 * - Κ4: η κύρια πράξη («Καταχώριση») κλείνει επίσης το συρτάρι.
 * - Κ5: Esc ⇒ κλείνει.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ ελέγχεται η **συμπεριφορά**, όχι το πώς φαίνεται.
 */

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => true }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/auth', () => ({
  useAuth: () => ({ user: { companyId: undefined }, loading: false }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, onClick, className }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => { event.preventDefault(); onClick?.(event); }}
    >
      {children}
    </a>
  ),
  usePathname: () => '/offers',
}));

import { SidebarProvider } from '@/components/ui/sidebar-context';
import { SidebarTrigger } from '@/components/ui/sidebar-trigger';
import { MY_MESSAGES_ROUTE } from '@/lib/network-messaging/network-messaging-routes';
import { NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';

import { PersonalSidebar } from '../PersonalSidebar';

function MobileShell(): React.JSX.Element {
  return (
    <SidebarProvider>
      <PersonalSidebar />
      <SidebarTrigger />
    </SidebarProvider>
  );
}

const drawer = (): HTMLElement | null => screen.queryByRole('dialog');
const openDrawer = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: 'buttons.toggleSidebar' }));
  return screen.findByRole('dialog');
};
const linkTo = (root: HTMLElement, href: string): HTMLAnchorElement => {
  const link = root.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
  if (link === null) throw new Error(`no link to ${href}`);
  return link;
};

describe('PersonalSidebar — συρτάρι στο κινητό', () => {
  it('Κ1: αρχικά κλειστό — κανένας σύνδεσμος της στήλης', () => {
    render(<MobileShell />);
    expect(drawer()).toBeNull();
    expect(document.querySelector(`a[href="${MY_MESSAGES_ROUTE}"]`)).toBeNull();
  });

  it('Κ2: το ☰ ανοίγει το συρτάρι με τους προορισμούς', async () => {
    const user = userEvent.setup();
    render(<MobileShell />);
    const dialog = await openDrawer(user);
    expect(linkTo(dialog, MY_MESSAGES_ROUTE)).toBeTruthy();
    expect(dialog.textContent).toContain('personal.items.myOffers');
  });

  it('Κ3: πάτημα συνδέσμου κλείνει το συρτάρι', async () => {
    const user = userEvent.setup();
    render(<MobileShell />);
    const dialog = await openDrawer(user);
    await user.click(linkTo(dialog, MY_MESSAGES_ROUTE));
    await waitFor(() => expect(drawer()).toBeNull());
  });

  it('Κ4: η κύρια πράξη («Καταχώριση») κλείνει επίσης το συρτάρι', async () => {
    const user = userEvent.setup();
    render(<MobileShell />);
    const dialog = await openDrawer(user);
    await user.click(linkTo(dialog, NEW_OFFER_ROUTE));
    await waitFor(() => expect(drawer()).toBeNull());
  });

  it('Κ6: το συρτάρι έχει ΟΝΟΜΑ για τον αναγνώστη οθόνης — και το Radix δεν διαμαρτύρεται', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<MobileShell />);
    await openDrawer(user);
    expect(screen.getByRole('dialog', { name: 'personal.sidebarLabel' })).toBeTruthy();
    const radixComplaints = [...errors.mock.calls, ...warnings.mock.calls]
      .map((call) => String(call[0]))
      .filter((message) => /DialogTitle|Description/.test(message));
    expect(radixComplaints).toEqual([]);
    errors.mockRestore();
    warnings.mockRestore();
  });

  it('Κ5: το Esc κλείνει το συρτάρι', async () => {
    const user = userEvent.setup();
    render(<MobileShell />);
    await openDrawer(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(drawer()).toBeNull());
  });
});
