/**
 * ΑΓΚΥΡΕΣ — παρατήρηση modifiers (ADR-711 §10 · ADR-363).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `createModifierKeyTracker` είχε `onBlur` **από την πρώτη του μέρα** και **καμία
 * άγκυρα δεν τον ασκούσε ποτέ** — μετρημένο: μηδέν αναφορές `blur` σε test που αγγίζει
 * tracker. Δηλαδή ένας φρουρός χωρίς απόδειξη ζωής (ADR-749 §5), σε αρχείο με **29**
 * καταναλωτές. Μια συμπεριφορά που κανείς δεν ελέγχει δεν είναι εγγύηση· είναι πρόθεση.
 *
 * Οι ομάδες:
 *   **Α** — οι ΤΡΕΙΣ ακμές επαναφοράς. Το VS Code έχει μία (`blur`)· εδώ υπάρχουν τρεις,
 *           γιατί η **αναχώρηση** και η **επιστροφή** δεν είναι το ίδιο γεγονός.
 *   **Β** — η ΑΥΤΟ-ΙΑΣΗ: κατάσταση που κόλλησε διορθώνεται από το **επόμενο** συμβάν.
 *   **Γ** — η ΠΟΡΤΑ: στιγμιότυπο (ποτέ συμβάν), δηλωμένη σειρά, μηδέν νέοι ακροατές.
 */
import { CtrlKeyTracker } from '../CtrlKeyTracker';
import { ShiftKeyTracker } from '../ShiftKeyTracker';
import { QKeyTracker } from '../QKeyTracker';
import {
  MODIFIER_OBSERVER_PRIORITY,
  observeModifierSnapshot,
  readModifierSnapshot,
  type ModifierSnapshot,
} from '../modifier-snapshot';

/** Πάτημα του ίδιου του modifier — η **μετάβαση**, που είναι η αυθεντία. */
function pressCtrl(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
}

beforeEach(() => {
  CtrlKeyTracker._setForTest(false);
  ShiftKeyTracker._setForTest(false);
  QKeyTracker._setForTest(false);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Α — οι τρεις ακμές επαναφοράς', () => {
  it('Α1 — `blur`: το παράθυρο φεύγει, το πλήκτρο δεν μένει πατημένο', () => {
    pressCtrl();
    expect(CtrlKeyTracker.getSnapshot()).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(CtrlKeyTracker.getSnapshot()).toBe(false);
  });

  it('Α2 — `focus`: ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΤΟ VS CODE ΣΤΑΜΑΤΑ', () => {
    // Το `blur` καλύπτει την αναχώρηση. Υπάρχουν όμως διαδρομές (ελαχιστοποίηση,
    // εναλλαγή καρτέλας) όπου δεν φτάνει αξιόπιστα — και τότε η μόνη στιγμή που
    // ξέρουμε σίγουρα ότι ξαναρχίζουμε είναι η **επιστροφή**.
    pressCtrl();
    window.dispatchEvent(new Event('focus'));
    expect(CtrlKeyTracker.getSnapshot()).toBe(false);
  });

  it('Α3 — `visibilitychange` σε hidden: η καρτέλα κρύφτηκε', () => {
    pressCtrl();
    // ⚠️ Η παράκαμψη μπαίνει ως **ίδια** ιδιότητα του `document`, άρα η επαναφορά πρέπει να
    // τη **σβήσει** — όχι να ξαναγράψει τον descriptor του prototype. Η πρώτη γραφή έκανε το
    // δεύτερο και το `hidden` **διέρρευσε** στην επόμενη άγκυρα: το Α3β βγήκε κόκκινο και
    // κατηγορούσε τον κώδικα για διαρροή που είχε φτιάξει το ίδιο το test.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(CtrlKeyTracker.getSnapshot()).toBe(false);
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
    }
  });

  it('Α3β — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: όσο η καρτέλα είναι ορατή, τίποτα δεν μηδενίζεται', () => {
    // Χωρίς αυτό, το Α3 θα ήταν πράσινο ακόμα κι αν ο handler μηδένιζε **πάντα**.
    pressCtrl();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(CtrlKeyTracker.getSnapshot()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Β — αυτο-ίαση: το επόμενο συμβάν λέει την αλήθεια', () => {
  it('Β1 — κολλημένο `true` πέφτει από ΑΣΧΕΤΟ πλήκτρο που δηλώνει ότι δεν κρατιέται', () => {
    // Το σενάριο: χάθηκε το `keyup` γιατί το παράθυρο δεν είχε εστίαση.
    CtrlKeyTracker._setForTest(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: false }));
    expect(CtrlKeyTracker.getSnapshot()).toBe(false);
  });

  it('Β2 — ΤΟ ΠΟΝΤΙΚΙ ΕΙΝΑΙ ΕΞΙΣΟΥ ΑΞΙΟΠΙΣΤΟ: κίνηση με Shift στήνει την κατάσταση', () => {
    // Αυτό ακριβώς διέψευσε την πρώτη γραφή, που άκουγε μόνο `mousedown`: ο άνθρωπος
    // κρατά το πλήκτρο ΠΡΙΝ φτάσει η εστίαση εδώ, οπότε `keydown` δεν είδαμε ποτέ.
    expect(ShiftKeyTracker.getSnapshot()).toBe(false);
    window.dispatchEvent(new MouseEvent('mousemove', { shiftKey: true }));
    expect(ShiftKeyTracker.getSnapshot()).toBe(true);
  });

  it('Β3 — …και το επόμενο `keyup` παράγει ΟΝΤΩΣ αλλαγή (η ρίζα του σφάλματος)', () => {
    // Χωρίς το Β2, το `keyup` θα έγραφε `false` πάνω σε `false` ⇒ καμία ειδοποίηση ⇒
    // μπαγιάτικη προεπισκόπηση. Ο έλεγχος είναι στον **συνδρομητή**, όχι στην τιμή.
    window.dispatchEvent(new MouseEvent('mousemove', { shiftKey: true }));
    const seen: ModifierSnapshot[] = [];
    const stop = observeModifierSnapshot((snapshot) => seen.push(snapshot));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', shiftKey: false }));
    stop();
    expect(seen).toEqual([{ ctrlKey: false, shiftKey: false }]);
  });

  it('Β5 — 🔴 ΣΥΜΒΑΝ ΧΩΡΙΣ `getModifierState` ΔΕΝ ΡΙΧΝΕΙ ΤΗΝ ΕΦΑΡΜΟΓΗ', () => {
    // Το `window` capture είναι **ανοιχτή πόρτα**: σκέτο `Event('keydown')` στέλνει
    // επέκταση, βιβλιοθήκη ή dev overlay — και το `resyncFrom` πετούσε
    // `TypeError: e.getModifierState is not a function`, ρίχνοντας την οθόνη.
    CtrlKeyTracker._setForTest(true);
    expect(() => window.dispatchEvent(new Event('keydown'))).not.toThrow();
    // …και ο συγχρονισμός **σιωπά**: συμβάν που δεν μπορεί να απαντήσει
    // δεν γίνεται «όχι» — η μετάβαση παραμένει η αυθεντία.
    expect(CtrlKeyTracker.getSnapshot()).toBe(true);
  });

  it('Β6 — το ίδιο από την πλευρά του ποντικιού (`mousemove`/`mousedown`)', () => {
    // Ο ίδιος ακροατής είναι γραμμένος σε τρία συμβάντα· μια άγκυρα μόνο
    // στο `keydown` θα άφηνε τις άλλες δύο πόρτες αφύλακτες.
    ShiftKeyTracker._setForTest(true);
    expect(() => window.dispatchEvent(new Event('mousemove'))).not.toThrow();
    expect(() => window.dispatchEvent(new Event('mousedown'))).not.toThrow();
    expect(ShiftKeyTracker.getSnapshot()).toBe(true);
  });

  it('Β4 — ΜΗ-modifier tracker ΔΕΝ συγχρονίζεται (το `getModifierState("q")` δεν έχει νόημα)', () => {
    QKeyTracker._setForTest(true);
    window.dispatchEvent(new MouseEvent('mousemove', {}));
    expect(QKeyTracker.getSnapshot()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Γ — η πόρτα', () => {
  it('Γ1 — ο παρατηρητής παίρνει ΣΤΙΓΜΙΟΤΥΠΟ, ποτέ συμβάν', () => {
    const received: unknown[] = [];
    const stop = observeModifierSnapshot((snapshot) => received.push(snapshot));
    pressCtrl();
    stop();
    expect(received).toEqual([{ ctrlKey: true, shiftKey: false }]);
    // Η εγγύηση: ό,τι έφτασε δεν έχει τρόπο να ακυρώσει το συμβάν.
    expect(received[0]).not.toHaveProperty('preventDefault');
    expect(received[0]).not.toHaveProperty('stopPropagation');
  });

  it('Γ2 — 🔴 Ο ΠΑΡΑΓΩΓΟΣ ΤΡΕΧΕΙ ΠΡΙΝ ΤΟΝ ΚΑΤΑΝΑΛΩΤΗ, ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΣΕΙΡΑ ΕΓΓΡΑΦΗΣ', () => {
    // Ο καταναλωτής εγγράφεται ΠΡΩΤΟΣ επίτηδες: έτσι συμβαίνει ζωντανά (ο γραφέας του
    // δείκτη ζει όσο η λειτουργία, ο παραγωγός γεννιέται με τη σύρση). Με σκέτη σειρά
    // εγγραφής θα διάβαζε ΠΡΙΝ γραφτεί — το σφάλμα που βρήκε η οθόνη (§31).
    const order: string[] = [];
    const stopConsumer = observeModifierSnapshot(() => order.push('consumer'));
    const stopProducer = observeModifierSnapshot(
      () => order.push('producer'),
      MODIFIER_OBSERVER_PRIORITY.STATE_PRODUCER,
    );
    pressCtrl();
    stopConsumer();
    stopProducer();
    expect(order).toEqual(['producer', 'consumer']);
  });

  it('Γ3 — η πόρτα ΔΕΝ εγγράφει κανέναν δικό της ακροατή στο DOM', () => {
    // Αλλιώς θα ήταν δεύτερη μηχανή για την ίδια ερώτηση (ADR-749) — και ο ratchet του
    // ADR-711 θα την έβλεπε, σωστά, ως νέο ωμό listener.
    const spy = jest.spyOn(window, 'addEventListener');
    const stop = observeModifierSnapshot(() => undefined);
    expect(spy).not.toHaveBeenCalled();
    stop();
    spy.mockRestore();
  });

  it('Γ4 — η αποδέσμευση σταματά τις ειδοποιήσεις', () => {
    let calls = 0;
    const stop = observeModifierSnapshot(() => (calls += 1));
    pressCtrl();
    expect(calls).toBe(1);
    stop();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', ctrlKey: false }));
    expect(calls).toBe(1);
  });

  it('Γ5 — το στιγμιότυπο ενώνει Control και Meta, όπως ο κριτής', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', metaKey: true }));
    expect(readModifierSnapshot()).toEqual({ ctrlKey: true, shiftKey: false });
  });
});
