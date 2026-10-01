/**
 * @fileoverview 📍 **Ο ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ, ΕΚΤΕΛΕΣΜΕΝΟΣ** — από την επιλογή ως την ΜΙΑ αποθήκευση (ADR-897 Φ3).
 * @related ../CaptureSpotWorkspaceDialog.tsx · ../use-capture-spot-gestures.ts · ../use-capture-spot-draft.ts
 *
 * Χ1 — επιλογή φωτογραφίας + πάτημα στην κάτοψη ⇒ θέση εκεί, με την προεπιλεγμένη κατεύθυνση/πεδίο;
 * Χ2 — το πληκτρολόγιο (`]` · βέλη · Delete) αλλάζει το πρόχειρο, χωρίς ποντίκι (WCAG 2.1.1);
 * Χ3 — «Αποθήκευση» γράφει **ΜΙΑ** φορά ολόκληρο τον χάρτη· «Ακύρωση» **τίποτα**· χωρίς αλλαγή η αποθήκευση είναι ανενεργή;
 * Χ4 — σημείο σε κάτοψη που αποσύρθηκε φαίνεται ως **ορφανό**, όχι σιωπηλά «τοποθετημένο»;
 * Χ5 — κλικ σε **άλλο** σημείο της κάτοψης επιλέγει εκείνη τη φωτογραφία, **δεν** μετακινεί την επιλεγμένη πάνω του;
 * Χ6 — 🧭 ο βορράς δηλώνεται στο πρόχειρο, φαίνεται ως βέλος, και φεύγει στην **ίδια** αποθήκευση με τα σημεία (Φ5.2);
 * Χ7 — 🧭 η πυξίδα **προτείνει** κατεύθυνση μόνο με γνωστό βορρά, και εφαρμόζεται **μόνο** με «Χρήση»;
 * Χ8 — 🧭 ο βορράς **βρίσκεται** από τις πυξίδες των τοποθετημένων φωτογραφιών, και εφαρμόζεται **μόνο** με «Χρήση»;
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: ο πίνακας οθόνης του SVG είναι **ταυτοτικός** (1 px οθόνης = 1 px εικόνας) και οι φυσικές
 * διαστάσεις της κάτοψης δηλώνονται στο `<img>` πριν το `load`. Ό,τι κρίνεται είναι η **λογική**, όχι η διάταξη.
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_PHOTO_FOV_RAD, type PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { DeclaredFloorplanNorth } from '@/lib/listings/floorplan-north';

import { CaptureSpotWorkspaceDialog } from '../CaptureSpotWorkspaceDialog';
import type { CaptureSpotFloorplan, CaptureSpotPhoto } from '../capture-spot-types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));
jest.mock('../../focal-point/use-photo-source', () => ({
  usePhotoSource: () => ({ kind: 'ready', src: 'blob:plan' }),
}));
/**
 * 📷 Η «Κουζίνα» λέει στο EXIF ότι τραβήχτηκε με ευρυγώνιο (0,9 rad)· το «Σαλόνι» δεν λέει φακό.
 * 🧭 Πυξίδες: Κουζίνα 0,2 rad · Σαλόνι 1,0 rad (από τον βορρά, δεξιόστροφα).
 */
const EXIF_FOV = 0.9;
jest.mock('@/services/filesystem/capture-facts.client', () => ({
  fetchCaptureFacts: async (fileId: string) => ({
    fovRad: fileId === 'kitchen' ? 0.9 : null,
    compassRad: fileId === 'kitchen' ? 0.2 : 1,
  }),
}));

const PLAN_SIZE = { width: 1000, height: 500 };
const PHOTOS: CaptureSpotPhoto[] = [
  { id: 'kitchen', name: 'Κουζίνα', thumbnailUrl: null },
  { id: 'living', name: 'Σαλόνι', thumbnailUrl: null },
];
const FLOORPLANS: CaptureSpotFloorplan[] = [
  { id: 'ground', name: 'Ισόγειο', source: { kind: 'file', fileId: 'ground', custody: 'company' } },
];

beforeAll(() => {
  // Ταυτοτικός πίνακας οθόνης + `DOMPoint` — ό,τι λείπει από το jsdom για το «κλικ ⇒ pixel εικόνας».
  const identity = { inverse: () => identity };
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => identity });
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', { configurable: true, value: jest.fn() });
  Object.defineProperty(SVGElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
  class Point {
    constructor(public x: number, public y: number) {}
    matrixTransform() { return this; }
  }
  Object.defineProperty(globalThis, 'DOMPoint', { configurable: true, value: Point });
  // Το jsdom δεν έχει `PointerEvent` ⇒ το `fireEvent.pointerDown` θα έφτιαχνε γενικό `Event` χωρίς `clientX`/`button`.
  if (typeof window.PointerEvent === 'undefined') {
    class TestPointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: TestPointerEvent });
  }
});

/** Η φωτογραφία στη **λίστα** (όχι το ομώνυμο σημείο πάνω στην κάτοψη). */
const inList = (name: RegExp, pressed?: boolean) =>
  within(screen.getByRole('navigation', { name: 'property-market:photoCaptureSpots.photosAria' }))
    .getByRole('button', { name, pressed });

function openWorkspace(
  declared: ReadonlyMap<string, PhotoCaptureSpot> = new Map(),
  north: DeclaredFloorplanNorth = new Map(),
) {
  const onSave = jest.fn();
  const onOpenChange = jest.fn();
  render(
    <CaptureSpotWorkspaceDialog open onOpenChange={onOpenChange} photos={PHOTOS} floorplans={FLOORPLANS}
      declared={{ spots: declared, north }} onSave={onSave} custody="company" />,
  );
  const img = screen.getByRole('img', { name: 'Ισόγειο' });
  Object.defineProperty(img, 'naturalWidth', { value: PLAN_SIZE.width });
  Object.defineProperty(img, 'naturalHeight', { value: PLAN_SIZE.height });
  fireEvent.load(img);
  return { onSave, onOpenChange, surface: () => screen.getByRole('application') };
}

function pressAt(target: Element, x: number, y: number) {
  act(() => {
    fireEvent.pointerDown(target, { clientX: x, clientY: y, button: 0, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  });
}

describe('Χ1 — επιλογή + πάτημα ⇒ θέση', () => {
  it('📷 η φωτογραφία πάει εκεί, προς τα πάνω, με το πεδίο του ΦΑΚΟΥ της (EXIF)', async () => {
    const { onSave, surface } = openWorkspace();
    await userEvent.click(inList(/Κουζίνα/u));
    await act(async () => { await Promise.resolve(); });
    pressAt(surface(), 250, 100);
    await userEvent.click(screen.getByRole('button', { name: 'property-market:photoCaptureSpots.save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].spots.get('kitchen')).toEqual(
      { floorplanFileId: 'ground', x: 0.25, y: 0.2, headingRad: 0, fovRad: EXIF_FOV },
    );
  });

  it('χωρίς EXIF ⇒ ο κύριος φακός κινητού', async () => {
    const { onSave, surface } = openWorkspace();
    await userEvent.click(inList(/Σαλόνι/u));
    await act(async () => { await Promise.resolve(); });
    pressAt(surface(), 500, 250);
    await userEvent.click(screen.getByRole('button', { name: 'property-market:photoCaptureSpots.save' }));
    expect(onSave.mock.calls[0][0].spots.get('living').fovRad).toBe(DEFAULT_PHOTO_FOV_RAD);
  });

  it('χωρίς επιλογή, το πάτημα δεν κάνει τίποτα', () => {
    const { surface } = openWorkspace();
    pressAt(surface(), 250, 100);
    expect(screen.getByRole('button', { name: 'property-market:photoCaptureSpots.save' })).toBeDisabled();
  });
});

describe('Χ2 — πληκτρολόγιο χωρίς ποντίκι', () => {
  it('`]` στρίβει, Delete αφαιρεί', async () => {
    const declared = new Map([['kitchen', { floorplanFileId: 'ground', x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 }]]);
    const { onSave, surface } = openWorkspace(declared);
    await userEvent.click(inList(/Κουζίνα/u));
    act(() => surface().focus());
    await userEvent.keyboard('{Shift>}]{/Shift}');
    await userEvent.click(screen.getByRole('button', { name: 'property-market:photoCaptureSpots.save' }));
    expect(onSave.mock.calls[0][0].spots.get('kitchen').headingRad).toBeCloseTo(Math.PI / 12);
  });

  it('Delete ⇒ η φωτογραφία ξαναγυρίζει στο «χωρίς θέση»', async () => {
    const declared = new Map([['kitchen', { floorplanFileId: 'ground', x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 }]]);
    const { onSave, surface } = openWorkspace(declared);
    await userEvent.click(inList(/Κουζίνα/u));
    act(() => surface().focus());
    await userEvent.keyboard('{Delete}');
    await userEvent.click(screen.getByRole('button', { name: 'property-market:photoCaptureSpots.save' }));
    expect(onSave.mock.calls[0][0].spots.has('kitchen')).toBe(false);
  });
});

describe('Χ3 — μία αποθήκευση, η ακύρωση δεν γράφει', () => {
  it('«Ακύρωση» μετά από αλλαγή ⇒ κανένα `onSave`', async () => {
    const { onSave, onOpenChange, surface } = openWorkspace();
    await userEvent.click(inList(/Κουζίνα/u));
    pressAt(surface(), 100, 100);
    await userEvent.click(screen.getByRole('button', { name: 'common:buttons.cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Χ4 — ορφανό σημείο', () => {
  it('φαίνεται στην ομάδα «η κάτοψή τους αποσύρθηκε»', () => {
    const declared = new Map([['living', { floorplanFileId: 'withdrawn', x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 }]]);
    openWorkspace(declared);
    const group = screen.getByRole('region', { name: 'property-market:photoCaptureSpots.groupOrphaned' });
    expect(within(group).getByRole('button', { name: /Σαλόνι/u })).toBeInTheDocument();
  });
});

describe('Χ5 — κλικ σε άλλο σημείο επιλέγει, δεν μετακινεί', () => {
  it('η επιλεγμένη μένει στη θέση της· επιλέγεται η άλλη', async () => {
    const declared = new Map([
      ['kitchen', { floorplanFileId: 'ground', x: 0.2, y: 0.2, headingRad: 0, fovRad: 1 }],
      ['living', { floorplanFileId: 'ground', x: 0.8, y: 0.8, headingRad: 0, fovRad: 1 }],
    ]);
    openWorkspace(declared);
    await userEvent.click(inList(/Κουζίνα/u));
    const living = within(screen.getByRole('application')).getByRole('button', { name: 'Σαλόνι' });
    fireEvent.pointerDown(living, { clientX: 800, clientY: 400, button: 0, pointerId: 1 });
    await userEvent.click(living);
    expect(inList(/Σαλόνι/u, true)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'property-market:photoCaptureSpots.save' })).toBeDisabled();
  });
});

const SAVE = { name: 'property-market:photoCaptureSpots.save' };
const N = 'property-market:photoCaptureSpots.north';

describe('Χ6 — ο βορράς στο πρόχειρο', () => {
  it('«Ορισμός βορρά» ⇒ βέλος πάνω στην κάτοψη, και ο βορράς φεύγει στην ΙΔΙΑ αποθήκευση', async () => {
    const { onSave } = openWorkspace();
    expect(screen.queryByRole('img', { name: `${N}.arrowAria` })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `${N}.set` }));
    expect(screen.getByRole('img', { name: `${N}.arrowAria` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', SAVE));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].north.get('ground')).toBe(0);
  });

  it('«Αφαίρεση βορρά» ⇒ η γραμμή φεύγει από τη δήλωση', async () => {
    const { onSave } = openWorkspace(new Map(), new Map([['ground', 1]]));
    await userEvent.click(screen.getByRole('button', { name: `${N}.remove` }));
    await userEvent.click(screen.getByRole('button', SAVE));
    expect(onSave.mock.calls[0][0].north.has('ground')).toBe(false);
  });
});

describe('Χ7 — η πυξίδα προτείνει, ο άνθρωπος αποφασίζει', () => {
  const living = new Map([['living', { floorplanFileId: 'ground', x: 0.5, y: 0.5, headingRad: 0, fovRad: 1 }]]);

  it('χωρίς βορρά ⇒ εξήγηση, κανένα «Χρήση»', async () => {
    openWorkspace(living);
    await userEvent.click(inList(/Σαλόνι/u));
    expect(await screen.findByText(`${N}.compassNeedsNorth`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${N}.use` })).not.toBeInTheDocument();
  });

  it('με βορρά ⇒ πρόταση βορράς + πυξίδα, που ΔΕΝ εφαρμόζεται χωρίς «Χρήση»', async () => {
    const { onSave } = openWorkspace(living, new Map([['ground', 0.5]]));
    await userEvent.click(inList(/Σαλόνι/u));
    const use = await screen.findByRole('button', { name: `${N}.use` });
    // Τίποτα δεν άλλαξε ακόμη — η πρόταση δεν είναι αλλαγή.
    expect(screen.getByRole('button', SAVE)).toBeDisabled();
    await userEvent.click(use);
    await userEvent.click(screen.getByRole('button', SAVE));
    expect(onSave.mock.calls[0][0].spots.get('living').headingRad).toBeCloseTo(1.5);
  });
});

describe('Χ8 — ο βορράς από τις πυξίδες των φωτογραφιών', () => {
  it('δύο τοποθετημένες φωτογραφίες που συμφωνούν ⇒ πρόταση, που εφαρμόζεται μόνο με «Χρήση»', async () => {
    const placed = new Map([
      ['kitchen', { floorplanFileId: 'ground', x: 0.2, y: 0.2, headingRad: 0.7, fovRad: 1 }],
      ['living', { floorplanFileId: 'ground', x: 0.8, y: 0.8, headingRad: 1.5, fovRad: 1 }],
    ]);
    const { onSave } = openWorkspace(placed);
    await userEvent.click(screen.getByRole('button', { name: `${N}.estimate` }));
    expect(await screen.findByText(`${N}.estimateResult`)).toBeInTheDocument();
    expect(screen.getByRole('button', SAVE)).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: `${N}.use` }));
    await userEvent.click(screen.getByRole('button', SAVE));
    expect(onSave.mock.calls[0][0].north.get('ground')).toBeCloseTo(0.5);
  });
});
