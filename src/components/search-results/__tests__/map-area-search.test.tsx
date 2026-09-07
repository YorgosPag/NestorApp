/**
 * 🔴 **Η ΠΟΛΙΤΙΚΗ ΤΟΥ ΧΑΡΤΗ, ΚΑΙ Η ΓΡΑΜΜΗ ΠΟΥ ΤΗΝ ΑΝΑΚΟΙΝΩΝΕΙ** (ADR-777 §8.63).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΑ ΤΡΙΑ ΕΛΑΤΤΩΜΑΤΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ ΓΙΑ ΝΑ ΠΙΑΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Ο διακόπτης γράφει στη διεύθυνση χωρίς ο άνθρωπος να το ζητήσει.** Με τον
 *    διακόπτη κλειστό, μια αναφορά του χάρτη οφείλει να **προσφέρει** (κουμπί), ποτέ
 *    να **εφαρμόσει**.
 * 2. **Η γραμμή τυπώνεται χωρίς ερώτηση**, γράφοντας «0 εκτός περιοχής» για πάντα —
 *    το σχήμα *«`0` σημαίνει κανείς δεν κοίταξε»*, σε έκτη μορφή.
 * 3. **Ο συναγερμός δεν χτυπά ποτέ**, επειδή ο έλεγχος είναι ταυτολογία.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';

import { computeAreaLedger } from '@/lib/listings/listing-search-area';
import { EMPTY_LISTING_FILTERS, type ListingFilters } from '@/lib/listings/listing-filters';
import { useMapAreaSearch } from '@/hooks/listings/useMapAreaSearch';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

import { readMapArea, sameMapArea } from '../results-map-area';
import { fitMapToArea, listingIdOf, type MapEventTarget } from '../results-map-contract';

import { AreaLedgerBar } from '../AreaLedgerBar';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars === undefined ? key : `${key}#${JSON.stringify(vars)}`,
  }),
}));

const FRAME: GeoBoundingBox = { south: 37.974, west: 23.7155, north: 37.994, east: 23.7395 };
const OTHER_FRAME: GeoBoundingBox = { south: 38.1, west: 23.8, north: 38.2, east: 23.9 };

describe('Α — η γραμμή σιωπά όταν κανείς δεν ρώτησε περιοχή', () => {
  it('χωρίς ερώτηση δεν αποδίδεται τίποτα — ποτέ «0 εκτός περιοχής» για πάντα', () => {
    const { container } = render(
      <AreaLedgerBar ledger={computeAreaLedger([], null)} asked={false} visibleCount={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('με ερώτηση τυπώνει ΚΑΙ ΤΑ ΤΡΙΑ μέρη, ακόμη και στο μηδέν', () => {
    render(
      <AreaLedgerBar
        ledger={{ total: 0, inside: 0, maybe: 0, outside: 0 }}
        asked
        visibleCount={0}
      />
    );
    expect(screen.getByText(/area\.summary/)).toHaveTextContent('"inside":0');
    expect(screen.getByText(/area\.summary/)).toHaveTextContent('"maybe":0');
    expect(screen.getByText(/area\.summary/)).toHaveTextContent('"outside":0');
  });
});

describe('Β — ο συναγερμός ΜΠΟΡΕΙ να χτυπήσει', () => {
  it('σιωπά όταν όλα κλείνουν', () => {
    render(
      <AreaLedgerBar
        ledger={{ total: 4, inside: 1, maybe: 2, outside: 1 }}
        asked
        visibleCount={3}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('🔴 χτυπά όταν ο μετρητής μιλά για ΑΛΛΟ σύνολο από τη λίστα', () => {
    render(
      <AreaLedgerBar
        ledger={{ total: 4, inside: 1, maybe: 2, outside: 1 }}
        asked
        visibleCount={99}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('area.imbalanced');
  });

  it('🔴 χτυπά όταν το άθροισμα δεν κλείνει μέσα του', () => {
    render(
      <AreaLedgerBar
        ledger={{ total: 10, inside: 1, maybe: 2, outside: 1 }}
        asked
        visibleCount={3}
      />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('η εξήγηση του «ίσως» εμφανίζεται ΜΟΝΟ όταν υπάρχει «ίσως»', () => {
    const { rerender } = render(
      <AreaLedgerBar
        ledger={{ total: 2, inside: 2, maybe: 0, outside: 0 }}
        asked
        visibleCount={2}
      />
    );
    expect(screen.queryByText(/area\.maybeHint/)).not.toBeInTheDocument();

    rerender(
      <AreaLedgerBar
        ledger={{ total: 2, inside: 1, maybe: 1, outside: 0 }}
        asked
        visibleCount={2}
      />
    );
    expect(screen.getByText(/area\.maybeHint/)).toBeInTheDocument();
  });
});

describe('Γ 🔴 — ο διακόπτης αποφασίζει ΑΝ η αναφορά του χάρτη γίνεται ερώτημα', () => {
  beforeEach(() => window.localStorage.clear());

  const setup = (filters: ListingFilters = EMPTY_LISTING_FILTERS) => {
    const commit = jest.fn();
    const view = renderHook(() => useMapAreaSearch(filters, commit));
    return { commit, view };
  };

  it('προεπιλογή: ΚΛΕΙΣΤΟΣ — ο διακομιστής δεν μπορεί να ξέρει άλλη τιμή', () => {
    const { view } = setup();
    expect(view.result.current.followMap).toBe(false);
  });

  it('🔴 κλειστός ⇒ η αναφορά ΠΡΟΣΦΕΡΕΙ (κουμπί), δεν γράφει στη διεύθυνση', () => {
    const { commit, view } = setup();
    act(() => view.result.current.onAreaChange(FRAME));

    expect(commit).not.toHaveBeenCalled();
    expect(view.result.current.pendingArea).toEqual(FRAME);
  });

  it('το κουμπί εφαρμόζει, και μετά δεν έχει πια τι να πει', () => {
    const { commit, view } = setup();
    act(() => view.result.current.onAreaChange(FRAME));
    act(() => view.result.current.applyPendingArea());

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ near: FRAME }));
    expect(view.result.current.pendingArea).toBeNull();
  });

  it('ανοιχτός ⇒ γράφει αμέσως, χωρίς κουμπί', () => {
    const { commit, view } = setup();
    act(() => view.result.current.setFollowMap(true));
    act(() => view.result.current.onAreaChange(FRAME));

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ near: FRAME }));
    expect(view.result.current.pendingArea).toBeNull();
  });

  it('🔑 το άναμμα ΕΦΑΡΜΟΖΕΙ ό,τι εκκρεμεί — ο άνθρωπος δεν ρωτιέται δύο φορές', () => {
    const { commit, view } = setup();
    act(() => view.result.current.onAreaChange(FRAME));
    expect(commit).not.toHaveBeenCalled();

    act(() => view.result.current.setFollowMap(true));
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ near: FRAME }));
  });

  it('η συνήθεια επιβιώνει — γράφεται και ξαναδιαβάζεται', () => {
    const first = setup();
    act(() => first.view.result.current.setFollowMap(true));
    first.view.unmount();

    const second = setup();
    expect(second.view.result.current.followMap).toBe(true);
  });

  it('🔴 αναφορά ΙΔΙΑΣ περιοχής αγνοείται — αλλιώς το «πίσω» του περιηγητή σπάει', () => {
    const { commit, view } = setup({ ...EMPTY_LISTING_FILTERS, near: FRAME });
    act(() => view.result.current.setFollowMap(true));
    commit.mockClear();

    act(() => view.result.current.onAreaChange(FRAME));
    expect(commit).not.toHaveBeenCalled();

    act(() => view.result.current.onAreaChange(OTHER_FRAME));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('το ορθογώνιο ΑΝΤΙΚΑΘΙΣΤΑ κύκλο — ένα πεδίο, ποτέ δύο γεωγραφικές δηλώσεις', () => {
    const circle = { center: { lat: 37.98, lng: 23.72 }, radiusKm: 5 };
    const { commit, view } = setup({ ...EMPTY_LISTING_FILTERS, near: circle });
    act(() => view.result.current.setFollowMap(true));
    act(() => view.result.current.onAreaChange(FRAME));

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ near: FRAME }));
  });
});

describe('Δ — το σύνορο προς το MapLibre: μετατροπές που ΣΠΑΝΕ ΣΙΩΠΗΛΑ', () => {
  const boundsOf = (b: GeoBoundingBox) => ({
    getSouth: () => b.south,
    getWest: () => b.west,
    getNorth: () => b.north,
    getEast: () => b.east,
  });

  it('readMapArea διαβάζει το κάδρο με τα ΣΩΣΤΑ ονόματα', () => {
    expect(readMapArea({ getBounds: () => boundsOf(FRAME) })).toEqual(FRAME);
  });

  it('🔴 NaN ⇒ null — ένα ορθογώνιο με NaN αδειάζει τη λίστα ΣΙΩΠΗΛΑ', () => {
    const broken = { ...FRAME, north: Number.NaN };
    expect(readMapArea({ getBounds: () => boundsOf(broken) })).toBeNull();
  });

  it('χάρτης χωρίς κάδρο ⇒ null, ποτέ εξαίρεση μέσα σε ακροατή', () => {
    expect(readMapArea({ getBounds: () => undefined } as never)).toBeNull();
  });

  it('sameMapArea συγκρίνει ΠΕΔΙΑ, ποτέ ταυτότητα αντικειμένου', () => {
    expect(sameMapArea(FRAME, { ...FRAME })).toBe(true);
    expect(sameMapArea(FRAME, { ...FRAME, north: FRAME.north + 0.001 })).toBe(false);
    expect(sameMapArea(null, null)).toBe(true);
    expect(sameMapArea(FRAME, null)).toBe(false);
  });

  it('🔴 fitMapToArea στέλνει [[δύση, νότος], [ανατολή, βορράς]] — η ΣΕΙΡΑ είναι σιωπηλά αντιστρέψιμη', () => {
    const calls: unknown[][] = [];
    const target = { fitBounds: (...args: unknown[]) => calls.push(args) } as unknown as MapEventTarget;

    fitMapToArea(target, FRAME);

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toEqual([
      [FRAME.west, FRAME.south],
      [FRAME.east, FRAME.north],
    ]);
    // ⚠️ Το `maxZoom` δεν είναι αισθητικό: ΕΝΑ αποτέλεσμα δίνει ορθογώνιο μηδενικού
    //    εμβαδού, και χωρίς φραγμό ο χάρτης ισχυρίζεται ακρίβεια δρόμου (Α5).
    expect(calls[0][1]).toMatchObject({ padding: 64, maxZoom: 15 });
  });

  it('listingIdOf επιστρέφει null όταν το σχήμα δεν είναι αγγελία', () => {
    expect(listingIdOf({ features: [{ properties: { id: 'prop_7' } }], point: { x: 0, y: 0 } })).toBe('prop_7');
    expect(listingIdOf({ features: [], point: { x: 0, y: 0 } })).toBeNull();
    expect(listingIdOf({ point: { x: 0, y: 0 } })).toBeNull();
  });
});
