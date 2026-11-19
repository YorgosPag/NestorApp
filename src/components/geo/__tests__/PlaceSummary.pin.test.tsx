/**
 * @fileoverview Άγκυρα «τόπος χωρίς σχήμα ⇒ ο χάρτης ΣΗΜΑΔΕΥΕΙ το σημείο» (ADR-777).
 * @related components/geo/PlaceSummary · hooks/geo/usePlaceOutline
 *
 * 🔴 Μετρημένο ζωντανά 2026-11-19 (`pbld_18161f29…`): η κάρτα «Επιλεγμένος τόπος» κεντράριζε
 * τον χάρτη σε σημείο **χωρίς** να το σημαδεύει — «γιατί δεν φαίνεται η πινέζα;».
 *
 * 🔑 Φυλά **ποια** κατάσταση του περιγράμματος δίνει πινέζα: μόνο όσες **κατέληξαν** χωρίς
 * σχήμα (`none` · `unavailable` · `failed`). Σε `idle`/`loading` όχι — αλλιώς η πινέζα
 * αναβοσβήνει πριν έρθει το περίγραμμα· σε `outline` όχι — το σχήμα **είναι** η σήμανση.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import type { PlaceOutlineState } from '@/hooks/geo/usePlaceOutline';
import type { PublicPlaceLookup } from '@/services/realtime/hooks/usePublicPlace';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));

jest.mock('next/dynamic', () => () => function DynamicStub(): null {
  return null;
});

let mockOutlineState: PlaceOutlineState = { kind: 'idle' };
jest.mock('@/hooks/geo/usePlaceOutline', () => ({
  usePlaceOutline: () => mockOutlineState,
}));

const CENTER: GeoPoint = { lat: 40.5701, lng: 22.9851 };
const mockLookup: PublicPlaceLookup = {
  state: 'found',
  land: {
    id: 'land_test',
    position: { kind: 'known', provenance: 'manual', point: CENTER, locatedAt: '2026-11-19T00:00:00.000Z' },
    displayAddress: null,
    areaSqm: null,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  },
  building: null,
};
jest.mock('@/services/realtime/hooks/usePublicPlace', () => ({
  ...jest.requireActual('@/services/realtime/hooks/usePublicPlace'),
  usePublicPlace: () => mockLookup,
}));

interface MapProbeProps {
  readonly center: GeoPoint;
  readonly outline: GeoOutline | null;
  readonly pin?: GeoPoint | null;
}
jest.mock('../PlaceMap', () => ({
  PlaceMap: ({ center, outline, pin }: MapProbeProps) => (
    <figure
      data-testid="place-map"
      data-center={`${center.lat},${center.lng}`}
      data-outline={outline === null ? 'none' : 'shape'}
      data-pin={pin ? `${pin.lat},${pin.lng}` : 'none'}
    />
  ),
}));

import { PlaceSummary } from '../PlaceSummary';

const SHAPE: GeoOutline = [CENTER, { lat: 40.5702, lng: 22.9851 }, { lat: 40.5702, lng: 22.9852 }];
const PLACE = { landId: 'land_test', buildingId: 'pbld_test' };
const AT_CENTER = `${CENTER.lat},${CENTER.lng}`;

function mapAttr(name: 'pin' | 'outline'): string | null {
  return screen.getByTestId('place-map').getAttribute(`data-${name}`);
}

function renderWith(state: PlaceOutlineState): void {
  mockOutlineState = state;
  render(<PlaceSummary place={PLACE} withOutline />);
}

describe('PlaceSummary — πινέζα όταν ο τόπος δεν έχει σχήμα', () => {
  it.each<PlaceOutlineState>([{ kind: 'none' }, { kind: 'unavailable' }, { kind: 'failed' }])(
    '🔴 κατέληξε χωρίς σχήμα (%o) ⇒ πινέζα ΣΤΟ κέντρο',
    (state) => {
      renderWith(state);
      expect(mapAttr('pin')).toBe(AT_CENTER);
      expect(mapAttr('outline')).toBe('none');
    },
  );

  it.each<PlaceOutlineState>([{ kind: 'idle' }, { kind: 'loading' }])(
    'δεν έχει κριθεί ακόμη (%o) ⇒ ΚΑΜΙΑ πινέζα (δεν αναβοσβήνει)',
    (state) => {
      renderWith(state);
      expect(mapAttr('pin')).toBe('none');
    },
  );

  it('ήρθε σχήμα ⇒ ζωγραφίζεται το σχήμα, ΚΑΜΙΑ πινέζα', () => {
    renderWith({ kind: 'outline', outline: SHAPE });
    expect(mapAttr('outline')).toBe('shape');
    expect(mapAttr('pin')).toBe('none');
  });
});
