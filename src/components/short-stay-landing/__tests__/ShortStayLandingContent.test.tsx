/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ακτίνα `/stay` — έντιμη όταν η προσφορά είναι λίγη** (ADR-777 §8.82).
 * @related ShortStayLandingContent · landing-tabpanel.test (ο κόμβος) · LandingHero.test
 *
 * ## Τι φυλάει
 * ✅ **Σ1** — ο ήρωας είναι **άμεσο** τέκνο του μέτρου, και ο μόνος `h1` είναι ο δικός του.
 * ✅ **Σ2** — λίγη προσφορά χωρίς θέση (η σημερινή, 24/09: **1** αγγελία) ⇒ **κανένα** πεδίο
 *    «πού;», αλλά η αγγελία **φαίνεται** και οι αριθμοί **λέγονται**.
 * ✅ **Σ3** — παρονομαστής του Σ2: όταν η κάλυψη **του υποσυνόλου** σηκώνει «πού;», το πεδίο
 *    επιστρέφει μόνο του. Χωρίς αυτό, ένα «ποτέ πεδίο» θα περνούσε το Σ2.
 * ✅ **Σ4** — η κάλυψη κρίνεται πάνω στις **βραχυχρόνιες**: πωλήσεις στον χάρτη ΔΕΝ κάνουν το
 *    «πού θες να μείνεις;» απαντήσιμο.
 * ✅ **Σ5** — η πόρτα «Δες όλα» οδηγεί στην οθόνη 2 **με** `leaseShort` γραμμένο.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { PublicListing } from '@/types/public-listing';
import { landingListing } from '@/components/search/__tests__/landing-listing-fixture';
import { ShortStayLandingContent } from '../ShortStayLandingContent';

const mockSource: { listings: readonly PublicListing[] } = { listings: [] };

jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  // `requireActual`: η λογιστική κάλυψης ζει στο ίδιο module — ψεύτικη εδώ θα δοκίμαζε
  // **δική μας** αριθμητική, όχι αυτή που κρίνει αν η σελίδα ρωτά «πού;».
  ...jest.requireActual('@/services/realtime/hooks/usePublicListings'),
  usePublicListings: () => ({ listings: mockSource.listings, loading: false, error: null }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ i18n: { language: 'el' }, t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  usePathname: () => '/stay',
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/lib/geocoding/geocoding-service', () => ({ geocodeAddressDetailed: jest.fn() }));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

function renderStay(listings: readonly PublicListing[]): HTMLElement {
  mockSource.listings = listings;
  render(<ShortStayLandingContent />);
  return document.querySelector('[data-shell-span="full"]') as HTMLElement;
}

describe('ADR-777 §8.82 — η ακτίνα της βραχυχρόνιας μίσθωσης', () => {
  it('Σ1 — ο ήρωας είναι ΑΜΕΣΟ τέκνο του μέτρου, με τον μόνο h1 της σελίδας', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: τύλιξε τον ήρωα σε δοχείο ⇒ το breakout σβήνει σιωπηλά.
    const hero = renderStay([landingListing('s1', ['leaseShort'], false)]);

    expect(hero.parentElement).toHaveAttribute('data-shell-measure', 'wide');
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('stay-landing:title');
    expect(hero.contains(headings[0])).toBe(true);
  });

  it('🔴 Σ2 — ΜΙΑ αγγελία χωρίς θέση: κανένα «πού;», αλλά η αγγελία ΦΑΙΝΕΤΑΙ και οι αριθμοί ΛΕΓΟΝΤΑΙ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `canAskWhere` ⇒ πεδίο που δίνει μηδέν σε κάθε είσοδο.
    const hero = renderStay([landingListing('s1', ['leaseShort'], false)]);

    expect(within(hero).queryByRole('combobox', { name: 'search-results:landing.search.label' })).toBeNull();
    expect(screen.getByText('Τ-s1')).toBeInTheDocument();
    expect(screen.getByText('search-results:landing.coverage.heading')).toBeInTheDocument();
  });

  it('Σ3 — ο παρονομαστής: με βραχυχρόνιες ΣΤΟΝ ΧΑΡΤΗ, το πεδίο επιστρέφει μόνο του', () => {
    const hero = renderStay([
      landingListing('s1', ['leaseShort'], true),
      landingListing('s2', ['leaseShort'], false),
    ]);

    expect(within(hero).getByRole('combobox', { name: 'search-results:landing.search.label' })).toBeInTheDocument();
  });

  it('🔴 Σ4 — η κάλυψη κρίνεται στο ΥΠΟΣΥΝΟΛΟ: πωλήσεις στον χάρτη δεν δίνουν «πού;» στη διαμονή', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: `computeListingCoverage(listings)` αντί για `(stays)` ⇒ κοκκινίζει.
    const hero = renderStay([
      landingListing('p1', ['sell'], true),
      landingListing('p2', ['sell'], true),
      landingListing('s1', ['leaseShort'], false),
    ]);

    expect(within(hero).queryByRole('combobox', { name: 'search-results:landing.search.label' })).toBeNull();
    // …και η βιτρίνα δείχνει ΜΟΝΟ τη διαμονή — όχι τις πωλήσεις.
    expect(screen.getByText('Τ-s1')).toBeInTheDocument();
    expect(screen.queryByText('Τ-p1')).toBeNull();
  });

  it('Σ5 — «Δες όλα» ⇒ οθόνη 2 με `leaseShort` ΗΔΗ γραμμένο', () => {
    renderStay([landingListing('s1', ['leaseShort'], false)]);

    const link = screen.getByText('stay-landing:browseAll').closest('a') as HTMLAnchorElement;
    const href = decodeURIComponent(link.getAttribute('href') ?? '');
    expect(href.startsWith('/search/results?')).toBe(true);
    expect(href).toContain('leaseShort');
  });
});
