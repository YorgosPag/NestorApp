/**
 * @fileoverview Άγκυρα του «Εντοπισμού στον χάρτη» της κάρτας βιτρίνας (ADR-332 D28 · ADR-841 Α21.19).
 * @related components/mandate/ShowcaseLocationEditor · components/geo/ResolvedPlaceConfirmation
 *
 * 🔴 **Το περιστατικό**: ο άνθρωπος πατούσε «Εντοπισμός» και η οθόνη **δεν έλεγε τίποτα** για το τι
 * κατάλαβε ο πάροχος — ο `usePlaceResolver` το έφερνε και η βιτρίνα το πετούσε. Αυτή η σουίτα φυλάει
 * ότι η απάντηση **λέγεται**, και ότι το «δεν βρέθηκε» **φαίνεται**.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { GeocodingOutcome } from '@/lib/geocoding/geocoding-types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key),
  }),
}));

/**
 * Ο επιλογέας τόπου σέρνει MapLibre — κρίνεται από τη δική του άγκυρα (`PlaceChooser.address-offer`). Εδώ
 * φαίνεται μόνο **τι του δίνεται**: το κείμενο που θα γίνει ρητό κλικ «Χρησιμοποίησε τη διεύθυνση» (D28 Δ).
 */
jest.mock('@/components/geo/PlaceIdentityField', () => ({
  PlaceIdentityField: ({ addressQuery }: { addressQuery?: string | null }) => (
    <div data-testid="place-identity" data-address-query={addressQuery ?? ''} />
  ),
}));

/** Τα κανάλια και το ωράριο δεν αφορούν τον εντοπισμό. */
jest.mock('../ShowcaseChannelFields', () => ({
  ShowcaseEmailFields: () => null,
  ShowcasePhoneFields: () => null,
}));
jest.mock('../WeeklyHoursField', () => ({ WeeklyHoursField: () => null }));

const geocodeAddressDetailed = jest.fn<Promise<GeocodingOutcome>, [unknown]>();
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddressDetailed: (query: unknown) => geocodeAddressDetailed(query),
}));

import { ShowcaseLocationEditor, showcasePlaceHeadingId } from '../ShowcaseLocationEditor';
import { emptyLocationDraft } from '@/lib/agency/showcase-card-draft';

const HINT = 'Σαμοθράκης 16, 56334, Θεσσαλονίκη';

/** Η απάντηση της μηχανής για το περιστατικό — βρέθηκε από τη βαθμίδα 9. */
const FOUND: GeocodingOutcome = {
  kind: 'found',
  result: {
    lat: 40.6643092,
    lng: 22.8976016,
    accuracy: 'interpolated',
    confidence: 0.8,
    displayName: 'Σαμοθράκης, Ελευθέριο-Κορδελιό',
    resolvedFields: {
      street: 'Σαμοθράκης',
      neighborhood: 'Ελευθέριο-Κορδελιό',
      city: 'Δημοτική Ενότητα Ελευθερίου - Κορδελιού',
      postalCode: '56334',
      county: 'Μητροπολιτική Ενότητα Θεσσαλονίκης',
      country: 'Ελλάδα',
    },
    partialMatch: true,
    alternatives: [],
    reasoning: {
      fieldMatches: { street: 'match', number: 'unknown', postalCode: 'match', city: 'broader' },
      attemptsLog: [],
      confidenceBreakdown: { base: 0.5, streetMatch: 0.2, cityMatch: 0, postalMatch: 0.1, countyMatch: 0, municipalityMatch: 0 },
      relaxation: { dropped: ['city'], anchor: 'postalCode' },
    },
    source: { provider: 'nominatim', variantUsed: 9 },
  },
};

function renderEditor(): void {
  render(
    <ShowcaseLocationEditor
      draft={{ ...emptyLocationDraft('headquarters'), placeHint: HINT }}
      saved={null}
      onChange={jest.fn()}
      onRemove={jest.fn()}
    />,
  );
}

function pressLocate(): void {
  fireEvent.click(screen.getByRole('button', { name: /cardImport\.locate/ }));
}

describe('ShowcaseLocationEditor — «Εντοπισμός στον χάρτη»', () => {
  beforeEach(() => geocodeAddressDetailed.mockReset());

  it('🔑 βρέθηκε ⇒ η οθόνη ΛΕΕΙ τι κατάλαβε ο πάροχος και με ποια χαλάρωση', async () => {
    geocodeAddressDetailed.mockResolvedValue(FOUND);
    renderEditor();

    pressLocate();

    expect(await screen.findByText('Σαμοθράκης, Ελευθέριο-Κορδελιό, 563 34')).toBeInTheDocument();
    expect(screen.getByText(/placeRelaxed\.broader/)).toHaveTextContent('56334');
    expect(screen.getByText(/placeRelaxed\.broader/)).toHaveTextContent('Θεσσαλονίκη');
  });

  it('το κείμενο φεύγει ΔΟΜΗΜΕΝΟ προς τη μηχανή — ο Τ.Κ. και η πόλη στα πεδία τους', async () => {
    geocodeAddressDetailed.mockResolvedValue(FOUND);
    renderEditor();

    pressLocate();
    await screen.findByText('Σαμοθράκης, Ελευθέριο-Κορδελιό, 563 34');

    expect(geocodeAddressDetailed).toHaveBeenCalledWith(
      expect.objectContaining({ street: 'Σαμοθράκης', number: '16', postalCode: '56334', city: 'Θεσσαλονίκη' }),
    );
  });

  it('δεν βρέθηκε ⇒ το μήνυμα ΦΑΙΝΕΤΑΙ, και κανένα πλαίσιο επιβεβαίωσης', async () => {
    geocodeAddressDetailed.mockResolvedValue({ kind: 'not-found' });
    renderEditor();

    pressLocate();

    expect(await screen.findByText(/cardImport\.locateNotFound/)).toBeInTheDocument();
    expect(screen.queryByText(/placeAccuracyNote/)).toBeNull();
    expect(screen.getByTestId('place-identity')).toHaveAttribute('data-address-query', '');
  });

  it('🔑 D28 Δ — το κείμενο φτάνει στον επιλογέα ΜΟΝΟ μετά από εντοπισμό που είδε ο άνθρωπος', async () => {
    geocodeAddressDetailed.mockResolvedValue(FOUND);
    renderEditor();

    expect(screen.getByTestId('place-identity')).toHaveAttribute('data-address-query', '');
    pressLocate();
    await screen.findByText('Σαμοθράκης, Ελευθέριο-Κορδελιό, 563 34');

    expect(screen.getByTestId('place-identity')).toHaveAttribute('data-address-query', HINT);
  });
});

describe('ShowcaseLocationEditor — «Αποθήκευση» χωρίς τόπο (GOV.UK: μήνυμα ΔΙΠΛΑ στο πεδίο)', () => {
  it('🔴 το μήνυμα λέγεται στο κατάστημα, και ο τίτλος «Περιοχή» είναι στόχος focus που το περιγράφει', () => {
    const draft = emptyLocationDraft('headquarters');
    render(<ShowcaseLocationEditor draft={draft} saved={null} placeMissing onChange={jest.fn()} onRemove={jest.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('cardPlaceMissingHere');
    const heading = document.getElementById(showcasePlaceHeadingId(draft.key));
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading).toHaveAttribute('aria-describedby', alert.id);
  });

  it('χωρίς απόπειρα αποθήκευσης ⇒ καμία πρόωρη επικύρωση', () => {
    render(<ShowcaseLocationEditor draft={emptyLocationDraft('branch')} saved={null} onChange={jest.fn()} onRemove={jest.fn()} />);

    expect(screen.queryByText(/cardPlaceMissingHere/)).toBeNull();
  });
});
