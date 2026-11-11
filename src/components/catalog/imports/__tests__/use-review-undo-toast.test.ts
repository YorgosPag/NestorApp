/**
 * ADR-923 §5.5.2 Β9γ — το toast «Αναίρεση» της ομαδικής πράξης ζει ΟΣΟ το βήμα του είναι στην κορυφή της στοίβας, και το
 * κουμπί του ζητά αναίρεση ΑΥΤΟΥ του βήματος. Η επανάληψη (redo) δεν ξαναδείχνει toast.
 */

import { act, renderHook } from '@testing-library/react';

import { emptyHistory, recordHistory, redoHistory, undoHistory, type History } from '@/lib/spreadsheet/grid-history';
import type { ImportTarget } from '@/subapps/catalog/types/catalog-import';
import type { FieldsStep, ReviewStep } from '../review-history';
import { useReviewUndoToast, type ReviewEntry } from '../use-review-undo-toast';

const notify = jest.fn();
const dismiss = jest.fn();
const mockNotifications = { notify, dismiss };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => mockNotifications }));
const mockT = (key: string) => key;
jest.mock('../import-text', () => ({ useImportText: () => ({ t: mockT }) }));
const mockName = (label: { kind: string; count: number } | null) => (label ? `${label.kind}·${label.count}` : null);
jest.mock('../use-review-step-name', () => ({ useStepName: () => mockName }));

const TARGET: ImportTarget = { kind: 'modelCode' };
const entry = (count: number): ReviewEntry => {
  const side: FieldsStep = { kind: 'fields', proposalId: 'p1', label: { kind: 'acceptRow', target: TARGET, count }, marks: [] };
  return { before: side, after: side };
};

interface Props {
  readonly history: History<ReviewStep>;
  readonly announce: ReviewEntry | null;
}

function setup(undo: (entry: ReviewEntry) => void = jest.fn()) {
  const initialProps: Props = { history: emptyHistory<ReviewStep>(), announce: null };
  return renderHook(({ history, announce }: Props) => useReviewUndoToast('batch_1', history, announce, undo), { initialProps });
}

beforeEach(() => { notify.mockClear(); dismiss.mockClear(); });

describe('useReviewUndoToast', () => {
  it('ομαδικό βήμα στην κορυφή ⇒ ΕΝΑ toast με το όνομά του· το κουμπί αναιρεί ΑΥΤΟ το βήμα', () => {
    const undo = jest.fn();
    const step = entry(5);
    const { rerender } = setup(undo);
    act(() => rerender({ history: recordHistory(emptyHistory<ReviewStep>(), step), announce: step }));
    expect(notify).toHaveBeenCalledTimes(1);
    const [message, options] = notify.mock.calls[0];
    expect(message).toBe('acceptRow·5');
    expect(options.actions[0].label).toBe('review.history.undo');
    options.actions[0].onClick();
    expect(undo).toHaveBeenCalledWith(step);
  });

  it('🔑 το βήμα φεύγει από την κορυφή (Ctrl+Z) ⇒ το toast φεύγει· η επανάληψη ΔΕΝ το ξαναδείχνει', () => {
    const step = entry(3);
    const recorded = recordHistory(emptyHistory<ReviewStep>(), step);
    const { rerender } = setup();
    act(() => rerender({ history: recorded, announce: step }));
    const undone = undoHistory(recorded).history;
    act(() => rerender({ history: undone, announce: step }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    act(() => rerender({ history: redoHistory(undone).history, announce: step }));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('νέα πράξη πάνω από το βήμα ⇒ το παλιό toast φεύγει (ένα τη φορά)', () => {
    const step = entry(2);
    const recorded = recordHistory(emptyHistory<ReviewStep>(), step);
    const { rerender } = setup();
    act(() => rerender({ history: recorded, announce: step }));
    act(() => rerender({ history: recordHistory(recorded, entry(1)), announce: step }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('η οθόνη φεύγει ⇒ το toast φεύγει (η στοίβα ζει μόνο στην οθόνη)', () => {
    const step = entry(2);
    const { rerender, unmount } = setup();
    act(() => rerender({ history: recordHistory(emptyHistory<ReviewStep>(), step), announce: step }));
    unmount();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
