/**
 * @fileoverview ΑΓΚΥΡΑ — **πινακίδες τιμής στον χάρτη του κατόχου** (ADR-777 §8.77 · §8.71.5 #2).
 * @related components/owner-property/OwnerPortfolioMap.tsx · lib/listings/listing-price-markers.ts
 *
 *   Π1 · ακριβές σημάδι + τιμή ⇒ ΜΙΑ πινακίδα, στη συντεταγμένη του ΣΗΜΑΔΙΟΥ, με την τιμή του
 *        `ownerPublicPrice` (όπως τη βλέπει ο κόσμος) και τον τίτλο στο προσβάσιμο όνομα.
 *   Π2 · σημάδι «πόλη» ⇒ καμία πινακίδα (ο ΙΔΙΟΣ κανόνας «ξέρουμε ΠΟΥ» με τη δημόσια αναζήτηση).
 *   Π3 · κλικ στην πινακίδα ⇒ η ΚΟΙΝΗ εστίαση επιλέγει το ακίνητο.
 *
 * ⚠️ Το `t` επιστρέφει το ΚΛΕΙΔΙ + παραμέτρους — ίδιο ιδίωμα με το `listing-price-markers.test.tsx`.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { NO_LISTING_FOCUS } from '@/lib/listings/listing-focus';
import type { ListingMapMark } from '@/lib/listings/listing-map-mark';
import { partitionOwnerPortfolio } from '@/lib/owner-property/owner-portfolio-map';
import { ownerPublicPrice } from '@/lib/owner-property/owner-property-projection';
import type { ListingFocusController } from '@/hooks/listings/useListingFocus';
import type { OwnerProperty } from '@/types/owner-property';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

// Ο πυρήνας MapLibre δεν ζει στο jsdom: ο καμβάς αποδίδει μόνο τα παιδιά του (εκεί ζουν οι πινακίδες).
jest.mock('@/components/search-results/ListingMapCanvas', () => ({
  ListingMapCanvas: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/maps/maplibre', () => ({
  Marker: ({ children, longitude, latitude, onClick }: {
    children: React.ReactNode;
    longitude: number;
    latitude: number;
    onClick?: (event: { originalEvent: { stopPropagation: () => void } }) => void;
  }) => (
    <div data-testid="marker" data-lng={longitude} data-lat={latitude} onClick={() => onClick?.({ originalEvent: { stopPropagation: () => undefined } })}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

import OwnerPortfolioMap from '../OwnerPortfolioMap';

const AT = '2026-09-24T10:00:00.000Z';
const PIN: ListingMapMark = { shape: 'pin', point: { lat: 40.6401, lng: 22.9444 } };
const CITY: ListingMapMark = { shape: 'shaded-city', point: { lat: 40.63, lng: 22.95 } };

function published(id: string, mark: ListingMapMark): OwnerProperty {
  return validOwnerProperty({
    id,
    title: `Ακίνητο ${id}`,
    offers: [offerOf('sell', 210_000)],
    publication: { outcome: 'published', at: AT, mapMark: mark },
  });
}

function controller(): ListingFocusController & { select: jest.Mock } {
  return { focus: NO_LISTING_FOCUS, peek: jest.fn(), select: jest.fn(), clear: jest.fn() } as ListingFocusController & { select: jest.Mock };
}

function renderMap(properties: readonly OwnerProperty[], focusController = controller()) {
  const { mapped, unmapped } = partitionOwnerPortfolio(properties, AT);
  render(<OwnerPortfolioMap mapped={mapped} unmapped={unmapped} focusController={focusController} />);
  return focusController;
}

describe('Π — πινακίδες τιμής κατόχου (ADR-777 §8.77)', () => {
  it('Π1 · ακριβές σημάδι ⇒ μία πινακίδα στο σημάδι, με την τιμή που βλέπει ο κόσμος', () => {
    const property = published('ownp_pin', PIN);
    renderMap([property, published('ownp_city', CITY)]);

    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('data-lng', String(PIN.point.lng));
    expect(markers[0]).toHaveAttribute('data-lat', String(PIN.point.lat));

    const price = ownerPublicPrice(property, AT);
    if (price.kind !== 'priced') throw new Error('η δοκιμή θέλει τιμή');
    const plaque = screen.getByRole('button', { name: /Ακίνητο ownp_pin/ });
    // Ο παρονομαστής: η τιμή του κόσμου ΕΙΝΑΙ τα 210.000 της προσφοράς· η πινακίδα τη λέει μορφοποιημένη.
    expect(price.headline.amount).toBe(210_000);
    // `\s`: η μορφοποίηση βάζει ΑΣΠΑΣΤΟ κενό (U+00A0) πριν από το σύμβολο.
    expect(plaque.getAttribute('aria-label')).toMatch(/210\.000\s€/);
  });

  it('Π2 · μόνο σημάδι «πόλη» ⇒ καμία πινακίδα', () => {
    renderMap([published('ownp_city', CITY), published('ownp_city2', CITY)]);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });

  it('Π3 · κλικ στην πινακίδα ⇒ η κοινή εστίαση επιλέγει το ακίνητο', () => {
    const focusController = renderMap([published('ownp_pin', PIN), published('ownp_city', CITY)]);
    fireEvent.click(screen.getByTestId('marker'));
    expect(focusController.select).toHaveBeenCalledWith('ownp_pin');
  });
});
