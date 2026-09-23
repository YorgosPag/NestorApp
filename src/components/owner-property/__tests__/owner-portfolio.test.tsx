/**
 * @fileoverview ΑΓΚΥΡΑ — **Λίστα | Χάρτης του χαρτοφυλακίου του κατόχου** (ADR-777 §8.71).
 * @related components/owner-property/{OwnerPortfolio, OwnerPropertyMapPopup, OwnerPortfolioUnmappedRow}.tsx
 *
 * Με πραγματικούς loaders + ICU (`test-utils/real-i18n`) και το πραγματικό `url-query-state`:
 *   Υ1 · κάτω από το όριο ⇒ ΚΑΝΕΝΑ tablist, η λίστα σκέτη (όπως πριν).
 *   Υ2 · πάνω από το όριο ⇒ διακόπτης· «Χάρτης» ⇒ `?view=map` στο URL, «Λίστα» ⇒ το κλειδί σβήνει.
 *   Υ3 · `?view=map` με λίγα σημάδια ⇒ λίστα, και το URL ΔΕΝ ξαναγράφεται.
 *   Υ4 · η φούσκα: σύνδεσμος στην κάρτα του κατόχου · τιμή όπως τη βλέπει ο κόσμος · χωρίς φωτογραφία ⇒ κανένα `<img>`.
 *   Υ5 · η γραμμή «εκτός χάρτη» λέει ΓΙΑΤΙ, ανά ακίνητο.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { createRealI18n } from '@/test-utils/real-i18n';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import type { OwnerProperty } from '@/types/owner-property';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';

import { OwnerPortfolio } from '../OwnerPortfolio';
import { OwnerPropertyMapPopup } from '../OwnerPropertyMapPopup';
import { OwnerPortfolioUnmappedRow } from '../OwnerPortfolioUnmappedRow';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return { useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]) };
});

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// Η MapLibre δεν ζει στο jsdom: η φούσκα αποδίδεται διάφανη, ο χάρτης ως δηλωμένο στέλεχος.
jest.mock('@/lib/maps/maplibre', () => ({
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));
jest.mock('next/dynamic', () => () =>
  function DynamicStub(props: { mapped?: readonly unknown[] }) {
    return props.mapped === undefined ? null : <p data-testid="portfolio-map">{props.mapped.length}</p>;
  },
);

// 📊 §8.72 — τα στατιστικά δεν είναι το ερώτημα εδώ (δες owner-property-stats.test.tsx): «φορτώνει».
jest.mock('@/hooks/owner-property/useOwnerPortfolioStats', () => ({
  ...jest.requireActual('@/hooks/owner-property/useOwnerPortfolioStats'),
  useOwnerPortfolioStats: () => ({ state: 'loading' }),
}));

const AT = '2026-09-23T10:00:00.000Z';
const MARK: ListingMapMark = { shape: 'shaded-city', point: { lat: 40.63, lng: 22.95 } };

let instance: i18n;
beforeAll(async () => {
  instance = await createRealI18n(['property-market', 'search-results', 'common', 'properties-enums']);
});

beforeEach(() => {
  window.history.replaceState(null, '', '/offers');
});

function published(id: string, over: Partial<OwnerProperty> = {}): OwnerProperty {
  return validOwnerProperty({ id, title: `Ακίνητο ${id}`, publication: { outcome: 'published', at: AT, mapMark: MARK }, ...over });
}

function renderWithI18n(node: React.ReactNode) {
  return render(<I18nextProvider i18n={instance}>{node}</I18nextProvider>);
}

describe('Υ1–Υ3 — ο διακόπτης και το URL', () => {
  it('Υ1 · ένα σημάδι ⇒ κανένα tablist, η λίστα σκέτη', () => {
    renderWithI18n(<OwnerPortfolio properties={[published('ownp_1'), published('ownp_2', { publication: undefined })]} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('Υ2 · δύο σημάδια ⇒ διακόπτης· το URL ακολουθεί', async () => {
    renderWithI18n(<OwnerPortfolio properties={[published('ownp_1'), published('ownp_2')]} />);

    expect(screen.getByRole('tablist', { name: 'Προβολή ακινήτων' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Λίστα' })).toHaveAttribute('aria-selected', 'true');

    // Ο Radix Tabs ενεργοποιεί στο `mousedown`, όχι στο `click`.
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'Χάρτης' }), { button: 0 });
    });
    expect(window.location.search).toBe('?view=map');
    expect(await screen.findByTestId('portfolio-map')).toHaveTextContent('2');

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'Λίστα' }), { button: 0 });
    });
    expect(window.location.search).toBe('');
  });

  it('Υ3 · `?view=map` με ένα σημάδι ⇒ λίστα, και το URL μένει όπως ήρθε', () => {
    window.history.replaceState(null, '', '/offers?view=map');
    renderWithI18n(<OwnerPortfolio properties={[published('ownp_1')]} />);

    expect(screen.queryByTestId('portfolio-map')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(window.location.search).toBe('?view=map');
  });
});

describe('Υ4 — η φούσκα του κατόχου', () => {
  it('σύνδεσμος στην κάρτα, τιμή όπως τη βλέπει ο κόσμος, χωρίς φωτογραφία ⇒ κανένα <img>', () => {
    const property = published('ownp_popup');
    renderWithI18n(<OwnerPropertyMapPopup property={property} mark={MARK} onClose={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Ακίνητο ownp_popup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Άνοιγμα' })).toHaveAttribute('href', '/offers/ownp_popup');
    expect(screen.getByText(/210\.000/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('Υ5 — όσα λείπουν από τον χάρτη λένε γιατί', () => {
  it('αιτία ανά ακίνητο, σύνδεσμος στην κάρτα του', () => {
    const withdrawn = validOwnerProperty({ id: 'ownp_w', title: 'Αποσυρμένο', offers: [offerOf('sell', 1, 'withdrawn')] });
    renderWithI18n(<OwnerPortfolioUnmappedRow unmapped={[{ property: withdrawn, reason: 'withdrawn' }]} />);

    fireEvent.click(screen.getByRole('button', { name: '1 ακίνητο δεν φαίνεται στον δημόσιο χάρτη' }));
    expect(screen.getByRole('link', { name: 'Αποσυρμένο' })).toHaveAttribute('href', '/offers/ownp_w');
    expect(screen.getByText('εκτός αγοράς')).toBeInTheDocument();
  });
});
