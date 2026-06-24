/**
 * ADR-508 — `linear-member-face-snap` (pure, axis-relative) generic core.
 *
 * Ίδια συμπεριφορά με το ADR-398 beam-to-beam (το δοκάρι κάνει re-export alias αυτού), αλλά
 * δοκιμασμένη στα generic ονόματα ώστε ο πυρήνας να έχει δική του κάλυψη ανεξάρτητα από τα
 * beam/wall aliases. Fixtures: scene units = mm. Μέλος οριζόντιο (0,0)→(10000,0), πλάτος 200.
 */

import {
  resolveLinearMemberFaceSnap,
  isMemberCollinearOverlap,
  type LinearMemberSnapTarget,
  type LinearMemberFaceSnapOptions,
} from '../linear-member-face-snap';

/** Οριζόντιο μέλος μήκους 10000, πλάτος 200 (μακριές παρειές y=±100). */
const HORIZONTAL: LinearMemberSnapTarget = {
  id: 'm1',
  axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
  outline: [
    { x: 0, y: -100 }, { x: 10000, y: -100 },
    { x: 10000, y: 100 }, { x: 0, y: 100 },
  ],
};

const OPTS: LinearMemberFaceSnapOptions = { ghostLenScene: 1200, captureScene: 600, memberWidthScene: 200 };

describe('resolveLinearMemberFaceSnap — κατευθυντικό status + γεωμετρία', () => {
  it('Βόρεια, ΜΕΣΑΙΟ τρίτο → 🟢 flush βόρεια (y=+100), κεντραρισμένο, ghost +y', () => {
    const r = resolveLinearMemberFaceSnap({ x: 5000, y: 150 }, [HORIZONTAL], OPTS);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: 5000, y: 100 });
    expect(r!.end).toEqual({ x: 5000, y: 1300 });
  });

  it('Βόρεια, ΑΡΙΣΤΕΡΟ τρίτο → μέλος ΔΕΞΙΑ του cursor (centerline +half = x+100)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 2000, y: 150 }, [HORIZONTAL], OPTS);
    expect(r!.start).toEqual({ x: 2100, y: 100 });
  });

  it('Βόρεια, ΔΕΞΙ τρίτο → μέλος ΑΡΙΣΤΕΡΑ του cursor (centerline −half = x−100)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 8000, y: 150 }, [HORIZONTAL], OPTS);
    expect(r!.start).toEqual({ x: 7900, y: 100 });
  });

  it('Νότια → ΑΝΤΙΣΤΡΟΦΑ: αριστερό τρίτο → μέλος ΑΡΙΣΤΕΡΑ (centerline −half = x−100)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 2000, y: -150 }, [HORIZONTAL], OPTS);
    expect(r!.status).toBe('beam');
    expect(r!.start).toEqual({ x: 1900, y: -100 });
    expect(r!.end).toEqual({ x: 1900, y: -1300 });
  });

  it('Κέντρο άξονα → 🟢 + auto-snap στην πλησιέστερη παρειά', () => {
    const r = resolveLinearMemberFaceSnap({ x: 5000, y: 0 }, [HORIZONTAL], OPTS);
    expect(r!.status).toBe('beam');
    expect(Math.abs(r!.start.y)).toBe(100);
  });

  it('Ανατολική κοντή άκρη → 🔴 overlap, συγγραμμική συνέχεια', () => {
    const r = resolveLinearMemberFaceSnap({ x: 10400, y: 0 }, [HORIZONTAL], OPTS);
    expect(r!.status).toBe('overlap');
    expect(r!.start).toEqual({ x: 10000, y: 0 });
    expect(r!.end).toEqual({ x: 11200, y: 0 });
  });

  it('Δυτική κοντή άκρη → 🔴 overlap, συνέχεια προς −x', () => {
    const r = resolveLinearMemberFaceSnap({ x: -400, y: 0 }, [HORIZONTAL], OPTS);
    expect(r!.status).toBe('overlap');
    expect(r!.end).toEqual({ x: -1200, y: 0 });
  });

  it('Μακριά από κάθε μέλος → null', () => {
    expect(resolveLinearMemberFaceSnap({ x: 5000, y: 5000 }, [HORIZONTAL], OPTS)).toBeNull();
  });

  it('Εκφυλισμένοι στόχοι (axis<2 ή outline<3) αγνοούνται → null', () => {
    const bad: LinearMemberSnapTarget = { id: 'x', axis: [{ x: 0, y: 0 }], outline: [] };
    expect(resolveLinearMemberFaceSnap({ x: 0, y: 0 }, [bad], OPTS)).toBeNull();
  });
});

describe('resolveLinearMemberFaceSnap — center/flush ΜΑΓΝΗΤΕΣ (ADR-508, Giorgio 2026-06-23)', () => {
  // Σενάριο bug: γραμμή-στόχος 250mm (zero-width band) + νέος τοίχος πλάτους 210mm (half=105).
  // ADR-508 (2026-06-24): proportional βήμα = W / round(L/1cm) = 210 / round(250/10=25) = 8.4mm·
  // ο magnet (radius=βήμα=8.4) κεντράρει cursor 122 → κέντρο 125 → κενά 20/20 (όχι 15/25). Σε μεγάλη
  // παρειά το βήμα γίνεται ~1mm → magnet αμελητέος → ομαλή ολίσθηση (αυτο-κλιμακώνεται).
  const LINE25: LinearMemberSnapTarget = {
    id: 'L',
    axis: [{ x: 0, y: 0 }, { x: 250, y: 0 }],
    outline: [{ x: 0, y: -0.25 }, { x: 250, y: -0.25 }, { x: 250, y: 0.25 }, { x: 0, y: 0.25 }],
  };
  const W = 210; // πλάτος τοίχου, half = 105
  const noStep: LinearMemberFaceSnapOptions = { ghostLenScene: 1200, captureScene: 600, memberWidthScene: W };
  const withStep: LinearMemberFaceSnapOptions = { ...noStep, dominantUnitScene: 10 };

  it('ΧΩΡΙΣ slide step (δοκάρι) → centerline ακολουθεί cursor (συνεχές, αμετάβλητο)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 122, y: 3 }, [LINE25], noStep);
    expect(r!.status).toBe('beam');
    expect(r!.start.x).toBeCloseTo(122, 6);
  });

  it('ΜΕ slide step (τοίχος): cursor 122 κοντά στο μέσο → ΜΑΓΝΗΤΗΣ κέντρου 125 (κεντράρει, όχι 120)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 122, y: 3 }, [LINE25], withStep);
    expect(r!.start.x).toBeCloseTo(125, 6); // κέντρο γραμμής → 20mm/20mm κενά (όχι 15/25)
  });

  it('ΜΕ slide step: cursor κοντά στην αρχή → ΜΑΓΝΗΤΗΣ flush (centerline = alongMin+half = 105)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 4, y: 3 }, [LINE25], withStep);
    expect(r!.start.x).toBeCloseTo(105, 6);
  });

  it('ΜΕ slide step: cursor κοντά στο τέλος → ΜΑΓΝΗΤΗΣ flush (centerline = alongMax−half = 145)', () => {
    const r = resolveLinearMemberFaceSnap({ x: 246, y: 3 }, [LINE25], withStep);
    expect(r!.start.x).toBeCloseTo(145, 6);
  });

  it('ΜΑΚΡΙΑ από κάθε μαγνήτη → ελεύθερη ολίσθηση (δεν επιβάλλει anchor)', () => {
    // Γραμμή 1000mm· μέλος 200· βήμα = 200/round(1000/10=100) = 2mm· anchors=100/500/900. cursor 400
    // (μεσαίο τρίτο, 100mm από το κέντρο) → πέρα από radius=2 → centerline = 400, όχι μαγνήτης.
    const LONG: LinearMemberSnapTarget = {
      id: 'L2', axis: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
      outline: [{ x: 0, y: -0.25 }, { x: 1000, y: -0.25 }, { x: 1000, y: 0.25 }, { x: 0, y: 0.25 }],
    };
    const opt: LinearMemberFaceSnapOptions = { ghostLenScene: 1200, captureScene: 600, memberWidthScene: 200, dominantUnitScene: 10 };
    const r = resolveLinearMemberFaceSnap({ x: 400, y: 3 }, [LONG], opt);
    expect(r!.start.x).toBeCloseTo(400, 6);
  });
});

describe('isMemberCollinearOverlap — ΑΠΑΓΟΡΕΥΣΗ ομοαξονικού/πάνω σε υφιστάμενο', () => {
  it('ομοαξονικό ΠΑΝΩ στο σώμα → true', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 0 }, { x: 8000, y: 0 }, [HORIZONTAL])).toBe(true);
  });

  it('κάθετο Τ-framing (⊥) → false', () => {
    expect(isMemberCollinearOverlap({ x: 5000, y: -2000 }, { x: 5000, y: 2000 }, [HORIZONTAL])).toBe(false);
  });

  it('παράλληλο ΔΙΠΛΑ → false', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 500 }, { x: 8000, y: 500 }, [HORIZONTAL])).toBe(false);
  });

  it('άκρο-με-άκρο άγγιγμα → false (νόμιμη επέκταση)', () => {
    expect(isMemberCollinearOverlap({ x: 10000, y: 0 }, { x: 16000, y: 0 }, [HORIZONTAL])).toBe(false);
  });

  it('μερική επικάλυψη στο άκρο → true', () => {
    expect(isMemberCollinearOverlap({ x: 9000, y: 0 }, { x: 15000, y: 0 }, [HORIZONTAL])).toBe(true);
  });

  it('κανένας στόχος → false', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 0 }, { x: 8000, y: 0 }, [])).toBe(false);
  });

  it('εκφυλισμένο νέο (start==end) → false', () => {
    expect(isMemberCollinearOverlap({ x: 5000, y: 0 }, { x: 5000, y: 0 }, [HORIZONTAL])).toBe(false);
  });
});

describe('isMemberCollinearOverlap — body-overlap τοίχου (newHalfScene, ADR-508 face-anchored)', () => {
  const NEW_HALF = 100; // νέος τοίχος πάχους 200

  it('άξονας στην ΠΑΡΕΙΑ (y=100) ΧΩΡΙΣ newHalf → false (backward-compat, beam path)', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 100 }, { x: 8000, y: 100 }, [HORIZONTAL])).toBe(false);
  });

  it('άξονας στην ΠΑΡΕΙΑ (y=100) ΜΕ newHalf → true (το σώμα επικαλύπτει)', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 100 }, { x: 8000, y: 100 }, [HORIZONTAL], NEW_HALF)).toBe(true);
  });

  it('παράλληλο ΔΙΠΛΑ με κενό (y=500) ΜΕ newHalf → false (faces μακριά)', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 500 }, { x: 8000, y: 500 }, [HORIZONTAL], NEW_HALF)).toBe(false);
  });

  it('faces ΑΓΓΙΖΟΥΝ (y=200, near-face=y=100) → false (άγγιγμα, όχι επικάλυψη)', () => {
    expect(isMemberCollinearOverlap({ x: 2000, y: 200 }, { x: 8000, y: 200 }, [HORIZONTAL], NEW_HALF)).toBe(false);
  });

  it('άκρο-με-άκρο (διαμήκης 0) στην παρειά ΜΕ newHalf → false (νόμιμη επέκταση)', () => {
    expect(isMemberCollinearOverlap({ x: 10000, y: 100 }, { x: 16000, y: 100 }, [HORIZONTAL], NEW_HALF)).toBe(false);
  });
});
