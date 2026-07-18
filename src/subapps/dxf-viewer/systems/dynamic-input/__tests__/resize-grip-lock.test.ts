/**
 * ADR-513 §grip-parity Φάση Δ — 5ο σκαλί: DISPLACEMENT lock για λαβή ΑΛΛΑΓΗΣ ΜΕΓΕΘΟΥΣ.
 *
 * Giorgio 2026-07-18: «κλικ στη λαβή πλάτους κολόνας → ORTHO κλειδώνει → γράφω 500 → η λαβή
 * μετακινείται 500, άρα πλάτος 300 → 800». ΜΕΤΑΤΟΠΙΣΗ, ΟΧΙ απόλυτη διάσταση (ρητή απόφαση).
 *
 * Το κενό που κλείνει: η Φάση Γ έκανε τις λαβές resize click-armed, αλλά ΚΑΜΙΑ από τις 5
 * προϋπάρχουσες βαθμίδες δεν τις έπιανε (`vertex-reshape-lock` δέχεται μόνο arc/polyline/rectangle),
 * άρα το πληκτρολογημένο Enter ήταν νεκρό ακριβώς στις λαβές που μόλις είχαν οπλιστεί.
 *
 * Ελέγχει: eligibility από το ΥΠΑΡΧΟΝ μητρώο, μη-επικάλυψη με τα άλλα σκαλιά, ORTHO+typed σύνθεση,
 * και το ΣΥΜΒΟΛΑΙΟ ΙΣΟΔΥΝΑΜΙΑΣ με τους αδελφούς (ο λόγος ύπαρξης του κοινού πυρήνα, N.18).
 */

import { resolveResizeGripLockedDelta, isResizeGripKind } from '../resize-grip-lock';
import { resolveMoveDisplacementLockedDelta } from '../move-displacement-lock';
import { isResizeGripDragInfo } from '../../cursor/GripDragStore';
import { HOT_GRIP_OP_REGISTRY } from '../../../hooks/grips/wall-hot-grip-fsm';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import { cadToggleState } from '../../constraints/cad-toggle-state';

const anchor = { x: 0, y: 0 };
const widthGrip = { gripKind: 'column-width', movesEntity: false, isRotation: false };

afterEach(() => {
  DynamicInputLockStore.unlock();
  cadToggleState.set(false, false); // ortho off, polar off
});

describe('isResizeGripKind — το εύρος διαβάζεται από το ΥΠΑΡΧΟΝ μητρώο, όχι από δεύτερη λίστα', () => {
  it.each([
    'column-width', 'column-depth', 'column-corner-ne', 'column-edge-w',
    'foundation-width', 'stair-width', 'stair-landing-depth',
    'beam-width', 'wall-thickness', 'wall-start', 'text-corner-ne', 'mep-fixture-diameter',
  ])('λαβή αλλαγής μεγέθους «%s» → επιλέξιμη', (kind) => {
    expect(isResizeGripKind(kind)).toBe(true);
  });

  it.each([
    'column-center', 'wall-midpoint', 'text-move', 'group-move', 'block-move',   // ΜΕΤΑΚΙΝΗΣΗ (6ο σκαλί)
    'column-rotation', 'wall-rotation', 'stair-direction', 'image-rotation',      // ΠΕΡΙΣΤΡΟΦΗ (δικό της ring)
  ])('λαβή μετακίνησης/περιστροφής «%s» → ΜΗ επιλέξιμη', (kind) => {
    expect(isResizeGripKind(kind)).toBe(false);
  });

  it.each([null, undefined, '', 'polyline-vertex-0', 'unknown-kind'])(
    'εκτός μητρώου (%s) → ΜΗ επιλέξιμη — δεν κλέβει από τα σκαλιά 1-4',
    (kind) => { expect(isResizeGripKind(kind)).toBe(false); },
  );

  /**
   * ΑΝΤΙΚΕΙΜΕΝΟ-ΔΙΧΤΥ (reference_anchor_without_subject_passes_forever): αν κάποιος αδειάσει ή
   * μετονομάσει τα `'corner'` του μητρώου, τα it.each παραπάνω θα έμεναν πράσινα σε ένα κενό σύνολο.
   */
  it('το μητρώο περιέχει ΟΥΣΙΑΣΤΙΚΟ πλήθος λαβών resize (δίχτυ πλήθους)', () => {
    const cornerKinds = Object.values(HOT_GRIP_OP_REGISTRY).filter((op) => op === 'corner');
    expect(cornerKinds.length).toBeGreaterThanOrEqual(40);
  });
});

describe('resolveResizeGripLockedDelta — eligibility', () => {
  it('χωρίς ενεργό κλείδωμα → null (ο καλών κρατά το ORTHO-constrained delta)', () => {
    cadToggleState.set(true, false);
    expect(resolveResizeGripLockedDelta(widthGrip, anchor, { x: 300, y: 40 })).toBeNull();
  });

  it('λαβή ΜΕΤΑΚΙΝΗΣΗΣ ολόκληρης οντότητας → null (ανήκει στο 6ο σκαλί)', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveResizeGripLockedDelta(
      { gripKind: 'column-center', movesEntity: true, isRotation: false }, anchor, { x: 300, y: 40 },
    )).toBeNull();
  });

  it('ΠΕΡΙΣΤΡΟΦΗ → null (εκεί η ρητή είσοδος είναι γωνία, όχι μήκος μετατόπισης)', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveResizeGripLockedDelta(
      { ...widthGrip, isRotation: true }, anchor, { x: 300, y: 40 },
    )).toBeNull();
  });

  it('κορυφή πολυγραμμής → null — σερβίρεται από το 3ο σκαλί, μηδέν επικάλυψη', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveResizeGripLockedDelta(
      { gripKind: 'polyline-vertex-0', movesEntity: false, isRotation: false }, anchor, { x: 300, y: 40 },
    )).toBeNull();
  });
});

describe('resolveResizeGripLockedDelta — ORTHO + πληκτρολογημένη μετατόπιση', () => {
  it('ORTHO on, κέρσορας οριζόντια, τιμή 500 → η λαβή μετακινείται 500 κατά +X', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(500);
    const d = resolveResizeGripLockedDelta(widthGrip, anchor, { x: 300, y: 40 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(500, 6);
    expect(d!.y).toBeCloseTo(0, 6); // ORTHO κλείδωσε στον οριζόντιο άξονα
  });

  it('η άγκυρα είναι η ΘΕΣΗ ΤΗΣ ΛΑΒΗΣ → το delta μένει ΣΧΕΤΙΚΟ ως προς αυτήν', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(250);
    const d = resolveResizeGripLockedDelta(widthGrip, { x: 1500, y: -800 }, { x: 1520, y: -1200 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(0, 6);
    expect(d!.y).toBeCloseTo(-250, 6);
  });
});

/**
 * ΤΟ ΣΥΜΒΟΛΑΙΟ ΠΟΥ ΖΗΤΗΣΕ Ο GIORGIO: «ΕΝΑ σύστημα, όχι δύο». Η ίδια πληκτρολόγηση πρέπει να δίνει
 * ΤΟ ΙΔΙΟ γεωμετρικό αποτέλεσμα σε λαβή resize και σε λαβή μετακίνησης. Αν κάποιος γράψει δεύτερη
 * ORTHO μαθηματική για τις λαβές διάστασης, αυτό το anchor κοκκινίζει.
 */
describe('ισοδυναμία με τους αδελφούς (κοινός πυρήνας displacement-lock-core)', () => {
  it('ίδια είσοδος → ίδιο delta, όποιο σκαλί κι αν το εξυπηρετήσει', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(500);
    const cursor = { x: 300, y: 40 };
    const resize = resolveResizeGripLockedDelta(widthGrip, anchor, cursor);
    const move = resolveMoveDisplacementLockedDelta({ movesEntity: true, isRotation: false }, anchor, cursor);
    expect(resize).toEqual(move);
  });
});

/**
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ ΤΟ ΚΟΙΝΟ PREDICATE: το δαχτυλίδι δεν πρέπει ΠΟΤΕ να εμφανίζεται σε λαβή που
 * δεν δέχεται τιμή (και αντίστροφα). Ένα predicate → αδύνατον να αποκλίνουν.
 */
describe('mount δαχτυλιδιού ≡ αποδοχή τιμής (κοινό predicate)', () => {
  it.each(['column-width', 'wall-thickness', 'stair-width'])(
    'λαβή «%s»: δείχνει δαχτυλίδι ΚΑΙ δέχεται τιμή',
    (gripKind) => {
      DynamicInputLockStore.lockLength(500);
      expect(isResizeGripDragInfo({ entityId: 'e1', gripKind })).toBe(true);
      expect(resolveResizeGripLockedDelta(
        { gripKind, movesEntity: false, isRotation: false }, anchor, { x: 300, y: 40 },
      )).not.toBeNull();
    },
  );

  it.each(['column-center', 'column-rotation'])(
    'λαβή «%s»: ΟΥΤΕ δαχτυλίδι ΟΥΤΕ τιμή από αυτό το σκαλί',
    (gripKind) => {
      DynamicInputLockStore.lockLength(500);
      expect(isResizeGripDragInfo({ entityId: 'e1', gripKind })).toBe(false);
    },
  );

  it('κανένα ενεργό drag → false', () => {
    expect(isResizeGripDragInfo(null)).toBe(false);
  });
});
