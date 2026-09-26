/**
 * @jest-environment jsdom
 *
 * ADR-882 §3.7 — οι αναζητήσεις ΠΕΡΙΟΧΗΣ στο «Ιστορικό αναζητήσεων», όπως τις ζει ο άνθρωπος:
 * «Θεσσαλονίκη» + Enter ή επιλογή από τη λίστα ⇒ γράφεται η ΠΕΡΙΟΧΗ· η επανεπιλογή ανοίγει το
 * ΟΡΙΟ (`area=`), ποτέ κύκλο, και χωρίς geocoder· περιοχή που καταργήθηκε ⇒ ξαναστέλνεται το
 * αρχικό αίτημα (Google NOT_FOUND). Το ευρετήριο σερβίρεται με ΚΑΘΥΣΤΕΡΗΣΗ (πύλη).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PlaceSearchBox } from '../PlaceSearchBox';
import { buildPlaceRecallOptions } from '../place-recall/place-recall-options';
import { readRecentPlaceSearches, type RecentAreaSearch } from '@/lib/geo/recent-place-searches';
import { buildAdminAreaIndex } from '@/lib/geo/admin-area-search';
import { readAdminAreaIndex } from '@/lib/geo/admin-area-index-file';
import { STORAGE_KEYS } from '@/lib/storage';

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
// Ανώνυμος επισκέπτης: το ιστορικό ζει στη συσκευή (ο λογαριασμός καλύπτεται στο μοντέλο).
jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => null,
}));

const INDEX = {
  data: [
    ['region:3', 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ', 3, null],
    ['regional_unit:4', 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', 4, 'region:3'],
    ['municipality:0701', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ', 5, 'regional_unit:4'],
    ['municipal_unit:1', 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', 6, 'municipality:0701'],
    ['settlement:9', 'Καρτερός', 8, 'municipal_unit:1'],
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

function seedHistory(...entries: RecentAreaSearch[]) {
  window.localStorage.setItem(STORAGE_KEYS.RECENT_PLACE_SEARCHES, JSON.stringify({ version: 1, entries }));
}

function areaEntry(areaId: string, label: string, savedAt = 1): RecentAreaSearch {
  return { kind: 'area', label, areaId, savedAt };
}

function pickRecentOption(label: string) {
  fireEvent.focus(field());
  const listbox = screen.getByRole('listbox');
  const option = within(listbox).getAllByRole('option').find((o) => o.textContent?.includes(label));
  if (option === undefined) throw new Error(`Καμία επιλογή «${label}»`);
  fireEvent.mouseDown(option);
}

describe('επανεπιλογή από το ιστορικό', () => {
  // ⚠️ ΠΡΩΤΟ, επίτηδες: τρέχει ΠΡΙΝ ανοίξει η πύλη του ευρετηρίου.
  it('🔑 περιοχή που ΚΑΤΑΡΓΗΘΗΚΕ ⇒ φεύγει, και το ΟΝΟΜΑ ξαναψάχνεται (ποτέ «όριο μη διαθέσιμο»)', async () => {
    seedHistory(areaEntry('municipality:9999', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'));
    render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
    pickRecentOption('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');
    expect(pushSpy).not.toHaveBeenCalled();
    releaseIndex();
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(pushSpy.mock.calls[0][0]).toContain('area=municipality%3A0701');
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(readRecentPlaceSearches()).toEqual([expect.objectContaining({ kind: 'area', areaId: 'municipality:0701' })]);
  });

  it('🔑 ανοίγει το ΟΡΙΟ (`area=`) — όχι κύκλο, όχι geocoder', async () => {
    seedHistory(areaEntry('municipality:0701', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ'));
    render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
    pickRecentOption('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(pushSpy.mock.calls[0][0]).toContain('area=municipality%3A0701');
    expect(pushSpy.mock.calls[0][0]).not.toMatch(/[?&](lat|lng|r)=/);
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it('ο κανόνας ανά λειτουργία ξαναϋπολογίζεται: οικισμός ⇒ το όριο του ΓΟΝΕΑ στους επαγγελματίες', async () => {
    seedHistory(areaEntry('settlement:9', 'Καρτερός'));
    render(<PlaceSearchBox mode="pros" occupations={[]} locale="el" />);
    pickRecentOption('Καρτερός');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(decodeURIComponent(pushSpy.mock.calls[0][0])).toContain('municipal_unit:1');
  });
});

describe('εγγραφή', () => {
  it('🔑 «Θεσσαλονίκη» + Enter ⇒ η ΠΕΡΙΟΧΗ μπαίνει στο ιστορικό (και αναβαθμίζει το παλιό σημείο)', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.RECENT_PLACE_SEARCHES,
      JSON.stringify({ version: 1, entries: [{ label: 'Θεσσαλονίκη', center: { lat: 40.6, lng: 22.9 }, savedAt: 1 }] }),
    );
    render(<PlaceSearchBox mode="buy" occupations={[]} locale="el" />);
    field().focus();
    fireEvent.change(field(), { target: { value: 'Θεσσαλονίκη' } });
    fireEvent.submit(field().form as HTMLFormElement);
    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));
    expect(readRecentPlaceSearches()).toEqual([
      expect.objectContaining({ kind: 'area', areaId: 'municipality:0701', label: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ' }),
    ]);
  });
});

describe('η λίστα', () => {
  const index = buildAdminAreaIndex(readAdminAreaIndex(INDEX));

  it('η περιοχή του ιστορικού φέρει τη γενεαλογία της και ΔΕΝ ξαναπροτείνεται από κάτω', () => {
    const options = buildPlaceRecallOptions('θεσσαλον', [areaEntry('municipality:0701', 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ')], index);
    const recent = options.filter((o) => o.kind === 'recent');
    expect(recent).toEqual([expect.objectContaining({ within: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ' })]);
    const suggested = options.flatMap((o) => (o.kind === 'area' ? [o.area.id] : []));
    expect(suggested).not.toContain('municipality:0701');
  });

  it('περιοχή που το ευρετήριο δεν έχει πια ΔΕΝ δείχνεται· χωρίς ευρετήριο δείχνεται', () => {
    const gone = [areaEntry('municipality:9999', 'ΔΗΜΟΣ ΠΟΥ ΕΦΥΓΕ')];
    expect(buildPlaceRecallOptions('', gone, index).filter((o) => o.kind === 'recent')).toEqual([]);
    expect(buildPlaceRecallOptions('', gone, null).filter((o) => o.kind === 'recent')).toHaveLength(1);
  });
});
