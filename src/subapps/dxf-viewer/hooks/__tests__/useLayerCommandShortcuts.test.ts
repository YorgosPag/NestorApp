/**
 * ADR-711 Boy-Scout + N.18 — `useLayerCommandShortcuts`.
 *
 * Το hook δεν είχε **καμία** κάλυψη όταν άλλαξε (2026-07-26). Δύο πράγματα άλλαξαν και
 * το καθένα έχει έναν συγκεκριμένο τρόπο να χαλάσει σιωπηλά:
 *
 *  1. **Μετανάστευση στον wrapper** (ADR-711): ο τοπικός `isInputFocused` — που ρωτούσε
 *     μόνο «γράφει ο χρήστης;», και το ρωτούσε ελλιπώς — αντικαταστάθηκε από το
 *     `addGlobalShortcutListener`, που ρωτά **και** «κατέχει modal το πληκτρολόγιο;».
 *     Αν η μετανάστευση γίνει λάθος, το `Ctrl+Shift+I` ξαναρχίζει να απομονώνει στρώσεις
 *     πίσω από ανοιχτό dialog — δηλαδή το ελάττωμα Ε1/Ε4 του ADR-364 §10.15.
 *  2. **Συγχώνευση των δύο isolate διαδρομών** (jscpd 9 γρ./57 tokens): έγιναν μία με
 *     όρισμα `inverse`. Ο τρόπος να χαλάσει είναι **αντιστροφή πολικότητας** — το
 *     `Ctrl+Shift+I` να τρέχει την inverse εντολή. Καμία γραμμή δεν φαίνεται λάθος.
 *
 * @see src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts
 */
import { renderHook } from '@testing-library/react';

import {
  __resetModalKeyboardScopeForTests,
  pushModalKeyboardScope,
} from '@/lib/a11y/keyboard-scope';

import { useLayerCommandShortcuts } from '../useLayerCommandShortcuts';
import {
  LayerIsolateCommand,
  LayerIsolateInverseCommand,
  LayerUnisolateCommand,
} from '../../core/commands/layer';

jest.mock('../../stores/LayerStore', () => ({
  // Μη-κενές στρώσεις: αλλιώς ο φύλακας «καμία στρώση» κόβει πριν το dispatch και το
  // test θα περνούσε χωρίς να έχει δοκιμάσει τίποτα.
  getAllLayers: (): ReadonlyArray<{ id: string }> => [{ id: 'layer-1' }],
}));

// Το `layer-isolate-resolver` μένει **πραγματικό** επίτηδες: ένα mock του
// `resolveLayerIsolateSettings` έσβηνε το `inverseMode` του ίδιου module, που ο
// `LayerIsolateInverseCommand` καλεί στον constructor του — το test έσκαγε μέσα σε
// listener και διαβαζόταν ως «η inverse διαδρομή δεν πυροδοτεί».
jest.mock('../../systems/selection', () => ({
  SelectedEntitiesStore: {
    getSelectedEntityIds: (): ReadonlyArray<string> => [],
  },
}));

function press(key: string, modifiers: { shift?: boolean; alt?: boolean }): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      shiftKey: modifiers.shift === true,
      altKey: modifiers.alt === true,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('useLayerCommandShortcuts', () => {
  let execute: jest.Mock;

  beforeEach(() => {
    __resetModalKeyboardScopeForTests();
    execute = jest.fn();
  });

  afterEach(() => {
    __resetModalKeyboardScopeForTests();
  });

  function mount(): ReturnType<typeof renderHook> {
    return renderHook(() =>
      useLayerCommandShortcuts({
        currentScene: null,
        commandHistory: { execute } as unknown as Parameters<
          typeof useLayerCommandShortcuts
        >[0]['commandHistory'],
      }),
    );
  }

  // Η πολικότητα, και προς τις δύο κατευθύνσεις. Ένα test μόνο για το ένα πλήκτρο θα
  // περνούσε ακόμη κι αν οι δύο εντολές είχαν ανταλλάξει θέσεις.
  it('Ctrl+Shift+I τρέχει την ΚΑΝΟΝΙΚΗ isolate εντολή', () => {
    mount();
    press('I', { shift: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBeInstanceOf(LayerIsolateCommand);
    expect(execute.mock.calls[0][0]).not.toBeInstanceOf(LayerIsolateInverseCommand);
  });

  it('Ctrl+Alt+I τρέχει την ΑΝΤΙΣΤΡΟΦΗ isolate εντολή', () => {
    mount();
    press('I', { alt: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBeInstanceOf(LayerIsolateInverseCommand);
  });

  it('Ctrl+Shift+U τρέχει unisolate (η συγχώνευση δεν κατάπιε τις άλλες διαδρομές)', () => {
    mount();
    press('U', { shift: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBeInstanceOf(LayerUnisolateCommand);
  });

  // 🔴 Η καρδιά της μετανάστευσης του ADR-711. Χωρίς τον wrapper αυτό το test είναι
  // κόκκινο, και το ελάττωμα είναι: απομόνωση στρώσεων πίσω από ανοιχτό dialog.
  it('ΔΕΝ δρα όσο modal κατέχει το πληκτρολόγιο', () => {
    mount();
    const release = pushModalKeyboardScope();

    press('I', { shift: true });
    press('U', { shift: true });
    expect(execute).not.toHaveBeenCalled();

    release();
    press('I', { shift: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('αποδεσμεύει τον listener στο unmount', () => {
    const view = mount();
    view.unmount();

    press('I', { shift: true });
    expect(execute).not.toHaveBeenCalled();
  });
});
