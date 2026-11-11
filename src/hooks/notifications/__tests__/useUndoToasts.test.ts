/**
 * ADR-923 §5.5.2 Β9γ — ο ΕΝΑΣ μηχανισμός toast «Αναίρεση»: μένει (καμία διάρκεια, ADR-866 §2.10 Β2), φεύγει μόλις το κλειδί
 * πάψει να είναι αναιρέσιμο, κρατά το `id` όπως δόθηκε όταν αλλάξει το εύρος, και (κατ' επιλογή) δεν επιζεί της οθόνης.
 * Η συμπεριφορά των κοινοχρήστων (ADR-931) φυλάσσεται χωριστά στο `useSuggestionUndoToasts.test.ts`.
 */

import { act, renderHook } from '@testing-library/react';

import { undoToastId, useUndoToasts, type UndoToastOptions } from '../useUndoToasts';

const notify = jest.fn();
const dismiss = jest.fn();
// Σταθερή αναφορά (όπως ο provider) — αλλιώς το effect θα ξανάτρεχε σε κάθε render για λάθος λόγο.
const mockNotifications = { notify, dismiss };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => mockNotifications }));

const toastFor = (key: string, onUndo: () => void = jest.fn()) => ({ key, message: `msg ${key}`, undoLabel: 'Αναίρεση', onUndo });

function setup(scope: string, keys: readonly string[], options?: UndoToastOptions) {
  return renderHook(
    ({ scope: currentScope, keys: currentKeys }) => useUndoToasts(currentScope, new Set(currentKeys), options),
    { initialProps: { scope, keys } },
  );
}

beforeEach(() => { notify.mockClear(); dismiss.mockClear(); });

describe('useUndoToasts', () => {
  it('σταθερό id = εύρος + κλειδί, κουμπί «Αναίρεση», ΚΑΜΙΑ διάρκεια', () => {
    const onUndo = jest.fn();
    const { result } = setup('batch_1', ['k1']);
    act(() => result.current(toastFor('k1', onUndo)));
    const [message, options] = notify.mock.calls[0];
    expect(message).toBe('msg k1');
    expect(options.id).toBe(undoToastId('batch_1', 'k1'));
    expect(options.duration).toBeUndefined();
    options.actions[0].onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('φεύγει μόλις το κλειδί πάψει να είναι αναιρέσιμο — από οποιονδήποτε δρόμο', () => {
    const { result, rerender } = setup('batch_1', ['k1']);
    act(() => result.current(toastFor('k1')));
    rerender({ scope: 'batch_1', keys: [] });
    expect(dismiss).toHaveBeenCalledWith(undoToastId('batch_1', 'k1'));
  });

  it('🔑 αλλαγή εύρους: το παλιό toast αποσύρεται με το ΔΙΚΟ ΤΟΥ id, όχι με το νέο εύρος', () => {
    const { result, rerender } = setup('batch_1', ['k1']);
    act(() => result.current(toastFor('k1')));
    rerender({ scope: 'batch_2', keys: [] });
    expect(dismiss).toHaveBeenCalledWith(undoToastId('batch_1', 'k1'));
    expect(dismiss).not.toHaveBeenCalledWith(undoToastId('batch_2', 'k1'));
  });

  it('κλείσιμο από τον χρήστη (×) ⇒ δεν ξανα-αποσύρεται αργότερα', () => {
    const { result, rerender } = setup('batch_1', ['k1']);
    act(() => result.current(toastFor('k1')));
    notify.mock.calls[0][1].onCancel();
    rerender({ scope: 'batch_1', keys: [] });
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('`retireOnUnmount`: η οθόνη φεύγει ⇒ φεύγει και το toast· χωρίς τη σημαία ⇒ μένει (συμπεριφορά κοινοχρήστων)', () => {
    const owned = setup('batch_1', ['k1'], { retireOnUnmount: true });
    act(() => owned.result.current(toastFor('k1')));
    owned.unmount();
    expect(dismiss).toHaveBeenCalledWith(undoToastId('batch_1', 'k1'));

    dismiss.mockClear();
    const kept = setup('bldg_1', ['k1']);
    act(() => kept.result.current(toastFor('k1')));
    kept.unmount();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
