/**
 * 🔴 ADR-739 §70 — **Ο ΚΑΝΟΝΑΣ «ΠΟΙΟΣ ΠΑΙΡΝΕΙ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ», ΕΚΤΕΛΕΣΜΕΝΟΣ.**
 *
 * Εδώ ελέγχεται η **απόφαση** χωρίς DOM συμβάν: τέσσερις κλάδοι, καθένας με το ελάττωμα που
 * θα γεννιόταν αν έλειπε. Η **συρραφή** (ότι η κορδέλα όντως τη δηλώνει, και ότι ένα
 * πραγματικό `mousedown` δεν μετακινεί την εστίαση) ελέγχεται ζωντανά στο
 * `ui/ribbon/components/__tests__/ribbon-tabbar-keyboard-custody.test.tsx`.
 *
 * Δύο ερωτήσεις, δύο άγκυρες — και αυτή εδώ μένει σωστή όταν αλλάξει το framework.
 *
 * @see src/lib/a11y/non-activating-surface.ts
 * @see docs/centralized-systems/reference/adrs/specs/SPEC-739D-excel-parity.md §70
 */

import {
  keepKeyboardOnNonActivatingSurface,
  keepKeyboardOnSurface,
  NON_ACTIVATING_SURFACE,
  pressMayMoveKeyboard,
} from '../non-activating-surface';

const WRITING = true;
const NOBODY_WRITING = false;

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  document.body.appendChild(node);
  return node;
}

/** Ένα κουμπί κορδέλας μέσα σε επιφάνεια-χρώμιο: ο κανονικός στόχος του κανόνα. */
function chromeButton(): HTMLElement {
  return el('button');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('pressMayMoveKeyboard — οι τέσσερις κλάδοι, κανένας σιωπηλός', () => {
  it('🔴 (4) γράφει κάποιος + απλό κουμπί ⇒ ΔΕΝ παίρνει το πληκτρολόγιο', () => {
    // Αυτός είναι ο κλάδος που κλείνει το ελάττωμα της αναφοράς: το βελάκι ↶ της κορδέλας
    // έκανε την αναίρεση ΚΑΙ έβγαζε τον πίνακα από τη συνεδρία, ενώ το `Ctrl+Z` όχι.
    expect(pressMayMoveKeyboard(chromeButton(), WRITING)).toBe(false);
  });

  it('🔴 (1) δεν γράφει κανείς ⇒ το κουμπί ΟΦΕΙΛΕΙ να εστιαστεί κανονικά', () => {
    // Ο κλάδος που μας χωρίζει από ProseMirror/Quill/Slate, που αποτρέπουν άνευ όρων. Χωρίς
    // αυτόν, ~700 κουμπιά της κορδέλας γίνονται μη εστιάσιμα με ποντίκι — αφαιρεμένη άγκυρα
    // εστίασης για χρήστη αναγνώστη οθόνης, χωρίς κανένα αντάλλαγμα (WAI-ARIA APG).
    expect(pressMayMoveKeyboard(chromeButton(), NOBODY_WRITING)).toBe(true);
  });

  it.each([
    ['input', {}],
    ['textarea', {}],
    ['div', { contenteditable: 'true' }],
    ['div', { contenteditable: 'plaintext-only' }],
    ['div', { role: 'textbox' }],
  ])('🔴 (2) ο στόχος είναι ο ίδιος πεδίο κειμένου (%s) ⇒ επιτρέπεται', (tag, attrs) => {
    // Ο χρήστης πάει να γράψει ΕΚΕΙ. Χωρίς αυτόν τον κλάδο, ένα πεδίο μέσα σε δηλωμένη
    // επιφάνεια θα γινόταν μη εστιάσιμο και το κείμενό του μη επιλέξιμο με το ποντίκι.
    expect(pressMayMoveKeyboard(el(tag, attrs), WRITING)).toBe(true);
  });

  it('🔴 (3) πηγή εγγενούς σύρσης ⇒ επιτρέπεται — αλλιώς πεθαίνει σιωπηλά το drag', () => {
    // Το `preventDefault` στο `mousedown` είναι ο **κατά πρότυπο** τρόπος ακύρωσης του
    // drag-and-drop, και οι browsers διαφωνούν στο πόσο πιστά το εφαρμόζουν. Χωρίς αυτόν τον
    // κλάδο η αναδιάταξη καρτελών της κορδέλας θα ήταν νεκρή σε άλλον browser από αυτόν που
    // δοκίμασες — και μόνο όσο κάποιος γράφει, δηλαδή διαλείπουσα.
    expect(pressMayMoveKeyboard(el('button', { draggable: 'true' }), WRITING)).toBe(true);
  });

  it('🔴 (3) η εμβέλεια της σύρσης είναι `closest`, όχι ο ίδιος ο στόχος', () => {
    // Το `draggable` μπαίνει στην ΚΑΡΤΕΛΑ· ο στόχος του `mousedown` είναι το εικονίδιο ή η
    // ετικέτα ΜΕΣΑ της. Έλεγχος μόνο του στόχου θα απαντούσε «όχι» ακριβώς στην περίπτωση
    // που υπάρχει — φρουρός που δεν φρουρεί.
    const tab = el('button', { draggable: 'true' });
    const icon = document.createElement('span');
    tab.appendChild(icon);
    expect(pressMayMoveKeyboard(icon, WRITING)).toBe(true);
  });

  it('`draggable="false"` ΔΕΝ είναι πηγή σύρσης — το γνώρισμα δεν αρκεί, η τιμή μετράει', () => {
    expect(pressMayMoveKeyboard(el('button', { draggable: 'false' }), WRITING)).toBe(false);
  });

  it('στόχος που λείπει ⇒ η αυστηρότερη πλευρά (καμία εξαίρεση), όχι η χαλαρότερη', () => {
    // Το `target` είναι προαιρετικό στον δομικό τύπο. Ένας φρουρός που «ανοίγει» όταν δεν
    // ξέρει θα ήταν φρουρός που σβήνει μόνος του στην πρώτη διαδρομή χωρίς React event.
    expect(pressMayMoveKeyboard(undefined, WRITING)).toBe(false);
    expect(pressMayMoveKeyboard(null, WRITING)).toBe(false);
  });

  it('μη-στοιχείο (`window`) ⇒ δεν σκάει', () => {
    expect(pressMayMoveKeyboard(window, WRITING)).toBe(false);
    expect(pressMayMoveKeyboard(window, NOBODY_WRITING)).toBe(true);
  });
});

describe('keepKeyboardOnSurface — ο φρουρός καλεί `preventDefault` ΜΟΝΟ όταν ο κανόνας λέει όχι', () => {
  function press(target: EventTarget | null, writing: boolean): boolean {
    let prevented = false;
    keepKeyboardOnSurface({ preventDefault: () => { prevented = true; }, target }, writing);
    return prevented;
  }

  it('αποτρέπει σε κουμπί χρωμίου ενώ γράφεται πεδίο', () => {
    expect(press(chromeButton(), WRITING)).toBe(true);
  });

  it('σιωπά όταν δεν γράφει κανείς', () => {
    expect(press(chromeButton(), NOBODY_WRITING)).toBe(false);
  });

  it('σιωπά πάνω σε πεδίο κειμένου', () => {
    expect(press(el('input'), WRITING)).toBe(false);
  });
});

describe('keepKeyboardOnNonActivatingSurface — η ΚΑΘΟΛΙΚΗ εμβέλεια διαβάζει το ζωντανό focus', () => {
  it('🔴 με εστιασμένο πεδίο κειμένου ⇒ αποτρέπει· χωρίς ⇒ όχι', () => {
    const field = el('input') as HTMLInputElement;
    const button = chromeButton();

    let prevented = false;
    const press = (): void => {
      prevented = false;
      keepKeyboardOnNonActivatingSurface({
        preventDefault: () => { prevented = true; },
        target: button,
      });
    };

    // Καμία εστίαση: η επιφάνεια συμπεριφέρεται σαν να μην υπάρχει φρουρός.
    (document.activeElement as HTMLElement | null)?.blur();
    press();
    expect(prevented).toBe(false);

    // Εστιασμένο πεδίο: το ίδιο πάτημα, αντίθετη απόφαση — και **καμία** γνώση για πίνακες.
    field.focus();
    expect(document.activeElement).toBe(field);
    press();
    expect(prevented).toBe(true);
  });
});

describe('NON_ACTIVATING_SURFACE — η δήλωση', () => {
  it('🔴 δηλώνει τον φρουρό στη φάση ΣΥΛΛΗΨΗΣ, όχι ανάδυσης', () => {
    // Στην ανάδυση, οποιοδήποτε Radix primitive καλέσει `stopPropagation()` σβήνει σιωπηλά
    // τον φρουρό: το κουμπί θα φαινόταν καλυμμένο και δεν θα ήταν. Αν αυτό το κλειδί
    // μετονομαστεί σε `onMouseDown`, η κάλυψη γίνεται ιδιότητα της συμπεριφοράς των παιδιών
    // αντί για ιδιότητα της δήλωσης — και το test κοκκινίζει.
    expect(Object.keys(NON_ACTIVATING_SURFACE)).toEqual(['onMouseDownCapture']);
    expect(NON_ACTIVATING_SURFACE.onMouseDownCapture).toBe(keepKeyboardOnNonActivatingSurface);
  });
});
