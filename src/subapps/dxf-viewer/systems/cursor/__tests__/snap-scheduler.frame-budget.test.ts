/**
 * ADR-728 Φ3 — προϋπολογισμός καρέ αντί για σταθερό time-throttle (snap-scheduler).
 *
 * Μετρημένο (ADR-732 §7.1, production 2026-07-30, hover σε 2.909 οντότητες):
 * `frame:snap-detection` p95 34,9ms, **max 205-455ms**. Το ΜΟΝΟ throttle που υπήρχε πριν
 * (`DXF_TIMING.frame.SNAP_DETECTION` ≈32ms) δεν βλέπει κόστος: μια ακριβή εκτέλεση ξανατρέχει
 * κανονικά μετά το ίδιο σταθερό διάστημα, κορένοντας το νήμα. Η δικλείδα: `onSnapFrame`
 * μετρά το κόστος της τελευταίας `runSnapDetection` και απαιτεί
 * `requiredGap = min(max(SNAP_DETECTION, lastRunCostMs × SNAP_BUDGET_BACKOFF_FACTOR), SNAP_BUDGET_MAX_GAP_MS)`.
 *
 * Ίδιο harness ιδίωμα με το `snap-scheduler.navigation-suspension.test.ts`: πραγματικός
 * scheduler, μόνο ο frame-registrar mocked ώστε να καλούμε το frame callback χειροκίνητα.
 * Το `performance.now` είναι ένα ελεγχόμενο ρολόι (`clock`) που το ΙΔΙΟ το `findSnapPoint`
 * mock προωθεί όταν εκτελείται, ώστε η προσομοιωμένη «διάρκεια εκτέλεσης» να είναι
 * πραγματική διαφορά `performance.now()` πριν/μετά, όχι εικασία.
 *
 * ⚠️ Κάθε test θέτει το ρολόι σε ΑΠΟΛΥΤΗ θέση σχετικά με `lastMark` (το clock τη στιγμή
 * που ΞΕΚΙΝΗΣΕ η τελευταία επιτυχημένη εκτέλεση — mirror του module-scope `lastRunMs` του
 * scheduler) αντί για σωρευτικά `clock +=`. Ο λόγος: το ίδιο το `findSnapPoint` προωθεί το
 * ρολόι όταν τρέξει (προσομοιώνει κόστος) — σωρευτικά `+=` θα μπέρδευαν αυτή την πλευρική
 * μετατόπιση με τη σκόπιμη μετατόπιση του test.
 */

const registered: { render: () => void; isDirty: () => boolean } = {
  render: () => {},
  isDirty: () => false,
};

jest.mock('../../../rendering', () => ({
  RENDER_PRIORITIES: { NORMAL: 2 },
  registerRenderCallback: (
    _id: string,
    _name: string,
    _priority: number,
    render: () => void,
    isDirty: () => boolean,
  ) => {
    registered.render = render;
    registered.isDirty = isDirty;
    return () => {};
  },
}));

jest.mock('../../../rendering/core/UnifiedFrameScheduler', () => ({
  markSystemsDirty: jest.fn(),
}));

import { requestSnapDetection } from '../snap-scheduler';
import { getImmediateSnap, clearImmediateSnap } from '../ImmediateSnapStore';
import { __resetNavigationGestureForTest } from '../../navigation/NavigationGestureStore';
import { DXF_TIMING } from '../../../config/dxf-timing';
import type { ProSnapResult } from '../../../snapping/extended-types';

const THROTTLE = DXF_TIMING.frame.SNAP_DETECTION;
const FACTOR = DXF_TIMING.frame.SNAP_BUDGET_BACKOFF_FACTOR;
const MAX_GAP = DXF_TIMING.frame.SNAP_BUDGET_MAX_GAP_MS;

let clock = 0;
let nowSpy: jest.SpyInstance;
let findSnapPoint: jest.Mock;
let setSnapResults: jest.Mock;
let seq = 0;
/** Πόσα ms να «κοστίσει» η επόμενη κλήση του findSnapPoint (προωθεί το ελεγχόμενο ρολόι). */
let nextCostMs = 0;
/** clock τη στιγμή που ξεκίνησε η ΤΕΛΕΥΤΑΙΑ επιτυχημένη εκτέλεση — mirror του `lastRunMs`. */
let lastMark = 0;

const makeSnapHit = (n: number): ProSnapResult => ({
  found: true,
  snappedPoint: { x: 100 + n, y: 200 + n },
  activeMode: 'endpoint',
  snapPoint: { entityId: `e${n}`, distance: 0 },
} as unknown as ProSnapResult);

/** Οπλίζει τον scheduler σαν να ήρθε mousemove, τρέχει ΕΝΑ frame, επιστρέφει αν όντως έτρεξε. */
function armAndRunFrame(): boolean {
  const before = findSnapPoint.mock.calls.length;
  const callClock = clock;
  requestSnapDetection({
    worldPos: { x: 0, y: 0 },
    activeTool: 'select',
    findSnapPoint: findSnapPoint as unknown as (x: number, y: number) => ProSnapResult | null,
    setSnapResults,
  });
  registered.render();
  const ran = findSnapPoint.mock.calls.length > before;
  if (ran) lastMark = callClock;
  return ran;
}

beforeEach(() => {
  // ΜΟΝΟΤΟΝΟ ρολόι ανάμεσα στα tests — ίδιος λόγος με το navigation-suspension harness:
  // ο scheduler κρατά `lastRunMs`/`lastRunCostMs` σε module scope που ΔΕΝ μηδενίζεται. Το
  // τεράστιο άλμα εγγυάται ότι το requiredGap του ΠΡΟΗΓΟΥΜΕΝΟΥ test (όποιο κι αν ήταν) έχει
  // ήδη περάσει, οπότε η πρώτη κλήση κάθε test τρέχει πάντα και «διορθώνει» το lastMark.
  clock += 1_000_000;
  nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clock);
  __resetNavigationGestureForTest();
  clearImmediateSnap();
  seq += 1;
  nextCostMs = 0;
  findSnapPoint = jest.fn(() => {
    clock += nextCostMs; // «κοστίζει» nextCostMs στο ελεγχόμενο ρολόι — πραγματική διάρκεια, όχι εικασία
    return makeSnapHit(seq);
  });
  setSnapResults = jest.fn();
});

afterEach(() => {
  nowSpy.mockRestore();
  __resetNavigationGestureForTest();
  clearImmediateSnap();
});

describe('snap-scheduler — προϋπολογισμός καρέ (ADR-728 Φ3 / ADR-732 §7.1)', () => {
  it('(α) φθηνή εκτέλεση ⇒ ίδια συμπεριφορά με σήμερα: κυριαρχεί το σταθερό throttle', () => {
    nextCostMs = 1; // αμελητέο κόστος ⇒ 1 × FACTOR ≪ THROTTLE, δεν αλλάζει τίποτα
    expect(armAndRunFrame()).toBe(true);
    expect(getImmediateSnap()?.found).toBe(true);

    nextCostMs = 0;
    clock = lastMark + THROTTLE - 1;
    expect(armAndRunFrame()).toBe(false); // ακόμη μπλοκαρισμένο, όπως και σήμερα

    clock = lastMark + THROTTLE + 1;
    expect(armAndRunFrame()).toBe(true); // ξανατρέχει μόλις περάσει το THROTTLE
  });

  it('(β) ακριβή εκτέλεση ⇒ το gap μεγαλώνει αναλογικά (requiredGap = cost × FACTOR)', () => {
    const costMs = 100;
    nextCostMs = costMs;
    expect(armAndRunFrame()).toBe(true);

    const requiredGap = costMs * FACTOR; // 200ms — κάτω από το MAX_GAP (250ms), δεν κόβεται
    expect(requiredGap).toBeLessThan(MAX_GAP);

    nextCostMs = 0;
    // Λίγο ΠΡΙΝ το requiredGap: ακόμη μπλοκαρισμένο — ΠΟΛΥ πάνω από το απλό THROTTLE (32ms),
    // που θα είχε ήδη επιτρέψει ξανά-εκτέλεση σήμερα χωρίς το budget.
    clock = lastMark + requiredGap - 1;
    expect(armAndRunFrame()).toBe(false);

    clock = lastMark + requiredGap + 1;
    expect(armAndRunFrame()).toBe(true); // μόλις περάσει το requiredGap: επιτρέπεται
  });

  it('(γ) cap: πολύ ακριβή εκτέλεση ⇒ gap ≤ MAX_GAP (το snap δεν χάνεται για πολύ)', () => {
    const costMs = 1000; // costMs × FACTOR = 2000ms, ΠΟΛΥ πάνω από MAX_GAP
    nextCostMs = costMs;
    expect(armAndRunFrame()).toBe(true);
    expect(costMs * FACTOR).toBeGreaterThan(MAX_GAP);

    nextCostMs = 0;
    clock = lastMark + MAX_GAP - 1;
    expect(armAndRunFrame()).toBe(false); // ακόμη μπλοκαρισμένο

    // Μόλις περάσει το MAX_GAP — ΠΟΛΥ ΝΩΡΙΤΕΡΑ από τα «ωμά» 2000ms που θα απαιτούσε ο
    // πολλαπλασιασμός χωρίς cap: επιτρέπεται ξανά.
    clock = lastMark + MAX_GAP + 1;
    expect(armAndRunFrame()).toBe(true);
  });

  it('(δ) το dirty παραμένει ενεργό μέσα στο budget window — retry next frame, όχι απώλεια του input', () => {
    nextCostMs = 100; // requiredGap = 100 × FACTOR(2) = 200ms
    expect(armAndRunFrame()).toBe(true);
    expect(registered.isDirty()).toBe(false); // επιτυχής εκτέλεση → καθαρό

    // Νέο mousemove μέσα στο 200ms budget window (πολύ πάνω από το ~32ms σταθερό throttle
    // που θα το επέτρεπε ήδη σήμερα): οπλίζει, αλλά ο scheduler ΠΡΕΠΕΙ να το μπλοκάρει.
    nextCostMs = 0;
    clock = lastMark + 1;
    expect(armAndRunFrame()).toBe(false); // δεν έτρεξε — μπλοκαρισμένο από το budget
    expect(registered.isDirty()).toBe(true); // ΠΑΡΑΜΕΝΕΙ dirty — θα ξαναδοκιμάσει το επόμενο καρέ

    clock = lastMark + 10; // ακόμη μέσα στο budget window — νέο καρέ, ΧΩΡΙΣ νέο mousemove
    registered.render();
    expect(findSnapPoint).toHaveBeenCalledTimes(1); // ακόμη μπλοκαρισμένο
    expect(registered.isDirty()).toBe(true); // το τελευταίο armed input ΔΕΝ χάθηκε

    clock = lastMark + 201; // περνάει το budget window
    registered.render();
    expect(findSnapPoint).toHaveBeenCalledTimes(2); // τώρα τρέχει, με το ΤΕΛΕΥΤΑΙΟ armed input
    expect(registered.isDirty()).toBe(false);
  });

  it('(ε) μετά από φθηνή εκτέλεση το gap επανέρχεται στο σταθερό throttle', () => {
    nextCostMs = 200; // ακριβή εκτέλεση ⇒ requiredGap = 400ms, capped στο MAX_GAP (250ms)
    expect(armAndRunFrame()).toBe(true);

    nextCostMs = 1; // ΤΩΡΑ φθηνή εκτέλεση
    clock = lastMark + MAX_GAP + 1;
    expect(armAndRunFrame()).toBe(true);

    // Μετά από τη φθηνή εκτέλεση, το επόμενο gap πρέπει να είναι ξανά το ΣΤΑΘΕΡΟ throttle —
    // ΟΧΙ ακόμη επηρεασμένο από το παλιό ακριβό κόστος (θα ήταν bug: «κολλημένο» backoff).
    nextCostMs = 0;
    clock = lastMark + THROTTLE - 1;
    expect(armAndRunFrame()).toBe(false); // ακόμη μέσα στο (μικρό) throttle

    clock = lastMark + THROTTLE + 1;
    expect(armAndRunFrame()).toBe(true); // επέστρεψε στο κανονικό ~throttle ρυθμό
  });
});
