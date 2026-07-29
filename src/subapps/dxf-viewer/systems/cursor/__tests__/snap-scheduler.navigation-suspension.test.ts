/**
 * ADR-728 Φ1 — ο snap scheduler ΔΕΝ τρέχει όσο διαρκεί χειρονομία πλοήγησης.
 *
 * Μετρημένο (2026-07-29, browser, 2.910 οντότητες, 1:1361, ορατή+εστιασμένη καρτέλα,
 * `pan-pending` 60/60): `frame:snap-detection` avg 24,2ms / min 22,1ms = 75-88% του
 * `frame:TOTAL`. Με OSNAP off (control group) το `frame:TOTAL` πέφτει 27,2 → 6,3ms.
 *
 * 🔴 ΤΟ ΚΡΙΣΙΜΟ TEST ΕΙΝΑΙ ΤΟ ΤΡΙΤΟ: ο guard ΔΕΝ καθαρίζει το `ImmediateSnapStore`.
 * Το store δεν είναι μόνο δείκτης — είναι το ΣΗΜΕΙΟ COMMIT για κολώνα/δοκάρι/τοίχο
 * (`resolveEffectivePreviewCursor` κάνει σιωπηλό fallback στον raw cursor όταν είναι κενό,
 * και το `mouse-handler-up` δεν ξανακαλεί `findSnapPoint` εκεί by design). Καθάρισμά του
 * μέσα στο παράθυρο αναστολής ⇒ γεωμετρία τοποθετημένη εκτός OSNAP, ΣΙΩΠΗΛΑ.
 *
 * Το `ImmediateSnapStore` και το `NavigationGestureStore` μένουν **ΠΡΑΓΜΑΤΙΚΑ** — μόνο ο
 * frame scheduler είναι mocked, ώστε να μπορούμε να καλέσουμε το frame callback χειροκίνητα.
 * Κάλυψη σε δίδυμο δεν είναι κάλυψη.
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
import { updateImmediateTransform } from '../ImmediateTransformStore';
import {
  isNavigationGesture,
  endNavigationGesture,
  __resetNavigationGestureForTest,
} from '../../navigation/NavigationGestureStore';
import { DXF_TIMING } from '../../../config/dxf-timing';
import type { ProSnapResult } from '../../../snapping/extended-types';

const IDLE = DXF_TIMING.gesture.WHEEL_IDLE;

let clock = 0;
let nowSpy: jest.SpyInstance;
let findSnapPoint: jest.Mock;
let setSnapResults: jest.Mock;
let seq = 0;

/**
 * Ένα επιτυχημένο snap, όπως θα το επέστρεφε μια engine — με **ΜΟΝΑΔΙΚΟ σημείο ανά test**.
 * ⚠️ Ο scheduler κάνει dedup (`snapMoved || !lastSnapFound`) πάνω σε module state που
 * επιβιώνει ανάμεσα στα tests. Με σταθερό σημείο, το 2ο test θα έβρισκε «ίδιο snap» και
 * δεν θα ξαναδημοσίευε — κάνοντας τα tests εξαρτημένα από τη σειρά τους.
 */
let snapHit: ProSnapResult;
const makeSnapHit = (n: number): ProSnapResult => ({
  found: true,
  snappedPoint: { x: 100 + n, y: 200 + n },
  activeMode: 'endpoint',
  snapPoint: { entityId: `e${n}`, distance: 0 },
} as unknown as ProSnapResult);

/** Οπλίζει τον scheduler σαν να ήρθε mousemove, και τρέχει ΕΝΑ frame. */
function armAndRunFrame(): void {
  requestSnapDetection({
    worldPos: { x: 0, y: 0 },
    activeTool: 'select',
    findSnapPoint: findSnapPoint as unknown as (x: number, y: number) => ProSnapResult | null,
    setSnapResults,
  });
  registered.render();
}

/** Μια πραγματική αλλαγή view transform (pan/zoom/touch/keyboard — αδιάφορο ποια). */
function changeTransform(): void {
  seq += 1;
  updateImmediateTransform({ scale: 1 + seq, offsetX: seq, offsetY: seq });
}

beforeEach(() => {
  // ΜΟΝΟΤΟΝΟ ρολόι ανάμεσα στα tests: ο scheduler κρατά δικό του `lastRunMs` (throttle
  // ~30fps) σε module scope που ΔΕΝ μηδενίζεται. Αν ξαναρχίζαμε από την ίδια τιμή, ο
  // throttle του προηγούμενου test θα μπλόκαρε το επόμενο και θα μετρούσαμε λάθος πράγμα.
  clock += 1_000_000;
  nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => clock);
  __resetNavigationGestureForTest();
  clearImmediateSnap();
  seq += 1;
  snapHit = makeSnapHit(seq);
  findSnapPoint = jest.fn(() => snapHit);
  setSnapResults = jest.fn();
  isNavigationGesture(); // οπλίζει τη lazy εγγραφή στο transform store
});

afterEach(() => {
  nowSpy.mockRestore();
  __resetNavigationGestureForTest();
  clearImmediateSnap();
});

describe('snap-scheduler — αναστολή κατά τη χειρονομία πλοήγησης (ADR-728 Φ1)', () => {
  it('σε ηρεμία τρέχει κανονικά: το findSnapPoint καλείται και το snap δημοσιεύεται', () => {
    armAndRunFrame();
    expect(findSnapPoint).toHaveBeenCalledTimes(1);
    expect(getImmediateSnap()?.found).toBe(true);
  });

  it('🔴 κατά την πλοήγηση ΔΕΝ καλείται καθόλου το findSnapPoint (εδώ ζουν τα ~24ms)', () => {
    changeTransform();               // ο χρήστης μετακινεί την οθόνη
    armAndRunFrame();
    expect(findSnapPoint).not.toHaveBeenCalled();
  });

  it('🔴 η αναστολή ΔΕΝ καθαρίζει το ImmediateSnapStore — είναι το σημείο commit', () => {
    // ⚠️ Το snap ΠΡΕΠΕΙ να το γράψει ο ΙΔΙΟΣ ο scheduler σε κανονικό καρέ, όχι το test με
    // `setImmediateSnap`: το `clearSnapState` φρουρείται από το ΔΙΚΟ ΤΟΥ `lastSnapFound`
    // (module state). Αν το test έγραφε το store απευθείας, ο φρουρός θα έκανε early-return
    // και το test θα περνούσε ΚΑΙ με τη μετάλλαξη — κάλυψη σε δίδυμο, όχι στον κώδικα.
    // Ρεαλιστικό σενάριο: ενεργό snap σε γωνία τοίχου, και μετά ο χρήστης κάνει wheel-zoom.
    armAndRunFrame();
    expect(getImmediateSnap()?.found).toBe(true);          // ο scheduler το δημοσίευσε
    setSnapResults.mockClear();

    clock += DXF_TIMING.frame.SNAP_DETECTION + 1;
    changeTransform();                                      // ...αρχίζει η πλοήγηση
    armAndRunFrame();

    // Ζει σε ΚΟΣΜΙΚΕΣ συντεταγμένες: δεν γίνεται λάθος επειδή κινήθηκε η κάμερα. Αν
    // καθαριζόταν, το commit κολώνας/δοκαριού/τοίχου θα έπεφτε σιωπηλά στον raw cursor.
    const survived = getImmediateSnap();
    expect(survived?.found).toBe(true);
    expect(survived?.point).toEqual(snapHit.snappedPoint);
    // Και ο React δείκτης δεν σβήστηκε σιωπηλά ούτε αυτός.
    expect(setSnapResults).not.toHaveBeenCalled();
  });

  it('ο scheduler δεν μένει «βρόμικος»: η αναστολή δεν κρατά τον scheduler να τρέχει κάθε καρέ', () => {
    changeTransform();
    armAndRunFrame();
    expect(registered.isDirty()).toBe(false);
  });

  it('μόλις λήξει το idle παράθυρο, το snap ξαναδουλεύει', () => {
    changeTransform();
    armAndRunFrame();
    expect(findSnapPoint).not.toHaveBeenCalled();

    clock += IDLE + 1;
    armAndRunFrame();
    expect(findSnapPoint).toHaveBeenCalledTimes(1);
  });

  it('🔴 μετά από ρητό end (mouseup) το snap ξαναδουλεύει ΑΜΕΣΩΣ, χωρίς να περιμένει το παράθυρο', () => {
    // Καρφώνει τη ΣΕΙΡΑ στο `mouse-handler-up`: το end πρέπει να έρχεται ΜΕΤΑ την τελευταία
    // εγγραφή transform του pan cleanup. Αν προηγηθεί, εκείνη ξαναοπλίζει την αναστολή.
    changeTransform();
    armAndRunFrame();
    expect(findSnapPoint).not.toHaveBeenCalled();

    endNavigationGesture();          // ό,τι κάνει το mouseup
    // ΜΟΝΟ όσο χρειάζεται για τον υπάρχοντα throttle ~30fps του scheduler — και **πολύ κάτω**
    // από το idle παράθυρο (33 ≪ 220): χωρίς το `end`, η αναστολή θα ήταν ακόμη ενεργή εδώ.
    // Άρα το test διακρίνει «το end δούλεψε» από «πέρασε ο χρόνος».
    clock += DXF_TIMING.frame.SNAP_DETECTION + 1;
    armAndRunFrame();
    expect(findSnapPoint).toHaveBeenCalledTimes(1);
  });

  it('συνεχής χειρονομία: κανένα από πολλά διαδοχικά καρέ δεν τρέχει snap', () => {
    for (let frame = 0; frame < 12; frame++) {
      changeTransform();
      clock += 50;                   // ρυθμός αργού καρέ υπό pan (μετρημένα ~50ms)
      armAndRunFrame();
    }
    expect(findSnapPoint).not.toHaveBeenCalled();
  });
});
