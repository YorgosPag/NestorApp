/**
 * @fileoverview **Η ΕΜΦΑΣΗ ΔΕΙΧΝΕΙ ΑΥΤΟ ΠΟΥ ΔΕΙΧΝΕΙ Ο ΑΝΘΡΩΠΟΣ;** — ADR-332 **D26**.
 * @related components/shared/addresses/useSuggestionMapBond
 *
 * 🔴 Η άγκυρα που **πρέπει** να υπάρχει είναι η τρίτη ομάδα: ο `originalRank` είναι
 * μοναδικός **μέσα** σε έναν κατάλογο, όχι ανάμεσα σε δύο. Έμφαση που επιβιώνει από τον
 * έναν κατάλογο στον επόμενο τονίζει **άλλη διεύθυνση** — και φαίνεται φυσιολογική.
 */

import { renderHook, act } from '@testing-library/react';
import { useSuggestionMapBond, useSuggestionOptions } from '../useSuggestionMapBond';
import type { SuggestionMapReport, SuggestionRanking } from '../editor';

function ranking(originalRank: number, lat: number, lng: number, name: string): SuggestionRanking {
  return {
    originalRank,
    distanceFromCenterM: 296_000,
    rankScore: 0.65,
    candidate: {
      lat,
      lng,
      displayName: name,
      confidence: 0.65,
      resolvedFields: { city: name },
      partialMatch: false,
      alternatives: [],
    },
  } as unknown as SuggestionRanking;
}

const ATTICA = [
  ranking(0, 38.01, 23.69, 'Περιστέρι'),
  ranking(1, 37.98, 23.65, 'Κορυδαλλός'),
] as const;

const OTHER_LIST = [ranking(0, 40.63, 22.94, 'Θεσσαλονίκη')] as const;

function report(
  candidates: readonly SuggestionRanking[],
  select: (rank: number) => void = () => {},
  proximityAnchor: { lat: number; lng: number } | null = null,
): SuggestionMapReport {
  return { candidates, select, proximityAnchor };
}

describe('useSuggestionMapBond — από αναφορά σε πινέζες', () => {
  it('χωρίς αναφορά: κανένας υποψήφιος, καμία έμφαση, καμία αφετηρία', () => {
    const { result } = renderHook(() => useSuggestionMapBond());

    expect(result.current.candidates).toEqual([]);
    expect(result.current.highlightedRank).toBeNull();
    expect(result.current.anchor).toBeNull();
  });

  it('η αναφορά γίνεται υποψήφιοι χάρτη, με σειρά εμφάνισης και ταυτότητα', () => {
    const { result } = renderHook(() => useSuggestionMapBond());

    act(() => result.current.report(report(ATTICA)));

    expect(result.current.candidates.map((c) => c.rank)).toEqual([0, 1]);
    expect(result.current.candidates.map((c) => c.position)).toEqual([1, 2]);
    expect(result.current.candidates.map((c) => c.label)).toEqual(['Περιστέρι', 'Κορυδαλλός']);
  });

  it('η αφετηρία της αναφοράς γίνεται η αφετηρία του δεσμού («296 χλμ από πού;»)', () => {
    const anchor = { lat: 40.6401, lng: 22.9444 };
    const { result } = renderHook(() => useSuggestionMapBond());

    act(() => result.current.report(report(ATTICA, () => {}, anchor)));

    expect(result.current.anchor).toEqual(anchor);
  });

  it('το κλικ σε πινέζα φτάνει στην πράξη ΤΗΣ ΑΝΑΦΟΡΑΣ, με την ταυτότητα', () => {
    const select = jest.fn();
    const { result } = renderHook(() => useSuggestionMapBond());

    act(() => result.current.report(report(ATTICA, select)));
    act(() => result.current.select(1));

    expect(select).toHaveBeenCalledWith(1);
  });

  it('η `report` έχει ΣΤΑΘΕΡΗ ταυτότητα — αλλιώς η ίδια η καλωδίωση γίνεται βρόχος', () => {
    const { result, rerender } = renderHook(() => useSuggestionMapBond());
    const first = result.current.report;

    act(() => result.current.report(report(ATTICA)));
    rerender();

    expect(result.current.report).toBe(first);
  });
});

describe('useSuggestionMapBond — η έμφαση', () => {
  it('τίθεται και διαβάζεται', () => {
    const { result } = renderHook(() => useSuggestionMapBond());

    act(() => result.current.report(report(ATTICA)));
    act(() => result.current.setHighlightedRank(1));

    expect(result.current.highlightedRank).toBe(1);
  });

  it('🔴 ΣΒΗΝΕΙ όταν αλλάζει ο κατάλογος — αλλιώς τονίζει άλλη διεύθυνση', () => {
    const { result } = renderHook(() => useSuggestionMapBond());

    act(() => result.current.report(report(ATTICA)));
    act(() => result.current.setHighlightedRank(0));
    expect(result.current.highlightedRank).toBe(0);

    // Νέα αναζήτηση: ο νέος κατάλογος αριθμεί κι αυτός από το μηδέν. Το κρατημένο «0»
    // θα έδειχνε τώρα τη Θεσσαλονίκη ενώ ο άνθρωπος δείχνει το Περιστέρι.
    act(() => result.current.report(report(OTHER_LIST)));

    expect(result.current.highlightedRank).toBeNull();
  });

  it('ΔΕΝ σβήνει όταν αναφέρεται ο ΙΔΙΟΣ κατάλογος (π.χ. άλλαξε μόνο η αφετηρία)', () => {
    const { result } = renderHook(() => useSuggestionMapBond());

    act(() => result.current.report(report(ATTICA)));
    act(() => result.current.setHighlightedRank(1));
    act(() => result.current.report(report(ATTICA, () => {}, { lat: 1, lng: 2 })));

    expect(result.current.highlightedRank).toBe(1);
  });
});

describe('useSuggestionOptions — οι ρυθμίσεις μιας φόρμας', () => {
  it('κουβαλά την αφετηρία ΤΗΣ φόρμας και τον κοινό παραλήπτη', () => {
    const anchor = { lat: 40.64, lng: 22.94 };
    const { result } = renderHook(() => {
      const bond = useSuggestionMapBond();
      return { bond, options: useSuggestionOptions(bond, anchor) };
    });

    expect(result.current.options.proximityAnchor).toBe(anchor);
    expect(result.current.options.onCandidatesChange).toBe(result.current.bond.report);
  });

  it('🔴 ΙΔΙΑ ταυτότητα αντικειμένου όσο δεν αλλάζει τίποτα — αλλιώς ο συντάκτης ξαναστήνει τον ακροατή σε κάθε render', () => {
    const anchor = { lat: 40.64, lng: 22.94 };
    const { result, rerender } = renderHook(() => {
      const bond = useSuggestionMapBond();
      return useSuggestionOptions(bond, anchor);
    });
    const first = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  it('η έμφαση περνά ΜΕΣΑ στις ρυθμίσεις, ώστε να φτάσει στη γραμμή του καταλόγου', () => {
    const { result } = renderHook(() => {
      const bond = useSuggestionMapBond();
      return { bond, options: useSuggestionOptions(bond, undefined) };
    });

    act(() => result.current.bond.report(report(ATTICA)));
    act(() => result.current.bond.setHighlightedRank(1));

    expect(result.current.options.highlightedCandidateRank).toBe(1);
  });

  it('δύο φόρμες μοιράζονται τον δεσμό αλλά ΟΧΙ την αφετηρία', () => {
    const addAnchor = { lat: 40.58, lng: 22.95 };
    const editAnchor = { lat: 40.64, lng: 22.94 };
    const { result } = renderHook(() => {
      const bond = useSuggestionMapBond();
      return {
        add: useSuggestionOptions(bond, addAnchor),
        edit: useSuggestionOptions(bond, editAnchor),
      };
    });

    expect(result.current.add.proximityAnchor).toBe(addAnchor);
    expect(result.current.edit.proximityAnchor).toBe(editAnchor);
    expect(result.current.add.onCandidatesChange).toBe(result.current.edit.onCandidatesChange);
  });
});
