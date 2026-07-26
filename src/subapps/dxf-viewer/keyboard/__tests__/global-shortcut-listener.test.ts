/**
 * @tests ADR-711 / ADR-364 §10.15 — ο δομικός φύλακας των global accelerators.
 *
 * Αυτό το αρχείο κλειδώνει το **συμβόλαιο** του wrapper. Η ζωντανή απόδειξη ότι το
 * `Tab` κυκλώνει πλέον μέσα στο lightbox είναι στο ADR-364 §10.15 — το jsdom δεν
 * εκτελεί διαδοχική πλοήγηση focus, οπότε δεν μπορεί να την πιάσει.
 */

import { __resetModalKeyboardScopeForTests, pushModalKeyboardScope } from '@/lib/a11y/keyboard-scope';
import { addGlobalShortcutListener } from '../global-shortcut-listener';

afterEach(() => {
  __resetModalKeyboardScopeForTests();
  document.body.innerHTML = '';
});

function pressTab(target: EventTarget = window): void {
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

describe('addGlobalShortcutListener', () => {
  it('τρέχει κανονικά όταν κανείς δεν κατέχει το πληκτρολόγιο', () => {
    const handler = jest.fn();
    const dispose = addGlobalShortcutListener(handler);

    pressTab();
    expect(handler).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('ΠΑΡΑΙΤΕΙΤΑΙ όσο modal κατέχει το πληκτρολόγιο — η ρίζα των Ε1/Ε4', () => {
    const handler = jest.fn();
    const dispose = addGlobalShortcutListener(handler);
    const release = pushModalKeyboardScope();

    pressTab();
    expect(handler).not.toHaveBeenCalled();

    release();
    pressTab();
    expect(handler).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('παραιτείται όταν πεδίο κειμένου κρατά το focus', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const handler = jest.fn();
    const dispose = addGlobalShortcutListener(handler);

    pressTab(input);
    expect(handler).not.toHaveBeenCalled();
    dispose();
  });

  it('allowWhenEditable: τρέχει σε πεδίο κειμένου, ΑΛΛΑ ποτέ μέσα σε modal', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const handler = jest.fn();
    const dispose = addGlobalShortcutListener(handler, { allowWhenEditable: true });

    // Το `useDimensionKeyboardRouting` ΚΑΤΕΧΕΙ τον χρόνο πληκτρολόγησης (Enter με
    // focus στο Dynamic Input) — καθολικός φύλακας εκεί θα ήταν παλινδρόμηση.
    pressTab(input);
    expect(handler).toHaveBeenCalledTimes(1);

    const release = pushModalKeyboardScope();
    pressTab(input);
    expect(handler).toHaveBeenCalledTimes(1); // το modal υπερισχύει πάντα

    release();
    dispose();
  });

  it('η αποδέσμευση αφαιρεί τον listener', () => {
    const handler = jest.fn();
    addGlobalShortcutListener(handler)();
    pressTab();
    expect(handler).not.toHaveBeenCalled();
  });
});
