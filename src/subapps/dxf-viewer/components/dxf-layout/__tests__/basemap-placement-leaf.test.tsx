/**
 * @jest-environment jsdom
 *
 * ΑΓΚΥΡΕΣ — ADR-782 §23: **οι τρεις πύλες του leaf τοποθέτησης**.
 *
 * Η επιφάνεια τοποθέτησης καταναλώνει **κάθε** γεγονός δείκτη του καμβά. Άρα το ερώτημα «πότε
 * υπάρχει;» δεν είναι λεπτομέρεια εμφάνισης — είναι το ερώτημα «πότε ο χρήστης μπορεί ακόμη να
 * σχεδιάσει». Οι `Λ1`-`Λ4` το κλειδώνουν στο **αποδοθέν DOM**, όχι στον κώδικα: ένα grep στο JSX
 * θα απαντούσε «η πύλη είναι γραμμένη», που δεν είναι το ίδιο με «η πύλη κρατάει».
 *
 * ⚠️ Η `Λ5` υπάρχει επειδή η πύλη της γεωαναφοράς είναι η **μόνη** που δεν προκύπτει από τη
 * συνεδρία: ο χρήστης μπορεί να ανοίξει την τοποθέτηση και **μετά** να γεωαναφερθεί το έργο
 * (υδάτωση από τη βάση, ευθυγράμμιση σε άλλο πάνελ). Χωρίς αυτήν, η επιφάνεια θα έμενε ανοιχτή
 * πάνω από μετρημένη θέση, ζητώντας από τον χρήστη να τη «διορθώσει» με το μάτι.
 */

import React from 'react';
import { render, act } from '@testing-library/react';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { BasemapPlacementLeaf } from '../BasemapPlacementLeaf';
import { setProjectAnchor } from '../../../systems/basemap/basemap-availability';
import { setGeoReference } from '../../../systems/geo-referencing/geo-reference-store';
import {
  beginBasemapPlacement,
  resetBasemapPlacementSession,
} from '../../../systems/basemap/basemap-placement-session';
import { resetBasemapPlacementStore } from '../../../systems/basemap/basemap-placement-store';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';

const SURFACE = 'basemap.placement.surfaceAria';

function anchorTheProject(): void {
  setProjectAnchor({
    kind: 'anchored',
    anchor: { lat: 40.64, lon: 22.94, originKey: 'projectAddressGeocoded' },
  });
}

function renderLeaf(): HTMLElement | null {
  const { container } = render(<BasemapPlacementLeaf />);
  return container.querySelector(`[aria-label="${SURFACE}"]`);
}

beforeEach(() => {
  resetBasemapPlacementSession();
  resetBasemapPlacementStore();
  setProjectAnchor(null);
  setGeoReference(null);
  act(() => {
    useViewMode3DStore.setState({ mode: '2d' });
  });
});

afterAll(() => {
  resetBasemapPlacementSession();
  resetBasemapPlacementStore();
  setProjectAnchor(null);
  setGeoReference(null);
});

describe('ADR-782 §23 — οι πύλες του leaf τοποθέτησης', () => {
  it('Λ1 — χωρίς συνεδρία δεν υπάρχει ΚΑΜΙΑ επιφάνεια πάνω από τον καμβά', () => {
    anchorTheProject();
    expect(renderLeaf()).toBeNull();
  });

  it('Λ2 — ενεργή συνεδρία σε κατά προσέγγιση θέση ⇒ η επιφάνεια υπάρχει', () => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    expect(renderLeaf()).not.toBeNull();
  });

  it('Λ3 — χωρίς καμία θέση δεν υπάρχει χάρτης να συρθεί ⇒ καμία επιφάνεια', () => {
    act(() => beginBasemapPlacement());
    expect(renderLeaf()).toBeNull();
  });

  it('Λ4 — σε προβολή 3Δ η επιφάνεια αποσύρεται (το transform της κάτοψης δεν ισχύει εκεί)', () => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => {
      useViewMode3DStore.setState({ mode: '3d-final' });
    });
    expect(renderLeaf()).toBeNull();
  });

  it('Λ5 — γεωαναφερμένο έργο ⇒ η επιφάνεια αποσύρεται ΑΚΟΜΑ ΚΑΙ ΜΕ ανοιχτή συνεδρία', () => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    expect(renderLeaf()).not.toBeNull();

    act(() => {
      setGeoReference({ originWorld: { x: 410_000_000, y: 4_500_000_000 }, rotationDeg: 0 });
    });
    expect(renderLeaf()).toBeNull();
  });
});
