/**
 * @fileoverview **ΤΙ ΑΚΡΙΒΩΣ ΦΕΥΓΕΙ ΠΡΟΣ ΤΟΝ ΧΑΡΤΗ, ΚΑΙ ΠΟΤΕ ΣΒΗΝΕΙ** — ADR-332 **D26**.
 * @related editor/hooks/useSuggestionMapReport
 *
 * 🔑 Κάθε ομάδα εδώ φυλάει μία εγγύηση που, αν σπάσει, **η οθόνη δεν σπάει**: απλώς
 * δείχνει πινέζες που δεν έπρεπε, ή διαλέγει άλλη διεύθυνση από αυτή που πατήθηκε.
 * Είναι ακριβώς η οικογένεια σφαλμάτων που περνά αναλλοίωτη από κάθε στιγμιότυπο.
 */

import { renderHook, act } from '@testing-library/react';
import { useSuggestionMapReport } from '../hooks/useSuggestionMapReport';
import type { SuggestionPresentation } from '../helpers/computeSuggestionTriggers';
import type {
  GeocodingApiResponse,
  SuggestionMapReport,
  SuggestionRanking,
} from '../types';

function candidate(name: string): GeocodingApiResponse {
  return {
    lat: 37.98,
    lng: 23.72,
    displayName: name,
    confidence: 0.65,
    resolvedFields: {},
    partialMatch: false,
    alternatives: [],
  } as unknown as GeocodingApiResponse;
}

function ranking(originalRank: number, name: string): SuggestionRanking {
  return {
    candidate: candidate(name),
    originalRank,
    distanceFromCenterM: null,
    rankScore: 0.65,
  };
}

/** Ο πάροχος έδωσε 0,1,2 · η εγγύτητα τους δείχνει σε **άλλη** σειρά. */
const CANDIDATES: readonly SuggestionRanking[] = [
  ranking(2, 'Κορυδαλλός'),
  ranking(0, 'Περιστέρι'),
  ranking(1, 'Βριλήσσια'),
];

interface HookArgs {
  presentation: SuggestionPresentation;
  onReport?: (report: SuggestionMapReport) => void;
  onSelect?: (c: GeocodingApiResponse) => void;
  anchor?: { lat: number; lng: number };
  candidates?: readonly SuggestionRanking[];
}

function renderReport(initial: HookArgs) {
  return renderHook(
    (args: HookArgs) =>
      useSuggestionMapReport({
        candidates: args.candidates ?? CANDIDATES,
        presentation: args.presentation,
        proximityAnchor: args.anchor,
        onReport: args.onReport,
        onSelect: args.onSelect ?? (() => {}),
      }),
    { initialProps: initial },
  );
}

describe('useSuggestionMapReport — αναφέρεται ό,τι ΖΩΓΡΑΦΙΖΕΤΑΙ, όχι ό,τι βρέθηκε', () => {
  it('`chooser` ⇒ φεύγουν οι γραμμές του καταλόγου', () => {
    const onReport = jest.fn();
    renderReport({ presentation: 'chooser', onReport });

    expect(onReport).toHaveBeenCalled();
    expect(onReport.mock.calls.at(-1)?.[0].candidates).toEqual(CANDIDATES);
  });

  it('🔴 `advisory` ⇒ φεύγει ΚΕΝΟΣ κατάλογος, παρότι υπάρχουν υποψήφιοι', () => {
    // Στο `advisory` το πάνελ δείχνει τον λόγο, όχι γραμμές. Πινέζες εκεί θα ήταν χάρτης
    // που απαντά σε ερώτηση την οποία κανείς δεν έθεσε.
    const onReport = jest.fn();
    renderReport({ presentation: 'advisory', onReport });

    expect(onReport.mock.calls.at(-1)?.[0].candidates).toHaveLength(0);
  });

  it('🔴 `hidden` ⇒ επίσης κενός', () => {
    const onReport = jest.fn();
    renderReport({ presentation: 'hidden', onReport });

    expect(onReport.mock.calls.at(-1)?.[0].candidates).toHaveLength(0);
  });

  it('η μετάβαση chooser → advisory ΑΔΕΙΑΖΕΙ τον χάρτη', () => {
    const onReport = jest.fn();
    const { rerender } = renderReport({ presentation: 'chooser', onReport });
    expect(onReport.mock.calls.at(-1)?.[0].candidates).toHaveLength(3);

    rerender({ presentation: 'advisory', onReport });
    expect(onReport.mock.calls.at(-1)?.[0].candidates).toHaveLength(0);
  });

  it('🔴 το ΞΕΜΟΝΤΑΡΙΣΜΑ σβήνει — αλλιώς μένουν πινέζες για ερώτηση που δεν ρωτιέται', () => {
    const onReport = jest.fn();
    const { unmount } = renderReport({ presentation: 'chooser', onReport });
    onReport.mockClear();

    unmount();

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0][0].candidates).toHaveLength(0);
  });

  it('χωρίς παραλήπτη δεν σκάει τίποτα', () => {
    expect(() => renderReport({ presentation: 'chooser' })).not.toThrow();
  });
});

describe('useSuggestionMapReport — η πράξη επιλογής ταξιδεύει ΜΑΖΙ', () => {
  it('🔴 `select(rank)` διαλέγει με ΤΑΥΤΟΤΗΤΑ, όχι με θέση στη λίστα', () => {
    // Ο υποψήφιος με `originalRank === 0` κάθεται **δεύτερος** στην οθόνη. Μια υλοποίηση
    // που δείκτεδε στη θέση θα διάλεγε τον Κορυδαλλό — και θα φαινόταν φυσιολογική.
    const onSelect = jest.fn();
    const onReport = jest.fn();
    renderReport({ presentation: 'chooser', onReport, onSelect });

    act(() => onReport.mock.calls.at(-1)?.[0].select(0));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].displayName).toBe('Περιστέρι');
  });

  it('άγνωστη ταυτότητα ⇒ ΤΙΠΟΤΑ, ποτέ «η κοντινότερη»', () => {
    const onSelect = jest.fn();
    const onReport = jest.fn();
    renderReport({ presentation: 'chooser', onReport, onSelect });

    act(() => onReport.mock.calls.at(-1)?.[0].select(99));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('🔴 η ΤΑΥΤΟΤΗΤΑ της `select` δεν αλλάζει όταν αλλάζει το `onSelect`…', () => {
    // Το `onSelect` του συντάκτη αλλάζει σε **κάθε πληκτρολόγηση**. Αν η αναφορά την
    // κουβαλούσε ευθέως, ο γονιός θα αποθήκευε νέο αντικείμενο σε κάθε πλήκτρο και ο
    // χάρτης θα ξανασχεδίαζε τις πινέζες όσο γράφει ο άνθρωπος.
    const onReport = jest.fn();
    const { rerender } = renderReport({ presentation: 'chooser', onReport, onSelect: () => {} });
    const firstSelect = onReport.mock.calls.at(-1)?.[0].select;

    rerender({ presentation: 'chooser', onReport, onSelect: () => {} });
    rerender({ presentation: 'chooser', onReport, onSelect: () => {} });

    expect(onReport.mock.calls.at(-1)?.[0].select).toBe(firstSelect);
  });

  it('…και όμως καλεί το ΝΕΟ `onSelect`, όχι το παλιό που έκλεισε μέσα της', () => {
    const stale = jest.fn();
    const fresh = jest.fn();
    const onReport = jest.fn();
    const { rerender } = renderReport({ presentation: 'chooser', onReport, onSelect: stale });
    const select = onReport.mock.calls.at(-1)?.[0].select;

    rerender({ presentation: 'chooser', onReport, onSelect: fresh });
    act(() => select(1));

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(fresh.mock.calls[0][0].displayName).toBe('Βριλήσσια');
  });
});

describe('useSuggestionMapReport — η αφετηρία ταξιδεύει μαζί', () => {
  it('η αφετηρία της ΙΔΙΑΣ φόρμας φτάνει στην αναφορά της', () => {
    const anchor = { lat: 40.6401, lng: 22.9444 };
    const onReport = jest.fn();
    renderReport({ presentation: 'chooser', onReport, anchor });

    expect(onReport.mock.calls.at(-1)?.[0].proximityAnchor).toEqual(anchor);
  });

  it('χωρίς αφετηρία ⇒ `null`, ποτέ `undefined` που διαβάζεται ως «δεν ρωτήθηκε»', () => {
    const onReport = jest.fn();
    renderReport({ presentation: 'chooser', onReport });

    expect(onReport.mock.calls.at(-1)?.[0].proximityAnchor).toBeNull();
  });
});
