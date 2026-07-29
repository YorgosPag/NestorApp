/**
 * ADR-726 Φ1 — frame-scheduler perf bridge.
 *
 * Η γέφυρα δεν είναι «απλώς ένα log». Κουβαλάει **τρεις** κανόνες που η Phase 1 πλήρωσε ακριβά
 * για να μάθει, και το test τους καρφώνει:
 *
 *  1. **Μηδέν κόστος με κλειστό flag** — ένα boolean και έξοδος (ίδιο σχήμα με το `withPerf`).
 *  2. **Καρέ σε μη-ορατό tab απορρίπτονται** (ADR-726 §1.2). Οι τρεις πρώτες διαγνώσεις ήταν
 *     άκυρες ακριβώς επειδή μετρήθηκαν σε hidden tab· ο κανόνας ζει ΜΕΣΑ στο όργανο.
 *  3. **Τα skipped συστήματα ΔΕΝ καταγράφονται** — κοστίζουν 0ms και θα αραίωναν τον μέσο όρο,
 *     κρύβοντας τον πραγματικό ένοχο.
 */

import {
  recordFrameAttribution,
  FRAME_TOTAL_STAGE,
  FRAME_INTERVAL_STAGE,
} from '../frame-scheduler-perf-bridge';
import { isPerfEnabled, recordSample } from '../../../systems/cursor/mouse-handler-perf';
import type { FrameMetrics } from '../frame-scheduler-types';

jest.mock('../../../systems/cursor/mouse-handler-perf');

const mockIsPerfEnabled = isPerfEnabled as jest.MockedFunction<typeof isPerfEnabled>;
const mockRecordSample = recordSample as jest.MockedFunction<typeof recordSample>;

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

function makeMetrics(
  systems: ReadonlyArray<[string, { renderTime: number; skipped: boolean }]>,
  totalFrameTime = 32.8,
): FrameMetrics {
  return {
    frameNumber: 7,
    deltaTime: 16.7,
    fps: 60,
    averageFps: 58,
    systemCount: systems.length,
    renderedCount: systems.filter(([, s]) => !s.skipped).length,
    skippedCount: systems.filter(([, s]) => s.skipped).length,
    totalFrameTime,
    systemMetrics: new Map(systems),
  };
}

/**
 * Η γέφυρα κρατά **module-level** ρολόι (το τελευταίο καρέ που κατέγραψε), ώστε να μπορεί να
 * βγάλει διάστημα. Χωρίς μηδενισμό, δείγματα διαρρέουν από describe σε describe.
 *
 * Μηδενίζεται μέσω της **δημόσιας συμπεριφοράς** — ένα καρέ με κλειστό flag ξεχνά το προηγούμενο
 * — και όχι με export «μόνο για test». Το όργανο δεν αποκτά επιφάνεια που δεν χρειάζεται.
 */
function resetBridgeClock(): void {
  mockIsPerfEnabled.mockReturnValueOnce(false);
  recordFrameAttribution(makeMetrics([['dxf-canvas', { renderTime: 0, skipped: false }]]), 0);
  jest.clearAllMocks();
}

describe('recordFrameAttribution (ADR-726 Φ1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPerfEnabled.mockReturnValue(true);
    setVisibility('visible');
    resetBridgeClock();
    mockIsPerfEnabled.mockReturnValue(true);
  });

  it('δεν καταγράφει τίποτα όταν το flag `dxf-perf-trace` είναι κλειστό', () => {
    mockIsPerfEnabled.mockReturnValue(false);
    recordFrameAttribution(makeMetrics([['dxf-canvas', { renderTime: 12, skipped: false }]]));
    expect(mockRecordSample).not.toHaveBeenCalled();
  });

  it('απορρίπτει καρέ σε ΜΗ ορατό tab — ο δεσμευτικός κανόνας εγκυρότητας (§1.2)', () => {
    setVisibility('hidden');
    recordFrameAttribution(makeMetrics([['dxf-canvas', { renderTime: 12, skipped: false }]]));
    expect(mockRecordSample).not.toHaveBeenCalled();
  });

  it('καταγράφει ένα δείγμα ανά σύστημα που ΖΩΓΡΑΦΙΣΕ, με το πρόθεμα `frame:`', () => {
    recordFrameAttribution(
      makeMetrics([
        ['dxf-canvas', { renderTime: 21.4, skipped: false }],
        ['layer-canvas', { renderTime: 3.2, skipped: false }],
      ]),
    );
    expect(mockRecordSample).toHaveBeenCalledWith('frame:dxf-canvas', 21.4);
    expect(mockRecordSample).toHaveBeenCalledWith('frame:layer-canvas', 3.2);
  });

  it('ΔΕΝ καταγράφει skipped συστήματα (0ms θα αραίωνε τον μέσο όρο και θα έκρυβε τον ένοχο)', () => {
    recordFrameAttribution(
      makeMetrics([
        ['dxf-canvas', { renderTime: 21.4, skipped: false }],
        ['home-run-wires', { renderTime: 0, skipped: true }],
      ]),
    );
    expect(mockRecordSample).not.toHaveBeenCalledWith('frame:home-run-wires', expect.anything());
  });

  it('καταγράφει τον συνολικό χρόνο του καρέ ως τον παρονομαστή του attribution', () => {
    recordFrameAttribution(makeMetrics([['dxf-canvas', { renderTime: 21.4, skipped: false }]], 32.8));
    expect(mockRecordSample).toHaveBeenCalledWith(FRAME_TOTAL_STAGE, 32.8);
  });

  it('καταγράφει το σύνολο ακόμη κι όταν ΟΛΑ τα συστήματα παραλείφθηκαν (άδειο καρέ ≠ δωρεάν καρέ)', () => {
    // Πρώτο καρέ του παραθύρου ⇒ κανένα διάστημα ακόμη, άρα ΜΟΝΟ η γραμμή TOTAL.
    recordFrameAttribution(makeMetrics([['dxf-canvas', { renderTime: 0, skipped: true }]], 1.4), 1000);
    expect(mockRecordSample).toHaveBeenCalledTimes(1);
    expect(mockRecordSample).toHaveBeenCalledWith(FRAME_TOTAL_STAGE, 1.4);
  });
});

/**
 * ADR-726 §5 — το **διάστημα** μεταξύ καρέ. Το μέγεθος των κριτηρίων αποδοχής, που η Φ1 δεν
 * κατέγραφε: μετρούσε τη διάρκεια του rAF callback και το ονόμαζε «χρόνος καρέ».
 */
describe('recordFrameAttribution — διάστημα καρέ (FRAME_INTERVAL_STAGE)', () => {
  const oneSystem = (): FrameMetrics => makeMetrics([['dxf-canvas', { renderTime: 5, skipped: false }]]);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPerfEnabled.mockReturnValue(true);
    setVisibility('visible');
    resetBridgeClock();
    mockIsPerfEnabled.mockReturnValue(true);
  });

  it('το ΠΡΩΤΟ καρέ δεν παράγει διάστημα — δεν υπάρχει προηγούμενο', () => {
    recordFrameAttribution(oneSystem(), 1000);
    expect(mockRecordSample).not.toHaveBeenCalledWith(FRAME_INTERVAL_STAGE, expect.anything());
  });

  it('το δεύτερο καρέ καταγράφει τον πραγματικό χρόνο ρολογιού από το πρώτο', () => {
    recordFrameAttribution(oneSystem(), 1000);
    recordFrameAttribution(oneSystem(), 1016.7);
    expect(mockRecordSample).toHaveBeenCalledWith(FRAME_INTERVAL_STAGE, 16.700000000000045);
  });

  it('διαδοχικά καρέ δίνουν διαδοχικά διαστήματα', () => {
    recordFrameAttribution(oneSystem(), 100);
    recordFrameAttribution(oneSystem(), 120);
    recordFrameAttribution(oneSystem(), 200);
    const intervals = mockRecordSample.mock.calls
      .filter(([stage]) => stage === FRAME_INTERVAL_STAGE)
      .map(([, value]) => value);
    expect(intervals).toEqual([20, 80]);
  });

  it('🔴 ένα κρυμμένο κενό ΔΕΝ γίνεται τεράστιο δείγμα — η ραφή πετιέται μαζί με τα καρέ', () => {
    recordFrameAttribution(oneSystem(), 1000);
    setVisibility('hidden');
    recordFrameAttribution(oneSystem(), 1500); // αόρατο καρέ — απορρίπτεται
    setVisibility('visible');
    recordFrameAttribution(oneSystem(), 31000); // 30΄΄ αργότερα: πρώτο ορατό μετά το κενό
    expect(mockRecordSample).not.toHaveBeenCalledWith(FRAME_INTERVAL_STAGE, expect.anything());
  });

  it('🔴 σβήσιμο/άναμμα του flag δεν ράβει διάστημα πάνω από το κενό', () => {
    recordFrameAttribution(oneSystem(), 1000);
    mockIsPerfEnabled.mockReturnValueOnce(false);
    recordFrameAttribution(oneSystem(), 9000);
    recordFrameAttribution(oneSystem(), 9016);
    expect(mockRecordSample).not.toHaveBeenCalledWith(FRAME_INTERVAL_STAGE, expect.anything());
  });

  it('μετά από κενό, το ΕΠΟΜΕΝΟ ζεύγος ξαναμετράει κανονικά', () => {
    recordFrameAttribution(oneSystem(), 1000);
    setVisibility('hidden');
    recordFrameAttribution(oneSystem(), 1500);
    setVisibility('visible');
    recordFrameAttribution(oneSystem(), 31000); // ξαναρχίζει το ρολόι
    recordFrameAttribution(oneSystem(), 31016);
    expect(mockRecordSample).toHaveBeenCalledWith(FRAME_INTERVAL_STAGE, 16);
  });
});
