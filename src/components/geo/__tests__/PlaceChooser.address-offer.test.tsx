/**
 * @fileoverview Άγκυρα της προσφοράς «Χρησιμοποίησε τη διεύθυνση που βρέθηκε» στον επιλογέα τόπου (ADR-332 D28 Δ).
 * @related components/geo/PlaceChooser · components/geo/PlaceAddressOffer · lib/places/place-claim
 *
 * 🔴 **Το περιστατικό (2026-09-15)**: μετά τον «Εντοπισμό» ο χάρτης κεντραριζόταν αλλά **καμία** χειρονομία δεν ήταν
 * έτοιμη — το «Χρησιμοποίησε αυτόν τον τόπο» έμενε κλειστό και η κάρτα δεν αποθηκευόταν. Εδώ φρουρείται ότι:
 * η προσφορά εμφανίζεται **μόνο** με εντοπισμό **και** κείμενο · στέλνει `typed-address` (ποτέ συντεταγμένες) ·
 * σε αδρή ακρίβεια **λέει** τι να γίνει χωρίς κουμπί · και το «Όχι, είναι άλλος» ξαναστέλνει **την υποβληθείσα**.
 *
 * ⚠️ Η προσφορά φορτώνεται με `next/dynamic` — γι' αυτό οι θετικοί έλεγχοι είναι `find*` και οι αρνητικοί
 * περιμένουν πρώτα κάτι που **σίγουρα** αποδίδεται (ο χάρτης), ώστε το «δεν υπάρχει» να μη σημαίνει «δεν πρόλαβε».
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { PlaceIdentityState } from '@/hooks/geo/usePlaceIdentity';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Ο χάρτης είναι MapLibre· το jsdom δεν έχει WebGL. */
jest.mock('../PlaceMap', () => ({ PlaceMap: () => <div data-testid="map" /> }));
jest.mock('../PlaceChooserStatus', () => ({ IdentityStatus: () => null, LookupStatus: () => null }));
jest.mock('../outline-draft', () => ({
  useOutlineDraft: () => ({ outline: null, vertices: [], clear: () => undefined, addVertex: () => undefined }),
  OutlineDraftControls: () => null,
}));

const mockClaim = jest.fn();
const mockState = jest.fn<PlaceIdentityState, []>();
jest.mock('@/hooks/geo/usePlaceIdentity', () => ({
  usePlaceIdentity: () => ({
    lookup: { kind: 'idle' },
    state: mockState(),
    look: jest.fn(),
    claim: mockClaim,
    reset: jest.fn(),
  }),
}));

import { PlaceChooser } from '../PlaceChooser';

const QUERY = 'Σαμοθράκης 16, 56334, Θεσσαλονίκη';
const STREET: PlaceFocus = { point: { lat: 40.6643092, lng: 22.8976016 }, accuracy: 'interpolated' };
const USE = /placeAddressOffer\.use/;
const TITLE = /placeAddressOffer\.title/;

beforeEach(() => {
  mockClaim.mockReset();
  mockState.mockReturnValue({ kind: 'idle' });
});

describe('PlaceChooser — η διεύθυνση που βρέθηκε ως ρητό κλικ', () => {
  it('🔑 Π1 — εντοπισμός + κείμενο ⇒ ένα κλικ στέλνει `typed-address`, ΠΟΤΕ συντεταγμένες', async () => {
    render(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={`  ${QUERY} `} />);

    fireEvent.click(await screen.findByRole('button', { name: USE }));

    expect(mockClaim).toHaveBeenCalledWith({ gesture: 'typed-address', query: QUERY }, 'land', false);
  });

  it('Π2 — χωρίς εντοπισμό ⇒ καμία προσφορά: κείμενο που δεν είδε ο άνθρωπος δεν γίνεται τόπος', async () => {
    render(<PlaceChooser target="land" onChosen={jest.fn()} focus={null} addressQuery={QUERY} />);

    await screen.findByTestId('map');
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('Π3 — εντοπισμός χωρίς κείμενο ⇒ καμία προσφορά (φόρμες που δεν ρωτούν διεύθυνση μένουν ως είχαν)', async () => {
    render(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery="   " />);

    await screen.findByTestId('map');
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('🔴 Π4 — αδρή ακρίβεια για τον στόχο ⇒ ΛΕΕΙ τι να γίνει, χωρίς κουμπί', async () => {
    render(<PlaceChooser target="building" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);

    expect(await screen.findByText(/placeAddressOffer\.coarse/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: USE })).toBeNull();
  });

  it('🔴 Π5 — «Όχι, είναι άλλος» ξαναστέλνει την ΥΠΟΒΛΗΘΕΙΣΑ διεύθυνση — πριν, δεν έστελνε τίποτα', async () => {
    const { rerender } = render(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);
    fireEvent.click(await screen.findByRole('button', { name: USE }));

    mockState.mockReturnValue({ kind: 'duplicate', existing: { landId: 'land_x', buildingId: null }, displayAddress: null });
    rerender(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);
    fireEvent.click(screen.getByRole('button', { name: 'place.duplicate.distinct' }));

    expect(mockClaim).toHaveBeenLastCalledWith({ gesture: 'typed-address', query: QUERY }, 'land', true);
  });

  it('🔴 Π6 — ο διακομιστής την έκρινε αδρή ⇒ η προσφορά ΛΕΕΙ την άρνηση και δεν ξαναπροσφέρει κουμπί', async () => {
    const { rerender } = render(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);
    await screen.findByRole('button', { name: USE });

    mockState.mockReturnValue({ kind: 'rejected', reason: 'address-too-coarse' });
    rerender(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);

    expect(await screen.findByText(/placeAddressOffer\.coarse/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: USE })).toBeNull();
  });

  it('Π7 — άλλη άρνηση (π.χ. δεν βρέθηκε) ⇒ η προσφορά κρύβεται, μιλά η γραμμή κατάστασης', async () => {
    const { rerender } = render(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);
    await screen.findByText(TITLE);

    mockState.mockReturnValue({ kind: 'rejected', reason: 'address-not-found' });
    rerender(<PlaceChooser target="land" onChosen={jest.fn()} focus={STREET} addressQuery={QUERY} />);

    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
  });
});
