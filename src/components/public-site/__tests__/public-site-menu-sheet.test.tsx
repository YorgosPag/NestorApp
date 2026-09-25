/**
 * ADR-809 §9 — **Το συρτάρι του «☰ Μενού»**: ό,τι έφυγε από τη μπάρα πρέπει να είναι ΕΔΩ.
 *
 * 🔴 Το ελάττωμα που κλείνει: στα 390 px το 🌐 κοβόταν στη μέση, θέμα/λογαριασμός ήταν εκτός
 * οθόνης, και οι ακτίνες (Επαγγελματίες · Διαμονή) ήταν `hidden` κάτω από `md` ⇒ **απρόσιτες**.
 * Η μετακόμιση σε μενού είναι θεραπεία ΜΟΝΟ αν κάθε προορισμός φτάνεται — αυτό κλειδώνεται εδώ.
 *
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className, onClick }: {
    href: string; children: React.ReactNode; className?: string; onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={(e) => { e.preventDefault(); onClick?.(); }}>{children}</a>
  ),
}));
// Οι προτιμήσεις έχουν δικό τους ιδιοκτήτη και δικές τους άγκυρες (shell-utilities-identity).
jest.mock('@/core/containers/ShellUtilities', () => ({
  ShellPreferences: () => <span data-testid="shell-preferences" />,
}));

import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE, NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { SHORT_STAY_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { AGENCY_DIRECTORY_ROUTE } from '@/components/mandate/agency-directory-route';

import { PublicSiteMenuSheet } from '../PublicSiteMenuSheet';

function renderOpen() {
  const onOpenChange = jest.fn();
  render(<PublicSiteMenuSheet open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

describe('PublicSiteMenuSheet — ό,τι έφυγε από τη μπάρα, φτάνεται εδώ', () => {
  it('Σ1: ΚΑΘΕ προορισμός της μπάρας υπάρχει στο συρτάρι (ακτίνες · πόρτες · πράξη)', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    for (const route of [AGENCY_DIRECTORY_ROUTE, SHORT_STAY_LANDING_ROUTE, MY_DEMANDS_ROUTE, MY_OFFERS_ROUTE, NEW_OFFER_ROUTE]) {
      expect(dialog.querySelector(`a[href="${route}"]`)).not.toBeNull();
    }
  });

  it('Σ2: και οι ΠΡΟΤΙΜΗΣΕΙΣ (γλώσσα · θέμα) — αλλιώς η μετακόμιση θα ήταν απώλεια (CHECK 3.72)', () => {
    renderOpen();
    expect(screen.getByTestId('shell-preferences')).toBeInTheDocument();
  });

  it('Σ3: ο διάλογος έχει ΟΝΟΜΑ, και οι ομάδες πλοήγησης επίσης', () => {
    renderOpen();
    expect(screen.getByRole('dialog', { name: 'common:header.menu.label' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'common:header.menu.explore' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'common:header.menu.mine' })).toBeInTheDocument();
  });

  it('Σ4: η πλοήγηση ΚΛΕΙΝΕΙ το συρτάρι — δεν μένει ανοιχτό πάνω στη νέα σελίδα', () => {
    const onOpenChange = renderOpen();
    fireEvent.click(screen.getByText('search-results:landing.modes.pros'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Σ5: το Esc κλείνει (Radix Dialog μέσω του κοινού ui/sheet)', () => {
    const onOpenChange = renderOpen();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Σ6: κάθε γραμμή είναι στόχος αφής ≥ 44 px (min-h-11)', () => {
    renderOpen();
    const links = Array.from(screen.getByRole('dialog').querySelectorAll('a'));
    expect(links.length).toBe(5);
    for (const link of links) expect(link.className).toContain('min-h-11');
  });
});
