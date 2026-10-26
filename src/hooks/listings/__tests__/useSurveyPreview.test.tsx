/**
 * ADR-920 Β4.8 5γ — ΑΓΚΥΡΕΣ της κατάστασης της προεπισκόπησης, με previewer που ελέγχει το test (πότε και τι απαντά).
 *
 *   Σ1  ο ΠΑΛΙΟΣ χάρτης μένει ορατός όσο έρχεται ο νέος · η ετυμηγορία μόνο για τα ΤΡΕΧΟΝΤΑ σημεία
 *   Σ2  αποτυχία της τρέχουσας ερώτησης ⇒ `failed`, ποτέ «ενημερώνεται» για πάντα · `disposed` ΔΕΝ είναι αποτυχία
 *   Σ3  ίδια σημεία (ίδιος πίνακας) ⇒ ίδιο κλειδί · χωρίς σημεία ⇒ καμία ερώτηση, τίποτα στην οθόνη
 *   Σ4  unmount ⇒ ο Worker τερματίζεται
 */

import { act, renderHook } from '@testing-library/react';

import type { TopoPoint } from '@/lib/terrain/terrain-types';
import type { SurveyPreviewQuestion, SurveyPreviewer } from '@/lib/terrain/survey-import/survey-preview-client';
import { previewReplyOf } from '@/lib/terrain/survey-import/__tests__/survey-preview-fixture';
import type { SurveyPreviewReply } from '@/lib/terrain/survey-import/survey-preview-host';
import { WORKER_RPC_DISPOSED } from '@/lib/workers/worker-rpc-client';
import type { WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';

import { useSurveyPreview } from '../useSurveyPreview';

interface Asked {
  readonly question: SurveyPreviewQuestion;
  readonly answer: (result: WorkerRpcResult<SurveyPreviewReply>) => void;
}

const mockAsked: Asked[] = [];
const mockPreviewer: SurveyPreviewer = {
  preview: (question) => new Promise((answer) => { mockAsked.push({ question, answer }); }),
  warm: jest.fn(),
  dispose: jest.fn(),
};

jest.mock('@/lib/terrain/survey-import/survey-preview-client', () => ({ createSurveyPreviewer: () => mockPreviewer }));

/** Every reply is a REAL one (the real handler), answering the question actually asked. */
const replyTo = (question: SurveyPreviewQuestion): SurveyPreviewReply => previewReplyOf(question.key, question.widthPx);

async function answer(index: number, result: WorkerRpcResult<SurveyPreviewReply>): Promise<void> {
  await act(async () => { mockAsked[index]!.answer(result); });
}

const A: readonly TopoPoint[] = [{ x: 1, y: 1, z: 1 }];
const B: readonly TopoPoint[] = [{ x: 2, y: 2, z: 2 }];

beforeEach(() => {
  mockAsked.length = 0;
  jest.clearAllMocks();
});

describe('useSurveyPreview', () => {
  it('Σ1 ο παλιός χάρτης μένει όσο έρχεται ο νέος · ετυμηγορία μόνο για τα τρέχοντα σημεία', async () => {
    const hook = renderHook(({ points }) => useSurveyPreview(points, 480), { initialProps: { points: A } });
    expect(hook.result.current).toMatchObject({ preparation: null, model: null, updating: true, failed: false });
    const first = replyTo(mockAsked[0]!.question);
    await answer(0, { kind: 'ok', value: first });
    expect(hook.result.current.preparation).toBe(first.preparation);
    expect(hook.result.current.model).toBe(first.model);
    expect(hook.result.current.updating).toBe(false);

    hook.rerender({ points: B });
    expect(hook.result.current.preparation).toBeNull();
    expect(hook.result.current.model).toBe(first.model);
    expect(hook.result.current.updating).toBe(true);
    const second = replyTo(mockAsked[1]!.question);
    await answer(1, { kind: 'ok', value: second });
    expect(hook.result.current.preparation).toBe(second.preparation);
    expect(hook.result.current.model).toBe(second.model);
    expect(hook.result.current.updating).toBe(false);
  });

  it('Σ1β η απάντηση της ΠΑΛΙΑΣ ερώτησης που φτάνει μετά την αλλαγή δείχνεται ως παλιός χάρτης — ποτέ ως ετυμηγορία', async () => {
    const hook = renderHook(({ points }) => useSurveyPreview(points, null), { initialProps: { points: A } });
    hook.rerender({ points: B });
    const old = replyTo(mockAsked[0]!.question);
    await answer(0, { kind: 'ok', value: old });
    expect(hook.result.current.model).toBe(old.model);
    expect(hook.result.current.preparation).toBeNull();
    expect(hook.result.current.updating).toBe(true);
  });

  it('Σ2 αποτυχία ⇒ failed (όχι «ενημερώνεται» για πάντα) · disposed δεν είναι αποτυχία', async () => {
    const left = renderHook(() => useSurveyPreview(A, null));
    await answer(0, { kind: 'failed', error: WORKER_RPC_DISPOSED });
    expect(left.result.current).toMatchObject({ updating: true, failed: false });

    const crashed = renderHook(() => useSurveyPreview(B, null));
    await answer(1, { kind: 'failed', error: 'worker-crashed' });
    expect(crashed.result.current).toMatchObject({ updating: false, failed: true, preparation: null });
  });

  it('Σ3 ίδιος πίνακας ⇒ ίδιο κλειδί · κενά σημεία ⇒ καμία ερώτηση', () => {
    const hook = renderHook(({ points, width }) => useSurveyPreview(points, width), { initialProps: { points: A, width: 320 } });
    hook.rerender({ points: A, width: 640 });
    expect(mockAsked.map((a) => a.question.key)).toEqual([mockAsked[0]!.question.key, mockAsked[0]!.question.key]);

    const empty = renderHook(() => useSurveyPreview([], 320));
    expect(mockAsked).toHaveLength(2);
    expect(empty.result.current).toMatchObject({ preparation: null, model: null, updating: false, failed: false });
  });

  it('Σ4 unmount ⇒ ο Worker τερματίζεται', () => {
    renderHook(() => useSurveyPreview(A, null)).unmount();
    expect(mockPreviewer.dispose).toHaveBeenCalled();
  });
});
