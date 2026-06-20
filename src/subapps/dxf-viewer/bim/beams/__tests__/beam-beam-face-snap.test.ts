/**
 * ADR-398 §beam-to-beam framing — `beam-beam-face-snap` (pure, axis-relative).
 *
 * Επαληθεύει το κατευθυντικό 🟢/🔴 + τη γεωμετρία: cursor σε **μακριά παρειά** (Β/Ν) →
 * 🟢 κάθετο Τ-framing flush στην πλησιέστερη παρειά· cursor σε **κοντή άκρη** (Α/Δ) →
 * 🔴 συγγραμμική συνέχεια· κέντρο άξονα → 🟢 + πλησιέστερη παρειά (απόφαση «Α»).
 * Fixtures: scene units = mm. Δοκάρι οριζόντιο (0,0)→(10000,0), πλάτος 200.
 */

import {
  resolveBeamBeamFaceSnap,
  isBeamCollinearOverlap,
  type BeamSnapTarget,
  type BeamBeamFaceSnapOptions,
} from '../beam-beam-face-snap';

/** Οριζόντιο δοκάρι μήκους 10000, πλάτος 200 (μακριές παρειές y=±100). */
const HORIZONTAL: BeamSnapTarget = {
  id: 'b1',
  axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
  outline: [
    { x: 0, y: -100 }, { x: 10000, y: -100 },
    { x: 10000, y: 100 }, { x: 0, y: 100 },
  ],
};

const OPTS: BeamBeamFaceSnapOptions = { ghostLenScene: 1200, captureScene: 600, beamWidthScene: 200 };

describe('resolveBeamBeamFaceSnap — κατευθυντικό status + γεωμετρία', () => {
  it('Βόρεια, ΜΕΣΑΙΟ τρίτο → 🟢 flush βόρεια (y=+100), κεντραρισμένο (x=cursor), ghost +y', () => {
    const r = resolveBeamBeamFaceSnap({ x: 5000, y: 150 }, [HORIZONTAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: 5000, y: 100 }); // mid → χωρίς μετατόπιση
    expect(r!.end).toEqual({ x: 5000, y: 1300 });
  });

  it('Βόρεια, ΑΡΙΣΤΕΡΟ τρίτο → δοκάρι ΔΕΞΙΑ του cursor (centerline +half = x+100)', () => {
    const r = resolveBeamBeamFaceSnap({ x: 2000, y: 150 }, [HORIZONTAL], OPTS);
    expect(r!.start).toEqual({ x: 2100, y: 100 }); // cursor=αριστερή ακμή, δοκάρι δεξιά
  });

  it('Βόρεια, ΔΕΞΙ τρίτο → δοκάρι ΑΡΙΣΤΕΡΑ του cursor (centerline −half = x−100)', () => {
    const r = resolveBeamBeamFaceSnap({ x: 8000, y: 150 }, [HORIZONTAL], OPTS);
    expect(r!.start).toEqual({ x: 7900, y: 100 }); // cursor=δεξιά ακμή, δοκάρι αριστερά
  });

  it('Νότια → ΑΝΤΙΣΤΡΟΦΑ: αριστερό τρίτο → δοκάρι ΑΡΙΣΤΕΡΑ (centerline −half = x−100)', () => {
    const r = resolveBeamBeamFaceSnap({ x: 2000, y: -150 }, [HORIZONTAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: 1900, y: -100 }); // νότια flush + αντίστροφη μετατόπιση
    expect(r!.end).toEqual({ x: 1900, y: -1300 });
  });

  it('Κέντρο άξονα → 🟢 beam + auto-snap στην πλησιέστερη παρειά (απόφαση «Α»)', () => {
    const r = resolveBeamBeamFaceSnap({ x: 5000, y: 0 }, [HORIZONTAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    // Στο τέλειο κέντρο (perp=0) η ισοπαλία πάει ντετερμινιστικά σε μία παρειά.
    expect(Math.abs(r!.start.y)).toBe(100);
  });

  it('Ανατολική κοντή άκρη (πέρα από το άκρο) → 🔴 overlap, συγγραμμική συνέχεια', () => {
    const r = resolveBeamBeamFaceSnap({ x: 10400, y: 0 }, [HORIZONTAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('overlap');
    expect(r!.start).toEqual({ x: 10000, y: 0 });
    expect(r!.end).toEqual({ x: 11200, y: 0 });
  });

  it('Δυτική κοντή άκρη → 🔴 overlap, συνέχεια προς −x', () => {
    const r = resolveBeamBeamFaceSnap({ x: -400, y: 0 }, [HORIZONTAL], OPTS);
    expect(r!.status).toBe('overlap');
    expect(r!.start).toEqual({ x: 0, y: 0 });
    expect(r!.end).toEqual({ x: -1200, y: 0 });
  });

  it('Μακριά από κάθε δοκάρι (πέρα από capture) → null (ελεύθερη κίνηση)', () => {
    expect(resolveBeamBeamFaceSnap({ x: 5000, y: 5000 }, [HORIZONTAL], OPTS)).toBeNull();
  });

  it('Εκφυλισμένοι στόχοι (axis<2 ή outline<3) αγνοούνται → null', () => {
    const bad: BeamSnapTarget = { id: 'x', axis: [{ x: 0, y: 0 }], outline: [] };
    expect(resolveBeamBeamFaceSnap({ x: 0, y: 0 }, [bad], OPTS)).toBeNull();
  });
});

describe('isBeamCollinearOverlap — ΑΠΑΓΟΡΕΥΣΗ ομοαξονικού/πάνω σε υφιστάμενο', () => {
  it('ομοαξονικό ΠΑΝΩ στο σώμα → true', () => {
    expect(isBeamCollinearOverlap({ x: 2000, y: 0 }, { x: 8000, y: 0 }, [HORIZONTAL])).toBe(true);
  });

  it('κάθετο Τ-framing (⊥) → false (όχι παράλληλο)', () => {
    expect(isBeamCollinearOverlap({ x: 5000, y: -2000 }, { x: 5000, y: 2000 }, [HORIZONTAL])).toBe(false);
  });

  it('παράλληλο ΔΙΠΛΑ (offset > half-widths) → false', () => {
    expect(isBeamCollinearOverlap({ x: 2000, y: 500 }, { x: 8000, y: 500 }, [HORIZONTAL])).toBe(false);
  });

  it('άκρο-με-άκρο άγγιγμα (μηδέν επικάλυψη) → false (νόμιμη επέκταση)', () => {
    expect(isBeamCollinearOverlap({ x: 10000, y: 0 }, { x: 16000, y: 0 }, [HORIZONTAL])).toBe(false);
  });

  it('μερική επικάλυψη στο άκρο → true', () => {
    expect(isBeamCollinearOverlap({ x: 9000, y: 0 }, { x: 15000, y: 0 }, [HORIZONTAL])).toBe(true);
  });

  it('κανένας στόχος → false', () => {
    expect(isBeamCollinearOverlap({ x: 2000, y: 0 }, { x: 8000, y: 0 }, [])).toBe(false);
  });

  it('εκφυλισμένο νέο (start==end) → false', () => {
    expect(isBeamCollinearOverlap({ x: 5000, y: 0 }, { x: 5000, y: 0 }, [HORIZONTAL])).toBe(false);
  });
});
