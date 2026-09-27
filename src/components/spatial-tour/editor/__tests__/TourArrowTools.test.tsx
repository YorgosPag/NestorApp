/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2δ · §4.10 — **τα εργαλεία των βελακιών**.
 *
 * - **♿** — «Βελάκι εδώ» = ένα κλικ, με τη διόπτευση του **στόχαστρου** (WCAG 2.2 · 2.5.7: το σύρσιμο δεν είναι ο μόνος δρόμος).
 * - **Σ** — σύρσιμο τσιπ πάνω στη φωτογραφία ⇒ η διόπτευση **κάτω από τον δείκτη**· έξω από την εικόνα ⇒ τίποτα.
 * - **Κ** — κίνηση κάτω από το κατώφλι είναι **κλικ**, όχι σύρσιμο ⇒ καμία εγγραφή.
 * - **Λ** — σημεία: συνδεδεμένα (με «χωρίς βελάκι» / αποσύνδεση) και ασύνδετα, χωριστά.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { buildTourEditorModel } from '@/lib/spatial-tour/tour-editor-model';
import { CAPTURE } from '@/lib/spatial-tour/__tests__/spatial-tour-fixtures';
import type { TourCapture, TourNode } from '@/types/spatial-tour';

import type { TourStageAim } from '../../viewer/TourPanoramaStage';
import { TourArrowTools } from '../TourArrowTools';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join('|')}` : key),
    isNamespaceReady: true,
  }),
}));

/** Το jsdom δεν έχει `PointerEvent` ⇒ χωρίς αυτό χάνονται `button`/`clientX`/`pointerId` (όριο περιβάλλοντος, όχι κώδικα). */
beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
});

const L0 = { kind: 'local', ordinal: 0 } as const;
const node = (id: string, links: TourNode['links'] = []): TourNode => ({ id, levelKey: L0, position: null, links });
const capture = (id: string, nodeId: string): TourCapture => ({ ...CAPTURE, id, nodeId });
const NODES = [
  node('a', [{ toNodeId: 'b', via: 'manual', bearingRad: null }]),
  node('b', [{ toNodeId: 'a', via: 'manual', bearingRad: 1 }]),
  node('c'),
];
const GRAPH = buildTourEditorModel({ nodes: NODES, levels: [{ key: L0, label: null, ordinal: 0 }] },
  [capture('ca', 'a'), capture('cb', 'b'), capture('cc', 'c')]).graph;

const CENTER = 0.7;
const UNDER_POINTER = 2.4;
const aim: TourStageAim = {
  centerBearing: () => CENTER,
  bearingAtClient: (x: number) => (x > 500 ? null : UNDER_POINTER),
};

function renderTools() {
  const onPlaceArrow = jest.fn();
  const onUnlink = jest.fn();
  render(<TourArrowTools aim={aim} graph={GRAPH} nodeId="a" onPlaceArrow={onPlaceArrow} onUnlink={onUnlink} />);
  return { onPlaceArrow, onUnlink };
}

const chip = (number: number) => screen.getByRole('button', { name: `spatial-tour:editor.dragArrow:${number}` });

function drag(el: HTMLElement, to: { x: number; y: number }) {
  el.setPointerCapture = jest.fn();
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.click(el);
}

describe('TourArrowTools', () => {
  it('♿ «Βελάκι εδώ» ⇒ βελάκι με τη διόπτευση του στόχαστρου, με ένα κλικ', () => {
    const { onPlaceArrow } = renderTools();
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.arrowHereFor:2' }));
    expect(onPlaceArrow).toHaveBeenCalledWith('b', CENTER);
  });

  it('Σ σύρσιμο πάνω στη φωτογραφία ⇒ η διόπτευση κάτω από τον δείκτη· έξω ⇒ τίποτα', () => {
    const { onPlaceArrow } = renderTools();
    drag(chip(2), { x: 200, y: 120 });
    expect(onPlaceArrow).toHaveBeenCalledWith('b', UNDER_POINTER);
    onPlaceArrow.mockClear();
    drag(chip(2), { x: 900, y: 120 });
    expect(onPlaceArrow).not.toHaveBeenCalled();
  });

  it('Κ κίνηση κάτω από το κατώφλι = κλικ ⇒ καμία εγγραφή', () => {
    const { onPlaceArrow } = renderTools();
    drag(chip(2), { x: 12, y: 11 });
    expect(onPlaceArrow).not.toHaveBeenCalled();
  });

  it('Λ συνδεδεμένο χωρίς βελάκι το λέει και αποσυνδέεται· ασύνδετο παίρνει βελάκι (σύνδεση + βελάκι μαζί)', () => {
    const { onPlaceArrow, onUnlink } = renderTools();
    expect(screen.getByText('spatial-tour:editor.arrowMissing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.unlink:2' }));
    expect(onUnlink).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.arrowHereFor:3' }));
    expect(onPlaceArrow).toHaveBeenCalledWith('c', CENTER);
    expect(screen.queryByRole('button', { name: 'spatial-tour:editor.unlink:3' })).toBeNull();
  });
});
