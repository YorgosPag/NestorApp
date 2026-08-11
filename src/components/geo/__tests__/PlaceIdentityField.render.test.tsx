/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΖΩΓΡΑΦΟΥ** — τι βλέπει ο άνθρωπος εκεί που έβλεπε `pbld_*`.
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · components/geo/PlaceIdentityField.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΗ ΑΓΚΥΡΑ ΓΙΑ ΤΟ **ΠΟΥ ΖΩΓΡΑΦΙΖΕΤΑΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το μάθημα είναι **μετρημένο, δύο φορές, σε αυτό το repo**:
 *
 *   - **CHECK 3.41 (Φ.1)**: όταν άλλαξε η γωνία του σημαδιού, **και τα 170** υπάρχοντα
 *     tests του φακέλου έμειναν πράσινα — *«καμία άγκυρα δεν κλείδωνε **πού**
 *     ζωγραφίζεται»*.
 *   - **CHECK 3.45 (Φ.3)**: μετά την προσθήκη του casing τα **67** προϋπάρχοντα tests
 *     έμειναν πράσινα, «*το ίδιο κενό με τη Φ.1*».
 *
 * Εδώ η αντίστοιχη βλάβη είναι ακριβώς αυτή που η Β3 ήρθε να διορθώσει: η
 * `classifyPlaceDocuments` μπορεί να λύνει τέλεια τη διεύθυνση και η οθόνη να
 * εξακολουθεί να βάφει ωμό `pbld_24b3a8d7…` — **με όλες τις άγκυρες πράσινες**, γιατί
 * καμία τους δεν κοιτάζει τι φτάνει στο DOM.
 *
 * ⚠️ **Το `t()` επιστρέφει το κλειδί επίτηδες**: η διεύθυνση **δεν** περνά από
 * μετάφραση (είναι δεδομένο, όχι κείμενο μας), οπότε αν εμφανιστεί στο DOM ενώ κάθε
 * μεταφρασμένο κείμενο είναι κλειδί, η απόδειξη είναι **μονοσήμαντη**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PlaceIdentityField } from '../PlaceIdentityField';
import type { PublicPlaceLookup } from '@/services/realtime/hooks/usePublicPlace';
import type { PlaceRef, PublicBuilding, PublicLand } from '@/types/geo/public-place';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

/** Ο επιλογέας δεν κρίνεται εδώ — και σέρνει MapLibre, `fetch` και ρυθμίσεις. */
jest.mock('@/components/geo/PlaceChooser', () => ({
  PlaceChooser: () => <div data-testid="chooser" />,
}));

/** Ο χάρτης είναι στιγμιότυπο MapLibre· το jsdom δεν έχει WebGL. */
jest.mock('../PlaceMap', () => ({
  PlaceMap: () => <div data-testid="map" />,
}));

jest.mock('@/hooks/geo/usePlaceOutline', () => ({
  usePlaceOutline: () => ({ kind: 'none' }),
}));

/**
 * ⚠️ **Η ανάγνωση μοκάρεται· η ΚΡΙΣΗ όχι.** Το `placeDisplayAddress` μένει το
 * **πραγματικό** — αλλιώς η άγκυρα θα δοκίμαζε το μοκ της, όχι τον κανόνα «η γη κρατά
 * τη διεύθυνση».
 */
const mockLookup = jest.fn<PublicPlaceLookup, []>();
jest.mock('@/services/realtime/hooks/usePublicPlace', () => ({
  ...jest.requireActual('@/services/realtime/hooks/usePublicPlace'),
  usePublicPlace: () => mockLookup(),
}));

const AT = '2026-08-11T12:00:00.000Z';
const ADDRESS = 'Στέφανου Δραγούμη, 8';
const BUILDING_ID = 'pbld_24b3a8d7-2e56-40e6-8053-9c1628b425bf';
const LAND_ID = 'land_0cb5cbb6-bb31-4954-a7f9-8e8f9ac00a00';

const CHOSEN: PlaceRef = { landId: LAND_ID, buildingId: BUILDING_ID };

const LAND: PublicLand = {
  id: LAND_ID,
  position: {
    kind: 'known',
    provenance: 'osm',
    point: { lat: 40.6403, lng: 22.9444 },
    locatedAt: AT,
    osmRef: { elementType: 'way', elementId: '27931128', seenAt: AT },
  },
  displayAddress: ADDRESS,
  areaSqm: null,
  createdAt: AT,
  updatedAt: AT,
};

const BUILDING: PublicBuilding = {
  id: BUILDING_ID,
  landId: LAND_ID,
  footprint: { kind: 'unknown' },
  floorsAboveGround: null,
  constructionYear: null,
  useCode: null,
  createdAt: AT,
  updatedAt: AT,
};

// =============================================================================
// Ζ — Ο ΖΩΓΡΑΦΟΣ
// =============================================================================

describe('🔴 Ζ — ο τόπος αποκτά ΠΡΟΣΩΠΟ στην οθόνη', () => {
  /**
   * 🔴 **ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ ΤΗΣ Β3, ΩΣ ΑΓΚΥΡΑ.** Το handoff το έθεσε κατά λέξη:
   * *«αν ένας άνθρωπος δεν βλέπει “Στέφανου Δραγούμη, 8” εκεί που τώρα βλέπει
   * `pbld_24b3a8d7…`, δεν έχει τελειώσει»*.
   */
  it('🔑 Ζ1 — ΒΛΕΠΕΙ ΤΗ ΔΙΕΥΘΥΝΣΗ, όχι μόνο την ταυτότητα', () => {
    mockLookup.mockReturnValue({ state: 'found', land: LAND, building: BUILDING });

    render(<PlaceIdentityField chosen={CHOSEN} onChosen={jest.fn()} />);

    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
  });

  /**
   * ⚠️ **Η ταυτότητα ΔΕΝ εξαφανίζεται** — είναι το μόνο πράγμα που ταιριάζει προσφορά
   * με ζήτηση (§14.5). Αυτό που άλλαξε είναι ότι δεν είναι πια **το μόνο** που
   * βλέπει ο άνθρωπος.
   */
  it('Ζ2 — η ταυτότητα μένει ορατή, σε δεύτερη γραμμή', () => {
    mockLookup.mockReturnValue({ state: 'found', land: LAND, building: BUILDING });

    render(<PlaceIdentityField chosen={CHOSEN} onChosen={jest.fn()} />);

    expect(
      screen.getByText(`search-results:place.summary.identity::{"id":"${BUILDING_ID}"}`),
    ).toBeInTheDocument();
  });

  /**
   * ⚠️ Μετρήθηκε ότι **54 %** των κτιρίων δεν έχουν διεύθυνση (§13.7.2 #2). Η οθόνη
   * οφείλει να το **πει** — μια κενή γραμμή θα διαβαζόταν ως «δεν φόρτωσε».
   */
  it('Ζ3 — τόπος ΧΩΡΙΣ διεύθυνση ⇒ το λέει ρητά, δεν σιωπά', () => {
    mockLookup.mockReturnValue({
      state: 'found',
      land: { ...LAND, displayAddress: null },
      building: BUILDING,
    });

    render(<PlaceIdentityField chosen={CHOSEN} onChosen={jest.fn()} />);

    expect(screen.getByText('search-results:place.picker.noAddress')).toBeInTheDocument();
    expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument();
  });

  it('🔴 Ζ4 — σπασμένος δεσμός ⇒ ο άνθρωπος το ΜΑΘΑΙΝΕΙ', () => {
    mockLookup.mockReturnValue({ state: 'dangling-building', land: LAND });

    render(<PlaceIdentityField chosen={CHOSEN} onChosen={jest.fn()} />);

    expect(screen.getByText('search-results:place.summary.danglingBuilding')).toBeInTheDocument();
  });

  it('Ζ5 — όσο διαβάζεται, το λέει· δεν δείχνει κενό ούτε ωμό id μόνο του', () => {
    mockLookup.mockReturnValue({ state: 'loading' });

    render(<PlaceIdentityField chosen={CHOSEN} onChosen={jest.fn()} />);

    expect(screen.getByText('search-results:place.summary.loading')).toBeInTheDocument();
  });

  it('Ζ6 — χωρίς επιλεγμένο τόπο ⇒ ο επιλογέας, καμία περίληψη', () => {
    mockLookup.mockReturnValue({ state: 'idle' });

    render(<PlaceIdentityField chosen={null} onChosen={jest.fn()} />);

    expect(screen.getByTestId('chooser')).toBeInTheDocument();
    expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument();
  });
});
