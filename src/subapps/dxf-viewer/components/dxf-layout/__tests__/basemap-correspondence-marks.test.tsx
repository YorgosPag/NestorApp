/**
 * @jest-environment jsdom
 *
 * ΑΓΚΥΡΕΣ `Ν` — ADR-782 §27.4: **ο χρήστης βλέπει τι έδειξε.**
 *
 * Το εργαλείο «Αντιστοίχιση» κρατούσε την κατάσταση σωστά και δεν τη ζωγράφιζε ποτέ: το πάνελ
 * δήλωνε **πλήθος**, η οθόνη **τίποτα**. Οι άγκυρες εδώ ρωτούν το **αποδοθέν DOM** — ένα grep
 * στο JSX θα απαντούσε «το σημάδι είναι γραμμένο», που δεν είναι το ίδιο με «το σημάδι φαίνεται».
 *
 * ## 🔴 Ο ΜΑΡΤΥΡΑΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟΣ
 * Οι μισές άγκυρες εδώ ισχυρίζονται **απουσία** (κανένα σημάδι στο «Σύρσιμο», κανένα μετά την
 * επαναφορά). Μια απουσία είναι πράσινη και όταν το περιβάλλον **δεν μπορεί** να παραγάγει το
 * φαινόμενο — και στο jsdom αυτό είναι πραγματικός κίνδυνος: το `getBoundingClientRect`
 * επιστρέφει **μηδενικές** διαστάσεις, οπότε κάθε χειριστής δείκτη βγαίνει νωρίς (το ίδιο
 * μάθημα που πλήρωσε η `Π0` στο `basemap-placement-leaf.test.tsx`). Γι' αυτό το `Ν0` αποδεικνύει
 * **πρώτα** ότι σημάδι μπορεί να εμφανιστεί, και το `Ν0β` ότι μπορεί να εμφανιστεί από
 * **πραγματικό κλικ**, όχι μόνο από γραφή στο store.
 */

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { BasemapPlacementLeaf } from '../BasemapPlacementLeaf';
import { BASEMAP_CORRESPONDENCE_MARKS } from '../../../config/color-config';
import { setProjectAnchor } from '../../../systems/basemap/basemap-availability';
import { setGeoReference } from '../../../systems/geo-referencing/geo-reference-store';
import { getBasemapFrame } from '../../../systems/basemap/basemap-frame';
import { makeWorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';
import {
  addPlacementCorrespondence,
  beginBasemapPlacement,
  clearPlacementCorrespondences,
  resetBasemapPlacementSession,
  setBasemapPlacementTool,
  setPlacementPendingDrawing,
} from '../../../systems/basemap/basemap-placement-session';
import { resetBasemapPlacementStore } from '../../../systems/basemap/basemap-placement-store';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import type { Point2D } from '../../../rendering/types/Types';

const VIEWPORT = { width: 800, height: 600 };
const MARKS = BASEMAP_CORRESPONDENCE_MARKS;

function anchorTheProject(): void {
  setProjectAnchor({
    kind: 'anchored',
    anchor: { lat: 40.64, lon: 22.94, originKey: 'projectAddressGeocoded' },
  });
}

/** Το σημείο της **Γης** που, με το τρέχον πλαίσιο, προσγειώνεται ακριβώς σε `paper`. */
function earthPointUnder(paper: Point2D): Point2D {
  const frame = getBasemapFrame();
  if (!frame) throw new Error('Χωρίς πλαίσιο — η άγκυρα δοκιμάζει άλλη κατάσταση.');
  return makeWorldToDisplayProjector(frame.geo).unproject(paper.x, paper.y);
}

function renderLeaf(): HTMLElement {
  const { container } = render(<BasemapPlacementLeaf viewport={VIEWPORT} />);
  return container;
}

function marksOf(container: HTMLElement, state?: string): SVGGElement[] {
  const selector = state ? `[data-mark-state="${state}"]` : '[data-mark-state]';
  return Array.from(container.querySelectorAll<SVGGElement>(selector));
}

/** Τα ονόματα ετικετών των σχημάτων ενός σημαδιού — το **τι ζωγραφίστηκε**. */
function shapeTagsOf(mark: SVGGElement): string[] {
  return Array.from(mark.children).map((child) => child.tagName.toLowerCase());
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

describe('ADR-782 §27.4 — τα σημάδια φτάνουν στην οθόνη', () => {
  beforeEach(() => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => setBasemapPlacementTool('match'));
  });

  it('Ν0 — ΜΑΡΤΥΡΑΣ: μια ολοκληρωμένη αντιστοιχία ΠΑΡΑΓΕΙ σημάδια σε αυτό το περιβάλλον', () => {
    const drawing = { x: 1_000, y: 2_000 };
    act(() => addPlacementCorrespondence({ drawing, world: earthPointUnder(drawing) }));

    // Χωρίς αυτό, κάθε «δεν υπάρχει σημάδι» παρακάτω θα ήταν «κανείς δεν κοίταξε».
    expect(marksOf(renderLeaf()).length).toBeGreaterThan(0);
  });

  it('Ν0β — ΜΑΡΤΥΡΑΣ: και ΠΡΑΓΜΑΤΙΚΟ κλικ στην επιφάνεια το παράγει, όχι μόνο γραφή στο store', () => {
    const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      const container = renderLeaf();
      const surface = container.querySelector(
        '[aria-label="basemap.placement.surfaceAria"]',
      ) as HTMLElement;

      fireEvent.pointerDown(surface, { clientX: 210, clientY: 140, pointerId: 1 });

      expect(marksOf(container, 'drawingPending')).toHaveLength(1);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('Ν1 — το εκκρεμές σημείο σχεδίου ΕΧΕΙ σημάδι (ήταν αόρατο: το ίδιο το ελάττωμα)', () => {
    act(() => setPlacementPendingDrawing({ x: 500, y: 900 }));

    const container = renderLeaf();
    expect(marksOf(container, 'drawingPending')).toHaveLength(1);
    expect(marksOf(container, 'drawingSettled')).toHaveLength(0);
  });

  it('Ν2 — κάθε ζεύγος δίνει ΔΥΟ σημάδια: το σημείο του σχεδίου ΚΑΙ το σημείο της Γης', () => {
    const a = { x: 1_000, y: 2_000 };
    const b = { x: 4_000, y: 2_500 };
    act(() => {
      addPlacementCorrespondence({ drawing: a, world: earthPointUnder(a) });
      addPlacementCorrespondence({ drawing: b, world: earthPointUnder(b) });
    });

    const container = renderLeaf();
    expect(marksOf(container, 'drawingSettled')).toHaveLength(2);
    expect(marksOf(container, 'mapSettled')).toHaveLength(2);
  });

  it('Ν3 — η επαναφορά τα σβήνει ΟΛΑ (δες Ν0: το περιβάλλον μπορεί να τα δείξει)', () => {
    const drawing = { x: 1_000, y: 2_000 };
    act(() => {
      addPlacementCorrespondence({ drawing, world: earthPointUnder(drawing) });
      setPlacementPendingDrawing({ x: 3_000, y: 100 });
    });
    expect(marksOf(renderLeaf())).not.toHaveLength(0);

    act(() => clearPlacementCorrespondences());
    expect(marksOf(renderLeaf())).toHaveLength(0);
  });

  it('Ν7 — στο «Σύρσιμο» δεν ζωγραφίζεται κανένα: εκεί μιλά η πυξίδα, όχι τα ζεύγη', () => {
    const drawing = { x: 1_000, y: 2_000 };
    act(() => addPlacementCorrespondence({ drawing, world: earthPointUnder(drawing) }));
    act(() => setBasemapPlacementTool('drag'));

    expect(marksOf(renderLeaf())).toHaveLength(0);
  });
});

/**
 * **WCAG 1.4.1 / CHECK 3.41** — «ξέρω ΠΟΙΟ είναι ποιο χωρίς να δω χρώμα;»
 *
 * Η πύλη `check-state-channel-distinctness.js` κρίνει το **λεξιλόγιο**. Οι άγκυρες εδώ κρίνουν
 * τη **ζωγραφιά**: ένα λεξιλόγιο που δηλώνει κύκλο ενώ το DOM βάφει τετράγωνο θα άφηνε την
 * πύλη πράσινη πάνω στο ελάττωμα. Χρειάζονται **και τα δύο** — το ίδιο ζευγάρι με το
 * `table-bound-mark-corner.test.ts` της πρώτης οικογένειας.
 */
describe('ADR-782 §27.4 — η ταυτότητα ΔΕΝ ζει στο χρώμα', () => {
  beforeEach(() => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => setBasemapPlacementTool('match'));
    const drawing = { x: 1_000, y: 2_000 };
    act(() => addPlacementCorrespondence({ drawing, world: earthPointUnder(drawing) }));
  });

  it('Ν4 — σημείο σχεδίου και σημείο χάρτη είναι ΔΙΑΦΟΡΕΤΙΚΑ ΣΧΗΜΑΤΑ στο DOM', () => {
    const container = renderLeaf();
    const drawingShapes = shapeTagsOf(marksOf(container, 'drawingSettled')[0]);
    const mapShapes = shapeTagsOf(marksOf(container, 'mapSettled')[0]);

    expect(new Set(drawingShapes)).toEqual(new Set(['rect']));
    expect(new Set(mapShapes)).toEqual(new Set(['circle']));
    // Το κρίσιμο: κανένα κοινό όνομα ετικέτας ⇒ η διάκριση επιβιώνει σε ασπρόμαυρη οθόνη.
    expect(drawingShapes.filter((tag) => mapShapes.includes(tag))).toHaveLength(0);
  });

  it('Ν5 — ΚΑΙ ΤΑ ΔΥΟ βάφονται με ΤΑΥΤΟΣΗΜΟ χρώμα: η απόχρωση δεν κουβαλά ΚΑΜΙΑ πληροφορία', () => {
    const container = renderLeaf();
    const inkOf = (state: string): string | null =>
      marksOf(container, state)[0].children[1].getAttribute('stroke');

    expect(inkOf('drawingSettled')).toBe(inkOf('mapSettled'));
    // Δομικά, όχι κατά σύμπτωση: το λεξιλόγιο έχει **ένα** πεδίο χρώματος για τις τρεις.
    expect(Object.keys(MARKS.states)).toHaveLength(3);
    expect(inkOf('mapSettled')).toBe(MARKS.hex);
  });

  it('Ν6 — τα δύο σχήματα δεν ΑΓΓΙΖΟΝΤΑΙ ποτέ: στην τέλεια προσαρμογή βλέπεις δύο σημάδια, όχι ένα', () => {
    // Η μακρύτερη ακτίνα του τετραγώνου είναι η διαγώνιός του· πρέπει να μένει εντός του κύκλου.
    const squareReach = MARKS.squareHalfPx * Math.SQRT2;
    expect(squareReach).toBeLessThan(MARKS.circleRadiusPx - MARKS.strokeWidthPx);
  });
});

/**
 * **CHECK 3.38-3.43 / ADR-771 Φ.3** — το σημάδι κάθεται πάνω σε ράστερ χάρτη, φωτεινό ακόμη και
 * στο σκοτεινό θέμα. Καμία τιμή απόχρωσης δεν λύνει αυτό· το λύνει **casing**.
 */
describe('ADR-782 §27.4 — αναγνωσιμότητα με casing, όχι με απόχρωση', () => {
  beforeEach(() => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => setBasemapPlacementTool('match'));
  });

  it('Ν8 — κάθε σημάδι έχει ΔΥΟ περάσματα: πλατύτερο casing από κάτω, μελάνι από πάνω', () => {
    act(() => setPlacementPendingDrawing({ x: 500, y: 900 }));
    const [casing, ink] = Array.from(marksOf(renderLeaf(), 'drawingPending')[0].children);

    expect(Number(casing.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(ink.getAttribute('stroke-width')),
    );
    expect(casing.getAttribute('stroke')).not.toBe(ink.getAttribute('stroke'));
  });

  it('Ν9 — το casing παίρνει ΤΟ ΙΔΙΟ μοτίβο: συμπαγές από κάτω θα έσβηνε το ίδιο το κανάλι', () => {
    act(() => setPlacementPendingDrawing({ x: 500, y: 900 }));
    const [casing, ink] = Array.from(marksOf(renderLeaf(), 'drawingPending')[0].children);

    const dash = MARKS.pendingDashPx.join(' ');
    expect(ink.getAttribute('stroke-dasharray')).toBe(dash);
    expect(casing.getAttribute('stroke-dasharray')).toBe(dash);
  });
});

/**
 * 🏆 **ΤΟ ΥΠΟΛΟΙΠΟ** — εδώ ξεπερνάμε το QGIS, που το δείχνει σε **πίνακα** μακριά από τα σημεία.
 * Με άκαμπτο μετασχηματισμό, η απόσταση τετραγώνου↔κύκλου **ΕΙΝΑΙ** το σφάλμα προσαρμογής.
 */
describe('ADR-782 §27.4 — το σφάλμα ζει πάνω στο σημείο', () => {
  beforeEach(() => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => setBasemapPlacementTool('match'));
  });

  // ⚠️ ΡΗΤΗ επιφάνεια, ΠΟΤΕ «svg[aria-hidden]»: μετρημένο στη ζωντανή σελίδα ότι ο θεατής έχει
  // **127** τέτοια svg (κάθε εικονίδιο lucide) με **59** ξένα `<line>` μέσα τους. Ακόμη και εδώ,
  // όπου το `container` είναι μόνο το leaf, το πάνελ φέρνει τα δικά του εικονίδια — μια αλλαγή
  // εικονιδίου θα μετακινούσε σιωπηλά αυτό το νούμερο.
  const residualsOf = (container: HTMLElement): Element[] =>
    Array.from(container.querySelectorAll('[data-basemap-marks] line'));

  it('Ν10 — όταν το σημείο της Γης προσγειώνεται ΑΚΡΙΒΩΣ στο σημείο σχεδίου, καμία γραμμή', () => {
    const drawing = { x: 1_000, y: 2_000 };
    act(() => addPlacementCorrespondence({ drawing, world: earthPointUnder(drawing) }));

    expect(residualsOf(renderLeaf())).toHaveLength(0);
  });

  it('Ν11 — όταν αποκλίνει, η απόκλιση ζωγραφίζεται ως γραμμή (με το δικό της casing)', () => {
    const drawing = { x: 1_000, y: 2_000 };
    // Το ίδιο ζεύγος, αλλά το σημείο της Γης είναι 5 μέτρα αλλού: η προσαρμογή δεν κλείνει.
    const offset = earthPointUnder({ x: drawing.x + 5_000, y: drawing.y });
    act(() => addPlacementCorrespondence({ drawing, world: offset }));

    // Δύο γραμμές = casing + μελάνι της ΙΔΙΑΣ απόκλισης, όχι δύο αποκλίσεις.
    expect(residualsOf(renderLeaf())).toHaveLength(2);
  });
});

/**
 * 🔴 **Ν13 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΕΠΙΛΟΓΕΑ**, γεννημένος από τη **ζωντανή** επαλήθευση.
 *
 * Η πρώτη γραφή των `Ν10`-`Ν12` ρωτούσε `svg[aria-hidden] line|text`. Στη **ζωντανή** σελίδα του
 * θεατή μετρήθηκαν **127** τέτοια svg — κάθε εικονίδιο lucide είναι ένα — με **59** ξένα
 * `<line>` μέσα τους. Οι άγκυρες περνούσαν, αλλά **κατά τύχη**: το πάνελ τυχαίνει σήμερα να
 * χρησιμοποιεί εικονίδια χωρίς `<line>`. Μια αλλαγή εικονιδίου θα μετακινούσε το νούμερο χωρίς
 * να αλλάξει τίποτα στα σημάδια — δηλαδή πράσινο ή κόκκινο για λόγο άσχετο με το ερώτημα.
 */
describe('ADR-782 §27.4 — ο επιλογέας μετρά ΤΑ ΣΗΜΑΔΙΑ, όχι ό,τι τυχαίνει να μοιάζει', () => {
  it('Ν13 — το πάνελ ΦΕΡΝΕΙ ξένα aria-hidden svg· ο επιλογέας των αγκυρών ΔΕΝ τα πιάνει', () => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => setBasemapPlacementTool('match'));
    act(() => setPlacementPendingDrawing({ x: 500, y: 900 }));
    const container = renderLeaf();

    const ξένα = Array.from(container.querySelectorAll('svg[aria-hidden]')).filter(
      (node) => !node.hasAttribute('data-basemap-marks'),
    );
    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αν το πάνελ έπαυε να φέρνει εικονίδια, αυτή η άγκυρα θα ήταν πράσινη
    // χωρίς να έχει αποδείξει τίποτα — δηλαδή ακριβώς το σχήμα που υπάρχει για να αποτρέψει.
    expect(ξένα.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-basemap-marks]')).toHaveLength(1);
  });
});

/**
 * **§27.5 β** — οι αντιστοιχίες κρατούνται `slice(-2)`: μια **τρίτη** διώχνει την πρώτη. Η
 * απόφαση είναι σωστή (τρίτο ζεύγος δεν λύνεται σε άκαμπτο μετασχηματισμό)· **σιωπηλή** δεν
 * ήταν. Οι αριθμημένες ετικέτες — η πρακτική του QGIS Georeferencer — την κάνουν ορατή χωρίς
 * να αλλάξει η λογική που την προκαλεί.
 */
describe('ADR-782 §27.5 β — η τρίτη αντιστοιχία δεν φεύγει πια σιωπηλά', () => {
  it('Ν12 — μετά την τρίτη μένουν ΔΥΟ σημάδια σχεδίου, αριθμημένα 1 και 2', () => {
    anchorTheProject();
    act(() => beginBasemapPlacement());
    act(() => setBasemapPlacementTool('match'));

    act(() => {
      for (const x of [1_000, 4_000, 7_000]) {
        const drawing = { x, y: 2_000 };
        addPlacementCorrespondence({ drawing, world: earthPointUnder(drawing) });
      }
    });

    const container = renderLeaf();
    expect(marksOf(container, 'drawingSettled')).toHaveLength(2);

    const labels = Array.from(container.querySelectorAll('[data-basemap-marks] text')).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(['1', '2']);
  });
});
