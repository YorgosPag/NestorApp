/**
 * Δίχτυ χαρακτηρισμού για τα δύο πρωτόγονα «σημείο ↔ ευθύγραμμο τμήμα».
 *
 * ── Γιατί υπάρχει ───────────────────────────────────────────────────────────────────────────
 * Η `pointToSegmentDistance` είχε **ΜΗΔΕΝ tests** (μετρημένο 2026-08-05) ενώ αποφασίζει:
 *   • ποιον οδηγό πιάνει το κλικ (`GuideStore.findNearestGuide`)
 *   • σε ποια πλευρά πέφτει το offset (`systems/offset/offset-side.ts`)
 *   • ποια όψη φινιρίσματος επιλέγεται (`bim/finishes/finish-face-pick-2d.ts`)
 *   • **αν βολή τοπογράφου κάθεται επί του ορίου του οικοπέδου** (ADR-730 · το εργοτάξιο
 *     του ADR-725 έχει 10 βολές ≤5 cm από τη γραμμή)
 *
 * ── Γιατί εισάγει από το ΠΑΛΙΟ μονοπάτι ─────────────────────────────────────────────────────
 * Το αρχείο γράφτηκε **πριν** την προαγωγή των συναρτήσεων στο `utils/segment-distance.ts` και
 * μένει **αναλλοίωτο** μετά από αυτήν: εισάγει από `systems/guides/guide-types` (που πλέον
 * κάνει re-export). Το ότι περνά **και πριν και μετά, χωρίς να αλλάξει byte**, *είναι* η
 * απόδειξη μηδενικής αλλαγής συμπεριφοράς — όχι η δήλωσή μου ότι «απλώς μετακίνησα κώδικα».
 *
 * @see ADR-189 · ADR-730 · `.claude-rules/pending-ratchet-work.md`
 */

import {
  pointToSegmentDistance,
  projectPointOnSegment,
} from '../../systems/guides/guide-types';
import type { Point2D } from '../../rendering/types/Types';

const p = (x: number, y: number): Point2D => ({ x, y });

describe('pointToSegmentDistance — χαρακτηρισμός', () => {
  it('σημείο ΠΑΝΩ στο τμήμα ⇒ 0', () => {
    expect(pointToSegmentDistance(p(5, 0), p(0, 0), p(10, 0))).toBe(0);
    expect(pointToSegmentDistance(p(0, 0), p(0, 0), p(10, 0))).toBe(0);
    expect(pointToSegmentDistance(p(10, 0), p(0, 0), p(10, 0))).toBe(0);
  });

  it('κάθετη απόσταση όταν η προβολή πέφτει ΜΕΣΑ στο τμήμα', () => {
    expect(pointToSegmentDistance(p(5, 3), p(0, 0), p(10, 0))).toBeCloseTo(3, 12);
    expect(pointToSegmentDistance(p(-4, 5), p(0, 0), p(0, 10))).toBeCloseTo(4, 12);
  });

  it('🔑 πέρα από το άκρο ⇒ απόσταση ΣΤΟ ΑΚΡΟ (clamped), όχι στην άπειρη ευθεία', () => {
    // Η άπειρη ευθεία y=0 θα έδινε 3· το τμήμα [0,10] δίνει hypot(5,3).
    expect(pointToSegmentDistance(p(15, 3), p(0, 0), p(10, 0))).toBeCloseTo(Math.hypot(5, 3), 12);
    expect(pointToSegmentDistance(p(-5, 3), p(0, 0), p(10, 0))).toBeCloseTo(Math.hypot(5, 3), 12);
  });

  it('εκφυλισμένο τμήμα (a === b) ⇒ ευκλείδεια απόσταση από το σημείο, ποτέ NaN', () => {
    const d = pointToSegmentDistance(p(3, 4), p(0, 0), p(0, 0));
    expect(d).toBeCloseTo(5, 12);
    expect(Number.isNaN(d)).toBe(false);
  });

  it('διαγώνιο τμήμα — κλασική 3-4-5 γεωμετρία', () => {
    // Τμήμα (0,0)→(4,3), σημείο (0,5): προβολή στο t = 9/25 ⇒ απόσταση 4.
    expect(pointToSegmentDistance(p(0, 5), p(0, 0), p(4, 3))).toBeCloseTo(4, 12);
  });

  it('συμμετρία: η φορά του τμήματος ΔΕΝ αλλάζει την απόσταση', () => {
    const a = p(0, 0);
    const b = p(10, 4);
    const q = p(3, 9);
    expect(pointToSegmentDistance(q, a, b)).toBeCloseTo(pointToSegmentDistance(q, b, a), 12);
  });
});

describe('projectPointOnSegment — χαρακτηρισμός', () => {
  it('t = 0 / 1 στα άκρα, 0.5 στο μέσο', () => {
    expect(projectPointOnSegment(p(0, 7), p(0, 0), p(10, 0)).t).toBeCloseTo(0, 12);
    expect(projectPointOnSegment(p(10, 7), p(0, 0), p(10, 0)).t).toBeCloseTo(1, 12);
    expect(projectPointOnSegment(p(5, 7), p(0, 0), p(10, 0)).t).toBeCloseTo(0.5, 12);
  });

  it('🔑 το t είναι clamped στο [0,1] — η προβολή δεν βγαίνει ποτέ εκτός τμήματος', () => {
    const before = projectPointOnSegment(p(-50, 7), p(0, 0), p(10, 0));
    expect(before.t).toBe(0);
    expect(before.snapPoint).toEqual({ x: 0, y: 0 });

    const after = projectPointOnSegment(p(50, 7), p(0, 0), p(10, 0));
    expect(after.t).toBe(1);
    expect(after.snapPoint).toEqual({ x: 10, y: 0 });
  });

  it('εκφυλισμένο τμήμα ⇒ t = 0, snapPoint = ΑΝΤΙΓΡΑΦΟ του άκρου (όχι η ίδια αναφορά)', () => {
    const start = p(2, 2);
    const r = projectPointOnSegment(p(5, 6), start, p(2, 2));
    expect(r.t).toBe(0);
    expect(r.snapPoint).toEqual({ x: 2, y: 2 });
    // Κρίσιμο: ο καλών μετακινεί λαβές — κοινή αναφορά θα μόλυνε το ίδιο το τμήμα.
    expect(r.snapPoint).not.toBe(start);
    expect(r.distance).toBeCloseTo(5, 12);
  });

  it('🔑 ΣΥΜΦΩΝΙΑ ΤΩΝ ΔΥΟ ΣΩΜΑΤΩΝ: .distance === pointToSegmentDistance για κάθε δείγμα', () => {
    const segments: readonly (readonly [Point2D, Point2D])[] = [
      [p(0, 0), p(10, 0)],
      [p(0, 0), p(0, 10)],
      [p(-3, -7), p(4, 11)],
      [p(2, 2), p(2, 2)], // εκφυλισμένο
    ];
    const probes = [p(0, 0), p(5, 5), p(-20, 3), p(100, -100), p(2, 2), p(3.5, -0.25)];

    for (const [a, b] of segments) {
      for (const q of probes) {
        expect(projectPointOnSegment(q, a, b).distance).toBeCloseTo(
          pointToSegmentDistance(q, a, b),
          12,
        );
      }
    }
  });

  it('το snapPoint κάθεται πράγματι πάνω στο τμήμα (a + t·(b−a))', () => {
    const a = p(1, 1);
    const b = p(9, 5);
    const r = projectPointOnSegment(p(4, 8), a, b);
    expect(r.snapPoint.x).toBeCloseTo(a.x + r.t * (b.x - a.x), 12);
    expect(r.snapPoint.y).toBeCloseTo(a.y + r.t * (b.y - a.y), 12);
  });
});
