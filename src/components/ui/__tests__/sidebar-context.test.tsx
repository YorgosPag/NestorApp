/**
 * @file ADR-871 Ε4 / §10.3 Υ1-Υ2 — η μνήμη σύμπτυξης ανά χώρο και η «παρουσία» της στήλης.
 *
 * Τι κλειδώνει:
 * - Π: `useOptionalSidebar` = `null` έξω από provider (αυτό κρίνει η κεφαλίδα, Ε2).
 * - Μ1: ΧΩΡΙΣ `restoreFromCookie` το cookie ΔΕΝ διαβάζεται — το `(app)` μένει όπως ήταν.
 * - Μ2: ΜΕ `restoreFromCookie` η αποθηκευμένη προτίμηση υπερισχύει του `defaultOpen`.
 * - Μ3: η εναλλαγή γράφει στο ΔΙΚΟ ΤΗΣ όνομα, όχι στο `sidebar_state` του γραφείου.
 * - Μ4: το `defaultOpen` διαβάζεται μία φορά (η στήλη δεν ανοιγοκλείνει μόνη της).
 * - Κ1-Κ4 (ADR-871 §10.5 Υ10): ο καμβάς είναι ΕΠΙΚΑΛΥΨΗ — κλειστός σε κάθε είσοδο,
 *   η εναλλαγή μέσα του δεν γράφει cookie, στην έξοδο επιστρέφει η προτίμηση.
 */

import * as React from 'react';
import { act, render, screen } from '@testing-library/react';

jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => false }));

import { SidebarProvider, useOptionalSidebar } from '../sidebar-context';

function Probe(): React.JSX.Element {
  const sidebar = useOptionalSidebar();
  return (
    <output data-testid="probe">
      {sidebar === null ? 'absent' : sidebar.state}
    </output>
  );
}

function Toggle(): React.JSX.Element {
  const sidebar = useOptionalSidebar();
  return <button type="button" onClick={() => sidebar?.toggleSidebar()}>toggle</button>;
}

const clearCookies = (): void => {
  for (const name of ['sidebar_state', 'personal_sidebar_state']) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
};

beforeEach(clearCookies);
afterAll(clearCookies);

describe('Π — παρουσία', () => {
  it('Π1: έξω από provider → null (η κεφαλίδα του `(light)`)', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('absent');
  });

  it('Π2: μέσα σε provider → η κατάσταση (η κεφαλίδα του `(me)`)', () => {
    render(<SidebarProvider><Probe /></SidebarProvider>);
    expect(screen.getByTestId('probe').textContent).toBe('expanded');
  });
});

describe('Μ — μνήμη σύμπτυξης', () => {
  it('Μ1: χωρίς `restoreFromCookie` το αποθηκευμένο «κλειστό» αγνοείται', () => {
    document.cookie = 'sidebar_state=false; path=/';
    render(<SidebarProvider><Probe /></SidebarProvider>);
    expect(screen.getByTestId('probe').textContent).toBe('expanded');
  });

  it('Μ2: με `restoreFromCookie` η αποθηκευμένη προτίμηση νικά το `defaultOpen`', () => {
    document.cookie = 'personal_sidebar_state=false; path=/';
    render(
      <SidebarProvider cookieName="personal_sidebar_state" restoreFromCookie>
        <Probe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('collapsed');
  });

  it('Μ3: η εναλλαγή γράφει στο δικό της όνομα — το cookie του γραφείου μένει άθικτο', () => {
    render(
      <SidebarProvider cookieName="personal_sidebar_state" restoreFromCookie>
        <Probe />
        <Toggle />
      </SidebarProvider>,
    );
    act(() => { screen.getByRole('button', { name: 'toggle' }).click(); });
    expect(screen.getByTestId('probe').textContent).toBe('collapsed');
    expect(document.cookie).toContain('personal_sidebar_state=false');
    expect(document.cookie.split('; ').some((c) => c.startsWith('sidebar_state='))).toBe(false);
  });

  it('Μ4: αλλαγή του `defaultOpen` μετά την προσάρτηση ΔΕΝ αλλάζει τη στήλη', () => {
    const { rerender } = render(<SidebarProvider defaultOpen><Probe /></SidebarProvider>);
    rerender(<SidebarProvider defaultOpen={false}><Probe /></SidebarProvider>);
    expect(screen.getByTestId('probe').textContent).toBe('expanded');
  });
});

describe('Κ — επικάλυψη καμβά (ADR-871 §10.5 Υ10)', () => {
  const shell = (canvasMode: boolean): React.JSX.Element => (
    <SidebarProvider restoreFromCookie canvasMode={canvasMode}>
      <Probe />
      <Toggle />
    </SidebarProvider>
  );
  const state = (): string | null => screen.getByTestId('probe').textContent;
  const officeCookie = (): string | undefined =>
    document.cookie.split('; ').find((c) => c.startsWith('sidebar_state='));

  it('Κ1: ο καμβάς ξεκινά κλειστός ακόμη κι αν η προτίμηση είναι «ανοιχτό»', () => {
    document.cookie = 'sidebar_state=true; path=/';
    render(shell(true));
    expect(state()).toBe('collapsed');
  });

  it('Κ2: άνοιγμα μέσα στον καμβά ΔΕΝ γράφει την προτίμηση', () => {
    document.cookie = 'sidebar_state=false; path=/';
    render(shell(true));
    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(state()).toBe('expanded');
    expect(officeCookie()).toBe('sidebar_state=false');
  });

  it('Κ3: στην έξοδο από τον καμβά επιστρέφει η αποθηκευμένη προτίμηση', () => {
    document.cookie = 'sidebar_state=true; path=/';
    const { rerender } = render(shell(true));
    expect(state()).toBe('collapsed');
    rerender(shell(false));
    expect(state()).toBe('expanded');
  });

  it('Κ4: δεύτερη είσοδος στον καμβά ⇒ πάλι κλειστός, όσο κι αν τον άνοιξε την πρώτη', () => {
    const { rerender } = render(shell(true));
    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(state()).toBe('expanded');
    rerender(shell(false));
    rerender(shell(true));
    expect(state()).toBe('collapsed');
  });

  it('Κ5: έξω από τον καμβά η εναλλαγή γράφει κανονικά την προτίμηση', () => {
    render(shell(false));
    act(() => screen.getByRole('button', { name: 'toggle' }).click());
    expect(officeCookie()).toBe('sidebar_state=false');
  });
});
