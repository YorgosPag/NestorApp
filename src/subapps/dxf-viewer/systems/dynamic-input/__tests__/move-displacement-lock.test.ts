/**
 * ADR-513 §grip-parity — 5ο σκαλί: DISPLACEMENT lock για λαβή ΜΕΤΑΚΙΝΗΣΗΣ ολόκληρης οντότητας.
 *
 * Giorgio 2026-07-18: «κλικ στη λαβή → ORTHO κλειδώνει → γράφω 500 → όλη η οντότητα μετακινείται
 * κατά 500». Το κενό που κλείνει: καμία από τις 4 προϋπάρχουσες βαθμίδες δεν έπιανε `movesEntity:
 * true`, άρα ο move-σταυρός ΔΕΝ δεχόταν πληκτρολογημένη τιμή.
 *
 * Ελέγχει: eligibility (μη-move λαβή / περιστροφή → null), gating (χωρίς lock → null),
 * ORTHO+typed σύνθεση, ελεύθερη κατεύθυνση — και το ΣΥΜΒΟΛΑΙΟ ΙΣΟΔΥΝΑΜΙΑΣ με τον αδελφό
 * `vertex-reshape-lock`, που είναι ο λόγος ύπαρξης του κοινού πυρήνα (N.18).
 */

import { resolveMoveDisplacementLockedDelta } from '../move-displacement-lock';
import { resolveVertexReshapeLockedDelta } from '../vertex-reshape-lock';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import { cadToggleState } from '../../constraints/cad-toggle-state';

const anchor = { x: 0, y: 0 };
const moveGrip = { movesEntity: true, isRotation: false };

afterEach(() => {
  DynamicInputLockStore.unlock();
  cadToggleState.set(false, false); // ortho off, polar off
});

describe('resolveMoveDisplacementLockedDelta — eligibility', () => {
  it('χωρίς ενεργό κλείδωμα → null (ο καλών κρατά το constrained delta)', () => {
    cadToggleState.set(true, false);
    expect(resolveMoveDisplacementLockedDelta(moveGrip, anchor, { x: 300, y: 40 })).toBeNull();
  });

  it('λαβή που ΔΕΝ μετακινεί οντότητα (reshape) → null — δεν κλέβει από τα σκαλιά 1-4', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveMoveDisplacementLockedDelta(
      { movesEntity: false, isRotation: false }, anchor, { x: 300, y: 40 },
    )).toBeNull();
  });

  it('ΠΕΡΙΣΤΡΟΦΗ → null (εκεί η ρητή είσοδος είναι γωνία, όχι μήκος μετατόπισης)', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveMoveDisplacementLockedDelta(
      { movesEntity: true, isRotation: true }, anchor, { x: 300, y: 40 },
    )).toBeNull();
  });

  it('απροσδιόριστο movesEntity → null (μόνο ρητό true περνά)', () => {
    DynamicInputLockStore.lockLength(500);
    expect(resolveMoveDisplacementLockedDelta({ isRotation: false }, anchor, { x: 300, y: 40 })).toBeNull();
  });
});

describe('resolveMoveDisplacementLockedDelta — ORTHO + πληκτρολογημένο μήκος', () => {
  it('ORTHO on, κέρσορας οριζόντια, τιμή 500 → μετακίνηση 500 κατά +X', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(500);
    const d = resolveMoveDisplacementLockedDelta(moveGrip, anchor, { x: 300, y: 40 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(500, 6);
    expect(d!.y).toBeCloseTo(0, 6); // ORTHO κλείδωσε στον οριζόντιο άξονα
  });

  it('ORTHO on, κέρσορας κατακόρυφα, τιμή 250 → μετακίνηση 250 κατά −Y', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(250);
    const d = resolveMoveDisplacementLockedDelta(moveGrip, anchor, { x: -30, y: -400 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(0, 6);
    expect(d!.y).toBeCloseTo(-250, 6);
  });

  it('χωρίς ORTHO/POLAR → η τιμή στην ελεύθερη κατεύθυνση του κέρσορα', () => {
    DynamicInputLockStore.lockLength(500);
    // κέρσορας κατά (3,4) → μοναδιαίο (0.6,0.8) × 500 = (300,400)
    const d = resolveMoveDisplacementLockedDelta(moveGrip, anchor, { x: 30, y: 40 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(300, 6);
    expect(d!.y).toBeCloseTo(400, 6);
  });

  it('η άγκυρα δεν είναι η αρχή των αξόνων → το delta μένει ΣΧΕΤΙΚΟ ως προς αυτήν', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(500);
    const d = resolveMoveDisplacementLockedDelta(moveGrip, { x: 1000, y: -250 }, { x: 1300, y: -210 });
    expect(d).not.toBeNull();
    expect(d!.x).toBeCloseTo(500, 6);
    expect(d!.y).toBeCloseTo(0, 6);
  });
});

/**
 * Ο ΛΟΓΟΣ ΥΠΑΡΞΗΣ του `displacement-lock-core` (N.18): τα δύο locks διαφέρουν ΜΟΝΟ στο eligibility.
 * Αν κάποιος τα ξανα-αποκλίνει (π.χ. γράψει δεύτερη ORTHO μαθηματική), αυτό το anchor κοκκινίζει.
 */
describe('ισοδυναμία με τον αδελφό vertex-reshape lock (κοινός πυρήνας)', () => {
  it('ίδια είσοδος → ίδιο delta, όποιο σκαλί κι αν το εξυπηρετήσει', () => {
    cadToggleState.set(true, false);
    DynamicInputLockStore.lockLength(500);
    const cursor = { x: 300, y: 40 };
    const move = resolveMoveDisplacementLockedDelta(moveGrip, anchor, cursor);
    const reshape = resolveVertexReshapeLockedDelta(
      { type: 'polyline' },
      { gripIndex: 0, movesEntity: false, polylineKind: 'polyline-vertex-0', isEdge: false },
      anchor, cursor,
    );
    expect(move).toEqual(reshape);
  });
});
