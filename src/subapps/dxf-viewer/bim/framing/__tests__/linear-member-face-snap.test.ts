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
