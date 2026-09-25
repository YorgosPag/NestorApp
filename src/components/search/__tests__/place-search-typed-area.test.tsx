/**
 * @jest-environment jsdom
 *
 * ADR-883 §5.8 — «Θεσσαλονίκη» + Enter χωρίς επιλογή από τη λίστα, όπως το «NY» του Zillow:
 * κείμενο που ονομάζει ΚΑΘΑΡΑ περιοχή ⇒ `area=` με όριο· ομώνυμες ⇒ ρωτάμε· αλλιώς geocoder.
 * Το ευρετήριο σερβίρεται από ψεύτικο `fetch` ΜΕ ΚΑΘΥΣΤΕΡΗΣΗ — η υποβολή πρέπει να το ΠΕΡΙΜΕΝΕΙ.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PlaceSearchBox } from '../PlaceSearchBox';

const pushSpy = jest.fn();
const geocodeSpy = jest.fn();

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

/** Μικρό ευρετήριο με ό,τι χρειάζεται: ίδιος τόπος σε 3 βαθμίδες + δύο ομώνυμες κοινότητες. */
const INDEX = {
  data: [
    ['region:3', 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ', 3, null],
    ['regional_unit:4', 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', 4, 'region:3'],
    ['municipality:0701', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ', 5, 'regional_unit:4'],
    ['municipal_unit:1', 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', 6, 'municipality:0701'],
    ['community:1', 'ΤΟΠΙΚΗ ΚΟΙΝΟΤΗΤΑ ΜΥΡΤΙΑΣ', 7, 'municipal_unit:1'],
    ['community:2', 'ΤΟΠΙΚΗ ΚΟΙΝΟΤΗΤΑ ΜΥΡΤΙΑΣ', 7, 'regional_unit:4'],
  ],
};

let releaseIndex: () => void = () => undefined;

beforeAll(() => {
  const gate = new Promise<void>((resolve) => {
    releaseIndex = resolve;
  });
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    value: jest.fn(async () => {
      await gate;
      return { json: async () => INDEX };
    }),
  });
});

beforeEach(() => {
  window.localStorage.clear();
  pushSpy.mockReset();
  geocodeSpy.mockReset();
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
});

const K = 'search-results:landing.search';

function field(): HTMLInputElement {
  return screen.getByRole('combobox', { name: `${K}.label` }) as HTMLInputElement;
}

/** Όπως στην πραγματικότητα: το πεδίο ΕΧΕΙ εστίαση όταν πατιέται το Enter. */
function submit(text: string) {
  field().focus();
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.submit(field().form as HTMLFormElement);
}

describe('Enter χωρίς επιλογή', () => {
  it('🔑 «Θεσσαλονίκη» ⇒ ΠΕΡΙΜΕΝΕΙ το ευρετήριο και ανοίγει με το ΟΡΙΟ του δήμου — όχι κύκλο', async () => {
    render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
    submit('Θεσσαλονίκη');
    // Το ευρετήριο δεν έχει φτάσει ακόμη: καμία πλοήγηση, κανένας geocoder.
    expect(pushSpy).not.toHaveBeenCalled();
    releaseIndex();
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(pushSpy.mock.calls[0][0]).toContain('area=municipality%3A0701');
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('ίδια απόφαση στους επαγγελματίες — ο κατάλογος παίρνει την περιοχή (ADR-846)', async () => {
    releaseIndex();
    render(<PlaceSearchBox mode="pros" occupations={[]} locale="el" />);
    submit('Θεσσαλονίκη');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(decodeURIComponent(pushSpy.mock.calls[0][0])).toContain('municipality:0701');
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('ομώνυμες ισότιμες ⇒ ΡΩΤΑΜΕ: λίστα ανοιχτή, μήνυμα, καμία πλοήγηση', async () => {
    releaseIndex();
    render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
    submit('Κοινότητα Μυρτιάς');
    await screen.findByText('common-shared:placeRecall.chooseArea');
    await waitFor(() => expect(field()).toHaveAttribute('aria-expanded', 'true'));
    expect(field()).toHaveFocus();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('οδός με αριθμό ⇒ ο geocoder, όπως πάντα', async () => {
    releaseIndex();
    geocodeSpy.mockResolvedValueOnce({ kind: 'found', result: { lat: 40.63, lng: 22.94 } });
    render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
    submit('Τσιμισκή 45 Θεσσαλονίκη');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(geocodeSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][0]).not.toContain('area=');
  });
});
