/**
 * ADR-923 §5.10.4 Β1 — πρόθεση πλήκτρων του γενικού πλέγματος (Excel · APG grid).
 */
import { gridClipboardScope, resolveGridKeyIntent, type GridEditMode, type GridKeyModifiers } from '../grid-key-intent';

const NONE: GridKeyModifiers = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };
const mod = (over: Partial<GridKeyModifiers>): GridKeyModifiers => ({ ...NONE, ...over });
const intent = (key: string, mode: GridEditMode, over: Partial<GridKeyModifiers> = {}) => resolveGridKeyIntent(key, mod(over), mode);

describe('resolveGridKeyIntent', () => {
  it('βέλη: nav κινεί · Shift επεκτείνει (μόνο σε nav) · enter δεσμεύει και κινεί · edit ανήκει στο πεδίο', () => {
    expect(intent('ArrowDown', 'nav')).toEqual({ kind: 'move', move: 'down' });
    expect(intent('ArrowDown', 'nav', { shiftKey: true })).toEqual({ kind: 'extend', move: 'down' });
    expect(intent('ArrowDown', 'enter', { shiftKey: true })).toEqual({ kind: 'move', move: 'down' });
    expect(intent('ArrowLeft', 'edit')).toEqual({ kind: 'passthrough' });
  });

  it('Ctrl+βέλος = άκρη δεδομένων · Ctrl+Shift+βέλος επεκτείνει ως εκεί', () => {
    expect(intent('ArrowRight', 'nav', { ctrlKey: true })).toEqual({ kind: 'move', move: 'edgeRight' });
    expect(intent('ArrowUp', 'nav', { metaKey: true, shiftKey: true })).toEqual({ kind: 'extend', move: 'edgeUp' });
  });

  it('Tab / Enter δεσμεύουν σε κάθε κατάσταση · Alt+Enter καταπίνεται (μονογραμμική τιμή)', () => {
    for (const mode of ['nav', 'enter', 'edit'] as const) {
      expect(intent('Tab', mode)).toEqual({ kind: 'move', move: 'next' });
      expect(intent('Tab', mode, { shiftKey: true })).toEqual({ kind: 'move', move: 'previous' });
      expect(intent('Enter', mode)).toEqual({ kind: 'move', move: 'commitDown' });
      expect(intent('Enter', mode, { shiftKey: true })).toEqual({ kind: 'move', move: 'commitUp' });
    }
    expect(intent('Enter', 'edit', { altKey: true })).toEqual({ kind: 'suppress' });
  });

  it('Esc δύο σταδίων: σε γραφή ακυρώνει · σε πλοήγηση ΔΕΝ είναι δικό μας (κλείνει ο διάλογος)', () => {
    expect(intent('Escape', 'enter')).toEqual({ kind: 'cancel' });
    expect(intent('Escape', 'edit')).toEqual({ kind: 'cancel' });
    expect(intent('Escape', 'nav')).toEqual({ kind: 'passthrough' });
  });

  it('F2: nav → edit · edit ⇄ enter', () => {
    expect(intent('F2', 'nav')).toEqual({ kind: 'mode', to: 'edit' });
    expect(intent('F2', 'edit')).toEqual({ kind: 'mode', to: 'enter' });
    expect(intent('F2', 'enter')).toEqual({ kind: 'mode', to: 'edit' });
  });

  it('🇬🇷 Ctrl+Z/Y/A/D από τη ΦΥΣΙΚΗ θέση — σε ελληνική διάταξη το key είναι «ζ»', () => {
    expect(intent('ζ', 'nav', { ctrlKey: true, code: 'KeyZ' })).toEqual({ kind: 'history', direction: 'undo' });
    expect(intent('ζ', 'nav', { ctrlKey: true, shiftKey: true, code: 'KeyZ' })).toEqual({ kind: 'history', direction: 'redo' });
    expect(intent('υ', 'nav', { ctrlKey: true, code: 'KeyY' })).toEqual({ kind: 'history', direction: 'redo' });
    expect(intent('α', 'nav', { ctrlKey: true, code: 'KeyA' })).toEqual({ kind: 'selectAll' });
    expect(intent('δ', 'nav', { metaKey: true, code: 'KeyD' })).toEqual({ kind: 'fillDown' });
  });

  it('συντομεύσεις Ctrl σε γραφή ανήκουν στο πεδίο (αναίρεση/επιλογή ΚΕΙΜΕΝΟΥ)', () => {
    expect(intent('z', 'edit', { ctrlKey: true, code: 'KeyZ' })).toEqual({ kind: 'passthrough' });
    expect(intent('a', 'enter', { ctrlKey: true, code: 'KeyA' })).toEqual({ kind: 'passthrough' });
  });

  it('Home/End μόνο σε nav · Ctrl+Home/End στο πλέγμα · PageUp/Down', () => {
    expect(intent('Home', 'nav')).toEqual({ kind: 'move', move: 'rowStart' });
    expect(intent('End', 'nav', { ctrlKey: true })).toEqual({ kind: 'move', move: 'gridEnd' });
    expect(intent('End', 'nav', { shiftKey: true })).toEqual({ kind: 'extend', move: 'rowEnd' });
    expect(intent('Home', 'edit')).toEqual({ kind: 'passthrough' });
    expect(intent('PageDown', 'nav')).toEqual({ kind: 'move', move: 'pageDown' });
  });

  it('Delete/Backspace αδειάζουν μόνο σε nav · Space = υποψήφια εναλλαγή · Alt+↓ = επιλογές', () => {
    expect(intent('Delete', 'nav')).toEqual({ kind: 'clear' });
    expect(intent('Backspace', 'nav')).toEqual({ kind: 'clear' });
    expect(intent('Backspace', 'enter')).toEqual({ kind: 'passthrough' });
    expect(intent(' ', 'nav')).toEqual({ kind: 'toggle' });
    expect(intent(' ', 'enter')).toEqual({ kind: 'passthrough' });
    expect(intent('ArrowDown', 'nav', { altKey: true })).toEqual({ kind: 'openChoices' });
  });

  it('εκτυπώσιμοι χαρακτήρες ΠΟΤΕ δεν ερμηνεύονται (IME, τόνοι) — passthrough στο πεδίο', () => {
    for (const key of ['α', 'ά', 'Process', 'Dead', '5', ',']) expect(intent(key, 'nav')).toEqual({ kind: 'passthrough' });
  });

  it('πρόχειρο: εύρος σε πλοήγηση, κείμενο σε γραφή', () => {
    expect(gridClipboardScope('nav')).toBe('range');
    expect(gridClipboardScope('enter')).toBe('text');
    expect(gridClipboardScope('edit')).toBe('text');
  });
});
