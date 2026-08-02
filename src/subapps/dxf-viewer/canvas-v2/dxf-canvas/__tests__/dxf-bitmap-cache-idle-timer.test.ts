/**
 * ADR-743 Φ1 — ο χρονιστής ηρεμίας ΔΕΝ μπορεί να χτυπήσει μέσα σε χειρονομία.
 *
 * ## Τι φυλάει αυτό το αρχείο
 *
 * Τον **μετρημένο ένοχο του zoom**: `43/43` πλήρεις ανακατασκευές (110,5ms η καθεμία, 78,2% όλου
 * του `frame:dxf-canvas`) πυροδοτούνταν από αυτόν τον χρονιστή ΜΕΣΑ σε χειρονομία, επειδή
 * `RASTER_IDLE` (120ms) < `WHEEL_IDLE` (220ms) και η εκκρεμότητα ελεγχόταν ΠΡΙΝ τον gesture guard.
 *
 * ⚠️ **Ο φύλακας ΔΕΝ ελέγχει τιμές σταθερών** — αυτό θα ήταν ταυτολογία που σπάει σε κάθε
 * νόμιμη ρύθμιση. Ελέγχει τη **δομική ιδιότητα**: «όσο ο ιδιοκτήτης λέει *τρέχει χειρονομία*, ο
 * χρονιστής επαναοπλίζεται και ΔΕΝ δηλώνει εκκρεμότητα». Σωστό ανεξαρτήτως τιμών — ακριβώς ο
 * λόγος που δεν επιλέχθηκε το «ανέβασε το `RASTER_IDLE` πάνω από το `WHEEL_IDLE`» (ADR-516).
 *
 * ## Γιατί εδώ δεν υπάρχει κανένα mock
 *
 * Το `isGestureActive` είναι **εγχυόμενη εξάρτηση**, όχι εισαγωγή store. Άρα ο φύλακας γράφεται
 * με μια σκέτη μεταβλητή και ψεύτικους χρονιστές: δοκιμάζεται η **πολιτική**, όχι η καλωδίωση.
 */

import { IdleRerasterTimer } from '../dxf-bitmap-cache-idle-timer';
import { IDLE_RERASTER_MS } from '../dxf-bitmap-cache-anchor';
import { DXF_TIMING } from '../../../config/dxf-timing';

/** Το παράθυρο που θεωρεί «ενεργή χειρονομία» ο ΕΝΑΣ ιδιοκτήτης (`NavigationGestureStore`). */
const GESTURE_WINDOW_MS = DXF_TIMING.gesture.WHEEL_IDLE;

let gestureActive = false;
let repaints = 0;

function makeTimer(): IdleRerasterTimer {
  return new IdleRerasterTimer({
    isGestureActive: () => gestureActive,
    requestRepaint: () => { repaints += 1; },
  });
}

beforeEach(() => {
  gestureActive = false;
  repaints = 0;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('IdleRerasterTimer — σε ηρεμία χτυπά κανονικά', () => {
  it('μετατοπισμένη προβολή + ησυχία ⇒ εκκρεμότητα + αίτημα ζωγραφικής', () => {
    const timer = makeTimer();
    timer.sync(true);
    expect(timer.isDue).toBe(false); // δεν είναι εκκρεμές ΠΡΙΝ περάσει ο χρόνος

    jest.advanceTimersByTime(IDLE_RERASTER_MS);

    expect(timer.isDue).toBe(true);
    expect(repaints).toBe(1);
  });

  it('προβολή ΠΑΝΩ στην άγκυρα ⇒ κανένας χρονιστής (δεν υπάρχει τι να αποκατασταθεί)', () => {
    const timer = makeTimer();
    timer.sync(false);
    jest.advanceTimersByTime(IDLE_RERASTER_MS * 10);
    expect(timer.isDue).toBe(false);
    expect(repaints).toBe(0);
  });

  it('κάθε νέο μετατοπισμένο καρέ ξανα-οπλίζει ⇒ χτυπά ΜΙΑ φορά αφού σταματήσει η κίνηση', () => {
    const timer = makeTimer();
    for (let i = 0; i < 5; i += 1) {
      timer.sync(true);
      jest.advanceTimersByTime(IDLE_RERASTER_MS - 1); // πάντα λίγο πριν χτυπήσει
    }
    expect(timer.isDue).toBe(false);
    expect(repaints).toBe(0);

    jest.advanceTimersByTime(IDLE_RERASTER_MS);
    expect(timer.isDue).toBe(true);
    expect(repaints).toBe(1);
  });
});

describe('🔴 ADR-743 Φ1 — ΜΕΣΑ σε χειρονομία ο χρονιστής ΔΕΝ δηλώνει ποτέ εκκρεμότητα', () => {
  it('ο χτύπος μέσα σε χειρονομία ξανα-οπλίζει αντί να θέσει εκκρεμότητα', () => {
    gestureActive = true;
    const timer = makeTimer();
    timer.sync(true);

    jest.advanceTimersByTime(IDLE_RERASTER_MS);

    expect(timer.isDue).toBe(false); // ο ένοχος των 43/43 δεν μπορεί πια να εκφραστεί
    expect(repaints).toBe(0);        // ούτε ζητά καρέ για ανακατασκευή που δεν θα γίνει
  });

  it('όσο κρατά η χειρονομία, ΚΑΝΕΝΑΣ χτύπος δεν περνά — ούτε μετά από πολλούς κύκλους', () => {
    gestureActive = true;
    const timer = makeTimer();
    timer.sync(true);

    jest.advanceTimersByTime(IDLE_RERASTER_MS * 20);

    expect(timer.isDue).toBe(false);
    expect(repaints).toBe(0);
  });

  it('🔑 ΣΥΓΚΛΙΣΗ: μόλις λήξει το παράθυρο χειρονομίας, χτυπά — ΜΙΑ φορά, χωρίς βρόχο', () => {
    gestureActive = true;
    const timer = makeTimer();
    timer.sync(true);

    // Πρώτος χτύπος: η χειρονομία τρέχει ⇒ επανόπλιση.
    jest.advanceTimersByTime(IDLE_RERASTER_MS);
    expect(timer.isDue).toBe(false);

    // Ο ιδιοκτήτης λήγει μόνος του (δεν ήρθε νέα αλλαγή transform).
    gestureActive = false;

    // Δεύτερος χτύπος: περνά.
    jest.advanceTimersByTime(IDLE_RERASTER_MS);
    expect(timer.isDue).toBe(true);
    expect(repaints).toBe(1);

    // Και δεν ξανα-οπλίζεται μόνος του: μία εκκρεμότητα, ένα αίτημα.
    jest.advanceTimersByTime(IDLE_RERASTER_MS * 10);
    expect(repaints).toBe(1);
  });

  it('🔑 Η ΕΠΑΝΟΠΛΙΣΗ ΕΙΝΑΙ ΤΟ ΠΟΛΥ ΜΙΑ — 120ms περίοδος vs 220ms παράθυρο', () => {
    // Ο ιδιοκτήτης απαντά με τον ΠΡΑΓΜΑΤΙΚΟ του κανόνα: «ενεργή αν η τελευταία αλλαγή transform
    // έγινε πριν λιγότερο από WHEEL_IDLE». Εδώ δεν έρχεται καμία αλλαγή μετά το t=0, οπότε
    // μετράμε πόσοι χτύποι χρειάζονται μέχρι να περάσει.
    let elapsed = 0;
    const timer = new IdleRerasterTimer({
      isGestureActive: () => elapsed < GESTURE_WINDOW_MS,
      requestRepaint: () => { repaints += 1; },
    });
    timer.sync(true);

    const step = (): void => { elapsed += IDLE_RERASTER_MS; jest.advanceTimersByTime(IDLE_RERASTER_MS); };

    step();                          // t=120 — 120 < 220 ⇒ επανόπλιση
    expect(timer.isDue).toBe(false);
    step();                          // t=240 — 240 ≥ 220 ⇒ περνά
    expect(timer.isDue).toBe(true);
    expect(repaints).toBe(1);
  });

  it('η άφιξη νέας κίνησης μέσα στην επανόπλιση απλώς μεταθέτει — δεν χάνεται εκκρεμότητα', () => {
    gestureActive = true;
    const timer = makeTimer();
    timer.sync(true);
    jest.advanceTimersByTime(IDLE_RERASTER_MS);   // επανόπλιση

    timer.sync(true);                             // νέο μετατοπισμένο καρέ (η ριπή συνεχίζεται)
    gestureActive = false;                        // ...και μετά ο χρήστης αφήνει τη ροδέλα
    jest.advanceTimersByTime(IDLE_RERASTER_MS);

    expect(timer.isDue).toBe(true);
    expect(repaints).toBe(1);
  });
});

describe('IdleRerasterTimer — κύκλος ζωής', () => {
  it('standDown μηδενίζει εκκρεμότητα ΚΑΙ χρονιστή, ιδεμποτεντικά', () => {
    const timer = makeTimer();
    timer.sync(true);
    jest.advanceTimersByTime(IDLE_RERASTER_MS);
    expect(timer.isDue).toBe(true);

    timer.standDown();
    timer.standDown();
    expect(timer.isDue).toBe(false);

    jest.advanceTimersByTime(IDLE_RERASTER_MS * 5);
    expect(timer.isDue).toBe(false);
    expect(repaints).toBe(1); // κανένα νέο αίτημα μετά το standDown
  });

  it('dispose σβήνει οπλισμένο χρονιστή ⇒ καμία ζωγραφική σε αποσυναρμολογημένο καμβά', () => {
    const timer = makeTimer();
    timer.sync(true);
    timer.dispose();
    jest.advanceTimersByTime(IDLE_RERASTER_MS * 5);
    expect(repaints).toBe(0);
    expect(timer.isDue).toBe(false);
  });

  it('χωρίς requestRepaint δεν σκάει — η εκκρεμότητα δηλώνεται κανονικά', () => {
    const timer = new IdleRerasterTimer({ isGestureActive: () => false });
    timer.sync(true);
    expect(() => jest.advanceTimersByTime(IDLE_RERASTER_MS)).not.toThrow();
    expect(timer.isDue).toBe(true);
  });
});
