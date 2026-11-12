/**
 * @jest-environment jsdom
 *
 * ADR-929 Δ21 (δ) βήμα 1 — ο κάτοχος των object URL των μικρογραφιών:
 *   · μία μικρογραφία ανά κείμενο της ανάγνωσης της μηχανής, από τον provider του ορόφου, με το πλαίσιο + περιθώριο·
 *   · νέα ανάγνωση ή αποσύνδεση ⇒ ΚΑΘΕ URL ανακαλείται· μικρογραφία που αποτυγχάνει απλώς λείπει.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { PlanReadingOutcome, PlanText } from '../../bim/plan-recognition/plan-recognition-types';
import { PLAN_READ_THUMB_MAX_EDGE_PX, planReadThumbRect } from '../../systems/plan-recognition/plan-read-values';

const getRegionImage = jest.fn();
jest.mock('../../floorplan-background/stores/floorplanBackgroundStore', () => ({
  getFloorProvider: (floorId: string) => (floorId === 'flr' ? { getRegionImage } : null),
}));

// eslint-disable-next-line import/first -- μετά το jest.mock
import { usePlanReadValueThumbnails } from '../usePlanReadValueThumbnails';

const text = (id: string, x: number): PlanText => ({
  id, kind: 'dimension', raw: id, rect: { minX: x, minY: 0, maxX: x + 40, maxY: 10 }, confidence: { score: 0.9, factors: {} },
});
const reading = (texts: readonly PlanText[]): PlanReadingOutcome => ({
  status: 'read',
  reading: { model: 'm', schemaVersion: 1, texts, dimensions: [], writtenScale: null, rooms: [], openings: [] },
});

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  getRegionImage.mockReset();
  getRegionImage.mockImplementation(async () => new Blob(['png']));
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true, value: () => { const url = `blob:${created.length + 1}`; created.push(url); return url; },
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: (url: string) => { revoked.push(url); } });
});

describe('usePlanReadValueThumbnails', () => {
  it('μία μικρογραφία ανά κείμενο, με το πλαίσιο + περιθώριο και το όριο px', async () => {
    const r1 = reading([text('t1', 0), text('t2', 100)]);
    const { result } = renderHook(() => usePlanReadValueThumbnails('flr', r1));
    await waitFor(() => expect(result.current.size).toBe(2));
    expect([...result.current]).toEqual([['t1', 'blob:1'], ['t2', 'blob:2']]);
    expect(getRegionImage).toHaveBeenCalledWith(planReadThumbRect(text('t2', 100).rect), PLAN_READ_THUMB_MAX_EDGE_PX);
  });

  it('νέα ανάγνωση ⇒ τα παλιά URL ανακαλούνται· αποσύνδεση ⇒ και τα νέα', async () => {
    const { result, rerender, unmount } = renderHook(({ r }) => usePlanReadValueThumbnails('flr', r), {
      initialProps: { r: reading([text('t1', 0)]) },
    });
    await waitFor(() => expect(result.current.size).toBe(1));
    rerender({ r: reading([text('t9', 0)]) });
    expect(revoked).toEqual(['blob:1']);
    await waitFor(() => expect(result.current.get('t9')).toBe('blob:2'));
    unmount();
    expect(revoked).toEqual(['blob:1', 'blob:2']);
  });

  it('μικρογραφία που αποτυγχάνει ή επιστρέφει null απλώς λείπει· χωρίς provider ή ανάγνωση ⇒ άδειο', async () => {
    getRegionImage.mockImplementationOnce(async () => { throw new Error('decode'); }).mockImplementationOnce(async () => null);
    const three = reading([text('t1', 0), text('t2', 50), text('t3', 100)]);
    const { result } = renderHook(() => usePlanReadValueThumbnails('flr', three));
    await waitFor(() => expect(result.current.size).toBe(1));
    expect([...result.current.keys()]).toEqual(['t3']);
    const none = renderHook(() => usePlanReadValueThumbnails('other', reading([text('t1', 0)])));
    await act(async () => { await Promise.resolve(); });
    expect(none.result.current.size).toBe(0);
    expect(renderHook(() => usePlanReadValueThumbnails('flr', null)).result.current.size).toBe(0);
  });
});
