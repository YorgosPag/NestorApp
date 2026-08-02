/**
 * 🔴 ADR-739 Φ.Δ βήμα 8 — **Ο ΚΑΜΒΑΣ ΔΕΝ ΒΛΕΠΕΙ ΤΑ `Ctrl+A` / `Ctrl+C` / `Ctrl+V` ΟΣΟ ΕΙΣΑΙ
 * ΜΕΣΑ ΣΤΟΝ ΠΙΝΑΚΑ — ΚΑΙ ΤΑ ΞΑΝΑΒΛΕΠΕΙ ΜΟΛΙΣ ΒΓΕΙΣ.**
 *
 * ## Γιατί χρειάζεται ξεχωριστή απόδειξη
 * Και τα **τρία** αυτά πλήκτρα είναι ήδη πιασμένα από τον καμβά, με σοβαρές εντολές:
 *
 * | πλήκτρο | τι κάνει στον καμβά | τι πρέπει να κάνει στον πίνακα |
 * |---|---|---|
 * | `Ctrl+A` | επιλογή **όλων των οντοτήτων** του σχεδίου | όλα τα **κελιά** |
 * | `Ctrl+C` | αντιγραφή **οντοτήτων** (ADR-466, cross-floor) | αντιγραφή **κελιών** |
 * | `Ctrl+V` | επικόλληση **οντοτήτων** | επικόλληση **κελιών** |
 *
 * Αν διέρρεαν, το `Ctrl+C` μέσα σε κελί θα αντέγραφε **ολόκληρο τον πίνακα ως οντότητα** και
 * το επόμενο `Ctrl+V` θα γεννούσε **δεύτερο πίνακα** πάνω στον πρώτο. Δεν είναι ενόχληση —
 * είναι αλλοίωση του σχεδίου από μια συντόμευση που ο χρήστης πάτησε για να αντιγράψει τρία
 * νούμερα.
 *
 * ## Η ιδιοκτησία είναι ΔΟΜΙΚΗ, και αυτό ακριβώς μετριέται εδώ
 * Δεν υπάρχει `if (tableMode)` πουθενά — το ίδιο το `useKeyboardShortcuts` το απαγορεύει
 * («ο φύλακας είναι δομικός»). Ο `useDxfToolbarShortcuts` παραιτείται επειδή ο **στόχος**
 * του συμβάντος είναι πραγματικό πεδίο κειμένου, και η λειτουργία πίνακα κρατά ένα τέτοιο
 * μονίμως εστιασμένο (Φ.Δ βήμα 2). Άρα το test δεν στήνει «κατάσταση πίνακα»: στήνει
 * **στόχο** — και αυτό αρκεί, που είναι όλο το επιχείρημα.
 *
 * Εκτελείται ο **πραγματικός** hook με πραγματικά `KeyboardEvent` (ADR-587: ένα anchor χωρίς
 * εκτέλεση είναι σχόλιο).
 *
 * @see hooks/useDxfToolbarShortcuts.ts — ο φύλακας που μετριέται
 * @see ui/table-cell-editor/use-table-range-actions.ts — τι κάνουν αντ' αυτού μέσα στον πίνακα
 */

import { renderHook } from '@testing-library/react';
import { useDxfToolbarShortcuts } from '../../../hooks/useDxfToolbarShortcuts';

/** Τα τρία πλήκτρα, με τη **φυσική θέση** τους — η μόνη ασφαλής αναγνώριση (ελληνική διάταξη). */
const CLIPBOARD_KEYS = [
  { key: 'a', code: 'KeyA', canvasAction: 'select-all' },
  { key: 'c', code: 'KeyC', canvasAction: 'clipboard-copy' },
  { key: 'v', code: 'KeyV', canvasAction: 'clipboard-paste' },
] as const;

function dispatchCtrl(target: EventTarget, key: string, code: string): void {
  const event = new KeyboardEvent('keydown', {
    key,
    code,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
}

function mountShortcuts(onAction: jest.Mock) {
  return renderHook(() => useDxfToolbarShortcuts('select', jest.fn(), onAction));
}

describe('🔴 ιδιοκτησία προχείρου — ο καμβάς παραιτείται μέσα στον πίνακα', () => {
  let elements: HTMLElement[] = [];

  function mount(tag: 'textarea' | 'input' | 'div'): HTMLElement {
    const el = document.createElement(tag);
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  afterEach(() => {
    for (const el of elements) el.remove();
    elements = [];
  });

  it.each(CLIPBOARD_KEYS)(
    '🔴 Ctrl+$key με στόχο το <textarea> της συνεδρίας ⇒ ο καμβάς ΔΕΝ εκτελεί «$canvasAction»',
    ({ key, code }) => {
      const onAction = jest.fn();
      mountShortcuts(onAction);
      dispatchCtrl(mount('textarea'), key, code);
      expect(onAction).not.toHaveBeenCalled();
    },
  );

  it.each(CLIPBOARD_KEYS)(
    'Ctrl+$key με στόχο <input> (η γραμμή τύπων) ⇒ ο καμβάς ΔΕΝ εκτελεί «$canvasAction»',
    ({ key, code }) => {
      const onAction = jest.fn();
      mountShortcuts(onAction);
      dispatchCtrl(mount('input'), key, code);
      expect(onAction).not.toHaveBeenCalled();
    },
  );

  /**
   * 🔴 **Η ΑΝΤΙΣΤΡΟΦΗ ΑΠΟΔΕΙΞΗ, ΚΑΙ ΕΙΝΑΙ Η ΜΙΣΗ ΔΟΥΛΕΙΑ.** Χωρίς αυτήν, ένας φύλακας που
   * απορρίπτει **τα πάντα** θα περνούσε όλα τα παραπάνω — και ο χρήστης θα είχε χάσει τις
   * τρεις συντομεύσεις για ολόκληρη την εφαρμογή, σιωπηλά.
   */
  it.each(CLIPBOARD_KEYS)(
    '🔴 ΜΟΛΙΣ ΒΓΕΙΣ (στόχος <div> του καμβά) ⇒ ο καμβάς ΞΑΝΑΕΚΤΕΛΕΙ το «$canvasAction»',
    ({ key, code, canvasAction }) => {
      const onAction = jest.fn();
      mountShortcuts(onAction);
      dispatchCtrl(mount('div'), key, code);
      expect(onAction).toHaveBeenCalledWith(canvasAction);
    },
  );

  it('contentEditable μετρά κι αυτό ως πεδίο κειμένου — ίδιος φύλακας, μία γραμμή', () => {
    const onAction = jest.fn();
    mountShortcuts(onAction);
    const el = mount('div');
    el.contentEditable = 'true';
    dispatchCtrl(el, 'a', 'KeyA');
    expect(onAction).not.toHaveBeenCalled();
  });
});
