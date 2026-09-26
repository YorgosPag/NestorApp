/**
 * @jest-environment jsdom
 *
 * ADR-882 — «Τρέχουσα τοποθεσία» + «Ιστορικό αναζητήσεων» στο πεδίο τόπου, όπως τα βλέπει ο
 * άνθρωπος: εστίαση, κλικ, πληκτρολόγιο. Ο επιλογέας είναι ο ΠΡΑΓΜΑΤΙΚΟΣ (Radix Popover).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PlaceSearchBox } from '../PlaceSearchBox';
import { readRecentPlaceSearches, rememberPlaceSearch } from '@/lib/geo/recent-place-searches';

const pushSpy = jest.fn();
const geocodeSpy = jest.fn();
const positionSpy = jest.fn();

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddressDetailed: (...args: unknown[]) => geocodeSpy(...args),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
// Ανώνυμος επισκέπτης (ADR-882 Φάση 2): χωρίς AuthProvider το ιστορικό μένει στη συσκευή.
jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => null,
}));

const K = 'search-results:landing.search';
const ATHENS = { lat: 37.98, lng: 23.73 };

function field(): HTMLInputElement {
  return screen.getByRole('combobox', { name: `${K}.label` }) as HTMLInputElement;
}

function optionNames(): string[] {
  return within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent ?? '');
}

beforeEach(() => {
  window.localStorage.clear();
  pushSpy.mockReset();
  geocodeSpy.mockReset();
  positionSpy.mockReset();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: positionSpy },
  });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
});

function renderBox() {
  render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
}

describe('άνοιγμα', () => {
  it('η εστίαση δείχνει «Τρέχουσα τοποθεσία» — χωρίς να ζητήσει θέση', () => {
    renderBox();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.focus(field());
    expect(optionNames()).toEqual([`common-shared:placeRecall.currentLocation`]);
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(positionSpy).not.toHaveBeenCalled();
  });

  it('με ιστορικό: επικεφαλίδα, οι αναζητήσεις, και «Καθαρισμός»', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    rememberPlaceSearch('Πάτρα', ATHENS, 2);
    renderBox();
    fireEvent.focus(field());
    expect(screen.getByRole('group', { name: `common-shared:placeRecall.historyHeading` })).toBeInTheDocument();
    expect(optionNames()).toEqual([
      `common-shared:placeRecall.currentLocation`,
      'Πάτρα',
      'Αθήνα',
      `common-shared:placeRecall.clearHistory`,
    ]);
  });

  it('καθώς γράφει: μόνο όσα ταιριάζουν, χωρίς «Τρέχουσα τοποθεσία»', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    rememberPlaceSearch('Πάτρα', ATHENS, 2);
    renderBox();
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: 'αθ' } });
    expect(optionNames()).toEqual(['Αθήνα']);
  });
});

describe('ιστορικό', () => {
  it('η επιλογή πηγαίνει ΚΑΤΕΥΘΕΙΑΝ στα αποτελέσματα — χωρίς geocoder', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    renderBox();
    fireEvent.focus(field());
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Αθήνα' }));
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][0]).toContain('37.98');
    expect(field().value).toBe('Αθήνα');
  });

  it('επιτυχής αναζήτηση γράφεται· «δεν βρέθηκε» ΔΕΝ γράφεται', async () => {
    renderBox();
    geocodeSpy.mockResolvedValueOnce({ kind: 'not-found' });
    fireEvent.change(field(), { target: { value: 'Ασδφγ' } });
    fireEvent.submit(field().form as HTMLFormElement);
    await screen.findByText(`${K}.notFound`);
    expect(readRecentPlaceSearches()).toEqual([]);

    geocodeSpy.mockResolvedValueOnce({ kind: 'found', result: ATHENS });
    fireEvent.change(field(), { target: { value: 'Αθήνα' } });
    fireEvent.submit(field().form as HTMLFormElement);
    await waitFor(() => expect(pushSpy).toHaveBeenCalled());
    expect(readRecentPlaceSearches().map((p) => p.label)).toEqual(['Αθήνα']);
  });

  it('↓ ↓ Enter επιλέγει με πληκτρολόγιο και το ανακοινώνει (aria-activedescendant)', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    renderBox();
    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    const active = field().getAttribute('aria-activedescendant');
    expect(active && document.getElementById(active)).toHaveTextContent('Αθήνα');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('Shift+Delete αφαιρεί την επισημασμένη· το ✕ με το ποντίκι επίσης', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    rememberPlaceSearch('Πάτρα', ATHENS, 2);
    renderBox();
    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    fireEvent.keyDown(field(), { key: 'Delete', shiftKey: true });
    expect(readRecentPlaceSearches().map((p) => p.label)).toEqual(['Αθήνα']);

    const row = screen.getByRole('option', { name: 'Αθήνα' });
    fireEvent.mouseDown(row.querySelector('[data-recall-remove]') as Element);
    expect(readRecentPlaceSearches()).toEqual([]);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('«Καθαρισμός ιστορικού» αδειάζει και αφήνει μόνο την «Τρέχουσα τοποθεσία»', () => {
    rememberPlaceSearch('Αθήνα', ATHENS, 1);
    renderBox();
    fireEvent.focus(field());
    fireEvent.mouseDown(screen.getByRole('option', { name: `common-shared:placeRecall.clearHistory` }));
    expect(readRecentPlaceSearches()).toEqual([]);
    expect(optionNames()).toEqual([`common-shared:placeRecall.currentLocation`]);
  });

  it('Esc κλείνει τη λίστα', () => {
    renderBox();
    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('τρέχουσα τοποθεσία', () => {
  it('ζητά θέση ΜΟΝΟ στην επιλογή και πηγαίνει στα αποτελέσματα — χωρίς εγγραφή στο ιστορικό', async () => {
    positionSpy.mockImplementation((ok) =>
      ok({ coords: { latitude: 40.64, longitude: 22.94, accuracy: 800 } }),
    );
    renderBox();
    fireEvent.focus(field());
    fireEvent.mouseDown(screen.getByRole('option', { name: `common-shared:placeRecall.currentLocation` }));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(pushSpy.mock.calls[0][0]).toContain('22.94');
    expect(positionSpy.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: false });
    expect(readRecentPlaceSearches()).toEqual([]);
  });

  it('άρνηση ⇒ το δικό της μήνυμα, όχι γενικό σφάλμα', async () => {
    positionSpy.mockImplementation((_ok, fail) =>
      fail({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
    );
    renderBox();
    fireEvent.focus(field());
    fireEvent.mouseDown(screen.getByRole('option', { name: `common-shared:placeRecall.currentLocation` }));
    expect(await screen.findByText('common-shared:geolocation.denied')).toBeInTheDocument();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('μόνιμη άρνηση ⇒ η επιλογή λέει πώς ενεργοποιείται', async () => {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: jest.fn().mockResolvedValue({ state: 'denied' }) },
    });
    renderBox();
    fireEvent.focus(field());
    expect(await screen.findByText(`common-shared:placeRecall.locationBlocked`)).toBeInTheDocument();
  });
});
