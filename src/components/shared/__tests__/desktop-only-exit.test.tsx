/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΩΝ ΣΤΑΔΙΩΝ Α.3 + Β** — η έξοδος του κινητού, και η πράξη.
 * @related ADR-660 §5.11 · components/shared/DesktopOnlyGate.tsx · PublicSiteHeader.tsx
 *
 * **Τ** — η έξοδος της πύλης Α8 **ξέρει αν υπάρχει χώρος να γυρίσει**.
 * **Υ** — το CTA της δημόσιας κεφαλίδας.
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΛΕΙΔΩΝΕΙ ΤΟ `Τ`**: όσο η φόρμα ζούσε πίσω από τον
 * `ProtectedRoute`, η πάντα-ιδιωτική έξοδος ήταν σωστή **κατά τύχη** — ανώνυμος δεν
 * έφτανε ποτέ εκεί. Μόλις το §5.10 άνοιξε την πόρτα, η **ίδια** γραμμή έγινε
 * αδιέξοδο: «δεν γίνεται εδώ» με μοναδική έξοδο μια διαδρομή που **απαιτεί σύνδεση**.
 *
 * ⚠️ **Κρίνονται ΚΑΙ ο σύνδεσμος ΚΑΙ η ετικέτα.** Σωστός προορισμός με λάθος ετικέτα
 * («Τα ακίνητά μου» προς δημόσια αναζήτηση) είναι το ίδιο αδιέξοδο, πιο ευγενικό.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/hooks/media/useViewportClass', () => ({
  useViewportClass: () => 'narrow',
}));

import { DesktopOnlyNotice } from '../DesktopOnlyGate';
import { PublicSiteHeader } from '@/components/public-site/PublicSiteHeader';
import { MY_OFFERS_ROUTE, NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { SEARCH_LANDING_ROUTE } from '@/lib/listings/listing-routes';

function exitLink(): HTMLAnchorElement {
  const link = screen.getByRole('link');
  return link as HTMLAnchorElement;
}

describe('Τ — η έξοδος της πύλης Α8', () => {
  it('Τ1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: με ταυτότητα, βγαίνει στον ΔΙΚΟ ΤΟΥ χώρο', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1' } });
    render(<DesktopOnlyNotice keyBase="offer" privateHref={MY_OFFERS_ROUTE} />);

    expect(exitLink()).toHaveAttribute('href', MY_OFFERS_ROUTE);
    expect(screen.getByText('property-market:offer.desktopOnly.back')).toBeInTheDocument();
  });

  it('Τ2 — 🔴 ΧΩΡΙΣ ταυτότητα, ΔΕΝ βγαίνει σε διαδρομή που απαιτεί σύνδεση', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<DesktopOnlyNotice keyBase="offer" privateHref={MY_OFFERS_ROUTE} />);

    // Το `/offers` ζει στο `(me)` → ProtectedRoute: θα ήταν τοίχος σύνδεσης.
    expect(exitLink()).not.toHaveAttribute('href', MY_OFFERS_ROUTE);
    expect(exitLink()).toHaveAttribute('href', SEARCH_LANDING_ROUTE);
  });

  it('Τ3 — ΚΑΙ η ετικέτα αλλάζει: «τα ακίνητά μου» δεν λέγεται σε ανώνυμο', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<DesktopOnlyNotice keyBase="offer" privateHref={MY_OFFERS_ROUTE} />);

    expect(screen.getByText('property-market:offer.desktopOnly.backAnonymous')).toBeInTheDocument();
    expect(screen.queryByText('property-market:offer.desktopOnly.back')).not.toBeInTheDocument();
  });

  it('Τ4 — ΚΑΙ η εξήγηση: «όσα έχεις ήδη καταχωρήσει» δεν ισχύει για ανώνυμο', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<DesktopOnlyNotice keyBase="offer" privateHref={MY_OFFERS_ROUTE} />);

    expect(screen.getByText('property-market:offer.desktopOnly.whatAnonymous')).toBeInTheDocument();
    expect(screen.queryByText('property-market:offer.desktopOnly.what')).not.toBeInTheDocument();
  });

  it('Τ5 — 🔑 ΔΟΜΙΚΟ: η ΖΗΤΗΣΗ παίρνει την ίδια προστασία ΧΩΡΙΣ να τη ζητήσει', () => {
    // Η γνώση ζει στο component, όχι στους καλούντες — άρα την ημέρα που θα ανοίξει
    // και το `/demands/new` (§5.10, δηλωμένη ασυμμετρία) θα είναι ήδη σωστό.
    mockUseAuth.mockReturnValue({ user: null });
    render(<DesktopOnlyNotice keyBase="demand" privateHref="/demands" />);

    expect(exitLink()).toHaveAttribute('href', SEARCH_LANDING_ROUTE);
    expect(screen.getByText('property-market:demand.desktopOnly.backAnonymous')).toBeInTheDocument();
  });

  it('Τ6 — κενό uid μετράει ως απουσία (ο ίδιος κριτής με τη φόρμα)', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '' } });
    render(<DesktopOnlyNotice keyBase="offer" privateHref={MY_OFFERS_ROUTE} />);

    expect(exitLink()).toHaveAttribute('href', SEARCH_LANDING_ROUTE);
  });
});

describe('Υ — το CTA της δημόσιας κεφαλίδας', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: null }));

  it('Υ1 — υπάρχει, και δείχνει στη ΦΟΡΜΑ (πράξη, όχι πλοήγηση)', () => {
    render(<PublicSiteHeader />);

    const cta = screen.getByText('property-market:offer.door.cta').closest('a');
    expect(cta).toHaveAttribute('href', NEW_OFFER_ROUTE);
  });

  it('Υ2 — 🔴 ΞΕΧΩΡΙΖΕΙ ΟΠΤΙΚΑ από τους συνδέσμους πλοήγησης', () => {
    render(<PublicSiteHeader />);

    const cta = screen.getByText('property-market:offer.door.cta').closest('a');
    const navLink = screen.getByText('property-market:offer.door.label').closest('a');

    // Η idealista το κάνει **κουμπί**, ξεχωριστό από τη πλοήγηση. Ένα τέταρτο
    // πανομοιότυπο ορθογώνιο δεν είναι CTA — είναι τέταρτος σύνδεσμος.
    expect(cta?.className).not.toBe(navLink?.className);
    expect(cta?.className).toContain('bg-foreground');
    expect(cta?.className).toContain('text-background');
  });

  it('Υ3 — οι δύο πόρτες πλοήγησης ΜΕΝΟΥΝ στους καταλόγους', () => {
    render(<PublicSiteHeader />);

    expect(screen.getByText('property-market:offer.door.label').closest('a')).toHaveAttribute(
      'href',
      MY_OFFERS_ROUTE,
    );
    expect(screen.getByText('property-market:demand.door.label').closest('a')).toHaveAttribute(
      'href',
      '/demands',
    );
  });
});
