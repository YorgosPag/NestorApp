/**
 * ADR-931 §6.2 · Β2.1 — το toast «Αναίρεση» της απόρριψης πρότασης: ΕΝΑ ανά πρόταση, και φεύγει μόλις το κλειδί πάψει
 * να είναι απορριφθέν (από ΟΠΟΙΟΝ δρόμο). Η μονιμότητα του ADR-866 §2.10 Β2 ΔΕΝ αλλάζει: καμία διάρκεια.
 */

import { renderHook } from '@testing-library/react';

import { suggestionUndoToastId, useSuggestionUndoToasts } from '../useSuggestionUndoToasts';

const notify = jest.fn();
const dismiss = jest.fn();
// Σταθερή αναφορά (όπως ο provider) — αλλιώς το effect θα ξανάτρεχε σε κάθε render για λάθος λόγο.
const mockNotifications = { notify, dismiss };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => mockNotifications }));

const BUILDING = 'bldg_1';
const STAIR = 'stairwell@building';
const ELEVATOR = 'elevator@building';

const toastFor = (key: string, onUndo: () => void = jest.fn()) => ({ key, message: `msg ${key}`, undoLabel: 'Αναίρεση', onUndo });

function setup(initial: readonly string[]) {
  return renderHook(({ keys }) => useSuggestionUndoToasts(BUILDING, new Set(keys)), { initialProps: { keys: initial } });
}

beforeEach(() => { notify.mockClear(); dismiss.mockClear(); });

describe('useSuggestionUndoToasts', () => {
  it('δείχνει το toast με σταθερό id ανά (κτίριο, κλειδί), κουμπί «Αναίρεση» και ΚΑΜΙΑ διάρκεια (μένει — ADR-866 Β2)', () => {
    const onUndo = jest.fn();
    const { result } = setup([STAIR]);
    result.current(toastFor(STAIR, onUndo));

    expect(notify).toHaveBeenCalledTimes(1);
    const [message, options] = notify.mock.calls[0];
    expect(message).toBe(`msg ${STAIR}`);
    expect(options.id).toBe(suggestionUndoToastId(BUILDING, STAIR));
    expect(options.duration).toBeUndefined();
    options.actions[0].onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('ξανά απόρριψη της ίδιας πρότασης ⇒ ΙΔΙΟ id (αντικατάσταση, όχι δεύτερο toast στη στοίβα)', () => {
    const { result } = setup([STAIR]);
    result.current(toastFor(STAIR));
    result.current(toastFor(STAIR));
    expect(notify.mock.calls[0][1].id).toBe(notify.mock.calls[1][1].id);
  });

  it('το κλειδί έπαψε να είναι απορριφθέν (αναίρεση · λίστα · «όλων» · άλλος άνθρωπος) ⇒ το toast φεύγει', () => {
    const { result, rerender } = setup([STAIR, ELEVATOR]);
    result.current(toastFor(STAIR));
    result.current(toastFor(ELEVATOR));

    rerender({ keys: [ELEVATOR] });
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(suggestionUndoToastId(BUILDING, STAIR));

    rerender({ keys: [] });
    expect(dismiss).toHaveBeenCalledTimes(2);
    expect(dismiss).toHaveBeenLastCalledWith(suggestionUndoToastId(BUILDING, ELEVATOR));
  });

  it('όσο το κλειδί μένει απορριφθέν ⇒ το toast ΜΕΝΕΙ (καμία απόσυρση σε άσχετη αλλαγή)', () => {
    const { result, rerender } = setup([STAIR]);
    result.current(toastFor(STAIR));
    rerender({ keys: [STAIR, ELEVATOR] });
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('ο άνθρωπος το έκλεισε μόνος του ⇒ δεν το ξανακλείνουμε όταν επανέλθει η πρόταση', () => {
    const { result, rerender } = setup([STAIR]);
    result.current(toastFor(STAIR));
    notify.mock.calls[0][1].onCancel();
    rerender({ keys: [] });
    expect(dismiss).not.toHaveBeenCalled();
  });
});
