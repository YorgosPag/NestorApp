/**
 * @file ADR-871 Ε4 / §10.3 Υ1-Υ2 — η μνήμη σύμπτυξης ανά χώρο και η «παρουσία» της στήλης.
 *
 * Τι κλειδώνει:
 * - Π: `useOptionalSidebar` = `null` έξω από provider (αυτό κρίνει η κεφαλίδα, Ε2).
 * - Μ1: ΧΩΡΙΣ `restoreFromCookie` το cookie ΔΕΝ διαβάζεται — το `(app)` μένει όπως ήταν.
 * - Μ2: ΜΕ `restoreFromCookie` η αποθηκευμένη προτίμηση υπερισχύει του `defaultOpen`.
 * - Μ3: η εναλλαγή γράφει στο ΔΙΚΟ ΤΗΣ όνομα, όχι στο `sidebar_state` του γραφείου.
 * - Μ4: το `defaultOpen` διαβάζεται μία φορά (η στήλη δεν ανοιγοκλείνει μόνη της).
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
