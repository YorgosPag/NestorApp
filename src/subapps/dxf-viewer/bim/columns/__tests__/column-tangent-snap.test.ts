/**
 * column-tangent-snap — ADR-398 §3.19 circumference-tangent κυκλικής κολόνας.
 *
 * Επαληθεύει ότι, με κυκλικό φάντασμα ακτίνας R, η **περιφέρεια** εφάπτεται σε άξονα (#4) / παρειά (#3)
 * τοίχου — auto-candidates μέσω του nearest-wins — ΧΩΡΙΣ να αλλάζουν τα center modes (#1/#2) ή η
 * συμπεριφορά μη-κυκλικών κολόνων (gated `circleRadiusScene`).
 */

import { resolveColumnFaceSnapFromTargets } from '../column-face-snap';
import type { PolarDiskSnapOptions } from '../polar-disk-snap';
import { resolveGhostFaceDimensions } from '../../framing/ghost-face-dim-references';
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

describe('ADR-398 §3.20b — ΚΑΘΕΤΗ (dy) CL ένδειξη (πλήρες καρτεσιανό)', () => {
  const R = 200;

  it('#4 tangent→άξονας: faceFrame κουβαλά ghostPerpOffset = ±R (κέντρο εφάπτεται στον άξονα)', () => {
    const s = snapWall({ x: 0, y: 200 }, circularOpts(R));
    expect(Math.abs(s!.faceFrame.ghostPerpOffset ?? 0)).toBeCloseTo(R, 3);
  });

  it('resolveGhostFaceDimensions εκπέμπει κάθετη (perp) dim ίση με R', () => {
    const s = snapWall({ x: 0, y: 200 }, circularOpts(R));
    const dims = resolveGhostFaceDimensions(s!.faceFrame, { gapOffsetScene: 50, centerOffsetScene: 100 });
    const perp = dims.find((d) => d.kind === 'perp');
    expect(perp).toBeDefined();
    expect(perp!.valueScene).toBeCloseTo(R, 3);
  });

  it('μη-tangent (center-on-axis) → ΚΑΜΙΑ κάθετη dim (ghostPerpOffset undefined)', () => {
    const s = snapWall({ x: 0, y: 0 }, circularOpts(R)); // κέντρο στον άξονα → perp 0
    const dims = resolveGhostFaceDimensions(s!.faceFrame, { gapOffsetScene: 50, centerOffsetScene: 100 });
    expect(dims.find((d) => d.kind === 'perp')).toBeUndefined();
  });
});

describe('ADR-398 §3.20 — quadrant-to-end alignment (τεταρτημόριο ↔ άκρο/μέσον παρειάς)', () => {
  const R = 200;
  // Τοίχος δυτικό άκρο world x=-1000, ανατολικό x=+1000 (axis a=(-1000,0), along 0..2000).

  it('Δ-τεταρτημόριο ↔ δυτικό άκρο: cursor (-800,200) → κέντρο x≈-800, δυτικό ακραίο σημείο=x=-1000', () => {
    const s = snapWall({ x: -800, y: 200 }, circularOpts(R));
    expect(s).not.toBeNull();
    expect(s!.position.x).toBeCloseTo(-800, 3);          // κέντρο
    expect(s!.position.x - R).toBeCloseTo(-1000, 3);     // δυτικό ακραίο σημείο ≡ δυτική παρειά
    expect(s!.anchor).toBe('center');
    expect(s!.alignmentGuide).toBeDefined();
    expect(s!.alignmentGuide!.a.x).toBeCloseTo(-1000, 3); // κατακόρυφη γραμμή-οδηγός στο δυτικό άκρο
    expect(s!.alignmentGuide!.b.x).toBeCloseTo(-1000, 3);
  });

  it('Α-τεταρτημόριο ↔ ανατολικό άκρο: cursor (800,200) → κέντρο x≈800, ανατολικό ακραίο σημείο=x=1000', () => {
    const s = snapWall({ x: 800, y: 200 }, circularOpts(R));
    expect(s!.position.x).toBeCloseTo(800, 3);
    expect(s!.position.x + R).toBeCloseTo(1000, 3);      // ανατολικό ακραίο σημείο ≡ ανατολική παρειά
    expect(s!.alignmentGuide!.a.x).toBeCloseTo(1000, 3);
  });

  it('κέντρο ↔ μέσον: cursor (0,200) → κέντρο x≈0 + γραμμή-οδηγός στο μέσον x=0', () => {
    const s = snapWall({ x: 0, y: 200 }, circularOpts(R));
    expect(s!.position.x).toBeCloseTo(0, 3);
    expect(s!.alignmentGuide!.a.x).toBeCloseTo(0, 3);
  });

  it('μακριά από άκρα/μέσον: cursor (-400,200) → ελεύθερο γλίστρημα, ΧΩΡΙΣ οδηγό', () => {
    const s = snapWall({ x: -400, y: 200 }, circularOpts(R));
    expect(s!.position.x).toBeCloseTo(-400, 3); // ελεύθερο (μακριά > ζώνη 60mm)
    expect(s!.alignmentGuide ?? null).toBeNull();
  });

  // §3.20c — οδηγός ΚΑΙ όταν το κέντρο είναι ΜΕΣΑ στο σώμα του τοίχου (center-on-axis), όχι μόνο tangent.
  it('§3.20c κέντρο ΜΕΣΑ στο σώμα (perp 0) + Α-τεταρτημόριο ↔ ανατ. άκρο → οδηγός', () => {
    const s = snapWall({ x: 800, y: 0 }, circularOpts(R)); // cursor στον άξονα, x=alongMax-R
    expect(s!.anchor).toBe('center');
    expect(s!.position.y).toBeCloseTo(0, 3);          // κέντρο στον άξονα (μέσα στο σώμα)
    expect(s!.position.x).toBeCloseTo(800, 3);        // Α-τεταρτημόριο (800+200=1000) στο ανατ. άκρο
    expect(s!.alignmentGuide).toBeDefined();
    expect(s!.alignmentGuide!.a.x).toBeCloseTo(1000, 3); // οδηγός στο ανατολικό άκρο
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

  // ADR-398 §3.18b — ΟΛΙΣΘΗΣΗ σε λοξό όπως σε οριζόντιο: η προσανατολισμένη bbox απόσταση σταματά το
  // spurious AABB-flush· σε off-ideal perp ο κύκλος εφάπτεται στη ΛΟΞΗ παρειά (perp-to-axis = halfThickness+R),
  // ΟΧΙ AABB junk. perp=300 (off-ideal, πάχος 200 → ημι=100, R=200 → tangent-to-face perp=300).
  it('§3.18b off-ideal perp σε λοξό → tangent στη λοξή παρειά (ΟΧΙ AABB flush)', () => {
    const targets = collectSceneSnapTargets([slantedWall()]);
    const perp: Point2D = { x: SQRT1_2, y: -SQRT1_2 };
    const cursor: Point2D = { x: 500 + 300 * perp.x, y: 500 + 300 * perp.y }; // perp=300 από τον άξονα
    const s = resolveColumnFaceSnapFromTargets(cursor, targets, 'mm', { worldPerPixel: 5, circleRadiusScene: R });
    expect(s!.anchor).toBe('center');                       // tangent (ΟΧΙ 'n'/'ne' AABB flush)
    // περιφέρεια εφάπτεται στη λοξή παρειά (perp ≈ ημι-πάχος+R ≈ 300)· tangent, ΟΧΙ flush(~100)/AABB junk.
    expect(distToSlantAxis(s!.position)).toBeGreaterThan(290);
    expect(distToSlantAxis(s!.position)).toBeLessThan(310);
  });
});
