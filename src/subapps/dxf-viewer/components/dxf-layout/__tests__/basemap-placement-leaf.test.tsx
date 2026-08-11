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
import { render, act, fireEvent } from '@testing-library/react';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { BasemapPlacementLeaf } from '../BasemapPlacementLeaf';
import { setProjectAnchor } from '../../../systems/basemap/basemap-availability';
import { setGeoReference } from '../../../systems/geo-referencing/geo-reference-store';
import {
  beginBasemapPlacement,
  getBasemapPlacementSession,
  resetBasemapPlacementSession,
  setBasemapPlacementTool,
} from '../../../systems/basemap/basemap-placement-session';
import {
  getBasemapPlacement,
  resetBasemapPlacementStore,
} from '../../../systems/basemap/basemap-placement-store';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';

const SURFACE = 'basemap.placement.surfaceAria';

/** Οι διαστάσεις του καμβά — από το ίδιο SSoT που δίνει ο shell σε κάθε overlay (ADR-782 §27.4). */
const VIEWPORT = { width: 800, height: 600 };

function anchorTheProject(): void {
  setProjectAnchor({
    kind: 'anchored',
    anchor: { lat: 40.64, lon: 22.94, originKey: 'projectAddressGeocoded' },
  });
}

function renderLeaf(): HTMLElement | null {
  const { container } = render(<BasemapPlacementLeaf viewport={VIEWPORT} />);
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

/**
 * ADR-782 §27 — **το πάνελ δεν είναι καμβάς**.
 *
 * 🔴 Ζωντανό εύρημα (Giorgio, 2026-08-10): «η αντιστοίχιση δεν λειτουργεί σωστά». Η μπάρα εργαλείων
 * αποδίδεται **ΜΕΣΑ** στην επιφάνεια που καταναλώνει κάθε γεγονός δείκτη (`Λ1`-`Λ5` παραπάνω
 * φυλάνε ακριβώς αυτή την αποκλειστικότητα) — και **κανείς δεν σταματούσε τη διάδοση**. Άρα το
 * `pointerdown` πάνω σε **κουμπί** έφτανε πρώτο στον χειριστή της επιφάνειας:
 *
 * | Εργαλείο | Τι έκανε το κλικ στο κουμπί, πριν καν φτάσει στο κουμπί |
 * |---|---|
 * | `match` | **καταγραφόταν ως σημείο** — και με εκκρεμές σημείο σχεδίου **ολοκλήρωνε ζεύγος** πάνω στη θέση του κουμπιού ⇒ ο χάρτης πήδαγε σε ό,τι έτυχε |
 * | `drag` | **ξεκινούσε χειρονομία** μετατόπισης, με `setPointerCapture` στην επιφάνεια |
 *
 * 🔑 Η αποκλειστικότητα ήταν σχεδιασμένη προς **τα κάτω** (να μην περνά κλικ στον καμβά), και
 * κανείς δεν ρώτησε τι γίνεται με τη διεπαφή **μέσα** της. Η λαβή στροφής **είχε** την απάντηση
 * γραμμένη — ο `start()` της κλείνει με `stopPropagation()` — αλλά ήταν λύση **ενός σημείου** αντί
 * για σύνορο.
 *
 * ⚠️ Ο μάρτυρας `Π0` δεν είναι διακοσμητικός: στο jsdom το `getBoundingClientRect` επιστρέφει
 * **μηδενικές** διαστάσεις, οπότε το `getPointerSnapshotFromElement` απαντά `null` και **κάθε**
 * χειριστής δείκτη βγαίνει νωρίς. Χωρίς αυτόν, οι `Λ6`/`Λ7` θα ήταν **πράσινες ακόμη και με το
 * ελάττωμα** — «κανείς δεν κοίταξε» μεταμφιεσμένο σε απόδειξη.
 */
describe('ADR-782 §27 — τα κουμπιά του πάνελ ΔΕΝ είναι γεγονότα καμβά', () => {
  /** Διαστάσεις για τον υπολογισμό χαρτιού — αλλιώς κάθε χειριστής βγαίνει νωρίς (δες επικεφαλίδα). */
  let rectSpy: jest.SpyInstance;

  beforeEach(() => {
    rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600,
      toJSON: () => ({}),
    } as DOMRect);
    anchorTheProject();
    act(() => beginBasemapPlacement());
  });

  afterEach(() => rectSpy.mockRestore());

  function panelButton(container: HTMLElement, key: string): HTMLElement {
    const found = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(key),
    );
    if (!found) throw new Error(`Το κουμπί «${key}» δεν αποδόθηκε — η άγκυρα δοκιμάζει άλλο DOM.`);
    return found;
  }

  it('Π0 — ΜΑΡΤΥΡΑΣ: pointerdown στην ΙΔΙΑ την επιφάνεια ΚΑΤΑΓΡΑΦΕΙ σημείο (αλλιώς τα Λ6/Λ7 δεν αποδεικνύουν τίποτα)', () => {
    act(() => setBasemapPlacementTool('match'));
    const { container } = render(<BasemapPlacementLeaf viewport={VIEWPORT} />);
    const surface = container.querySelector(`[aria-label="${SURFACE}"]`) as HTMLElement;

    fireEvent.pointerDown(surface, { clientX: 120, clientY: 90, pointerId: 1 });

    expect(getBasemapPlacementSession().pendingDrawing).not.toBeNull();
  });

  it('Λ6 — σε ΑΝΤΙΣΤΟΙΧΙΣΗ, κλικ σε κουμπί του πάνελ ΔΕΝ καταγράφεται ως σημείο', () => {
    act(() => setBasemapPlacementTool('match'));
    const { container } = render(<BasemapPlacementLeaf viewport={VIEWPORT} />);

    fireEvent.pointerDown(panelButton(container, 'basemap.placement.done'), {
      clientX: 400, clientY: 560, pointerId: 2,
    });

    // Με το ελάττωμα, το «Τέλος» έδειχνε σημείο σχεδίου στη θέση του κουμπιού.
    expect(getBasemapPlacementSession().pendingDrawing).toBeNull();
  });

  it('Λ6β — και ΔΕΝ ολοκληρώνει ζεύγος: ο χάρτης δεν πηδά στη θέση του κουμπιού', () => {
    act(() => setBasemapPlacementTool('match'));
    const { container } = render(<BasemapPlacementLeaf viewport={VIEWPORT} />);
    const surface = container.querySelector(`[aria-label="${SURFACE}"]`) as HTMLElement;

    // Πρώτο, νόμιμο κλικ πάνω στην επιφάνεια: εκκρεμεί σημείο σχεδίου.
    fireEvent.pointerDown(surface, { clientX: 120, clientY: 90, pointerId: 3 });
    expect(getBasemapPlacementSession().pendingDrawing).not.toBeNull();

    // Τώρα ο χρήστης πάει να πατήσει «Σύρσιμο» — ΟΧΙ να δείξει σημείο στον χάρτη.
    fireEvent.pointerDown(panelButton(container, 'basemap.placement.tool.drag'), {
      clientX: 400, clientY: 560, pointerId: 4,
    });

    expect(getBasemapPlacementSession().correspondences).toHaveLength(0);
    expect(getBasemapPlacement()).toBeNull();
  });

  it('Λ7 — σε ΣΥΡΣΙΜΟ, κλικ σε κουμπί του πάνελ ΔΕΝ ξεκινά χειρονομία', () => {
    const { container } = render(<BasemapPlacementLeaf viewport={VIEWPORT} />);

    fireEvent.pointerDown(panelButton(container, 'basemap.placement.reset'), {
      clientX: 400, clientY: 560, pointerId: 5,
    });

    expect(getBasemapPlacementSession().gesture).toBe('none');
  });
});
