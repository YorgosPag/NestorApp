/**
 * @fileoverview **Η ΑΝΙΧΝΕΥΣΗ ΣΤΟΝ ΕΠΕΞΕΡΓΑΣΤΗ** (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14) — προθέρμανση με το ΜΕΓΑΛΥΤΕΡΟ παράγωγο, η
 * κλίμακα/το πλάτος του ΠΡΩΤΟΤΥΠΟΥ μπαίνουν από την κάτοψη, getter τη στιγμή της κλήσης (ADR-040), `dispose` στην αποχώρηση.
 */

import { act, renderHook } from '@testing-library/react';

import type { PlanDetectRequest } from '@/lib/spatial-tour/space-detect/space-detect-plan';
import type { TourViewerPlan } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import { PLAN_LARGEST_CSS_WIDTH, type TourPanoramaSource } from '../../viewer/tour-panorama-source';
import { useSpaceDetector } from '../useSpaceDetector';

const load = jest.fn(async () => ({ kind: 'ok' as const, value: { width: 1, height: 1 } }));
const detect = jest.fn(async (_url: string, _request: PlanDetectRequest) => ({ kind: 'superseded' as const }));
const dispose = jest.fn();

jest.mock('@/lib/spatial-tour/space-detect/space-detect-client', () => ({
  createSpaceDetector: () => ({ load, detect, dispose }),
}));

const planImageUrl = jest.fn((plan: TourViewerPlan, cssWidth: number) => `plan:${plan.image.contentHash}:${cssWidth}`);
const SOURCE = { tiles: null, base: jest.fn(), planImageUrl } as unknown as TourPanoramaSource;
const plan = (hash: string, metresPerPixel: number | null): TourViewerPlan =>
  ({ fileId: 'f', source: 'engineer', image: { width: 1200, height: 900, contentHash: hash }, metresPerPixel });
const ASK = { seed: { x: 1, y: -1 }, otherStops: [], separations: [] };

beforeEach(() => jest.clearAllMocks());

it('προθέρμανση με το ΜΕΓΑΛΥΤΕΡΟ παράγωγο · η ερώτηση παίρνει κλίμακα + πλάτος του ΠΡΩΤΟΤΥΠΟΥ', async () => {
  const { result } = renderHook(() => useSpaceDetector(SOURCE, plan('h1', 0.0156)));
  expect(planImageUrl).toHaveBeenCalledWith(expect.anything(), PLAN_LARGEST_CSS_WIDTH);
  expect(load).toHaveBeenCalledWith(`plan:h1:${PLAN_LARGEST_CSS_WIDTH}`);
  await act(async () => { await result.current.detect(ASK); });
  expect(detect).toHaveBeenCalledWith(`plan:h1:${PLAN_LARGEST_CSS_WIDTH}`, { ...ASK, metresPerPixel: 0.0156, imageWidth: 1200 });
});

it('νέος όροφος ⇒ νέα προθέρμανση και η ΙΔΙΑ συνάρτηση `detect` ρωτά τη ΝΕΑ κάτοψη (getter, όχι στιγμιότυπο)', async () => {
  const { result, rerender } = renderHook(({ p }) => useSpaceDetector(SOURCE, p), { initialProps: { p: plan('h1', 0.02) } });
  const first = result.current.detect;
  rerender({ p: plan('h2', 0.01) });
  expect(load).toHaveBeenLastCalledWith(`plan:h2:${PLAN_LARGEST_CSS_WIDTH}`);
  await act(async () => { await first(ASK); });
  expect(detect).toHaveBeenLastCalledWith(`plan:h2:${PLAN_LARGEST_CSS_WIDTH}`, expect.objectContaining({ metresPerPixel: 0.01 }));
});

it('χωρίς κλίμακα ⇒ καμία προθέρμανση, `plan-unavailable` · αποχώρηση ⇒ dispose', async () => {
  const { result, unmount } = renderHook(() => useSpaceDetector(SOURCE, plan('h1', null)));
  expect(load).not.toHaveBeenCalled();
  await expect(result.current.detect(ASK)).resolves.toEqual({ kind: 'failed', error: 'plan-unavailable' });
  unmount();
  expect(dispose).toHaveBeenCalled();
});
