/**
 * @jest-environment jsdom
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — ΚΑΘΕ χάρτης δείχνει την απόδοση των πηγών του, χωρίς να το θυμηθεί κανείς** (ADR-891 §8).
 * @related lib/maps/maplibre.ts · lib/maps/map-attribution-view.tsx
 *
 * Μετρημένο 2026-09-27: πέντε χάρτες (ανάμεσά τους η **δημόσια** σελίδα `/area`) έδειχναν πλακίδια OpenStreetMap
 * **χωρίς** την απόδοση που ζητά η άδεια ODbL, γιατί ο κανόνας ήταν «κάθε καταναλωτής τη γράφει μόνος του».
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | το σύνορο δεν ζωγραφίζει την απόδοση | κανένα `<small>` ⇒ 🔴 |
 * | ο καταναλωτής μπορεί να την κλείσει (`attributionControl`) | 🔴 |
 * | το σύνορο «τρώει» το `onLoad` του καταναλωτή | 🔴 |
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';

const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const fakeMap = {
  getStyle: () => ({ sources: { 'osm-raster': {} } }),
  getSource: () => ({ attribution: OSM }),
};

/** Ό,τι έλαβε η βιβλιοθήκη — για να ελεγχθεί ότι το σύνορο επιβάλλει τις δικές του επιλογές. */
const received: Array<Record<string, unknown>> = [];

jest.mock('maplibre-gl', () => ({
  LngLatBounds: class {},
  Marker: class {},
  setNow: jest.fn(),
  restoreNow: jest.fn(),
  addProtocol: jest.fn(),
}));

jest.mock('react-map-gl/maplibre', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    Map: ReactActual.forwardRef(function FakeMap(props: Record<string, unknown> & { children?: React.ReactNode }, _ref) {
      received.push(props);
      return ReactActual.createElement('section', { 'data-testid': 'map' }, props.children);
    }),
  };
});

import { Map } from '../maplibre';

beforeEach(() => {
  received.length = 0;
});

function fireLoad(): void {
  const props = received[received.length - 1];
  act(() => (props.onLoad as (e: { target: typeof fakeMap }) => void)({ target: fakeMap }));
}

describe('σύνορο χάρτη — απόδοση', () => {
  it('μετά το load, ο χάρτης δείχνει την απόδοση της πηγής, με τη λέξη «OpenStreetMap» σύνδεσμο', () => {
    render(<Map />);
    fireLoad();
    expect(screen.getByTestId('map').querySelector('small')).toHaveTextContent('© OpenStreetMap contributors');
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  });

  it('ο καταναλωτής ΔΕΝ μπορεί να την κλείσει: η βιβλιοθήκη παίρνει πάντα attributionControl=false και ζωγραφίζουμε εμείς', () => {
    render(<Map attributionControl={{ compact: true }} />);
    fireLoad();
    expect(received[received.length - 1].attributionControl).toBe(false);
    expect(screen.getByTestId('map').querySelector('small')).not.toBeNull();
  });

  it('το onLoad του καταναλωτή καλείται κανονικά', () => {
    const onLoad = jest.fn();
    render(<Map onLoad={onLoad} />);
    fireLoad();
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('πριν φορτώσει το στυλ, τίποτα — ποτέ κενό κουτί', () => {
    render(<Map />);
    expect(screen.getByTestId('map').querySelector('small')).toBeNull();
  });

  it('ο φύλακας του μητρώου μένει φορεμένος (transformRequest)', () => {
    render(<Map />);
    expect(typeof received[received.length - 1].transformRequest).toBe('function');
  });
});
