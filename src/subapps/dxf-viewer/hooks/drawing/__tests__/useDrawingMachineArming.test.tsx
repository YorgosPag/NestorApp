/**
 * 🔴 ADR-032 §1 — Ο ΔΕΣΜΟΣ, ΕΚΤΕΛΕΣΜΕΝΟΣ: **Η ΣΚΑΝΔΑΛΗ**.
 *
 * Το `useDrawingMachineArming.ts` γράφει ονομαστικά:
 *
 * > «🔴 **ΜΗΝ ξαναγυρίσεις την εξάρτηση σε `[activeTool]`.** Αυτή είναι η μετάλλαξη που
 * > γέννησε το bug· την **εκτελεί** το `__tests__/useDrawingMachineArming.test.tsx`.»
 *
 * Αυτό είναι εκείνο το αρχείο. Ένα σχόλιο που επικαλείται άγκυρα η οποία δεν υπάρχει
 * είναι υπόσχεση, όχι φρουρός (CHECK 3.54).
 *
 * ## Η διαφορά από το αδελφό αρχείο
 * Το `systems/tools/__tests__/drawing-tool-arming.test.ts` μετρά **ΤΙ αποφασίζεται**.
 * Εδώ μετριέται **ΠΟΤΕ ΞΑΝΑΡΩΤΑΜΕ** — και αυτό ήταν το bug: η απόφαση ήταν σωστή, αλλά
 * κανείς δεν ξαναρωτούσε όταν ο αφοπλισμός γινόταν χωρίς αλλαγή του `activeTool`.
 *
 * ## Οι μεταλλάξεις που πρέπει να κοκκινίσουν εδώ (ADR-032 §1.7)
 * · **Μ1** εξαρτήσεις → `[declaredTool]` (η αρχική αστοχία) → **Σ7**
 * · **Μ5** κριτής που επιστρέφει πάντα `'none'` → **Σ1 + Σ2 + Σ7**
 *
 * @see docs/centralized-systems/reference/adrs/ADR-032-drawing-state-machine.md §1
 */

import { renderHook } from '@testing-library/react';
import { useDrawingMachineArming } from '../useDrawingMachineArming';
import type { DrawingTool } from '../drawing-types';

/** Οι τρεις αλήθειες που βλέπει ο δεσμός, σε ένα αντικείμενο. */
interface Truths {
  declaredTool: string;
  machineTool: string;
  machineAcceptsPoints: boolean;
}

function armingHarness(initial: Truths) {
  const startDrawing = jest.fn<void, [DrawingTool]>();
  const view = renderHook(
    (truths: Truths) => useDrawingMachineArming({ ...truths, startDrawing }),
    { initialProps: initial },
  );
  return { ...view, startDrawing };
}

describe('🔴 ADR-032 §1 — ο δεσμός οπλίζει όταν οι δύο αλήθειες ΔΙΑΦΩΝΟΥΝ', () => {
  it('Σ1 — δηλωμένο `table`, μηχανή άοπλη ⇒ οπλίζει με ΤΟ ΔΗΛΩΜΕΝΟ εργαλείο', () => {
    const { startDrawing } = armingHarness({
      declaredTool: 'table',
      machineTool: 'select',
      machineAcceptsPoints: false,
    });

    expect(startDrawing).toHaveBeenCalledTimes(1);
    expect(startDrawing).toHaveBeenCalledWith('table');
  });

  it('Σ2 — mount με persisted `table` και μηχανή IDLE ⇒ οπλίζει ΣΤΟ ΠΡΩΤΟ RENDER', () => {
    // Ο χειρότερος δρόμος: ο άνθρωπος δεν άγγιξε τίποτα, άρα ΚΑΜΙΑ τιμή δεν αλλάζει ποτέ.
    // Αν ο οπλισμός εξαρτιόταν από αλλαγή, το εργαλείο θα ήταν νεκρό από τη γέννησή του.
    const { startDrawing } = armingHarness({
      declaredTool: 'table',
      machineTool: 'select',
      machineAcceptsPoints: false,
    });

    expect(startDrawing).toHaveBeenCalledWith('table');
  });

  it('Σ3 — μηχανή ήδη οπλισμένη για το ίδιο εργαλείο ⇒ ΔΕΝ αγγίζει τίποτα (ο βρόχος)', () => {
    const { startDrawing } = armingHarness({
      declaredTool: 'table',
      machineTool: 'table',
      machineAcceptsPoints: true,
    });

    expect(startDrawing).not.toHaveBeenCalled();
  });

  it('Σ4 — `polyline` ΣΤΗ ΜΕΣΗ πολυγραμμής ⇒ ΔΕΝ ξαναοπλίζει (τα φαγωμένα σημεία)', () => {
    const { startDrawing, rerender } = armingHarness({
      declaredTool: 'polyline',
      machineTool: 'polyline',
      machineAcceptsPoints: true,
    });

    // Δεύτερο σημείο: τίποτα δεν αλλάζει στις τρεις αλήθειες, ο άνθρωπος συνεχίζει να σχεδιάζει.
    rerender({ declaredTool: 'polyline', machineTool: 'polyline', machineAcceptsPoints: true });

    expect(startDrawing).not.toHaveBeenCalled();
  });

  it('Σ5 — entity-picking (`measure-angle-constraint`) ⇒ δική του μηχανή, κανένας οπλισμός', () => {
    const { startDrawing } = armingHarness({
      declaredTool: 'measure-angle-constraint',
      machineTool: 'select',
      machineAcceptsPoints: false,
    });

    expect(startDrawing).not.toHaveBeenCalled();
  });

  it('Σ6 — `select` ⇒ καμία ενέργεια', () => {
    const { startDrawing } = armingHarness({
      declaredTool: 'select',
      machineTool: 'select',
      machineAcceptsPoints: false,
    });

    expect(startDrawing).not.toHaveBeenCalled();
  });
});

describe('🔑 ADR-032 §1 — Η ΚΑΡΔΙΑ: η σκανδάλη ΔΕΝ είναι το `activeTool`', () => {
  it('Σ7 — αλλάζει ΜΟΝΟ το `machineAcceptsPoints` (true→false) ⇒ ΞΑΝΑΟΠΛΙΖΕΙ', () => {
    // Αυτό συμβαίνει μετά από `Escape` και μετά από ολοκλήρωση σχήματος: ο άνθρωπος
    // ΔΕΝ ξαναδιάλεξε εργαλείο — η κορδέλα εξακολουθεί να γράφει `table`.
    //
    // 🔴 Μ1: με εξαρτήσεις `[declaredTool]` ο δεσμός ΔΕΝ ξανατρέχει εδώ (η τιμή δεν
    // άλλαξε) ⇒ `startDrawing` δεν καλείται ⇒ ΚΟΚΚΙΝΟ. Αυτή είναι η αρχική αστοχία.
    const { startDrawing, rerender } = armingHarness({
      declaredTool: 'table',
      machineTool: 'table',
      machineAcceptsPoints: true,
    });

    expect(startDrawing).not.toHaveBeenCalled();

    // Ο αφοπλισμός (`onCancel()` / ολοκλήρωση): το ΜΟΝΟ που αλλάζει είναι ο οπλισμός.
    rerender({ declaredTool: 'table', machineTool: 'table', machineAcceptsPoints: false });

    expect(startDrawing).toHaveBeenCalledTimes(1);
    expect(startDrawing).toHaveBeenCalledWith('table');
  });

  it('Σ7β — αλλάζει ΜΟΝΟ το `machineTool` (η μηχανή έπεσε σε «select») ⇒ ΞΑΝΑΟΠΛΙΖΕΙ', () => {
    const { startDrawing, rerender } = armingHarness({
      declaredTool: 'table',
      machineTool: 'table',
      machineAcceptsPoints: true,
    });
    expect(startDrawing).not.toHaveBeenCalled();

    rerender({ declaredTool: 'table', machineTool: 'select', machineAcceptsPoints: true });

    expect(startDrawing).toHaveBeenCalledTimes(1);
  });

  it('Σ8 — ΙΔΕΜΠΟΤΗΣΙΑ (N.7.2 #3): δύο renders με ΙΔΙΕΣ τιμές ⇒ ΜΙΑ κλήση', () => {
    // Το `startDrawing` γράφει νέο `localState` ⇒ re-render. Αν ο δεσμός ξανακαλούσε,
    // θα γεννιόταν ατέρμονος βρόχος — γι' αυτό ο φρουρός είναι μέρος της λύσης.
    const { startDrawing, rerender } = armingHarness({
      declaredTool: 'table',
      machineTool: 'select',
      machineAcceptsPoints: false,
    });
    expect(startDrawing).toHaveBeenCalledTimes(1);

    rerender({ declaredTool: 'table', machineTool: 'select', machineAcceptsPoints: false });

    expect(startDrawing).toHaveBeenCalledTimes(1);
  });

  it('η αλλαγή δηλωμένου εργαλείου εξακολουθεί να οπλίζει (δεν χάθηκε ο παλιός δρόμος)', () => {
    const { startDrawing, rerender } = armingHarness({
      declaredTool: 'select',
      machineTool: 'select',
      machineAcceptsPoints: false,
    });
    expect(startDrawing).not.toHaveBeenCalled();

    rerender({ declaredTool: 'polyline', machineTool: 'select', machineAcceptsPoints: false });

    expect(startDrawing).toHaveBeenCalledTimes(1);
    expect(startDrawing).toHaveBeenCalledWith('polyline');
  });
});
