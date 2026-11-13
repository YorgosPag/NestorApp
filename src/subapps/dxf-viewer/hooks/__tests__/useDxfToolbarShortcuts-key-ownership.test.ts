/**
 * ADR-929 Δ21 (δ) · ADR-711 §5.6 — ιδιοκτησία πλήκτρων: τα εργαλεία του καμβά παραιτούνται όταν το πλήκτρο ανήκει σε
 * λίστα επιλογής (`role="option"` / `role="listbox"`).
 *
 * 🔴 ΜΕΤΡΗΜΕΝΟ live (DOC014, nestorconstruct.gr): με εστίαση σε γραμμή της λίστας «Τι διάβασα» το N έκανε ΚΑΙ «δεν είναι
 * διάσταση» ΚΑΙ εργαλείο «Πολύγωνο». Ο φύλακας του hook ρωτούσε μόνο «γράφει ο χρήστης κείμενο;» (ερώτηση 1)· τώρα ο
 * listener περνά από τον ΕΝΑ wrapper (`addGlobalShortcutListener`), που ρωτά και «θα καταναλώσει κάποιος τον χαρακτήρα;».
 *
 * Η αντίστροφη απόδειξη (στόχος ο καμβάς ⇒ το εργαλείο ΑΛΛΑΖΕΙ) είναι η μισή δουλειά: ένας φύλακας που απορρίπτει τα πάντα
 * θα περνούσε όλα τα υπόλοιπα.
 *
 * @see ../useDxfToolbarShortcuts.ts
 * @see ../../keyboard/global-shortcut-listener.ts
 */

import { renderHook } from '@testing-library/react';
import { useDxfToolbarShortcuts } from '../useDxfToolbarShortcuts';
import { DXF_TIMING } from '../../config/dxf-timing';

function press(target: EventTarget, key: string, code: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('useDxfToolbarShortcuts — ιδιοκτησία πλήκτρων σε λίστα επιλογής (ADR-711 §5.6)', () => {
  let elements: HTMLElement[] = [];

  function mount(role: 'option' | 'listbox' | null): HTMLElement {
    const el = document.createElement(role === 'option' ? 'li' : 'div');
    if (role !== null) el.setAttribute('role', role);
    el.tabIndex = -1;
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  function mountShortcuts(onToolChange: jest.Mock) {
    return renderHook(() => useDxfToolbarShortcuts('wall', onToolChange, jest.fn()));
  }

  afterEach(() => {
    for (const el of elements) el.remove();
    elements = [];
    jest.useRealTimers();
  });

  it.each(['option', 'listbox'] as const)('🔴 N με στόχο role="%s" ⇒ το εργαλείο ΔΕΝ γίνεται «Πολύγωνο»', (role) => {
    const onToolChange = jest.fn();
    mountShortcuts(onToolChange);
    const event = press(mount(role), 'n', 'KeyN');
    expect(onToolChange).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('🔴 ΑΝΤΙΣΤΡΟΦΗ: N με στόχο τον καμβά ⇒ το εργαλείο ΓΙΝΕΤΑΙ «Πολύγωνο»', () => {
    const onToolChange = jest.fn();
    mountShortcuts(onToolChange);
    press(mount(null), 'n', 'KeyN');
    expect(onToolChange).toHaveBeenCalledWith('polygon');
  });

  it('S (αρχή chord) με στόχο role="option" ⇒ ούτε chord ούτε «Επιλογή» μετά τη λήξη', () => {
    jest.useFakeTimers();
    const onToolChange = jest.fn();
    mountShortcuts(onToolChange);
    const event = press(mount('option'), 's', 'KeyS');
    jest.advanceTimersByTime(DXF_TIMING.gesture.CHORD_TIMEOUT + 50);
    expect(event.defaultPrevented).toBe(false);
    expect(onToolChange).not.toHaveBeenCalled();
  });

  it('ΑΝΤΙΣΤΡΟΦΗ: S στον καμβά ⇒ «Επιλογή» μετά τη λήξη του chord (οι chords του BIM δεν έσπασαν)', () => {
    jest.useFakeTimers();
    const onToolChange = jest.fn();
    mountShortcuts(onToolChange);
    press(mount(null), 's', 'KeyS');
    jest.advanceTimersByTime(DXF_TIMING.gesture.CHORD_TIMEOUT + 50);
    expect(onToolChange).toHaveBeenCalledWith('select');
  });

  it('ΑΝΤΙΣΤΡΟΦΗ: S→T στον καμβά ⇒ «Σκάλα» (chord δύο πλήκτρων)', () => {
    const onToolChange = jest.fn();
    mountShortcuts(onToolChange);
    const canvas = mount(null);
    press(canvas, 's', 'KeyS');
    press(canvas, 't', 'KeyT');
    expect(onToolChange).toHaveBeenCalledWith('stair');
  });
});
