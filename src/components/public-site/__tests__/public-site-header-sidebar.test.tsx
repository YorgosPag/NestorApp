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
jest.mock('@/core/containers/ShellUtilities', () => ({ ShellUtilities: () => null }));

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

  it('Χ3 (ADR-777 §8.82): οι ΑΚΤΙΝΕΣ `/pro` και `/stay` φτάνονται από κάθε δημόσια σελίδα — από `md`', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε τους συνδέσμους ⇒ οι ακτίνες γίνονται ορφανές, φτάνονται
    //    μόνο από την καρτέλα της αρχικής.
    render(<PublicSiteHeader />);
    for (const route of [AGENCY_DIRECTORY_ROUTE, SHORT_STAY_LANDING_ROUTE]) {
      const link = document.querySelector(`a[href="${route}"]`);
      expect(link).not.toBeNull();
      expect(link?.className).toContain('md:inline-flex');
    }
  });
});
