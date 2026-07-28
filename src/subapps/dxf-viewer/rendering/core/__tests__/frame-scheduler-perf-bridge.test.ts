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

import { recordFrameAttribution, FRAME_TOTAL_STAGE } from '../frame-scheduler-perf-bridge';
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

describe('recordFrameAttribution (ADR-726 Φ1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPerfEnabled.mockReturnValue(true);
    setVisibility('visible');
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
    recordFrameAttribution(makeMetrics([['dxf-canvas', { renderTime: 0, skipped: true }]], 1.4));
    expect(mockRecordSample).toHaveBeenCalledTimes(1);
    expect(mockRecordSample).toHaveBeenCalledWith(FRAME_TOTAL_STAGE, 1.4);
  });
});
