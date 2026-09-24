/**
 * @fileoverview ΑΓΚΥΡΑ — **«Σύνδεσμος σε αυτό το ακίνητο» στη φούσκα του χάρτη** (ADR-777 §8.78).
 * @related components/search-results/ListingMapPopupFooter.tsx · lib/share-utils.ts · lib/listings/listing-focus.ts
 *
 *   Φ1 · κλικ ⇒ ο σύνδεσμος είναι η ΤΡΕΧΟΥΣΑ διεύθυνση (τη στιγμή του κλικ) με `?selected=` ΑΥΤΗΣ της αγγελίας.
 *   Φ2 · αντιγράφηκε ⇒ η απάντηση στη ΘΕΣΗ του «Άνοιγμα» (role=status), και μετά από 2″ επιστρέφει.
 *   Φ3 · ακύρωση ⇒ καμία απάντηση · αποτυχία ⇒ «Η αντιγραφή απέτυχε».
 *   Φ4 · το κουμπί κάθεται ΠΑΝΩ από τον σύνδεσμο-επικάλυψη του τίτλου (`relative z-10`).
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockShare = jest.fn();
jest.mock('@/lib/share-utils', () => ({
  shareOrCopyLink: (data: { title: string; url: string }) => mockShare(data),
}));

import { ListingMapPopupFooter } from '../ListingMapPopupFooter';

const status = () => screen.getByRole('status');
const button = () => screen.getByRole('button', { name: 'search-focus:popup.link' });

async function click() {
  await act(async () => { fireEvent.click(button()); });
}

beforeEach(() => {
  mockShare.mockReset();
  window.history.replaceState(null, '', '/search/results?bedsmin=1');
});

describe('ListingMapPopupFooter (ADR-777 §8.78)', () => {
  it('Φ1 · ο σύνδεσμος = τρέχουσα διεύθυνση τη στιγμή του κλικ + `?selected=` της αγγελίας', async () => {
    mockShare.mockResolvedValue('copied');
    render(<ListingMapPopupFooter listingId="pl_7" title="Διαμέρισμα" />);
    window.history.replaceState(null, '', '/search/results?bedsmin=2');
    await click();

    const { title, url } = mockShare.mock.calls[0][0] as { title: string; url: string };
    expect(title).toBe('Διαμέρισμα');
    expect(new URL(url).searchParams.get('bedsmin')).toBe('2');
    expect(new URL(url).searchParams.get('selected')).toBe('pl_7');
  });

  it('Φ2 · «αντιγράφηκε» στη θέση του «Άνοιγμα», και επιστρέφει μετά από 2″', async () => {
    jest.useFakeTimers();
    mockShare.mockResolvedValue('copied');
    render(<ListingMapPopupFooter listingId="pl_7" title="Τ" />);
    expect(status()).toHaveTextContent('search-focus:popup.open');

    await click();
    expect(status()).toHaveTextContent('search-focus:popup.linkCopied');

    act(() => { jest.advanceTimersByTime(2000); });
    expect(status()).toHaveTextContent('search-focus:popup.open');
    jest.useRealTimers();
  });

  it('Φ3 · ακύρωση ⇒ καμία απάντηση · αποτυχία ⇒ λέγεται', async () => {
    mockShare.mockResolvedValueOnce('cancelled').mockResolvedValueOnce('failed');
    render(<ListingMapPopupFooter listingId="pl_7" title="Τ" />);

    await click();
    expect(status()).toHaveTextContent('search-focus:popup.open');

    await click();
    expect(status()).toHaveTextContent('search-focus:popup.linkCopyFailed');
  });

  it('Φ4 · το κουμπί είναι πάνω από την επικάλυψη του τίτλου', () => {
    render(<ListingMapPopupFooter listingId="pl_7" title="Τ" />);
    expect(button()).toHaveClass('relative', 'z-10');
    expect(button()).toHaveAttribute('type', 'button');
  });
});
