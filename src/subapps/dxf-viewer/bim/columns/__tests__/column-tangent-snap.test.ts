/**
 * column-tangent-snap — ADR-398 §3.19 circumference-tangent κυκλικής κολόνας.
 *
 * Επαληθεύει ότι, με κυκλικό φάντασμα ακτίνας R, η **περιφέρεια** εφάπτεται σε άξονα (#4) / παρειά (#3)
 * τοίχου — auto-candidates μέσω του nearest-wins — ΧΩΡΙΣ να αλλάζουν τα center modes (#1/#2) ή η
 * συμπεριφορά μη-κυκλικών κολόνων (gated `circleRadiusScene`).
 */

import { resolveColumnFaceSnapFromTargets } from '../column-face-snap';
import type { PolarDiskSnapOptions } from '../polar-disk-snap';
import { collectSceneSnapTargets } from '../../framing/scene-snap-targets';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

// ── Fixtures (scene units = mm → factor 1) ───────────────────────────────────

/** Οριζόντιος τοίχος: άξονας y=0 (x −1000..1000), πάχος 200 → παρειές y=±100. */
function horizontalWall(id = 'wall-h'): Entity {
  return {
    id,
    type: 'wall',
    geometry: {
      axisPolyline: { points: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }] },
      outerEdge: { points: [{ x: -1000, y: 100 }, { x: 1000, y: 100 }] },
      innerEdge: { points: [{ x: -1000, y: -100 }, { x: 1000, y: -100 }] },
    },
  } as unknown as Entity;
}

const SQRT1_2 = Math.SQRT1_2;

/** Λοξός τοίχος 45°: άξονας (0,0)→(1000,1000), πάχος 200 → παρειές offset ±100 κατά perp=(1/√2,−1/√2). */
function slantedWall(id = 'wall-45'): Entity {
  const px = 100 * SQRT1_2; // 70.71
  return {
    id,
    type: 'wall',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 1000, y: 1000 }] },
      outerEdge: { points: [{ x: px, y: -px }, { x: 1000 + px, y: 1000 - px }] },
      innerEdge: { points: [{ x: -px, y: px }, { x: 1000 - px, y: 1000 + px }] },
    },
  } as unknown as Entity;
}

/** opts με R (κυκλικό φάντασμα)· worldPerPixel 0 → polar/rect tiers ανενεργά (απομονώνει tangent). */
const circularOpts = (radius: number): PolarDiskSnapOptions => ({ worldPerPixel: 0, circleRadiusScene: radius });

const snapWall = (cursor: Point2D, opts?: PolarDiskSnapOptions) =>
  resolveColumnFaceSnapFromTargets(cursor, collectSceneSnapTargets([horizontalWall()]), 'mm', opts);

/** Κάθετη απόσταση σημείου από τον άξονα y=0 = |y|. */
const distToAxisY0 = (p: Point2D): number => Math.abs(p.y);

describe('ADR-398 §3.19 — circumference-tangent σε ΟΡΙΖΟΝΤΙΟ τοίχο (άξονας y=0, παρειές y=±100)', () => {
  const R = 200;

  it('#4 περιφέρεια→άξονας: cursor y=200 → κέντρο y≈200 (κύκλος εφάπτεται στον άξονα), anchor center', () => {
    const s = snapWall({ x: 0, y: 200 }, circularOpts(R));
    expect(s).not.toBeNull();
    expect(s!.position.y).toBeCloseTo(200, 3);
    expect(s!.position.x).toBeCloseTo(0, 3);
    expect(s!.anchor).toBe('center');
    expect(distToAxisY0(s!.position)).toBeCloseTo(R, 3); // περιφέρεια αγγίζει τον άξονα
  });

  it('#4 κάτω πλευρά: cursor y=−200 → κέντρο y≈−200 (offset προς την πλευρά του cursor)', () => {
    const s = snapWall({ x: 0, y: -200 }, circularOpts(R));
    expect(s!.position.y).toBeCloseTo(-200, 3);
    expect(s!.anchor).toBe('center');
  });

  it('#3 περιφέρεια→παρειά: cursor y=300 → κέντρο y≈300 (κύκλος εφάπτεται στην παρειά y≈100)', () => {
    const s = snapWall({ x: 0, y: 300 }, circularOpts(R));
    // Η παρειά από `collectFootprintEdgeTargets` μπορεί να διαφέρει ~2mm από το bbox (διαφορετική πηγή).
    expect(Math.abs(s!.position.y - 300)).toBeLessThan(5);
    expect(s!.anchor).toBe('center');
  });

  it('#2 ΑΜΕΤΑΒΛΗΤΟ: cursor y=0 (πάνω στον άξονα) → κέντρο→άξονας νικά (y≈0), ΟΧΙ tangent', () => {
    const s = snapWall({ x: 0, y: 0 }, circularOpts(R));
    expect(s!.position.y).toBeCloseTo(0, 3);
    expect(s!.anchor).toBe('center');
  });

  it('#1 ΑΜΕΤΑΒΛΗΤΟ: cursor y=100 (πάνω στην παρειά) → κέντρο→παρειά νικά (y≈100), ΟΧΙ tangent', () => {
    const s = snapWall({ x: 0, y: 100 }, circularOpts(R));
    expect(s!.position.y).toBeCloseTo(100, 3);
  });
});

describe('ADR-398 §3.19 — gating (μηδέν regression χωρίς R)', () => {
  it('ΧΩΡΙΣ circleRadiusScene: cursor y=300 → flush στην παρειά (y≈100), ΟΧΙ tangent', () => {
    const s = snapWall({ x: 0, y: 300 }); // καθόλου opts → μη-κυκλικό
    expect(s!.position.y).toBeCloseTo(100, 3);
  });

  it('circleRadiusScene=0: αμετάβλητο (flush y≈100)', () => {
    const s = snapWall({ x: 0, y: 300 }, { worldPerPixel: 0, circleRadiusScene: 0 });
    expect(s!.position.y).toBeCloseTo(100, 3);
  });

  it('ΜΕ R: ίδιος cursor y=300 → tangent (y≈300) — αντίθεση που αποδεικνύει το gating', () => {
    const s = snapWall({ x: 0, y: 300 }, circularOpts(200));
    expect(Math.abs(s!.position.y - 300)).toBeLessThan(5);
  });
});

describe('ADR-398 §3.19 — ΛΟΞΟΣ τοίχος 45° (tangent σε κάθε γωνία)', () => {
  const R = 200;
  // perp μοναδιαία του άξονα u=(1/√2,1/√2) → (1/√2,−1/√2). Foot (500,500), offset +R·perp.
  const foot: Point2D = { x: 500, y: 500 };
  const perp: Point2D = { x: SQRT1_2, y: -SQRT1_2 };
  const cursorAtTangent: Point2D = { x: foot.x + R * perp.x, y: foot.y + R * perp.y };

  /** Κάθετη απόσταση σημείου από τον λοξό άξονα (a=(0,0), u=(1/√2,1/√2)). */
  const distToSlantAxis = (p: Point2D): number => Math.abs(p.x * SQRT1_2 - p.y * SQRT1_2);

  it('#4 περιφέρεια→λοξό άξονα: κέντρο offset κατά R κατά την 45° κάθετο (περιφέρεια αγγίζει τον άξονα)', () => {
    const targets = collectSceneSnapTargets([slantedWall()]);
    const s = resolveColumnFaceSnapFromTargets(cursorAtTangent, targets, 'mm', circularOpts(R));
    expect(s).not.toBeNull();
    expect(s!.anchor).toBe('center');
    expect(distToSlantAxis(s!.position)).toBeCloseTo(R, 2); // εφάπτεται στον λοξό άξονα
    expect(s!.position.x).toBeCloseTo(cursorAtTangent.x, 2);
    expect(s!.position.y).toBeCloseTo(cursorAtTangent.y, 2);
  });
});
