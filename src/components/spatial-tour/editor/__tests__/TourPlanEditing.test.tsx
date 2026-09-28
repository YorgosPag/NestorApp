/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΣΤΗΝ ΟΘΟΝΗ ΤΟΠΟΘΕΤΗΣΗΣ** (ADR-884 Φ2στ-β · §4.13).
 *
 * - **Π** — πληκτρολόγιο (WCAG 2.1.1): βελάκια ⇒ πρόχειρο σημείο (0,1 m · Shift 1 m), Enter ⇒ **μία** αποθήκευση, Escape ⇒
 *   τίποτα. Χωρίς θέση, το πρόχειρο ξεκινά από το κέντρο της κάτοψης.
 * - **Κ** — κατεύθυνση: η πρόταση από τα βελάκια αποθηκεύει το heading που κάνει το βελάκι να δείχνει στον γείτονα· με
 *   βελάκια που διαφωνούν, η οθόνη το λέει· χωρίς γείτονα με θέση, κανένα κουμπί πρότασης.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import type { TourNode } from '@/types/spatial-tour';

import { TourPlanDirection } from '../TourPlanDirection';
import { TourPlanEditMap } from '../TourPlanEditMap';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values === undefined ? key : `${key}:${JSON.stringify(values)}`) }),
}));

const L0 = { kind: 'local', ordinal: 0 } as const;
const IMAGE = { width: 1000, height: 500, contentHash: 'h1' };
/** 1 pixel = 1 cm ⇒ 0,1 m = 10 pixel · 1 m = 100 pixel. */
const MPP = 0.01;
const at = (id: string, x: number | null, y = 0, links: TourNode['links'] = []): TourNode =>
  ({ id, levelKey: L0, position: x === null ? null : { x, y, z: 0 }, links });

function renderMap(nodes: readonly TourNode[], onPlace = jest.fn()) {
  render(<TourPlanEditMap imageUrl="plan.webp" image={IMAGE} metresPerPixel={MPP} nodes={nodes} selectedNodeId="a"
    headingRad={null} nameOf={(id) => id} onPlace={onPlace} />);
  return { map: screen.getByRole('application'), onPlace };
}

describe('Π — πληκτρολόγιο στον χάρτη', () => {
  it('από τη θέση του σημείου: → δύο φορές και Shift+↓ μία ⇒ Enter αποθηκεύει μία φορά, 20 px δεξιά και 100 px κάτω', () => {
    const { map, onPlace } = renderMap([at('a', 2, -1)]);
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    fireEvent.keyDown(map, { key: 'ArrowDown', shiftKey: true });
    expect(onPlace).not.toHaveBeenCalled();
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(onPlace).toHaveBeenCalledTimes(1);
    const [pixel] = onPlace.mock.calls[0];
    expect(pixel.x).toBeCloseTo(220);
    expect(pixel.y).toBeCloseTo(200);
  });

  it('χωρίς θέση: το πρόχειρο ξεκινά από το κέντρο · Escape ακυρώνει, τίποτα δεν αποθηκεύεται', () => {
    const { map, onPlace } = renderMap([at('a', null)]);
    fireEvent.keyDown(map, { key: 'ArrowUp' });
    fireEvent.keyDown(map, { key: 'Escape' });
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(onPlace).not.toHaveBeenCalled();
    fireEvent.keyDown(map, { key: 'ArrowUp' });
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(onPlace.mock.calls[0][0]).toEqual({ x: 500, y: 240 });
  });

  it('το πρόχειρο δεν βγαίνει ποτέ έξω από την εικόνα', () => {
    const { map, onPlace } = renderMap([at('a', 0, 0)]);
    fireEvent.keyDown(map, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(onPlace.mock.calls[0][0]).toEqual({ x: 0, y: 0 });
  });
});

describe('Κ — κατεύθυνση', () => {
  it('η πρόταση αποθηκεύει το heading που κάνει το βελάκι να δείχνει στον γείτονα', () => {
    // Β ανατολικά (π/2)· το βελάκι στη φωτογραφία σε yaw 0,3 με heading 0 ⇒ πρόταση π/2 − 0,3.
    const a = at('a', 0, 0, [{ toNodeId: 'b', via: 'manual', bearingRad: 0.3 }]);
    const onCommit = jest.fn();
    render(<TourPlanDirection node={a} nodes={[a, at('b', 5, 0)]} headingRad={0} onPreview={jest.fn()} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'spatial-tour:editor.planSuggest' }));
    expect(onCommit.mock.calls[0][0]).toBeCloseTo(Math.PI / 2 - 0.3);
    expect(screen.queryByText(/planSuggestSpread/)).toBeNull();
  });

  it('βελάκια που διαφωνούν πάνω από 10° ⇒ προειδοποίηση', () => {
    const a = at('a', 0, 0, [{ toNodeId: 'b', via: 'manual', bearingRad: 0 }, { toNodeId: 'c', via: 'manual', bearingRad: Math.PI / 2 + 0.6 }]);
    render(<TourPlanDirection node={a} nodes={[a, at('b', 0, 4), at('c', 4, 0)]} headingRad={0} onPreview={jest.fn()} onCommit={jest.fn()} />);
    expect(screen.getByText(/planSuggestSpread/).textContent).toContain('"degrees":17');
  });

  it('χωρίς βελάκι προς γείτονα με θέση ⇒ κανένα κουμπί πρότασης', () => {
    const a = at('a', 0, 0, [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }]);
    render(<TourPlanDirection node={a} nodes={[a, at('b', null)]} headingRad={0} onPreview={jest.fn()} onCommit={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'spatial-tour:editor.planSuggest' })).toBeNull();
  });
});
