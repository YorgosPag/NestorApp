/**
 * @file ADR-871 Π5 · ADR-867 §4.5 (Β10) — το σήμα αδιάβαστων όπως το ΒΛΕΠΕΙ και το ΑΚΟΥΕΙ ο άνθρωπος.
 *
 * Τι κλειδώνει:
 * - Σ1: αριθμός ⇒ ορατός αριθμός **και** ο ίδιος ακέραιος στον αναγνώστη οθόνης, μέσα στο όνομα του συνδέσμου.
 * - Σ2: 0 ⇒ τίποτα (ούτε κενό σήμα, ούτε «0 αδιάβαστες»).
 * - Σ3: 🔴 στην οροφή ⇒ «99+» οπτικά και «ΤΟΥΛΑΧΙΣΤΟΝ 100» στον αναγνώστη — ποτέ αριθμός που δεν ξέρουμε.
 * - Σ4: στη γραμμή (ανοιχτή στήλη) μετρά ΜΟΝΟ ο σύνδεσμος που δηλώνει πηγή — ο κατάλογος γραφείου μένει ανέγγιχτος.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { FileText, MessagesSquare } from 'lucide-react';

import type { MenuCount, MenuLink } from '@/types/sidebar';

let mockCount: MenuCount = { count: 0, atLeast: false };

jest.mock('@/hooks/network-messaging/useNetworkUnreadCount', () => ({
  useNetworkUnreadCount: () => mockCount,
}));
// Το t() επιστρέφει «ns:key|count» ώστε να ΑΠΟΔΕΙΚΝΥΕΤΑΙ ποιο κλειδί και ποιος αριθμός έφτασαν (πρότυπο ADR-854).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { ns?: string; count?: number }) => `${opts?.ns ?? ''}:${key}|${opts?.count ?? ''}`,
  }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { MenuCountBadge } from '@/components/sidebar/menu-count-badge';
import { SidebarItemLabel } from '@/components/sidebar/sidebar-menu-shared';

const BADGE = 'menu-count-network-unread';
const MESSAGES: MenuLink = {
  kind: 'link',
  navLabelKey: 'personal.items.myMessages',
  icon: MessagesSquare,
  href: '/messages',
  countSource: 'network-unread',
};
const PLAIN: MenuLink = { kind: 'link', navLabelKey: 'crm.leads', icon: FileText, href: '/crm/leads' };

describe('Σ — το σήμα αδιάβαστων', () => {
  it('Σ1 αριθμός ⇒ ορατός, και ο ΙΔΙΟΣ ακέραιος μέσα στο όνομα του συνδέσμου', () => {
    mockCount = { count: 3, atLeast: false };
    render(<a href="/messages">Τα μηνύματά μου<MenuCountBadge source="network-unread" placement="inline-end" /></a>);

    expect(screen.getByTestId(BADGE)).toHaveTextContent('3');
    expect(screen.getByRole('link')).toHaveAccessibleName(/navigation:personal\.unread\.threads\|3/);
  });

  it('Σ2 μηδέν ⇒ ΤΙΠΟΤΑ', () => {
    mockCount = { count: 0, atLeast: false };
    render(<a href="/messages">x<MenuCountBadge source="network-unread" placement="inline-end" /></a>);

    expect(screen.queryByTestId(BADGE)).toBeNull();
    expect(screen.getByRole('link')).toHaveAccessibleName('x');
  });

  it('Σ3 🔴 στην οροφή ⇒ «99+» οπτικά, «ΤΟΥΛΑΧΙΣΤΟΝ 100» στον αναγνώστη', () => {
    mockCount = { count: 100, atLeast: true };
    render(<a href="/messages">x<MenuCountBadge source="network-unread" placement="top-end" /></a>);

    expect(screen.getByTestId(BADGE)).toHaveTextContent('99+');
    expect(screen.getByRole('link')).toHaveAccessibleName(/personal\.unread\.threadsAtLeast\|100/);
  });

  it('Σ4 στη γραμμή μετρά ΜΟΝΟ ο σύνδεσμος που δηλώνει πηγή', () => {
    mockCount = { count: 2, atLeast: false };
    const { unmount } = render(<SidebarItemLabel item={MESSAGES} title="Τα μηνύματά μου" />);
    expect(screen.getByTestId(BADGE)).toHaveTextContent('2');
    unmount();

    render(<SidebarItemLabel item={PLAIN} title="Leads" />);
    expect(screen.queryByTestId(BADGE)).toBeNull();
  });
});
