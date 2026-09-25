/**
 * @file ADR-871 Ε2 / §10.3 Υ2 — η κεφαλίδα κρίνει από την ΠΑΡΟΥΣΙΑ της στήλης.
 *
 * - Χωρίς στήλη (`(light)`): «Ζητώ» / «Προσφέρω» ορατά, κανένα ☰.
 * - Με στήλη (`(me)`): «Ζητώ» / «Προσφέρω» κρυμμένα (είναι στοιχεία της στήλης), ☰ ορατό.
 * - «Καταχώριση αγγελίας» παντού.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => false }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
// Οι καθολικές δυνατότητες έχουν δική τους πύλη (CHECK 3.72) — εδώ μετρά μόνο η κεφαλίδα.
// ⚠️ Το mock ΚΡΑΤΑ τη σημαία `collapsePreferences` ορατή: η απόφαση «μετακομίζουν γλώσσα/θέμα;»
//    ανήκει στην ΚΕΦΑΛΙΔΑ (ξέρει αν αποδίδει μενού), και κρίνεται εδώ (ADR-809 §9).
jest.mock('@/core/containers/ShellUtilities', () => ({
  ShellUtilities: ({ collapsePreferences }: { collapsePreferences?: boolean }) => (
    <span data-testid="shell-utilities" data-collapse={String(Boolean(collapsePreferences))} />
  ),
}));

import { SidebarProvider } from '@/components/ui/sidebar-context';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE, NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { SHORT_STAY_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { AGENCY_DIRECTORY_ROUTE } from '@/components/mandate/agency-directory-route';

import { PublicSiteHeader } from '../PublicSiteHeader';

const hrefs = (): string[] =>
  Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');

describe('PublicSiteHeader — στήλη ή όχι', () => {
  it('Χ1: χωρίς στήλη οι δύο πόρτες του ιδιώτη ΥΠΑΡΧΟΥΝ και δεν υπάρχει ☰', () => {
    render(<PublicSiteHeader />);
    expect(hrefs()).toEqual(expect.arrayContaining([MY_DEMANDS_ROUTE, MY_OFFERS_ROUTE, NEW_OFFER_ROUTE]));
    expect(document.querySelector(`a[href="${NEW_OFFER_ROUTE}"]`)?.className).not.toContain('md:hidden');
    expect(document.querySelector('[data-sidebar="trigger"]')).toBeNull();
  });

  it('Χ2: με στήλη οι πόρτες ΚΡΥΒΟΝΤΑΙ, το ☰ εμφανίζεται, η «Καταχώριση» μένει', () => {
    render(<SidebarProvider><PublicSiteHeader /></SidebarProvider>);
    expect(hrefs()).not.toContain(MY_DEMANDS_ROUTE);
    expect(hrefs()).not.toContain(MY_OFFERS_ROUTE);
    expect(hrefs()).toContain(NEW_OFFER_ROUTE);
    expect(document.querySelector('[data-sidebar="trigger"]')).not.toBeNull();
    // Η «Καταχώριση» μένει στο DOM για το κινητό, κρυμμένη από `md` (ζει στη στήλη).
    expect(document.querySelector(`a[href="${NEW_OFFER_ROUTE}"]`)?.className).toContain('md:hidden');
    expect(screen.getByText('buttons.toggleSidebar')).toBeTruthy();
  });

  it('Χ3 (ADR-777 §8.82): οι ΑΚΤΙΝΕΣ `/pro` και `/stay` φτάνονται από κάθε δημόσια σελίδα — από `lg` (κάτω: στο μενού)', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε τους συνδέσμους ⇒ οι ακτίνες γίνονται ορφανές, φτάνονται
    //    μόνο από την καρτέλα της αρχικής.
    render(<PublicSiteHeader />);
    for (const route of [AGENCY_DIRECTORY_ROUTE, SHORT_STAY_LANDING_ROUTE]) {
      const link = document.querySelector(`a[href="${route}"]`);
      expect(link).not.toBeNull();
      // 📱 ADR-809 §9: `md` → `lg` — στα 768 px η πλήρης μπάρα χρειαζόταν ~810 px.
      expect(link?.className).toContain('lg:inline-flex');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADR-809 §9 (2026-09-25) — μετρημένο στα 390 px: δεξιά ομάδα 470 px σε 358.
// ═══════════════════════════════════════════════════════════════════════════
describe('PublicSiteHeader — μικτή πλοήγηση κάτω από `lg`', () => {
  const menuButton = () => screen.queryByRole('button', { name: 'common:header.menu.label' });

  it('Κ1: χωρίς στήλη υπάρχει «☰ Μενού», ορατό ΜΟΝΟ κάτω από `lg`, και δηλώνει τι ανοίγει', () => {
    render(<PublicSiteHeader />);
    const button = menuButton();
    expect(button).not.toBeNull();
    expect(button?.className).toContain('lg:hidden');
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  it('Κ2: με στήλη ΔΕΝ υπάρχει δεύτερο ☰ — μία θέση ☰ σε όλη την εφαρμογή', () => {
    render(<SidebarProvider><PublicSiteHeader /></SidebarProvider>);
    expect(menuButton()).toBeNull();
  });

  it('Κ3: πόρτες ΚΑΙ πράξη κρύβονται κάτω από `lg` — ζουν στο συρτάρι', () => {
    render(<PublicSiteHeader />);
    for (const route of [MY_DEMANDS_ROUTE, MY_OFFERS_ROUTE, NEW_OFFER_ROUTE]) {
      const className = document.querySelector(`a[href="${route}"]`)?.className ?? '';
      expect(className).toContain('hidden');
      expect(className).toContain('lg:inline-flex');
    }
  });

  it('Κ4: γλώσσα/θέμα μετακομίζουν ΜΟΝΟ όταν υπάρχει το μενού που τα δέχεται', () => {
    const { unmount } = render(<PublicSiteHeader />);
    expect(screen.getByTestId('shell-utilities').dataset.collapse).toBe('true');
    unmount();
    // Με στήλη το μενού ΔΕΝ αποδίδεται ⇒ αν μετακόμιζαν, θα χάνονταν (CHECK 3.72).
    render(<SidebarProvider><PublicSiteHeader /></SidebarProvider>);
    expect(screen.getByTestId('shell-utilities').dataset.collapse).toBe('false');
  });
});
