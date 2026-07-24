/**
 * ADR-692 Φ2 — press-ownership: το SSoT του «κρατάει ήδη κάποιος αυτό το πάτημα;» για τον 3D καμβά.
 *
 * ΤΟ REGRESSION ΠΟΥ ΚΑΡΦΩΝΕΙ (μετρημένο 2026-07-25): ο marquee ρωτούσε «είναι ανεβασμένο το gizmo;»
 * αντί για «σέρνει κάποιος τώρα;». Επειδή το gizmo είναι auto-on-selection, κάθε επιτυχημένο marquee
 * το άναβε → το επόμενο drag δεν οπλιζόταν → ✅❌✅❌. Το τεστ «σταθερό ανάμεσα σε χειρονομίες»
 * παρακάτω είναι ακριβώς αυτή η διαφορά: ένας probe που είναι TRUE μόνο ΜΕΣΑ στο drag δεν
 * μολύνει την επόμενη χειρονομία.
 */

import {
  registerBim3DPressOwner,
  isBim3DPressOwned,
  _resetBim3DPressOwnersForTests,
} from '../press-ownership';

describe('press-ownership (ADR-692 Φ2)', () => {
  beforeEach(() => {
    _resetBim3DPressOwnersForTests();
  });

  it('χωρίς ιδιοκτήτες το πάτημα είναι ελεύθερο', () => {
    expect(isBim3DPressOwned()).toBe(false);
  });

  it('ρωτά τον probe ΤΗ ΣΤΙΓΜΗ του γεγονότος, όχι στην εγγραφή', () => {
    let dragging = false;
    registerBim3DPressOwner(() => dragging);
    expect(isBim3DPressOwned()).toBe(false);
    dragging = true;
    expect(isBim3DPressOwned()).toBe(true);
    dragging = false;
    expect(isBim3DPressOwned()).toBe(false);
  });

  it('αρκεί ΕΝΑΣ ιδιοκτήτης για να δεσμευτεί το πάτημα', () => {
    let gizmo = false;
    let grip = false;
    registerBim3DPressOwner(() => gizmo);
    registerBim3DPressOwner(() => grip);
    expect(isBim3DPressOwned()).toBe(false);
    grip = true;
    expect(isBim3DPressOwned()).toBe(true);
    grip = false;
    gizmo = true;
    expect(isBim3DPressOwned()).toBe(true);
  });

  it('το unregister βγάζει ΜΟΝΟ τον δικό του probe (ξεφορτωμένο viewport δεν απαντά)', () => {
    const unregisterA = registerBim3DPressOwner(() => true);
    registerBim3DPressOwner(() => false);
    expect(isBim3DPressOwned()).toBe(true);
    unregisterA();
    expect(isBim3DPressOwned()).toBe(false);
    unregisterA(); // idempotent
    expect(isBim3DPressOwned()).toBe(false);
  });

  it('ΤΟ BUG: η ιδιοκτησία μένει καθαρή ανάμεσα σε διαδοχικές χειρονομίες', () => {
    let dragging = false;
    registerBim3DPressOwner(() => dragging);
    // Τρεις πανομοιότυπες χειρονομίες: καμία δεν κληρονομεί κατάσταση από την προηγούμενη.
    for (let gesture = 0; gesture < 3; gesture++) {
      expect(isBim3DPressOwned()).toBe(false); // pointerdown: ελεύθερο → ο marquee ΟΠΛΙΖΕΤΑΙ
      dragging = true;                          // ο ιδιοκτήτης άρπαξε ένα δικό του drag
      expect(isBim3DPressOwned()).toBe(true);
      dragging = false;                         // pointerup / cancel
    }
    expect(isBim3DPressOwned()).toBe(false);
  });
});
