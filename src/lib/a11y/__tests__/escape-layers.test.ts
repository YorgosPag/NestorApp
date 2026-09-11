/**
 * ADR-364 §10.15.γ · ADR-241 — **Στρώσεις Escape εκτός του bus: ΕΝΑ Esc = ΕΝΑ ΠΛΑΙΣΙΟ προς τα έξω.**
 *
 * 🔴 Μετρημένο ζωντανά 2026-09-11 σε 4 καταναλωτές (Πίνακας Ελέγχου / Νομικά ×2 / DXF): με ανοιχτή στρώση Radix μέσα
 * σε πλήρη οθόνη, **ένα** Esc έκλεινε **και** τη στρώση **και** την πλήρη οθόνη. Αιτία: το `useEscapeKey` ήταν ωμός
 * listener `document` (bubble) που **δεν** ρωτούσε αν το πάτημα είχε ήδη ιδιοκτήτη — ενώ ο Radix καλεί
 * `preventDefault()` στο document **capture** πριν κλείσει.
 *
 * Το συμβόλαιο που καρφώνεται εδώ:
 *   A1 — πολλές στρώσεις, ένα πάτημα ⇒ μόνο η **κορυφαία** (LIFO — ο κανόνας του top layer, όπως στο Revit / Figma).
 *   A2 — πάτημα που **ήδη** κατανάλωσε κάποιος (`defaultPrevented`) ⇒ καμία στρώση.
 *   A3 — πάτημα που χειρίστηκε η στοίβα ⇒ `defaultPrevented` + δηλωμένος ιδιοκτήτης (ώστε ο έλεγχος του ADR-364 να μην
 *        το κρίνει `shadow-owner`, και οι εξωτερικές στρώσεις να παραιτούνται).
 *   A4 — σύνθεση IME αγνοείται · ιδempotent αποδέσμευση · ο listener φεύγει όταν αδειάσει η στοίβα.
 */

import {
  __resetEscapeLayersForTests,
  claimEscape,
  escapeClaimOf,
  inspectEscapeLayers,
  pushEscapeLayer,
} from '../escape-layers';

function pressEscape(init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init });
  document.body.dispatchEvent(event);
  return event;
}

afterEach(() => {
  __resetEscapeLayersForTests();
});

describe('A1 — ένα πάτημα, μία στρώση: η κορυφαία', () => {
  test('δύο στρώσεις ⇒ καλείται μόνο η νεότερη', () => {
    const outer = jest.fn();
    const inner = jest.fn();
    pushEscapeLayer({ id: 'test/outer', onEscape: outer });
    pushEscapeLayer({ id: 'test/inner', onEscape: inner });
    pressEscape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  test('η εσώτερη φεύγει ⇒ το επόμενο πάτημα πάει στην εξωτερική', () => {
    const outer = jest.fn();
    pushEscapeLayer({ id: 'test/outer', onEscape: outer });
    const releaseInner = pushEscapeLayer({ id: 'test/inner', onEscape: jest.fn() });
    releaseInner();
    pressEscape();
    expect(outer).toHaveBeenCalledTimes(1);
  });

  test('άλλο πλήκτρο ⇒ καμία στρώση', () => {
    const onEscape = jest.fn();
    pushEscapeLayer({ id: 'test/only', onEscape });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe('A2 — το πάτημα που έχει ήδη ιδιοκτήτη δεν ξαναχρησιμοποιείται', () => {
  test('εσώτερος ιδιοκτήτης στο document capture (όπως ο Radix) ⇒ καμία στρώση', () => {
    const onEscape = jest.fn();
    pushEscapeLayer({ id: 'test/fullscreen', onEscape });
    const radixLike = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', radixLike, { capture: true });
    try {
      pressEscape();
    } finally {
      document.removeEventListener('keydown', radixLike, { capture: true });
    }
    expect(onEscape).not.toHaveBeenCalled();
  });

  test('εσώτερος ιδιοκτήτης στο ίδιο το στοιχείο (bubble) ⇒ καμία στρώση', () => {
    const onEscape = jest.fn();
    pushEscapeLayer({ id: 'test/fullscreen', onEscape });
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.addEventListener('keydown', (e) => e.preventDefault());
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    field.remove();
    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe('A3 — ό,τι χειρίζεται η στοίβα, το δηλώνει', () => {
  test('χειρισμένο ⇒ defaultPrevented + ιδιοκτήτης = η κορυφαία στρώση', () => {
    pushEscapeLayer({ id: 'core/fullscreen-surface', onEscape: jest.fn() });
    const event = pressEscape();
    expect(event.defaultPrevented).toBe(true);
    expect(escapeClaimOf(event)).toBe('core/fullscreen-surface');
  });

  test('καμία στρώση ⇒ ανέγγιχτο, χωρίς ιδιοκτήτη', () => {
    const event = pressEscape();
    expect(event.defaultPrevented).toBe(false);
    expect(escapeClaimOf(event)).toBeNull();
  });

  test('ρητή δήλωση από άλλον ιδιοκτήτη διαβάζεται από το ίδιο SSoT', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    claimEscape(event, 'ui/dialog-content');
    expect(escapeClaimOf(event)).toBe('ui/dialog-content');
  });

  test('δύο δηλώσεις για το ίδιο πάτημα ⇒ κρατά την ΠΡΩΤΗ (ο εσώτερος δηλώνει νωρίτερα)', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    claimEscape(event, 'ui/select-content');
    claimEscape(event, 'core/fullscreen-surface');
    expect(escapeClaimOf(event)).toBe('ui/select-content');
  });
});

describe('A4 — φρουροί κύκλου ζωής', () => {
  test('σύνθεση IME (`isComposing`) ⇒ αγνοείται', () => {
    const onEscape = jest.fn();
    pushEscapeLayer({ id: 'test/only', onEscape });
    const event = pressEscape({ isComposing: true });
    expect(onEscape).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test('η αποδέσμευση είναι ιδempotent — διπλό cleanup (StrictMode) δεν αφαιρεί ξένη στρώση ΜΕ ΤΟ ΙΔΙΟ id', () => {
    // Δύο πλήρεις οθόνες στην ίδια σελίδα δηλώνουν το ίδιο `id`· η αφαίρεση κατά `id` θα έσβηνε τη λάθος.
    const keep = jest.fn();
    pushEscapeLayer({ id: 'core/fullscreen-surface', onEscape: keep });
    const release = pushEscapeLayer({ id: 'core/fullscreen-surface', onEscape: jest.fn() });
    release();
    release();
    expect(inspectEscapeLayers()).toEqual(['core/fullscreen-surface']);
    pressEscape();
    expect(keep).toHaveBeenCalledTimes(1);
  });

  test('ο listener του document υπάρχει μόνο όσο υπάρχει στρώση', () => {
    const add = jest.spyOn(document, 'addEventListener');
    const remove = jest.spyOn(document, 'removeEventListener');
    try {
      const releaseA = pushEscapeLayer({ id: 'test/a', onEscape: jest.fn() });
      const releaseB = pushEscapeLayer({ id: 'test/b', onEscape: jest.fn() });
      const keydownAdds = add.mock.calls.filter(([type]) => type === 'keydown').length;
      releaseA();
      const removesWhileNonEmpty = remove.mock.calls.filter(([type]) => type === 'keydown').length;
      releaseB();
      const removesWhenEmpty = remove.mock.calls.filter(([type]) => type === 'keydown').length;
      expect(keydownAdds).toBe(1);
      expect(removesWhileNonEmpty).toBe(0);
      expect(removesWhenEmpty).toBe(1);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
